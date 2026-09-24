import { createHmac, timingSafeEqual } from 'crypto'
import type { ChannelConnection, Prisma, WebhookEventStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import type { MetaAppConfig } from '@/lib/messaging/provider-config'
import { fetchContactProfile, fetchThreadMessages, listPendingConversations, type MetaChannel } from '@/lib/messaging/meta-graph'
import { getConnectionCredentials, getConnectionMeta, isMetaChannel, requireMetaApp } from '@/lib/messaging/meta-channels'
import { autopilotCovers, drainAgentTasks, scheduleInboundAgent } from '@/lib/ai/autopilot'
import { resolveInboundContact } from '@/lib/inbox/contacts'
import { processCommentChanges } from '@/lib/messaging/meta-comments'
import { commentSettingsOf } from '@/lib/ai/comments-core'

const logger = createLogger('meta-inbound')

// ─── Signature ───────────────────────────────────────────────────────────────

export function verifyMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false
  const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')}`
  const a = Buffer.from(expected)
  const b = Buffer.from(signatureHeader)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// ─── Audit ───────────────────────────────────────────────────────────────────

export async function logWebhookEvent(params: {
  channel: MetaChannel
  externalId?: string | null
  status: WebhookEventStatus
  detail?: string | null
  payload?: unknown
}) {
  try {
    await prisma.webhookEvent.create({
      data: {
        channel: params.channel,
        externalId: params.externalId ?? null,
        status: params.status,
        detail: params.detail?.slice(0, 500) ?? null,
        payload: params.payload === undefined ? undefined : (trimPayload(params.payload) as Prisma.InputJsonValue),
      },
    })
  } catch (err) {
    logger.warn('Could not persist webhook event', { err: err instanceof Error ? err.message : err })
  }
}

function trimPayload(payload: unknown) {
  try {
    const text = JSON.stringify(payload)
    if (text.length <= 8000) return payload
    return { truncated: true, preview: text.slice(0, 8000) }
  } catch {
    return { unserializable: true }
  }
}

// ─── Payload types (subset) ──────────────────────────────────────────────────

type Attachment = { type?: string; payload?: { url?: string; title?: string; sticker_id?: number } }

type MessagingEvent = {
  sender?: { id: string }
  recipient?: { id: string }
  timestamp?: number
  message?: {
    mid?: string
    text?: string
    attachments?: Attachment[]
    quick_reply?: { payload?: string }
    is_echo?: boolean
    is_deleted?: boolean
    is_unsupported?: boolean
    reply_to?: { mid?: string; story?: { url?: string; id?: string } }
  }
  postback?: { mid?: string; title?: string; payload?: string; referral?: { ref?: string; source?: string; type?: string } }
  referral?: { ref?: string; source?: string; type?: string; ad_id?: string }
  optin?: { ref?: string; type?: string }
  reaction?: { mid?: string; action?: 'react' | 'unreact'; emoji?: string; reaction?: string }
  delivery?: { mids?: string[]; watermark?: number }
  read?: { watermark?: number }
  pass_thread_control?: { new_owner_app_id?: string | number; previous_owner_app_id?: string | number; metadata?: string }
  take_thread_control?: { new_owner_app_id?: string | number; previous_owner_app_id?: string | number; metadata?: string }
}

type WebhookEntry = { id: string; time?: number; messaging?: MessagingEvent[]; standby?: MessagingEvent[]; changes?: unknown[] }
export type MetaWebhookPayload = { object?: string; entry?: WebhookEntry[] }

// ─── Inbound recording (shared by webhook + pending poller) ──────────────────

const SAFE_RETRY_CODES = new Set(['P2002'])

export async function pickAutoAssignAgent(): Promise<string | null> {
  const [agentCounts, adminUsers] = await Promise.all([
    prisma.conversation.groupBy({
      by: ['assignedToId'],
      where: { status: 'IN_PROGRESS', assignedToId: { not: null } },
      _count: { _all: true },
    }),
    prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } }),
  ])
  if (adminUsers.length === 0) return null
  const countMap = new Map(agentCounts.map((r) => [r.assignedToId!, r._count._all]))
  return adminUsers.sort((a, b) => (countMap.get(a.id) ?? 0) - (countMap.get(b.id) ?? 0))[0]?.id ?? null
}

function fallbackContactName(channel: MetaChannel, contactId: string) {
  const label = channel === 'INSTAGRAM' ? 'Instagram' : 'Messenger'
  return `${label} · …${contactId.slice(-4)}`
}

