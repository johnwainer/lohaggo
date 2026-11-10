import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  NON_REPLY_AGENT_IDS, copilotCounts, summarizeConversations,
  type ConversationInput, type ConversionRow, type MetricChannel, type MetricPeriod,
} from '@/lib/inbox/metrics-core'

/** Conversations with activity in the period that are read (latest first): keeps the query bounded */
const MAX_CONVERSATIONS = 5000
/** Outbound messages read per conversation to find the first real replies (notices come first, then the answer) */
const CANDIDATES_PER_CONVERSATION = 8
const EVENTS_PER_CONVERSATION = 40
const MAX_CONVERSIONS = 20000
const EVENT_TYPES = ['status', 'ai_closed', 'ai_handoff', 'ai_started', 'csat_asked', 'csat_answered', 'account_linked', 'account_created']

type RawRow = Omit<ConversationInput, 'humans' | 'agents'> & { humans: string[] | null; agents: string[] | null }

export type MetricsOptions = { days: MetricPeriod; channel: MetricChannel | null; workspaceIds: string[] | null; now?: Date }

/**
 * Inbox metrics for the conversations where the contact wrote in the last 7, 30 or 90 days, measured from
 * their first message in the period. Test conversations and comment threads are left out.
 */
export async function computeInboxMetrics({ days, channel, workspaceIds, now = new Date() }: MetricsOptions) {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  const base = { days, channel, since: since.toISOString(), truncated: false }
  if (workspaceIds && !workspaceIds.length) {
    return { ...base, ...summarizeConversations([]), people: [] as Named[], agents: [] as Named[], copilot: copilotCounts([]) }
  }
  const ws = workspaceIds ? Prisma.sql`AND c."workspaceId" IN (${Prisma.join(workspaceIds)})` : Prisma.empty
  const ch = channel ? Prisma.sql`AND c.channel::text = ${channel}` : Prisma.empty
  const nonReply = Prisma.join([...NON_REPLY_AGENT_IDS])

  const raw = await prisma.$queryRaw<RawRow[]>`
    WITH v AS (
      SELECT c.id, c.channel::text AS channel, c.status::text AS status, c."userId", fi.t AS "firstIn"
      FROM "Conversation" c
      JOIN LATERAL (
        SELECT MIN(m."sentAt") AS t FROM "ConversationMessage" m
        WHERE m."conversationId" = c.id AND m.direction = 'INBOUND' AND m."sentAt" >= ${since}
      ) fi ON fi.t IS NOT NULL
      WHERE c."lastMessageAt" >= ${since} AND c."isTest" = false AND c.channel NOT IN ('FACEBOOK_COMMENT', 'INSTAGRAM_COMMENT') ${ws} ${ch}
      ORDER BY c."lastMessageAt" DESC
      LIMIT ${MAX_CONVERSATIONS + 1}
    )
    SELECT v.*,
      (SELECT COALESCE(json_agg(x ORDER BY x."sentAt"), '[]'::json) FROM (
        SELECT o."sentAt", o."senderType", o."sentById", o."aiAgentId", LEFT(o.body, 80) AS body,
          EXISTS (
            SELECT 1 FROM "ConversationEvent" e
            WHERE e."conversationId" = v.id AND e.type = 'escalation_holding'
              AND e."createdAt" BETWEEN o."sentAt" - interval '5 seconds' AND o."sentAt" + interval '60 seconds'
          ) AS "nearHolding"
        FROM "ConversationMessage" o
        WHERE o."conversationId" = v.id AND o.direction = 'OUTBOUND' AND o."isInternal" = false AND o."sentAt" >= v."firstIn"
          AND (o."senderType" IN ('HUMAN', 'ECHO') OR (o."sentById" IS NOT NULL AND o."senderType" IS DISTINCT FROM 'AUTOMATION')
            OR (o."senderType" = 'AI' AND o."aiAgentId" IS NOT NULL AND o."aiAgentId" NOT IN (${nonReply})))
        ORDER BY o."sentAt"
        LIMIT ${CANDIDATES_PER_CONVERSATION}
      ) x) AS candidates,
      (SELECT array_agg(DISTINCT o."sentById") FROM "ConversationMessage" o
        WHERE o."conversationId" = v.id AND o.direction = 'OUTBOUND' AND o."isInternal" = false AND o."sentAt" >= v."firstIn"
          AND o."sentById" IS NOT NULL AND o."senderType" IS DISTINCT FROM 'AI' AND o."senderType" IS DISTINCT FROM 'AUTOMATION') AS humans,
      (SELECT array_agg(DISTINCT o."aiAgentId") FROM "ConversationMessage" o
        WHERE o."conversationId" = v.id AND o.direction = 'OUTBOUND' AND o."isInternal" = false AND o."sentAt" >= v."firstIn"
          AND o."senderType" = 'AI' AND o."aiAgentId" IS NOT NULL AND o."aiAgentId" NOT IN (${nonReply})) AS agents,
      (SELECT MAX(m."sentAt") FROM "ConversationMessage" m
        WHERE m."conversationId" = v.id AND m.direction = 'INBOUND' AND m."sentAt" > v."firstIn"
          AND m.body !~ '^\\s*[1-5]\\s*[.!]?\\s*$') AS "lastIn",
      (SELECT COALESCE(json_agg(y ORDER BY y."createdAt"), '[]'::json) FROM (
        SELECT e.type, e."actorType", e."actorId", LEFT(e."actorName", 60) AS "actorName", LEFT(e.detail, 160) AS detail, e."createdAt"
        FROM "ConversationEvent" e
        WHERE e."conversationId" = v.id AND e."createdAt" >= v."firstIn" AND e.type IN (${Prisma.join(EVENT_TYPES)})
        ORDER BY e."createdAt"
        LIMIT ${EVENTS_PER_CONVERSATION}
      ) y) AS events
    FROM v`

  const truncated = raw.length > MAX_CONVERSATIONS
  const rows: ConversationInput[] = raw.slice(0, MAX_CONVERSATIONS).map((r) => ({ ...r, humans: r.humans ?? [], agents: r.agents ?? [] }))
  const ids = rows.map((r) => r.id)
  const userIds = Array.from(new Set(rows.map((r) => r.userId).filter((u): u is string => Boolean(u))))
  const conversionWhere = { createdAt: { gte: since }, OR: [{ originConversationId: { in: ids } }, ...(userIds.length ? [{ userId: { in: userIds } }] : [])] }
  const conversionSelect = { userId: true, originConversationId: true, createdAt: true } as const
  const convFilter = { isTest: false, ...(workspaceIds ? { workspaceId: { in: workspaceIds } } : {}), ...(channel ? { channel } : {}) }

  const [aiAgents, requests, bookings, suggestions] = await Promise.all([
    prisma.aiAgent.findMany({ select: { id: true, name: true, handoffMessage: true, outsideHoursMessage: true } }),
    ids.length ? prisma.serviceRequest.findMany({ where: conversionWhere, select: conversionSelect, take: MAX_CONVERSIONS }) : Promise.resolve([] as ConversionRow[]),
    ids.length ? prisma.booking.findMany({ where: conversionWhere, select: conversionSelect, take: MAX_CONVERSIONS }) : Promise.resolve([] as ConversionRow[]),
    prisma.aiSuggestion.groupBy({ by: ['status'], where: { createdAt: { gte: since }, conversation: convFilter }, _count: { _all: true } }),
  ])

  const canned = new Map(aiAgents.map((a) => [a.id, [a.handoffMessage, a.outsideHoursMessage ?? ''].filter(Boolean)]))
  const summary = summarizeConversations(rows, { canned, requests, bookings })

  const personIds = summary.people.map((p) => p.id)
  const users = personIds.length ? await prisma.user.findMany({ where: { id: { in: personIds } }, select: { id: true, name: true } }) : []
  const userName = new Map(users.map((u) => [u.id, u.name]))
  const agentName = new Map(aiAgents.map((a) => [a.id, a.name]))

  return {
    ...base,
    truncated,
    ...summary,
    people: summary.people.map((p) => ({ ...p, name: userName.get(p.id) || 'Persona sin nombre' })),
    agents: summary.agents.map((a) => ({ ...a, name: agentName.get(a.id) || 'Agente eliminado' })),
    copilot: copilotCounts(suggestions.map((s) => ({ status: s.status, count: s._count._all }))),
  }
}

type Named = ReturnType<typeof summarizeConversations>['people'][number] & { name: string }

export type InboxMetrics = Awaited<ReturnType<typeof computeInboxMetrics>>
