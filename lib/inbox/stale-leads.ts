/**
 * Daily sweep of leads nobody answered: open conversations whose contact wrote last more than 2 h ago with no
 * reply. Inside the channel window the AI answers now (when it covers the channel); otherwise the conversation
 * goes back to «Por responder» with the tag lead-sin-respuesta and the admins get a summary in the app.
 * Nothing is ever sent to the contact outside the 24 h window (no template exists for leads without account).
 */
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { patchInboxState, readInboxState } from '@/lib/inbox/state'
import { ESCALATION_SETTINGS, STALE_LEAD_TAG, insideReplyWindow, staleLeadDecision, type StaleLeadDecision } from '@/lib/inbox/escalation-core'
import { notifyAdminsInApp, workspaceAdminIds } from '@/lib/inbox/escalation'

const logger = createLogger('inbox-stale-leads')

const HOUR = 3600_000
/** AI turns per sweep (each one is a model call) */
const MAX_AI_REPLIES = 8

type Row = {
  id: string
  channel: string
  status: string
  workspaceId: string
  contactName: string | null
  contactPhone: string
  userId: string | null
  tags: string[]
  customFields: unknown
  isTest: boolean
  aiSpam: boolean
  unanswered: boolean
  last_in_id: string
  last_in: Date
}

const utc = (d: Date) => Prisma.sql`(${d.toISOString()}::timestamptz AT TIME ZONE 'UTC')`

/**
 * Open conversations whose contact waits: the last real message is the contact's, or the AI handed off /
 * only said «una persona te responderá» and no person wrote after it.
 */
function candidatesQuery(now: Date) {
  const s = ESCALATION_SETTINGS
  const staleBefore = utc(new Date(now.getTime() - s.staleAfterHours * HOUR))
  const lookback = utc(new Date(now.getTime() - s.staleLookbackDays * 24 * HOUR))
  return Prisma.sql`
    SELECT c."id", c.channel::text AS channel, c.status::text AS status, c."workspaceId", c."contactName", c."contactPhone", c."userId", c.tags,
      c."customFields", c."isTest", c."aiSpam", li.id AS last_in_id, li."sentAt" AS last_in,
      (lm.direction = 'INBOUND'
        OR (COALESCE(c."customFields"->'inbox'->>'awaitingReply', '') = 'true' AND NOT EXISTS (
          SELECT 1 FROM "ConversationMessage" h WHERE h."conversationId" = c.id AND h.direction = 'OUTBOUND' AND h."isInternal" = false
            AND h."sentAt" > li."sentAt" AND (h."sentById" IS NOT NULL OR h."senderType" IN ('HUMAN', 'ECHO'))))
        OR (c."aiHandoffAt" IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM "ConversationMessage" h WHERE h."conversationId" = c.id AND h.direction = 'OUTBOUND' AND h."isInternal" = false
            AND h."sentAt" > c."aiHandoffAt" AND (h."sentById" IS NOT NULL OR h."senderType" IN ('HUMAN', 'ECHO'))))
      ) AS unanswered
    FROM "Conversation" c
    JOIN LATERAL (
      SELECT m.id, m."sentAt" FROM "ConversationMessage" m
      WHERE m."conversationId" = c.id AND m.direction = 'INBOUND' AND m."isInternal" = false
      ORDER BY m."sentAt" DESC, m.id DESC LIMIT 1
    ) li ON TRUE
    JOIN LATERAL (
      SELECT m.direction::text AS direction FROM "ConversationMessage" m
      WHERE m."conversationId" = c.id AND m."isInternal" = false AND COALESCE(m."senderType", '') <> 'AUTOMATION'
      ORDER BY m."sentAt" DESC, m.id DESC LIMIT 1
    ) lm ON TRUE
    WHERE c.status IN ('OPEN', 'IN_PROGRESS') AND c."isTest" = false AND c."aiSpam" = false
      AND c.channel::text NOT IN ('FACEBOOK_COMMENT', 'INSTAGRAM_COMMENT')
      AND li."sentAt" < ${staleBefore} AND li."sentAt" > ${lookback}
    ORDER BY li."sentAt" ASC
    LIMIT 500`
}

export type StaleLeadItem = { id: string; channel: string; contact: string; waitingHours: number; linked: boolean; decision: StaleLeadDecision['action']; reason?: string; done?: string }

/**
 * dryRun: what would happen, without answering nor touching anything. `notify`: the summary to the admins
 * (only for conversations newly put back in «Por responder»).
 */