type RecordParams = {
  app: MetaAppConfig
  conn: ChannelConnection
  channel: MetaChannel
  contactId: string
  direction: 'INBOUND' | 'OUTBOUND'
  body: string
  mediaUrl?: string | null
  mediaType?: string | null
  providerMessageId: string
  sentAt?: Date
  contactNameHint?: string | null
  threadOwner?: string | null | undefined
}

async function ensureConversation(params: RecordParams) {
  const { conn, channel, contactId } = params
  let conversation = await prisma.conversation.findUnique({ where: { channel_contactPhone: { channel, contactPhone: contactId } } })
  if (conversation) {
    if (!conversation.contactId) {
      const contact = await resolveInboundContact({ workspaceId: conn.workspaceId, channel, externalId: contactId, nameHint: conversation.contactName })
      conversation = await prisma.conversation.update({ where: { id: conversation.id }, data: { contactId: contact.id, userId: conversation.userId ?? contact.userId } })
    }
    return { conversation, created: false }
  }

  let contactName = params.contactNameHint || null
  if (!contactName) {
    const creds = getConnectionCredentials(conn)
    if (creds?.pageAccessToken) {
      const profile = await fetchContactProfile(params.app, creds.pageAccessToken, contactId, channel).catch(() => null)
      contactName = profile?.name || (profile?.username ? `@${profile.username}` : null)
    }
  }

  // A conversation an AI autopilot will take must not start with a human owner
  const assignedToId = (await autopilotCovers(conn.workspaceId, channel, conn.id, conn.externalId)) ? null : await pickAutoAssignAgent()
  const contact = await resolveInboundContact({ workspaceId: conn.workspaceId, channel, externalId: contactId, nameHint: contactName })
  try {
    conversation = await prisma.conversation.create({
      data: {
        channel,
        workspaceId: conn.workspaceId,
        contactPhone: contactId,
        contactName: contact.name || contactName || fallbackContactName(channel, contactId),
        contactId: contact.id,
        userId: contact.userId,
        connectionId: conn.id,
        assignedToId,
        status: 'OPEN',
        unreadCount: 0,
      },
    })
    logger.info('New conversation', { id: conversation.id, channel, connectionId: conn.id })
    return { conversation, created: true }
  } catch (err) {
    // Race between two concurrent events for the same contact
    if ((err as { code?: string })?.code === 'P2002') {
      conversation = await prisma.conversation.findUnique({ where: { channel_contactPhone: { channel, contactPhone: contactId } } })
      if (conversation) return { conversation, created: false }
    }
    throw err
  }
}

/** Idempotent on providerMessageId. Returns false when the message already existed. */
export async function recordMetaMessage(params: RecordParams): Promise<boolean> {
  // Echo of something we already stored (e.g. a private reply to a comment): don't open an empty DM thread for it
  if (params.direction === 'OUTBOUND') {
    const known = await prisma.conversationMessage.findUnique({ where: { providerMessageId: params.providerMessageId }, select: { id: true } })
    if (known) return false
  }
  const { conversation } = await ensureConversation(params)

  let messageId: string
  try {
    const created = await prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        direction: params.direction,
        body: params.body,
        mediaUrl: params.mediaUrl || null,
        mediaType: params.mediaType || null,
        providerMessageId: params.providerMessageId,
        status: 'DELIVERED',
        senderType: params.direction === 'OUTBOUND' ? 'ECHO' : 'CONTACT',
        sentAt: params.sentAt || new Date(),
        deliveredAt: new Date(),
      },
      select: { id: true },
    })
    messageId = created.id
  } catch (err) {
    if (SAFE_RETRY_CODES.has((err as { code?: string })?.code || '')) {
      logger.info('Duplicate message ignored', { providerMessageId: params.providerMessageId })
      return false
    }
    throw err
  }

  const isInbound = params.direction === 'INBOUND'
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      status: conversation.status === 'CLOSED' || conversation.status === 'RESOLVED' ? 'OPEN' : conversation.status,
      lastMessageAt: params.sentAt || new Date(),
      lastMessageBody: params.body.slice(0, 200),
      ...(isInbound ? { unreadCount: { increment: 1 } } : {}),
      ...(params.contactNameHint && !conversation.contactName ? { contactName: params.contactNameHint } : {}),
      ...(params.threadOwner !== undefined ? { threadOwner: params.threadOwner } : {}),
      ...(conversation.connectionId ? {} : { connectionId: params.conn.id }),
    },
  })
  emitInboxEvent({ type: 'new-message', conversationId: conversation.id, workspaceId: conversation.workspaceId })
  if (isInbound) scheduleInboundAgent(conversation.id, messageId)
  return true
}

