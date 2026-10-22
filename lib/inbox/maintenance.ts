import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'

const DAY_MS = 24 * 60 * 60 * 1000
export const CLEANUP_INACTIVE_DAYS = 7
export const CLEANUP_AWAITING_MAX_DAYS = 30

/**
 * Per open conversation: the last real message (no internal notes, no automatic templates), the last message
 * from the contact, how many the contact sent, and the last activity of any kind (notes included).
 */
const OPEN_SUMMARY = Prisma.sql`
  SELECT c."id", c."channel"::text AS channel, c."workspaceId" AS "workspaceId", c."isTest" AS "isTest", c."lastMessageAt" AS "lastMessageAt",
    lm.direction AS last_dir, lm."sentAt" AS last_at, lm.body AS last_body,
    li.last_in, li.inbound_count,
    GREATEST(COALESCE(la.any_last, c."createdAt"), COALESCE(c."lastMessageAt", c."createdAt")) AS activity
  FROM "Conversation" c
  LEFT JOIN LATERAL (
    SELECT m."direction"::text AS direction, m."sentAt", m."body" FROM "ConversationMessage" m
    WHERE m."conversationId" = c."id" AND m."isInternal" = false AND COALESCE(m."senderType", '') <> 'AUTOMATION'
    ORDER BY m."sentAt" DESC, m."id" DESC LIMIT 1
  ) lm ON TRUE
  LEFT JOIN LATERAL (
    SELECT max(m."sentAt") AS last_in, count(*)::int AS inbound_count FROM "ConversationMessage" m
    WHERE m."conversationId" = c."id" AND m."direction" = 'INBOUND' AND m."isInternal" = false
  ) li ON TRUE
  LEFT JOIN LATERAL (
    SELECT max(m."sentAt") AS any_last FROM "ConversationMessage" m WHERE m."conversationId" = c."id"
  ) la ON TRUE
  WHERE c."status" IN ('OPEN', 'IN_PROGRESS')`

const ISO = `'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'`

export function backfillSummaryQuery() {
  return Prisma.sql`
    SELECT count(*)::int AS open,
      count(*) FILTER (WHERE s.last_dir = 'INBOUND')::int AS awaiting,
      count(*) FILTER (WHERE s.last_dir = 'OUTBOUND')::int AS outbound,
      count(*) FILTER (WHERE s.last_dir IS NULL)::int AS automated_only,
      count(*) FILTER (WHERE s.last_at IS NOT NULL AND s."lastMessageAt" > s.last_at)::int AS bumped
    FROM (${OPEN_SUMMARY}) s`
}

export function backfillUpdateQuery(fixLastMessageAt: boolean) {
  return Prisma.sql`
    UPDATE "Conversation" c SET
      "customFields" = (CASE WHEN jsonb_typeof(c."customFields") = 'object' THEN c."customFields" ELSE '{}'::jsonb END)
        || jsonb_build_object('inbox', (CASE WHEN jsonb_typeof(c."customFields"->'inbox') = 'object' THEN c."customFields"->'inbox' ELSE '{}'::jsonb END)
          || jsonb_build_object(
            'awaitingReply', COALESCE(s.last_dir = 'INBOUND', false),
            'lastInboundAt', CASE WHEN s.last_in IS NULL THEN NULL ELSE to_char(s.last_in, ${Prisma.raw(ISO)}) END,
            'automatedOnly', s.last_dir IS NULL
          )),
      "lastMessageAt" = CASE WHEN ${fixLastMessageAt} AND s.last_at IS NOT NULL AND c."lastMessageAt" > s.last_at THEN s.last_at ELSE c."lastMessageAt" END,
      "lastMessageBody" = CASE WHEN ${fixLastMessageAt} AND s.last_at IS NOT NULL AND c."lastMessageAt" > s.last_at THEN left(s.last_body, 200) ELSE c."lastMessageBody" END
    FROM (${OPEN_SUMMARY}) s
    WHERE c."id" = s."id"`
}

/**
 * Recomputes customFields.inbox.awaitingReply / lastInboundAt / automatedOnly for every open conversation from
 * its messages (other customFields keys and pins / snoozes are kept). fixLastMessageAt also moves
 * lastMessageAt and the preview back to the last real message when an automatic template bumped them.
 */
