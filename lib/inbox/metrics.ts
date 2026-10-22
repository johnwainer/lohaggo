import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { CSAT_SENDER } from '@/lib/inbox/csat-core'
import { aiResolution, firstResponseStats, topHandoffReasons, type ConversationRow, type MetricPeriod } from '@/lib/inbox/metrics-core'

/** Conversations started in the period that are read (newest first): keeps the query bounded */
const MAX_CONVERSATIONS = 5000
const MAX_HANDOFFS = 3000
const CSAT_AGENT = CSAT_SENDER.agentId

/**
 * Inbox metrics of the last 7 or 30 days for the workspaces an admin sees (null = all). Test conversations
 * and comment threads are left out; the survey's own messages never count as an answer.
 */
export async function computeInboxMetrics(days: MetricPeriod, workspaceIds: string[] | null, now: Date = new Date()) {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  const empty = { days, since: since.toISOString(), conversations: 0, firstResponse: { medianSeconds: null, answered: 0, unanswered: 0 }, ai: { closed: 0, byAi: 0, rate: null }, handoffs: { total: 0, top: [] }, reopened: 0, csat: { asked: 0, answered: 0, average: null } }
  if (workspaceIds && !workspaceIds.length) return empty
  const ws = workspaceIds ? Prisma.sql`AND c."workspaceId" IN (${Prisma.join(workspaceIds)})` : Prisma.empty

  const reply = (sender: 'HUMAN' | 'AI') => Prisma.sql`EXISTS (
    SELECT 1 FROM "ConversationMessage" o
    WHERE o."conversationId" = v.id AND o.direction = 'OUTBOUND' AND o."isInternal" = false AND o."senderType" = ${sender} AND COALESCE(o."aiAgentId", '') <> ${CSAT_AGENT})`

  const [rows, handoffs, reopenedRows, csatRows] = await Promise.all([
    prisma.$queryRaw<ConversationRow[]>`
      WITH v AS (
        SELECT c.id, c.status::text AS status FROM "Conversation" c
        WHERE c."createdAt" >= ${since} AND c."isTest" = false AND c.channel NOT IN ('FACEBOOK_COMMENT', 'INSTAGRAM_COMMENT') ${ws}
        ORDER BY c."createdAt" DESC
        LIMIT ${MAX_CONVERSATIONS}
      )
      SELECT v.status, fi.t AS "firstIn",
        (SELECT MIN(o."sentAt") FROM "ConversationMessage" o
          WHERE o."conversationId" = v.id AND o.direction = 'OUTBOUND' AND o."isInternal" = false AND o."senderType" IN ('HUMAN', 'AI')
            AND COALESCE(o."aiAgentId", '') <> ${CSAT_AGENT} AND o."sentAt" >= fi.t) AS "firstOut",
        ${reply('HUMAN')} AS human,
        ${reply('AI')} AS ai
      FROM v
      LEFT JOIN LATERAL (SELECT MIN(m."sentAt") AS t FROM "ConversationMessage" m WHERE m."conversationId" = v.id AND m.direction = 'INBOUND') fi ON true`,
    prisma.conversationEvent.findMany({
      where: { type: 'ai_handoff', createdAt: { gte: since }, conversation: { isTest: false, ...(workspaceIds ? { workspaceId: { in: workspaceIds } } : {}) } },
      select: { detail: true },
      orderBy: { createdAt: 'desc' },
      take: MAX_HANDOFFS,
    }),
    // Closed (by a person, the AI or the cleanup) and the contact wrote again afterwards; a survey answer is not a reopening
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(DISTINCT e."conversationId") AS n
      FROM "ConversationEvent" e
      JOIN "Conversation" c ON c.id = e."conversationId"
      WHERE e."createdAt" >= ${since} AND c."isTest" = false ${ws}
        AND (e.type = 'ai_closed' OR (e.type = 'status' AND e.detail IN ('RESOLVED', 'CLOSED')))
        AND EXISTS (
          SELECT 1 FROM "ConversationMessage" m
          WHERE m."conversationId" = e."conversationId" AND m.direction = 'INBOUND' AND m."sentAt" > e."createdAt"
            AND m.body !~ '^\\s*[1-5]\\s*[.!]?\\s*$'
        )`,
    prisma.$queryRaw<{ asked: bigint; answered: bigint; average: number | null }[]>`
      SELECT
        COUNT(*) FILTER (WHERE (c."customFields"->'inbox'->>'csatAskedAt') >= ${since.toISOString()}) AS asked,
        COUNT(*) FILTER (WHERE (c."customFields"->'inbox'->'csat'->>'at') >= ${since.toISOString()}) AS answered,
        AVG(CASE WHEN jsonb_typeof(c."customFields"->'inbox'->'csat'->'score') = 'number' THEN (c."customFields"->'inbox'->'csat'->>'score')::float END)
          FILTER (WHERE (c."customFields"->'inbox'->'csat'->>'at') >= ${since.toISOString()}) AS average
      FROM "Conversation" c
      WHERE c."lastMessageAt" >= ${since} AND c."isTest" = false AND jsonb_typeof(c."customFields") = 'object' ${ws}`,
  ])

  const csat = csatRows[0]
  return {
    days,
    since: since.toISOString(),
    conversations: rows.length,
    firstResponse: firstResponseStats(rows),
    ai: aiResolution(rows),
    handoffs: { total: handoffs.length, top: topHandoffReasons(handoffs.map((h) => h.detail)) },
    reopened: Number(reopenedRows[0]?.n ?? 0),
    csat: { asked: Number(csat?.asked ?? 0), answered: Number(csat?.answered ?? 0), average: csat?.average === null || csat?.average === undefined ? null : Number(csat.average) },
  }
}

export type InboxMetrics = Awaited<ReturnType<typeof computeInboxMetrics>>
