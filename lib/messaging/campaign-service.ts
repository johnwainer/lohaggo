import type { MessagingCampaign, MessagingCampaignStatus, MessagingChannel, UserRole } from '@prisma/client'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { renderTextTemplate } from '@/lib/messaging/template'
import { sendMessageViaProvider, sendWhatsAppTemplate, sendMetaWhatsAppTemplate } from '@/lib/messaging/providers'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { resolveCampaignRecipients, resolveDestination } from '@/lib/messaging/campaign-recipients'

export async function processCampaign(campaignId: string) {
  const campaign = await prisma.messagingCampaign.findUnique({
    where: { id: campaignId },
    include: { template: true },
  })

  if (!campaign) {
    throw new Error('Campaign not found')
  }

  if (campaign.status === 'PROCESSING') {
    throw new Error('Campaign is already processing')
  }

  await prisma.messagingCampaign.update({
    where: { id: campaign.id },
    data: { status: 'PROCESSING', startedAt: new Date() },
  })

  const { users } = await resolveCampaignRecipients({
    targetRole: campaign.targetRole,
    targetCity: campaign.targetCity,
    metadata: campaign.metadata,
    take: 2000,
  })
  const runtimeConfig = await getMessagingProviderRuntimeConfig()

  // Parse campaign metadata once for all config below
  let campaignMeta: Record<string, unknown> = {}
  try { campaignMeta = JSON.parse(campaign.metadata ?? '{}') } catch { /* ignore */ }

  // WA Content Template metadata (WHATSAPP channel only)
  let waContentSid: string | null = null
  let waTemplateVariables: Record<string, string> = {}
  if (campaign.channel === 'WHATSAPP') {
    waContentSid = (campaignMeta.waContentSid as string) || null
    waTemplateVariables = (campaignMeta.waTemplateVariables as Record<string, string>) || {}
  }

  const magicLinkRedirectUrl = (campaignMeta.magicLinkRedirectUrl as string) || '/partner/dashboard'
  const magicLinkRequirePasswordChange = Boolean(campaignMeta.magicLinkRequirePasswordChange)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || ''

  // Determine if this campaign needs {{action_url}} resolved per user.
  const needsActionUrl =
    (campaign.customBody || campaign.template?.body || '').includes('{{action_url}}') ||
    (campaign.customSubject || campaign.template?.subject || '').includes('{{action_url}}') ||
    Object.values(waTemplateVariables).some((v) => v.includes('action_url'))

  const magicUrlByUser = new Map<string, string>()

  if (needsActionUrl && users.length > 0) {
    // Reuse existing valid tokens only when they match this campaign's redirect and banner config.
    const existingTokens = await prisma.magicToken.findMany({
      where: {
        userId: { in: users.map((u) => u.id) },
        usedAt: null,
        expiresAt: { gt: new Date() },
        redirectUrl: magicLinkRedirectUrl,
        requirePasswordChange: magicLinkRequirePasswordChange,
      },
      orderBy: { createdAt: 'desc' },
      select: { userId: true, token: true },
    })
    for (const t of existingTokens) {
      if (!magicUrlByUser.has(t.userId)) {
        magicUrlByUser.set(t.userId, `${appUrl}/auth/magic?token=${t.token}`)
      }
    }

    // Auto-generate tokens for users who don't have a matching valid one.
    const missingUserIds = users.map((u) => u.id).filter((id) => !magicUrlByUser.has(id))
    if (missingUserIds.length > 0) {
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000)
      await Promise.all(
        missingUserIds.map(async (userId) => {
          try {
            const token = randomBytes(32).toString('hex')
            await prisma.magicToken.create({
              data: { userId, token, redirectUrl: magicLinkRedirectUrl, requirePasswordChange: magicLinkRequirePasswordChange, expiresAt },
            })
            magicUrlByUser.set(userId, `${appUrl}/auth/magic?token=${token}`)
          } catch {
            // If auto-generation fails, the variable will be empty and caught below.
          }
        })
      )
    }
  }

  let sent = 0
  let failed = 0

  let contentMode: 'CUSTOM' | 'TEMPLATE' = 'TEMPLATE'
  if (campaign.metadata) {
    try {
      const parsed = JSON.parse(campaign.metadata) as { contentMode?: string }
      if (parsed.contentMode === 'CUSTOM') contentMode = 'CUSTOM'
    } catch {
      contentMode = 'TEMPLATE'
    }
  }

  const abConfig = campaign.abTestEnabled && campaign.abTestConfig
    ? (JSON.parse(campaign.abTestConfig) as {
        variants?: Array<{
          key: string
          subject?: string
          body: string
          allocation: number
        }>
      })
    : null

  function pickAbVariant(seed: string) {
    const variants = abConfig?.variants || []
    if (!variants.length) return null
    const total = variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.allocation || 0)), 0)
    if (total <= 0) return variants[0]
    let hash = 0
    for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 100000
    let roll = hash % total
    for (const variant of variants) {
      const weight = Math.max(0, Number(variant.allocation || 0))
      if (roll < weight) return variant
      roll -= weight
    }
    return variants[0]
  }

  for (const user of users) {
    const destination = resolveDestination(campaign.channel, user)
    if (!destination) {
      failed += 1
      await prisma.messagingDelivery.create({
        data: {
          campaignId: campaign.id,
          userId: user.id,
          channel: campaign.channel,
          destination: '',
          status: 'FAILED',
          provider: 'internal',
          errorCode: 'MISSING_DESTINATION',
          errorMessage: 'User does not have destination configured for this channel',
        },
      })
      continue
    }

    const optedOut = await prisma.messagingOptOut.findFirst({
      where: {
        channel: campaign.channel,
        isActive: true,
        OR: [{ destination }, { userId: user.id }],
      },
    })

    if (optedOut) {
      await prisma.messagingDelivery.create({
        data: {
          campaignId: campaign.id,
          userId: user.id,
          channel: campaign.channel,
          destination,
          status: 'UNSUBSCRIBED',
          provider: 'internal',
          errorCode: 'OPTOUT',
          errorMessage: 'Recipient opted out',
        },
      })
      continue
    }

    const variant = pickAbVariant(`${campaign.id}:${user.id}`)
    const bodyTemplate =
      variant?.body ||
      (contentMode === 'CUSTOM'
        ? campaign.customBody
        : campaign.template?.body || campaign.customBody)
    const subjectTemplate =
      variant?.subject ||
      (contentMode === 'CUSTOM'
        ? campaign.customSubject
        : campaign.template?.subject || campaign.customSubject)
    const userVars = {
      user_name: user.name,
      user_email: user.email,
      action_url: magicUrlByUser.get(user.id) ?? '',
    }
    const body = renderTextTemplate(bodyTemplate, userVars)
    const subject = subjectTemplate
      ? renderTextTemplate(subjectTemplate, userVars)
      : null

    // For WA Content Templates the body uses Twilio numbered vars ({{1}}, {{2}}).
    // Hoist resolvedVars so the inbox can render the body with merged keys.
    let resolvedVars: Record<string, string> = {}

    let result: Awaited<ReturnType<typeof sendMessageViaProvider>>
    if (campaign.channel === 'WHATSAPP' && waContentSid) {
      for (const [key, val] of Object.entries(waTemplateVariables)) {
        resolvedVars[key] = renderTextTemplate(val, userVars)
      }

      // Twilio rejects ContentVariables with empty strings — catch it before the API call
      // and give a clear error (most common cause: {{action_url}} with no magic token).
      const emptyKey = Object.entries(resolvedVars).find(([, v]) => !v.trim())
      if (emptyKey) {
        const isActionUrl = String(waTemplateVariables[emptyKey[0]] || '').includes('action_url')
        result = {
          ok: false,
          provider: 'twilio-whatsapp',
          errorCode: 'EMPTY_VARIABLE',
          errorMessage: isActionUrl
            ? `La variable {{${emptyKey[0]}}} (action_url) está vacía: genera magic links para este usuario antes de enviar.`
            : `La variable {{${emptyKey[0]}}} está vacía. Revisa las variables de la plantilla.`,
        }
      } else if (waContentSid.startsWith('meta:')) {
        // Format: meta:{templateName}:{language}
        const parts = waContentSid.split(':')
        const templateName = parts[1] ?? ''
        const language = parts[2] ?? 'es'
        result = await sendMetaWhatsAppTemplate(destination, templateName, language, resolvedVars, runtimeConfig.metaWhatsApp)
      } else {
        result = await sendWhatsAppTemplate(destination, waContentSid, resolvedVars, runtimeConfig.twilio)
      }
    } else {
      result = await sendMessageViaProvider(
        {
          channel: campaign.channel,
          to: destination,
          userId: user.id,
          subject,
          body,
          data: {
            notificationId: `${campaign.id}:${user.id}:${Date.now()}`,
            campaignId: campaign.id,
            campaignName: campaign.name,
            targetUrl: '/notifications',
          },
        },
        runtimeConfig
      )
    }

    await prisma.messagingDelivery.create({
      data: {
        campaignId: campaign.id,
        userId: user.id,
        channel: campaign.channel,
        destination,
        status: result.ok ? 'SENT' : 'FAILED',
        provider: result.provider,
        providerMessageId: result.providerMessageId || null,
        errorCode: result.errorCode || null,
        errorMessage: result.errorMessage || null,
        sentAt: result.ok ? new Date() : null,
        abVariant: variant?.key || null,
        metadata: JSON.stringify({
          ...(variant ? { abVariant: variant.key } : {}),
        }),
      },
    })

    // Track outbound campaign messages in the inbox conversation
    if (result.ok && (campaign.channel === 'SMS' || campaign.channel === 'WHATSAPP')) {
      try {
        // Re-render with merged vars so {{1}}/{{2}} WA template vars are also resolved
        const mergedBody = renderTextTemplate(bodyTemplate, { ...userVars, ...resolvedVars })
        const messageBody = mergedBody || (waContentSid ? `[Plantilla WhatsApp: ${waContentSid}]` : '')
        const normalizedPhone = (() => {
          const clean = (destination ?? '').replace(/[^\d+]/g, '')
          if (clean.startsWith('+')) return clean
          if (clean.startsWith('57')) return `+${clean}`
          return `+57${clean}`
        })()
        const conv = await prisma.conversation.upsert({
          where: { channel_contactPhone: { channel: campaign.channel, contactPhone: normalizedPhone } },
          create: {
            channel: campaign.channel,
            contactPhone: normalizedPhone,
            userId: user.id,
            contactName: user.name || null,
            status: 'OPEN',
            lastMessageAt: new Date(),
            lastMessageBody: messageBody.slice(0, 200),
            unreadCount: 0,
          },
          update: {
            lastMessageAt: new Date(),
            lastMessageBody: messageBody.slice(0, 200),
            userId: user.id,
            contactName: user.name || null,
          },
        })
        await prisma.conversationMessage.create({
          data: {
            conversationId: conv.id,
            direction: 'OUTBOUND',
            body: messageBody,
            providerMessageId: result.providerMessageId || null,
            status: 'SENT',
          },
        })
      } catch {
        // Conversation tracking must not block campaign delivery
      }
    }

    if (result.ok) sent += 1
    else failed += 1
  }

  const finalStatus: MessagingCampaignStatus =
    failed === 0 ? 'SENT' : sent === 0 ? 'FAILED' : 'PARTIAL'

  const totalsByStatus = await prisma.messagingDelivery.groupBy({
    by: ['status'],
    where: { campaignId: campaign.id },
    _count: { _all: true },
  })

  const totalSent = totalsByStatus.find((row) => row.status === 'SENT')?._count._all || 0
  const totalFailed = totalsByStatus.find((row) => row.status === 'FAILED')?._count._all || 0
  const totalRecipients = totalsByStatus.reduce((acc, row) => acc + row._count._all, 0)

  return prisma.messagingCampaign.update({
    where: { id: campaign.id },
    data: {
      status: finalStatus,
      totalRecipients,
      totalSent,
      totalFailed,
      completedAt: new Date(),
    },
  })
}

export type CampaignWithTemplate = MessagingCampaign & { template: { id: string } | null }
