/**
 * Sends a catalog template to a person and leaves the trace: preferences (WhatsApp notifications, opt-out,
 * marketing exclusion and hours), deduplication (one template, one entity, one recipient) through
 * AdminAuditLog, and the sent text as an outgoing message in the person's WhatsApp conversation with
 * `customFields.lastTemplate`, so the inbox AI agent knows what a button press refers to.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { getDefaultWorkspaceId } from '@/lib/workspaces'
import { resolveInboundContact, toE164 } from '@/lib/inbox/contacts'
import { sendTemplateCandidates, type TemplateSendResult } from '@/lib/messaging/wa-registry'
import type { Candidate } from '@/lib/messaging/wa-core'
import { isMarketingQuietHour, waDedupeKey, type TemplateMark } from '@/lib/messaging/wa-format'

const logger = createLogger('wa-send')

/** AdminAuditLog marker of a sent template (entityType WaTemplate, entityId = dedupe key, route = template). */
export const WA_SENT_ACTION = 'WA_TEMPLATE_SENT'
export const WA_ENTITY = 'WaTemplate'

export type WaSpec = {
  /** Catalog code of the event (B3, C10…) */
  event: string
  /** Ordered: the first approved as UTILITY wins (see selectTemplate) */
  candidates: Candidate[]
  /** What the template is about (Booking, ServiceRequest…): dedupe and the agent's context */
  entity?: { type: string; id: string } | null
  /** Default: event + entity; the recipient is always appended */
  dedupeKey?: string
  /** Only look for a previous send inside this window (default: ever) */
  dedupeWindowMs?: number
  /** Promotional by nature: respects `excludedFromMarketing` and quiet hours even if Meta approved it as UTILITY */
  marketing?: boolean
}

export type WaRecipient = {
  userId: string | null
  phone: string | null
  name?: string | null
  excludedFromMarketing?: boolean | null
}

export type WaOutcome =
  | TemplateSendResult
  | { ok: false; skipped: 'no_phone' | 'duplicate' | 'marketing_blocked' | 'user_disabled' | 'opted_out' | 'inactive'; requested: string }

/** Conversation tag set when the person pressed «no más avisos» (optout_soft) on a MARKETING template. */
export const NO_MARKETING_TAG = 'sin-marketing'

async function marketingOptedOut(r: WaRecipient, phone: string) {
  const [row, tagged] = await Promise.all([
    prisma.messagingOptOut.findFirst({
      where: { channel: 'WHATSAPP', isActive: true, OR: [{ destination: phone }, ...(r.userId ? [{ userId: r.userId }] : [])] },
      select: { id: true },
    }),
    prisma.conversation.findFirst({ where: { channel: 'WHATSAPP', contactPhone: phone, tags: { has: NO_MARKETING_TAG } }, select: { id: true } }),
  ])
  return Boolean(row || tagged)
}

export async function alreadySent(key: string, windowMs?: number, now = new Date()) {
  const hit = await prisma.adminAuditLog.findFirst({
    where: { action: WA_SENT_ACTION, entityType: WA_ENTITY, entityId: key, ...(windowMs ? { createdAt: { gte: new Date(now.getTime() - windowMs) } } : {}) },
    select: { id: true },
  })
  return Boolean(hit)
}

/**
 * The core send to one phone. Checks marketing rules and dedupe, sends, records. Channel preferences and the
 * opt-out are the caller's (sendWaToUser, the notification dispatch). Never throws.
 */
