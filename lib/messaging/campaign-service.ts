import { normalizePhone } from '@/lib/phone'
import { toE164 } from '@/lib/inbox/contacts'
import type { MessagingCampaign, MessagingCampaignStatus, MessagingChannel, Prisma } from '@prisma/client'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { renderTextTemplate } from '@/lib/messaging/template'
import { sendMessageViaProvider, sendWhatsAppTemplate, sendMetaWhatsAppTemplate } from '@/lib/messaging/providers'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { resolveCampaignRecipients, resolveDestination } from '@/lib/messaging/campaign-recipients'
import { getDefaultWorkspaceId } from '@/lib/workspaces'
import { isMarketingQuietHour } from '@/lib/messaging/wa-format'
import { NO_MARKETING_TAG } from '@/lib/messaging/wa-send'
import { campaignRefCode, campaignWaLink, withCampaignUtm } from '@/lib/messaging/campaign-tracking'
import { SITE_URL } from '@/lib/marketing/seo'

/** WhatsApp campaigns are promotional: they only go out in the allowed marketing hours (Bogotá). */
export function campaignBlockedByQuietHours(channel: MessagingChannel, now: Date = new Date()) {
  return channel === 'WHATSAPP' && isMarketingQuietHour(now)
}

/** One run sends for at most this long (the routes allow 300 s); the rest is resumed by the cron. */
export const CAMPAIGN_TIME_BUDGET_MS = 240_000
/** A PROCESSING campaign with no progress for this long lost its worker: the cron resumes it. */
export const CAMPAIGN_STUCK_MS = 30 * 60_000
/** Metadata key of a send paused by the time budget (the cron picks it up on its next run). */
const PAUSE_KEY = 'sendPausedAt'
/** Statuses a person can (re)send from. */
const MANUAL_FROM: MessagingCampaignStatus[] = ['DRAFT', 'SCHEDULED', 'SENT', 'PARTIAL', 'FAILED', 'CANCELLED']

export class CampaignBusyError extends Error {
  constructor() {
    super('Campaign is already processing')
  }
}

