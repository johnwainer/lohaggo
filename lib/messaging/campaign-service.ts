import type { MessagingCampaign, MessagingCampaignStatus, MessagingChannel, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { renderTextTemplate } from '@/lib/messaging/template'
import { sendMessageViaProvider, sendWhatsAppTemplate } from '@/lib/messaging/providers'
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

  // WA Content Template metadata (WHATSAPP channel only)
  let waContentSid: string | null = null
  let waTemplateVariables: Record<string, string> = {}
  if (campaign.channel === 'WHATSAPP') {
    try {
      const meta = JSON.parse(campaign.metadata ?? '{}') as {
        waContentSid?: string
        waTemplateVariables?: Record<string, string>
      }
      waContentSid = meta.waContentSid || null
      waTemplateVariables = meta.waTemplateVariables || {}
    } catch { /* ignore */ }
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
    const body = renderTextTemplate(bodyTemplate, {
      user_name: user.name,
      user_email: user.email,
    })
    const subject = subjectTemplate
      ? renderTextTemplate(subjectTemplate, { user_name: user.name, user_email: user.email })
      : null

    let result: Awaited<ReturnType<typeof sendMessageViaProvider>>
    if (campaign.channel === 'WHATSAPP' && waContentSid) {
      const resolvedVars: Record<string, string> = {}
      for (const [key, val] of Object.entries(waTemplateVariables)) {
        resolvedVars[key] = val
          .replace(/\{\{user_name\}\}/g, user.name || user.email)
          .replace(/\{\{user_email\}\}/g, user.email)
      }
      result = await sendWhatsAppTemplate(destination, waContentSid, resolvedVars, runtimeConfig.twilio)
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