export async function deliverWa(recipient: WaRecipient, spec: WaSpec, now = new Date()): Promise<WaOutcome> {
  const requested = spec.candidates[0]?.name ?? spec.event
  try {
    const phone = toE164(recipient.phone)
    if (!phone) return { ok: false, skipped: 'no_phone', requested }

    const allowMarketing = !recipient.excludedFromMarketing && !isMarketingQuietHour(now) && !(await marketingOptedOut(recipient, phone))
    if (spec.marketing && !allowMarketing) return { ok: false, skipped: 'marketing_blocked', requested }

    const recipientKey = recipient.userId ?? phone
    const key = spec.dedupeKey ? `${spec.dedupeKey}:${recipientKey}`.slice(0, 190) : waDedupeKey(spec.event, spec.entity, recipientKey)
    if (await alreadySent(key, spec.dedupeWindowMs, now)) return { ok: false, skipped: 'duplicate', requested }

    const res = await sendTemplateCandidates(spec.candidates, phone, { allowMarketing })
    if (!res.ok) {
      if (!res.skipped) logger.warn('WhatsApp template failed', { event: spec.event, requested, error: res.error })
      return res
    }

    await prisma.adminAuditLog.create({
      data: {
        action: WA_SENT_ACTION, entityType: WA_ENTITY, entityId: key, route: res.name, actorEmail: 'sistema',
        details: JSON.stringify({ event: spec.event, requested, via: res.via, category: res.category, userId: recipient.userId, entity: spec.entity ?? null, sid: res.providerMessageId }).slice(0, 1000),
      },
    }).catch((err) => logger.warn('WA sent marker failed', { key, err }))

    await recordTemplateInConversation({
      phone, userId: recipient.userId, name: recipient.name ?? null, template: res.name, event: spec.event,
      entity: spec.entity ?? null, rendered: res.rendered, providerMessageId: res.providerMessageId, now,
    })
    return res
  } catch (err) {
    logger.error('deliverWa threw', { event: spec.event, err: err instanceof Error ? err.message : err })
    return { ok: false, error: err instanceof Error ? err.message : 'error', requested }
  }
}

/** A platform user: active, with phone, WhatsApp notifications on and not opted out. */
export async function sendWaToUser(userId: string, spec: WaSpec | null, now = new Date()): Promise<WaOutcome | null> {
  if (!spec) return null
  const requested = spec.candidates[0]?.name ?? spec.event
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, phone: true, isActive: true, notificationsWhatsappEnabled: true, excludedFromMarketing: true } })
    if (!user || !user.isActive) return { ok: false, skipped: 'inactive', requested }
    if (user.notificationsWhatsappEnabled === false) return { ok: false, skipped: 'user_disabled', requested }
    const phone = toE164(user.phone)
    if (!phone) return { ok: false, skipped: 'no_phone', requested }
    const optOut = await prisma.messagingOptOut.findFirst({ where: { channel: 'WHATSAPP', isActive: true, OR: [{ userId: user.id }, { destination: phone }] }, select: { id: true } })
    if (optOut) return { ok: false, skipped: 'opted_out', requested }
    return await deliverWa({ userId: user.id, phone, name: user.name, excludedFromMarketing: user.excludedFromMarketing }, spec, now)
  } catch (err) {
    logger.error('sendWaToUser threw', { event: spec.event, err: err instanceof Error ? err.message : err })
    return { ok: false, error: err instanceof Error ? err.message : 'error', requested }
  }
}

export type WaAdmin = { id: string; name: string; phone: string }

/**
 * Admins who get team alerts by WhatsApp: active ADMIN users with a phone and WhatsApp notifications on.
 * With a workspace, only its members (and superadmins, who see every workspace).
 */
export async function waAdmins(opts: { workspaceId?: string | null } = {}): Promise<WaAdmin[]> {
  const rows = await prisma.user.findMany({
    where: {
      role: 'ADMIN', isActive: true, phone: { not: null }, notificationsWhatsappEnabled: true,
      ...(opts.workspaceId ? { OR: [{ isSuperAdmin: true }, { workspaceMemberships: { some: { workspaceId: opts.workspaceId } } }] } : {}),
    },
    select: { id: true, name: true, phone: true },
    take: 20,
  })
  return rows.filter((r) => toE164(r.phone)).map((r) => ({ id: r.id, name: r.name, phone: r.phone! }))
}

/** One spec per admin (built with their name); nobody with a phone and WhatsApp on → nothing is sent. */
export async function sendWaToAdmins(build: (admin: WaAdmin) => WaSpec | null, opts: { workspaceId?: string | null } = {}, now = new Date()) {
  const admins = await waAdmins(opts).catch(() => [] as WaAdmin[])
  let sent = 0
  for (const a of admins) {
    const spec = build(a)
    if (!spec) continue
    const r = await sendWaToUser(a.id, spec, now)
    if (r?.ok) sent++
  }
  return { admins: admins.length, sent }
}