async function setThreadOwner(channel: MetaChannel, contactId: string, threadOwner: string | null) {
  const conversation = await prisma.conversation.findUnique({ where: { channel_contactPhone: { channel, contactPhone: contactId } } })
  if (!conversation) return
  await prisma.conversation.update({ where: { id: conversation.id }, data: { threadOwner } })
  emitInboxEvent({ type: 'status-update', conversationId: conversation.id, workspaceId: conversation.workspaceId })
}

async function markOutboundDelivered(channel: MetaChannel, contactId: string, mids: string[] | undefined, watermark: number | undefined) {
  const conversation = await prisma.conversation.findUnique({ where: { channel_contactPhone: { channel, contactPhone: contactId } } })
  if (!conversation) return
  const where: Prisma.ConversationMessageWhereInput = { conversationId: conversation.id, direction: 'OUTBOUND', status: { in: ['PENDING', 'SENT'] } }
  if (mids?.length) where.providerMessageId = { in: mids }
  else if (watermark) where.sentAt = { lte: new Date(watermark) }
  else return
  await prisma.conversationMessage.updateMany({ where, data: { status: 'DELIVERED', deliveredAt: new Date() } })
}

function describeAttachments(attachments: Attachment[] | undefined) {
  if (!attachments?.length) return { text: '', mediaUrl: null as string | null, mediaType: null as string | null }
  const first = attachments[0]
  const labels: Record<string, string> = {
    image: '📷 Imagen',
    video: '🎥 Video',
    audio: '🎤 Audio',
    file: '📎 Archivo',
    location: '📍 Ubicación',
    fallback: '🔗 Enlace',
    template: '📄 Plantilla',
    story_mention: '📖 Te mencionó en una historia',
    share: '🔗 Contenido compartido',
    reel: '🎬 Reel',
    ig_reel: '🎬 Reel',
  }
  const parts = attachments.map((a) => labels[a.type || ''] || `📎 ${a.type || 'Adjunto'}`)
  const mediaUrl = first?.payload?.url || null
  const kindMime: Record<string, string> = { image: 'image/*', video: 'video/*', audio: 'audio/*', file: 'application/octet-stream' }
  const mediaType = first?.type ? kindMime[first.type] || null : null
  return { text: parts.join(' · '), mediaUrl, mediaType }
}

// ─── Event processing ────────────────────────────────────────────────────────

type EventSummary = { kind: string; recorded: boolean }