export async function sweepStaleLeads(opts: { dryRun: boolean; notify?: boolean; now?: Date }) {
  const now = opts.now ?? new Date()
  const rows = await prisma.$queryRaw<Row[]>(candidatesQuery(now))
  const items: StaleLeadItem[] = []
  const counts = { candidates: rows.length, aiReplied: 0, reopened: 0, alreadyFlagged: 0, skipped: 0 }
  const reopenedBy = new Map<string, StaleLeadItem[]>()
  let aiTurns = 0
  const { shouldTakeOver, handleInbound } = await import('@/lib/ai/autopilot')

  for (const r of rows) {
    const inbox = readInboxState(r.customFields)
    const lastInboundAt = new Date(r.last_in)
    const base = { id: r.id, channel: r.channel, contact: r.contactName || r.contactPhone, waitingHours: Math.floor((now.getTime() - lastInboundAt.getTime()) / HOUR), linked: Boolean(r.userId) }
    try {
      // The AI only answers inside the window and when it would take the conversation anyway
      let aiCovers = false
      if (insideReplyWindow(r.channel, lastInboundAt, now) && aiTurns < MAX_AI_REPLIES) {
        const conv = await prisma.conversation.findUnique({ where: { id: r.id } })
        aiCovers = Boolean(conv && (await shouldTakeOver(conv)).take)
      }
      const decision = staleLeadDecision({
        channel: r.channel, status: r.status, isTest: r.isTest, aiSpam: r.aiSpam, automatedOnly: Boolean(inbox.automatedOnly),
        snoozed: Boolean(inbox.snoozedUntil && inbox.snoozedUntil > now.toISOString()), unanswered: r.unanswered, lastInboundAt,
      }, { now, aiCovers })
      if (decision.action === 'skip') {
        counts.skipped++
        items.push({ ...base, decision: 'skip', reason: decision.reason })
        continue
      }
      if (opts.dryRun) {
        items.push({ ...base, decision: decision.action })
        continue
      }
      if (decision.action === 'ai_reply') {
        aiTurns++
        const res = await handleInbound(r.id, r.last_in_id, { debounceMs: 0, maxAgeMs: 23 * HOUR })
        if ('handled' in res) {
          counts.aiReplied++
          items.push({ ...base, decision: 'ai_reply', done: String(res.handled) })
          continue
        }
      }
      // Back in «Por responder» with the tag (once): a person must answer it
      const flagged = r.tags.includes(STALE_LEAD_TAG) && inbox.awaitingReply &&
        Boolean(await prisma.conversationEvent.findFirst({ where: { conversationId: r.id, type: 'stale_lead', createdAt: { gt: lastInboundAt } }, select: { id: true } }))
      if (flagged) {
        counts.alreadyFlagged++
        items.push({ ...base, decision: 'reopen', done: 'ya_marcada' })
        continue
      }
      await patchInboxState(r.id, { awaitingReply: true, snoozedUntil: null, snoozedBy: null, ...(inbox.lastInboundAt ? {} : { lastInboundAt: lastInboundAt.toISOString() }) })
      await prisma.conversation.update({ where: { id: r.id }, data: { tags: Array.from(new Set([...r.tags, STALE_LEAD_TAG])), priority: 'high' } })
      await prisma.conversationEvent.create({ data: { conversationId: r.id, type: 'stale_lead', actorType: 'system', actorName: 'Leads sin respuesta', detail: `Sin respuesta hace ${base.waitingHours} h` } })
      emitInboxEvent({ type: 'status-update', conversationId: r.id, workspaceId: r.workspaceId })
      counts.reopened++
      const item: StaleLeadItem = { ...base, decision: 'reopen', done: 'por_responder' }
      items.push(item)
      reopenedBy.set(r.workspaceId, [...(reopenedBy.get(r.workspaceId) ?? []), item])
    } catch (err) {
      logger.warn('Stale lead step failed', { conversationId: r.id, err: err instanceof Error ? err.message : err })
    }
  }

  if (!opts.dryRun && opts.notify !== false) {
    for (const [workspaceId, list] of Array.from(reopenedBy.entries())) {
      const admins = await workspaceAdminIds(workspaceId).catch(() => [] as string[])
      const oldest = Math.max(...list.map((l) => l.waitingHours))
      await notifyAdminsInApp(admins, {
        title: `${list.length} ${list.length === 1 ? 'lead sin respuesta' : 'leads sin respuesta'}`,
        message: `Volvieron a «Por responder» con la etiqueta ${STALE_LEAD_TAG}. El más antiguo espera hace ${oldest >= 48 ? `${Math.floor(oldest / 24)} días` : `${oldest} h`}: ${list.slice(0, 3).map((l) => l.contact).join(', ')}${list.length > 3 ? '…' : ''}.`,
        url: '/admin/inbox',
        kind: 'INBOX_STALE_LEADS',
      })
    }
  }
  return { dryRun: opts.dryRun, ...counts, items: items.slice(0, 200) }
}