export async function backfillInboxState(opts: { dryRun: boolean; fixLastMessageAt: boolean }) {
  const [summary] = await prisma.$queryRaw<Array<{ open: number; awaiting: number; outbound: number; automated_only: number; bumped: number }>>(backfillSummaryQuery())
  const counts = {
    open: summary?.open ?? 0,
    awaitingReply: summary?.awaiting ?? 0,
    waitingOnContact: summary?.outbound ?? 0,
    automatedOnly: summary?.automated_only ?? 0,
    lastMessageAtBumped: summary?.bumped ?? 0,
  }
  if (opts.dryRun) return { dryRun: true, counts, updated: 0 }

  const updated = await prisma.$executeRaw(backfillUpdateQuery(opts.fixLastMessageAt))
  return { dryRun: false, counts, updated }
}

export type CleanupBucket = 'inactiveOutbound' | 'smsOutboundOnly' | 'staleAwaiting'

/**
 * «Cerrar conversaciones inactivas»: open conversations with no activity for 7+ days whose last real message is
 * ours (or only automatic notices), SMS threads where the contact never wrote, and contacts whose last message
 * is older than 30 days. A contact waiting less than 30 days is never touched (it stays in «Por responder»).
 */
export function cleanupCandidatesQuery(now: Date) {
  // Stored times are UTC timestamps without zone: compare against UTC explicitly
  const utc = (d: Date) => Prisma.sql`(${d.toISOString()}::timestamptz AT TIME ZONE 'UTC')`
  const inactiveBefore = utc(new Date(now.getTime() - CLEANUP_INACTIVE_DAYS * DAY_MS))
  const awaitingBefore = utc(new Date(now.getTime() - CLEANUP_AWAITING_MAX_DAYS * DAY_MS))
  return Prisma.sql`
    SELECT s."id", s.channel, s."workspaceId", s.bucket FROM (
      SELECT t.*, CASE
        WHEN t.channel = 'SMS' AND COALESCE(t.inbound_count, 0) = 0 THEN 'smsOutboundOnly'
        WHEN t.last_dir = 'INBOUND' THEN CASE WHEN t.last_in < ${awaitingBefore} THEN 'staleAwaiting' ELSE NULL END
        WHEN t.activity < ${inactiveBefore} THEN 'inactiveOutbound'
        ELSE NULL END AS bucket
      FROM (${OPEN_SUMMARY}) t
    ) s
    WHERE s.bucket IS NOT NULL`
}

export async function cleanupInactiveConversations(opts: { dryRun: boolean; actor: { id: string; name: string | null } }, now = new Date()) {
  const rows = await prisma.$queryRaw<Array<{ id: string; channel: string; workspaceId: string; bucket: CleanupBucket }>>(cleanupCandidatesQuery(now))

  const counts: Record<CleanupBucket, number> = { inactiveOutbound: 0, smsOutboundOnly: 0, staleAwaiting: 0 }
  const byChannel: Record<string, number> = {}
  for (const r of rows) {
    counts[r.bucket]++
    byChannel[r.channel] = (byChannel[r.channel] ?? 0) + 1
  }
  const result = { dryRun: opts.dryRun, total: rows.length, counts, byChannel, closed: 0 }
  if (opts.dryRun || rows.length === 0) return result

  const ids = rows.map((r) => r.id)
  for (let i = 0; i < ids.length; i += 500) {
    const still = await prisma.conversation.findMany({ where: { id: { in: ids.slice(i, i + 500) }, status: { in: ['OPEN', 'IN_PROGRESS'] } }, select: { id: true } })
    const chunk = still.map((c) => c.id)
    if (!chunk.length) continue
    // State-guarded: a conversation that changed meanwhile is not closed
    const res = await prisma.conversation.updateMany({
      where: { id: { in: chunk }, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      data: { status: 'CLOSED', aiHandoffAt: null, priority: 'normal' },
    })
    result.closed += res.count
    await prisma.conversationEvent.createMany({
      data: chunk.map((conversationId) => ({ conversationId, type: 'status', detail: 'CLOSED', actorType: 'system', actorId: opts.actor.id, actorName: `Limpieza de la bandeja (${opts.actor.name || 'admin'})` })),
    })
  }
  // One event per workspace is enough: every open inbox refreshes its counters
  const firstByWorkspace = new Map<string, string>()
  for (const r of rows) if (!firstByWorkspace.has(r.workspaceId)) firstByWorkspace.set(r.workspaceId, r.id)
  firstByWorkspace.forEach((conversationId, workspaceId) => emitInboxEvent({ type: 'status-update', conversationId, workspaceId }))
  return result
}