async function processEvent(app: MetaAppConfig, conn: ChannelConnection, channel: MetaChannel, ev: MessagingEvent, standby: boolean): Promise<EventSummary> {
  const ts = ev.timestamp ? new Date(ev.timestamp) : new Date()
  const appId = String(app.appId)
  const threadOwner = standby ? 'other' : undefined

  if (ev.message?.is_echo) {
    const contactId = ev.recipient?.id
    if (!contactId || !ev.message.mid) return { kind: 'echo', recorded: false }
    const att = describeAttachments(ev.message.attachments)
    const body = ev.message.text || att.text || '[mensaje]'
    const recorded = await recordMetaMessage({
      app, conn, channel, contactId, direction: 'OUTBOUND', body, mediaUrl: att.mediaUrl, mediaType: att.mediaType,
      providerMessageId: ev.message.mid, sentAt: ts, threadOwner,
    })
    return { kind: 'echo', recorded }
  }

  const contactId = ev.sender?.id
  if (!contactId) return { kind: 'unknown', recorded: false }

  if (ev.message) {
    if (ev.message.is_deleted) return { kind: 'message_deleted', recorded: false }
    const att = describeAttachments(ev.message.attachments)
    let body = ev.message.text || ''
    if (ev.message.reply_to?.story) body = `[Respuesta a historia] ${body}`.trim()
    if (ev.message.quick_reply?.payload && !body) body = ev.message.quick_reply.payload
    if (!body) body = att.text || (ev.message.is_unsupported ? '[Mensaje no soportado]' : '[mensaje]')
    else if (att.text) body = `${body}\n${att.text}`
    const recorded = await recordMetaMessage({
      app, conn, channel, contactId, direction: 'INBOUND', body, mediaUrl: att.mediaUrl, mediaType: att.mediaType,
      providerMessageId: ev.message.mid || `msg:${contactId}:${ts.getTime()}`, sentAt: ts, threadOwner,
    })
    return { kind: 'message', recorded }
  }

  if (ev.postback) {
    const ref = ev.postback.referral?.ref
    const body = `▶️ ${ev.postback.title || ev.postback.payload || 'Botón pulsado'}${ref ? ` (ref: ${ref})` : ''}`
    const recorded = await recordMetaMessage({
      app, conn, channel, contactId, direction: 'INBOUND', body,
      providerMessageId: ev.postback.mid || `postback:${contactId}:${ts.getTime()}`, sentAt: ts, threadOwner,
    })
    return { kind: 'postback', recorded }
  }

  if (ev.referral) {
    const src = ev.referral.source || ev.referral.type || 'referral'
    const body = `📣 Entrada por ${src}${ev.referral.ref ? ` · ref: ${ev.referral.ref}` : ''}${ev.referral.ad_id ? ` · ad: ${ev.referral.ad_id}` : ''}`
    const recorded = await recordMetaMessage({
      app, conn, channel, contactId, direction: 'INBOUND', body,
      providerMessageId: `referral:${contactId}:${ts.getTime()}`, sentAt: ts, threadOwner,
    })
    return { kind: 'referral', recorded }
  }

  if (ev.optin) {
    const recorded = await recordMetaMessage({
      app, conn, channel, contactId, direction: 'INBOUND', body: `✅ Opt-in${ev.optin.ref ? ` · ref: ${ev.optin.ref}` : ''}`,
      providerMessageId: `optin:${contactId}:${ts.getTime()}`, sentAt: ts, threadOwner,
    })
    return { kind: 'optin', recorded }
  }

  if (ev.reaction) {
    if (ev.reaction.action === 'unreact') return { kind: 'unreact', recorded: false }
    const body = `${ev.reaction.emoji || '👍'} reaccionó a un mensaje`
    const recorded = await recordMetaMessage({
      app, conn, channel, contactId, direction: 'INBOUND', body,
      providerMessageId: `reaction:${contactId}:${ev.reaction.mid || ''}:${ts.getTime()}`, sentAt: ts, threadOwner,
    })
    return { kind: 'reaction', recorded }
  }

  if (ev.delivery) {
    await markOutboundDelivered(channel, contactId, ev.delivery.mids, ev.delivery.watermark)
    return { kind: 'delivery', recorded: false }
  }

  if (ev.read) {
    await markOutboundDelivered(channel, contactId, undefined, ev.read.watermark)
    return { kind: 'read', recorded: false }
  }

  if (ev.pass_thread_control) {
    const newOwner = String(ev.pass_thread_control.new_owner_app_id ?? '')
    await setThreadOwner(channel, contactId, newOwner === appId ? null : 'other')
    return { kind: 'pass_thread_control', recorded: false }
  }

  if (ev.take_thread_control) {
    const newOwner = String(ev.take_thread_control.new_owner_app_id ?? '')
    await setThreadOwner(channel, contactId, newOwner === appId ? null : 'other')
    return { kind: 'take_thread_control', recorded: false }
  }

  return { kind: 'unknown', recorded: false }
}

/**
 * Multi-account routing: the webhook URL is global; each `entry.id` (pageId / igBusinessAccountId)
 * resolves to a ChannelConnection. Unknown accounts are logged as UNROUTED and never processed.
 */