function parseMeta(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {}
  try {
    const v = JSON.parse(raw)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function withoutPause(raw: string | null) {
  const meta = parseMeta(raw)
  if (!(PAUSE_KEY in meta)) return raw
  const { [PAUSE_KEY]: _paused, ...rest } = meta
  return JSON.stringify(rest)
}

/**
 * Takes the campaign for this run, atomically: a new send (from `from`, new startedAt) or the resume
 * of a send that paused or whose worker died (same startedAt). Null when someone else has it.
 */
async function claimCampaign(c: MessagingCampaign, from: MessagingCampaignStatus[], now: Date): Promise<Date | null> {
  const metadata = withoutPause(c.metadata)
  if (c.status !== 'PROCESSING') {
    if (!from.includes(c.status)) return null
    const r = await prisma.messagingCampaign.updateMany({
      where: { id: c.id, status: { in: from } },
      data: { status: 'PROCESSING', startedAt: now, completedAt: null, metadata },
    })
    return r.count ? now : null
  }
  const startedAt = c.startedAt ?? now
  const r = await prisma.messagingCampaign.updateMany({
    where: {
      id: c.id,
      status: 'PROCESSING',
      OR: [{ updatedAt: { lt: new Date(now.getTime() - CAMPAIGN_STUCK_MS) } }, { metadata: { contains: `"${PAUSE_KEY}"` } }],
    },
    data: { metadata, startedAt, updatedAt: now },
  })
  return r.count ? startedAt : null
}

/** Totals of one send only (a resend starts a new startedAt; earlier deliveries are history). */
async function sendTotals(campaignId: string, startedAt: Date) {
  const rows = await prisma.messagingDelivery.groupBy({
    by: ['status'],
    where: { campaignId, createdAt: { gte: startedAt } },
    _count: { _all: true },
  })
  const count = (st: string) => rows.find((row) => row.status === st)?._count._all || 0
  return { totalSent: count('SENT'), totalFailed: count('FAILED'), totalRecipients: rows.reduce((acc, row) => acc + row._count._all, 0) }
}

/**
 * Sends a campaign. `from`: statuses a new send may start from (the cron passes SCHEDULED only). Runs
 * for at most `budgetMs`; what is left stays PROCESSING (paused) for the cron, which resumes it
 * without sending twice to anyone who already got this send.
 */
export async function processCampaign(campaignId: string, opts: { from?: MessagingCampaignStatus[]; budgetMs?: number } = {}) {
  const t0 = Date.now()
  const budgetMs = opts.budgetMs ?? CAMPAIGN_TIME_BUDGET_MS
  const found = await prisma.messagingCampaign.findUnique({
    where: { id: campaignId },
    include: { template: true },
  })

  if (!found) {
    throw new Error('Campaign not found')
  }

  // Outside marketing hours a WhatsApp campaign is left as it is (a scheduled one goes out on a later run).
  if (campaignBlockedByQuietHours(found.channel)) return found

  const startedAt = await claimCampaign(found, opts.from ?? MANUAL_FROM, new Date())
  if (!startedAt) {
    throw new CampaignBusyError()
  }
  const campaign = { ...found, metadata: withoutPause(found.metadata) }

  const { users: audience } = await resolveCampaignRecipients({
    targetRole: campaign.targetRole,
    targetCity: campaign.targetCity,
    metadata: campaign.metadata,
    all: true,
  })
  // Resume: whoever already got a delivery in this send is not sent to again
  const attempted = new Set(
    (await prisma.messagingDelivery.findMany({ where: { campaignId: campaign.id, createdAt: { gte: startedAt } }, select: { userId: true } })).map((d) => d.userId),
  )
  const users = audience.filter((u) => !attempted.has(u.id))
  const runtimeConfig = await getMessagingProviderRuntimeConfig()

  // Parse campaign metadata once for all config below
  const campaignMeta = parseMeta(campaign.metadata)

  // WA Content Template metadata (WHATSAPP channel only)
  let waContentSid: string | null = null
  let waTemplateVariables: Record<string, string> = {}
  if (campaign.channel === 'WHATSAPP') {
    waContentSid = (campaignMeta.waContentSid as string) || null
    waTemplateVariables = (campaignMeta.waTemplateVariables as Record<string, string>) || {}
  }

  const magicLinkRedirectUrl = (campaignMeta.magicLinkRedirectUrl as string) || '/partner/dashboard'
  const magicLinkRequirePasswordChange = Boolean(campaignMeta.magicLinkRequirePasswordChange)

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || SITE_URL).replace(/\/+$/, '')
  const siteUrl = appUrl
  const campaignRef = campaignRefCode(campaign.id)
  const campaignLink = campaignWaLink(siteUrl, campaign.id)
  const trackLinks = (text: string) => withCampaignUtm(text, { channel: campaign.channel, campaignId: campaign.id, appUrl })

  // People who pressed «no más avisos» on a WhatsApp marketing template (same rule as deliverWa).
  const noMarketingPhones = new Set<string>()
  if (campaign.channel === 'WHATSAPP' && users.length > 0) {
    const tagged = await prisma.conversation.findMany({
      where: { channel: 'WHATSAPP', tags: { has: NO_MARKETING_TAG } },
      select: { contactPhone: true, userId: true },
    })
    for (const t of tagged) {
      const e164 = toE164(t.contactPhone)
      if (e164) noMarketingPhones.add(e164)
      if (t.userId) noMarketingPhones.add(`user:${t.userId}`)
    }
  }

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
      for (let i = 0; i < missingUserIds.length; i += 50) {
        await Promise.all(
          missingUserIds.slice(i, i + 50).map(async (userId) => {
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
  }

  const contentMode: 'CUSTOM' | 'TEMPLATE' = campaignMeta.contentMode === 'CUSTOM' ? 'CUSTOM' : 'TEMPLATE'

  type AbConfig = { variants?: Array<{ key: string; subject?: string; body: string; allocation: number }> }
  let abConfig: AbConfig | null = null
  if (campaign.abTestEnabled && campaign.abTestConfig) {
    try {
      const parsed = JSON.parse(campaign.abTestConfig) as AbConfig
      abConfig = parsed && typeof parsed === 'object' && Array.isArray(parsed.variants) ? parsed : null
    } catch {
      abConfig = null
    }
  }

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

  let paused = false
  let sinceHeartbeat = 0
  for (const user of users) {
    if (Date.now() - t0 > budgetMs) {
      paused = true
      break
    }
    // Progress on the campaign (also the heartbeat that tells a live send from a dead one)
    if (++sinceHeartbeat >= 25) {
      sinceHeartbeat = 0
      await prisma.messagingCampaign.update({ where: { id: campaign.id }, data: await sendTotals(campaign.id, startedAt) }).catch(() => null)
    }
    const destination = resolveDestination(campaign.channel, user)
    if (!destination) {
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

    const taggedNoMarketing =
      noMarketingPhones.size > 0 &&
      (noMarketingPhones.has(`user:${user.id}`) || noMarketingPhones.has(toE164(normalizePhone(destination)) ?? ''))

    if (optedOut || taggedNoMarketing) {
      await prisma.messagingDelivery.create({
        data: {
          campaignId: campaign.id,
          userId: user.id,
          channel: campaign.channel,
          destination,
          status: 'UNSUBSCRIBED',
          provider: 'internal',
          errorCode: optedOut ? 'OPTOUT' : 'NO_MARKETING',
          errorMessage: optedOut ? 'Recipient opted out' : 'Recipient asked for no marketing messages',
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
      campaign_link: campaignLink,
      campaign_ref: campaignRef,
    }
    const body = trackLinks(renderTextTemplate(bodyTemplate, userVars))
    const subject = subjectTemplate
      ? renderTextTemplate(subjectTemplate, userVars)
      : null

    // For WA Content Templates the body uses Twilio numbered vars ({{1}}, {{2}}).
    // Hoist resolvedVars so the inbox can render the body with merged keys.
    let resolvedVars: Record<string, string> = {}

    let result: Awaited<ReturnType<typeof sendMessageViaProvider>>
    if (campaign.channel === 'WHATSAPP' && waContentSid) {
      for (const [key, val] of Object.entries(waTemplateVariables)) {
        resolvedVars[key] = trackLinks(renderTextTemplate(val, userVars))
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
            workspaceId: await getDefaultWorkspaceId(),
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
            senderType: 'AUTOMATION',
          },
        })
        // Last touch for the attribution board: a request in the next days counts for this campaign
        if (campaign.channel === 'WHATSAPP') {
          const fields = conv.customFields && typeof conv.customFields === 'object' && !Array.isArray(conv.customFields) ? (conv.customFields as Prisma.JsonObject) : {}
          await prisma.conversation.update({
            where: { id: conv.id },
            data: { customFields: { ...fields, lastCampaign: { code: campaignRef, at: new Date().toISOString() } } },
          })
        }
      } catch {
        // Conversation tracking must not block campaign delivery
      }
    }

  }

  const totals = await sendTotals(campaign.id, startedAt)
  if (paused) {
    // Out of time: stays PROCESSING with the pause mark; the cron resumes it (same startedAt)
    return prisma.messagingCampaign.update({
      where: { id: campaign.id },
      data: { ...totals, metadata: JSON.stringify({ ...parseMeta(campaign.metadata), [PAUSE_KEY]: new Date().toISOString() }) },
    })
  }

  const finalStatus: MessagingCampaignStatus =
    totals.totalFailed === 0 ? 'SENT' : totals.totalSent === 0 ? 'FAILED' : 'PARTIAL'

  return prisma.messagingCampaign.update({
    where: { id: campaign.id },
    data: {
      status: finalStatus,
      ...totals,
      completedAt: new Date(),
    },
  })
}

/**
 * Scheduled campaigns that are due, plus sends that paused or lost their worker. Each campaign on its
 * own (one failing does not stop the rest), all inside one time budget.
 */
export async function runScheduledCampaigns(now: Date = new Date()) {
  const t0 = Date.now()
  const due = await prisma.messagingCampaign.findMany({
    where: {
      OR: [
        { status: 'SCHEDULED', scheduledAt: { lte: now } },
        {
          status: 'PROCESSING',
          OR: [{ updatedAt: { lt: new Date(now.getTime() - CAMPAIGN_STUCK_MS) } }, { metadata: { contains: `"${PAUSE_KEY}"` } }],
        },
      ],
    },
    orderBy: { scheduledAt: 'asc' },
    take: 50,
    select: { id: true },
  })

  const results: Array<{ id: string; status: string; sent: number; failed: number; error?: string }> = []
  for (const c of due) {
    const left = CAMPAIGN_TIME_BUDGET_MS - (Date.now() - t0)
    if (left < 10_000) break
    try {
      const processed = await processCampaign(c.id, { from: ['SCHEDULED'], budgetMs: left })
      results.push({ id: processed.id, status: processed.status, sent: processed.totalSent, failed: processed.totalFailed })
    } catch (err) {
      if (err instanceof CampaignBusyError) continue
      results.push({ id: c.id, status: 'ERROR', sent: 0, failed: 0, error: err instanceof Error ? err.message : 'error' })
    }
  }
  return results
}

export type CampaignWithTemplate = MessagingCampaign & { template: { id: string } | null }