type RecordInput = {
  phone: string
  userId: string | null
  name: string | null
  template: string
  event: string
  entity: { type: string; id: string } | null
  rendered: string
  providerMessageId: string | null
  now: Date
}

/** customFields with the template marked as the last one (and in the last-5 list); a stale button press is dropped. Pure. */
export function withTemplateMark(current: unknown, mark: TemplateMark): Record<string, unknown> {
  const base = current && typeof current === 'object' && !Array.isArray(current) ? { ...(current as Record<string, unknown>) } : {}
  const recent = Array.isArray(base.recentTemplates) ? (base.recentTemplates as TemplateMark[]) : []
  delete base.lastButton
  return { ...base, lastTemplate: mark, recentTemplates: [mark, ...recent.filter((m) => m && m.sid !== mark.sid)].slice(0, 5) }
}

/**
 * The sent template as an OUTBOUND message (senderType AUTOMATION) in the person's WhatsApp conversation.
 * A conversation created here starts CLOSED (nothing to attend); the person's reply reopens it.
 */
/** Never keep a credential in the inbox copy (access-link tokens, codes): defensive, templates render only their body. */
export function redactSecrets(text: string) {
  return text.replace(/token=[^&\s]+/gi, 'token=•••')
}

export async function recordTemplateInConversation(p: RecordInput) {
  p = { ...p, rendered: redactSecrets(p.rendered) }
  try {
    const workspaceId = await getDefaultWorkspaceId()
    const contact = await resolveInboundContact({ workspaceId, channel: 'WHATSAPP', externalId: p.phone, nameHint: p.name })
    const mark: TemplateMark = { name: p.template, event: p.event, entityType: p.entity?.type ?? null, entityId: p.entity?.id ?? null, at: p.now.toISOString(), body: p.rendered.slice(0, 600), sid: p.providerMessageId }
    const snippet = p.rendered.slice(0, 200)
    const existing = await prisma.conversation.findUnique({ where: { channel_contactPhone: { channel: 'WHATSAPP', contactPhone: p.phone } }, select: { id: true, workspaceId: true, userId: true, contactId: true, customFields: true } })
    const conversation = existing
      ? await prisma.conversation.update({
        where: { id: existing.id },
        data: {
          lastMessageAt: p.now, lastMessageBody: snippet,
          ...(existing.userId || !p.userId ? {} : { userId: p.userId }),
          ...(existing.contactId ? {} : { contactId: contact.id }),
          customFields: withTemplateMark(existing.customFields, mark) as Prisma.InputJsonValue,
        },
        select: { id: true, workspaceId: true },
      })
      : await prisma.conversation.create({
        data: {
          channel: 'WHATSAPP', workspaceId, contactPhone: p.phone, contactName: contact.name || p.name, userId: p.userId ?? contact.userId ?? null,
          contactId: contact.id, status: 'CLOSED', lastMessageAt: p.now, lastMessageBody: snippet, unreadCount: 0,
          customFields: withTemplateMark(null, mark) as Prisma.InputJsonValue,
        },
        select: { id: true, workspaceId: true },
      })
    await prisma.conversationMessage.create({
      data: { conversationId: conversation.id, direction: 'OUTBOUND', body: p.rendered, status: 'SENT', senderType: 'AUTOMATION', providerMessageId: p.providerMessageId, sentAt: p.now },
    })
    emitInboxEvent({ type: 'new-message', conversationId: conversation.id, workspaceId: conversation.workspaceId })
  } catch (err) {
    logger.warn('Template not recorded in the conversation', { template: p.template, err: err instanceof Error ? err.message : err })
  }
}

/** Sends in the 24 h per template, for Haggo and the admin. */
export async function templateSendsSince(since: Date) {
  const rows = await prisma.adminAuditLog.groupBy({ by: ['route'], where: { action: WA_SENT_ACTION, createdAt: { gte: since } }, _count: { _all: true } })
  return rows.map((r) => ({ template: r.route ?? '—', sent: r._count._all })).sort((a, b) => b.sent - a.sent)
}