export async function processMetaWebhookPayload(channel: MetaChannel, payload: MetaWebhookPayload) {
  const expectedObject = channel === 'INSTAGRAM' ? 'instagram' : 'page'
  if (payload.object !== expectedObject) {
    await logWebhookEvent({ channel, status: 'IGNORED', detail: `object=${payload.object || 'none'} (esperado ${expectedObject})`, payload })
    return
  }

  let app: MetaAppConfig
  try {
    app = await requireMetaApp()
  } catch (err) {
    await logWebhookEvent({ channel, status: 'ERROR', detail: err instanceof Error ? err.message : 'App de Meta no configurada' })
    return
  }

  for (const entry of payload.entry || []) {
    const accountId = String(entry.id || '')
    const conn = accountId
      ? await prisma.channelConnection.findUnique({ where: { channel_externalId: { channel, externalId: accountId } } })
      : null

    if (!conn) {
      await logWebhookEvent({ channel, externalId: accountId || null, status: 'UNROUTED', detail: 'Cuenta no conectada', payload: entry })
      continue
    }
    if (!conn.enabled) {
      await logWebhookEvent({ channel, externalId: accountId, status: 'PAUSED', detail: `Conexión "${conn.name}" pausada` })
      continue
    }

    const events: Array<{ ev: MessagingEvent; standby: boolean }> = [
      ...(entry.messaging || []).map((ev) => ({ ev, standby: false })),
      ...(entry.standby || []).map((ev) => ({ ev, standby: true })),
    ]

    const changes = entry.changes || []
    if (events.length === 0 && changes.length === 0) {
      await logWebhookEvent({ channel, externalId: accountId, status: 'IGNORED', detail: 'Entry sin eventos de mensajería', payload: entry })
      continue
    }

    const summaries: EventSummary[] = []
    let error: string | null = null
    for (const { ev, standby } of events) {
      try {
        summaries.push(await processEvent(app, conn, channel, ev, standby))
      } catch (err) {
        error = err instanceof Error ? err.message : 'error'
        logger.error('Error processing Meta event', { channel, accountId, error })
      }
    }

    const counts = summaries.reduce<Record<string, number>>((acc, s) => {
      acc[s.kind] = (acc[s.kind] || 0) + 1
      return acc
    }, {})

    // Comments on posts / ads (Page "feed", Instagram "comments" / "mentions")
    if (changes.length) {
      if (!commentSettingsOf(conn.commentSettings).enabled) {
        await logWebhookEvent({ channel, externalId: accountId, status: 'PAUSED', detail: `Comentarios desactivados en "${conn.name}" (Admin → Canales)`, payload: entry })
        if (events.length === 0) continue
      } else {
        const result = await processCommentChanges(app, conn, channel, changes)
        for (const [k, v] of Object.entries(result.counts)) counts[k] = (counts[k] || 0) + v
        if (result.error) error = result.error
      }
    }
    const detail = Object.entries(counts).map(([k, v]) => `${k}×${v}`).join(', ') || 'sin cambios'

    await Promise.all([
      logWebhookEvent({
        channel,
        externalId: accountId,
        status: error ? 'ERROR' : 'OK',
        detail: error ? `${detail} · ${error}` : detail,
        payload: error ? entry : undefined,
      }),
      prisma.channelConnection.update({
        where: { id: conn.id },
        data: { lastEventAt: new Date(), ...(error ? { lastError: error } : {}) },
      }).catch(() => null),
    ])
  }
  await drainAgentTasks()
}

// ─── Pending folder polling ──────────────────────────────────────────────────

/**
 * Message requests (folder "pending") never trigger webhooks. Poll each enabled connection and push
 * anything new through the same recording pipeline (dedup by external message id).
 */
export async function pollPendingFolders() {
  const app = await requireMetaApp()
  const connections = await prisma.channelConnection.findMany({ where: { enabled: true, channel: { in: ['MESSENGER', 'INSTAGRAM'] } } })
  const report: Array<{ connectionId: string; threads: number; recorded: number; error?: string }> = []

  for (const conn of connections) {
    if (!isMetaChannel(conn.channel)) continue
    const channel = conn.channel
    const creds = getConnectionCredentials(conn)
    const meta = getConnectionMeta(conn)
    const pageId = meta.pageId || conn.externalId
    if (!creds?.pageAccessToken) {
      report.push({ connectionId: conn.id, threads: 0, recorded: 0, error: 'sin token' })
      continue
    }

    try {
      const threads = await listPendingConversations(app, creds.pageAccessToken, pageId, channel)
      let recorded = 0
      for (const thread of threads) {
        const { participants, messages } = await fetchThreadMessages(app, creds.pageAccessToken, thread.id)
        const ownIds = new Set([pageId, conn.externalId])
        const contact = participants.find((p) => !ownIds.has(p.id))
        for (const m of [...messages].reverse()) {
          const fromId = m.from?.id
          if (!fromId || ownIds.has(fromId)) continue
          const attachment = m.attachments?.data?.[0]
          const mediaUrl = attachment?.image_data?.url || attachment?.video_data?.url || attachment?.file_url || null
          const body = m.message || (attachment ? '📎 Adjunto' : '[mensaje]')
          const nameHint = m.from?.name || (m.from?.username ? `@${m.from.username}` : null) || contact?.name || (contact?.username ? `@${contact.username}` : null)
          const ok = await recordMetaMessage({
            app, conn, channel, contactId: fromId, direction: 'INBOUND', body, mediaUrl,
            providerMessageId: m.id, sentAt: new Date(m.created_time), contactNameHint: nameHint,
          })
          if (ok) recorded += 1
        }
      }
      report.push({ connectionId: conn.id, threads: threads.length, recorded })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'error'
      report.push({ connectionId: conn.id, threads: 0, recorded: 0, error: message })
      logger.warn('Pending poll failed', { connectionId: conn.id, message })
    }
  }

  await drainAgentTasks()
  return report
}

export async function purgeOldWebhookEvents(days = 7) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const result = await prisma.webhookEvent.deleteMany({ where: { createdAt: { lt: cutoff } } })
  return result.count
}
