import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

const logger = createLogger('inbox-state')

/**
 * Inbox bookkeeping kept in Conversation.customFields.inbox (no schema change). Other keys of customFields
 * (lastTemplate, lastButton, lastCampaign, attribution…) are never touched: every write merges in SQL.
 */
export type InboxState = {
  /** The last real message (not an internal note, event or automatic template) came from the contact */
  awaitingReply?: boolean
  /** ISO time of the last message from the contact */
  lastInboundAt?: string | null
  /** ISO time of the last real reply (person, AI, or the native Meta inbox) */
  lastReplyAt?: string | null
  /** Only automatic notices so far (template / SMS): nothing to attend until the person writes */
  automatedOnly?: boolean
  /** Admin ids that pinned it (pins are personal) */
  pinnedBy?: string[]
  /** Snoozed until this ISO time; when it passes, it is back in «Por responder» */
  snoozedUntil?: string | null
  snoozedBy?: string | null
  /** Admin ids that marked it as unread for themselves */
  unreadFor?: string[]
  /** ISO time the satisfaction survey was sent (at most once every 7 days, see lib/inbox/csat-core.ts) */
  csatAskedAt?: string | null
  /** The contact's answer to the survey (1–5) */
  csat?: { score: number; at: string } | null
}

export const INBOX_KEY = 'inbox'

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

/** The inbox state stored in customFields (always an object). Pure. */
export function readInboxState(customFields: unknown): InboxState {
  const raw = asObject(asObject(customFields)[INBOX_KEY])
  const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  return {
    awaitingReply: raw.awaitingReply === true,
    lastInboundAt: typeof raw.lastInboundAt === 'string' ? raw.lastInboundAt : null,
    lastReplyAt: typeof raw.lastReplyAt === 'string' ? raw.lastReplyAt : null,
    automatedOnly: raw.automatedOnly === true,
    pinnedBy: ids(raw.pinnedBy),
    snoozedUntil: typeof raw.snoozedUntil === 'string' ? raw.snoozedUntil : null,
    snoozedBy: typeof raw.snoozedBy === 'string' ? raw.snoozedBy : null,
    unreadFor: ids(raw.unreadFor),
    csatAskedAt: typeof raw.csatAskedAt === 'string' ? raw.csatAskedAt : null,
    csat: readCsat(raw.csat),
  }
}

function readCsat(v: unknown): InboxState['csat'] {
  const o = asObject(v)
  const score = Number(o.score)
  return Number.isInteger(score) && score >= 1 && score <= 5 && typeof o.at === 'string' ? { score, at: o.at } : null
}

/** customFields with `patch` merged into its inbox key; every other key is kept. Pure. */
export function withInboxState(customFields: unknown, patch: Partial<InboxState>): Record<string, unknown> {
  const base = { ...asObject(customFields) }
  return { ...base, [INBOX_KEY]: { ...asObject(base[INBOX_KEY]), ...patch } }
}

/** What the inbox list shows for one viewer. Pure. */
export function inboxView(customFields: unknown, viewerId: string, now = new Date()) {
  const s = readInboxState(customFields)
  const snoozeActive = Boolean(s.snoozedUntil && s.snoozedUntil > now.toISOString())
  const snoozeExpired = Boolean(s.snoozedUntil && !snoozeActive)
  return {
    awaitingReply: Boolean(s.awaitingReply) || snoozeExpired,
    lastInboundAt: s.lastInboundAt ?? null,
    automatedOnly: Boolean(s.automatedOnly),
    pinned: (s.pinnedBy ?? []).includes(viewerId),
    snoozedUntil: snoozeActive ? s.snoozedUntil ?? null : null,
    unreadForMe: (s.unreadFor ?? []).includes(viewerId),
    csat: s.csat ?? null,
  }
}

export type InboxView = ReturnType<typeof inboxView>

/**
 * Atomic merge of `patch` into customFields.inbox (jsonb ||): concurrent writers of other customFields keys
 * or other inbox keys are not overwritten. Best effort: the inbox must never break message delivery.
 */
export async function patchInboxState(conversationId: string, patch: Partial<InboxState>): Promise<boolean> {
  try {
    await prisma.$executeRaw`
      UPDATE "Conversation"
      SET "customFields" = (CASE WHEN jsonb_typeof("customFields") = 'object' THEN "customFields" ELSE '{}'::jsonb END)
        || jsonb_build_object('inbox', (CASE WHEN jsonb_typeof("customFields"->'inbox') = 'object' THEN "customFields"->'inbox' ELSE '{}'::jsonb END) || ${JSON.stringify(patch)}::jsonb)
      WHERE "id" = ${conversationId}`
    return true
  } catch (err) {
    logger.warn('Inbox state not saved', { conversationId, err: err instanceof Error ? err.message : err })
    return false
  }
}

/** A message from the contact arrived: it waits for an answer again (and wakes a snoozed conversation). */
export function markInbound(conversationId: string, at: Date = new Date()) {
  return patchInboxState(conversationId, { awaitingReply: true, lastInboundAt: at.toISOString(), automatedOnly: false, snoozedUntil: null, snoozedBy: null })
}

/** A real reply went out (person, AI agent or the native Meta inbox): nothing pending anymore. */
export function markReplied(conversationId: string, at: Date = new Date()) {
  return patchInboxState(conversationId, { awaitingReply: false, lastReplyAt: at.toISOString(), automatedOnly: false, snoozedUntil: null, snoozedBy: null })
}

// ─── Snooze presets ─────────────────────────────────────────────────────────

export type SnoozePreset = '1h' | '3h' | 'tomorrow'
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000

/** When a snooze preset ends; «mañana» is tomorrow 8:00 in Bogotá (UTC-5, no DST). Pure. */
export function snoozeUntil(preset: SnoozePreset, now = new Date()): Date {
  if (preset === '1h') return new Date(now.getTime() + 60 * 60 * 1000)
  if (preset === '3h') return new Date(now.getTime() + 3 * 60 * 60 * 1000)
  const local = new Date(now.getTime() + BOGOTA_OFFSET_MS)
  const tomorrow8Local = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1, 8, 0, 0)
  return new Date(tomorrow8Local - BOGOTA_OFFSET_MS)
}

// ─── SQL fragments shared by the list, the counters, the backfill and the cleanup ─────────────────

const INBOX = Prisma.sql`(c."customFields"->'inbox')`
export const sqlOpen = Prisma.sql`c."status" IN ('OPEN', 'IN_PROGRESS')`
export const sqlClosed = Prisma.sql`c."status" IN ('RESOLVED', 'CLOSED')`

export function sqlSnoozeActive(nowIso: string) {
  return Prisma.sql`COALESCE((${INBOX}->>'snoozedUntil') > ${nowIso}, false)`
}

/** Waiting for an answer: flagged, or a snooze that already ended */
export function sqlAwaiting(nowIso: string) {
  return Prisma.sql`(COALESCE(${INBOX}->>'awaitingReply', '') = 'true' OR COALESCE((${INBOX}->>'snoozedUntil') <= ${nowIso}, false))`
}

export function sqlPinned(userId: string) {
  return Prisma.sql`COALESCE(jsonb_typeof(${INBOX}->'pinnedBy') = 'array' AND (${INBOX}->'pinnedBy') @> jsonb_build_array(${userId}::text), false)`
}

/** Since when it waits (UTC timestamp, same type as lastMessageAt) */
export const sqlWaitingSince = Prisma.sql`COALESCE(((${INBOX}->>'lastInboundAt')::timestamptz AT TIME ZONE 'UTC'), c."lastMessageAt", c."createdAt")`
export const sqlActivity = Prisma.sql`COALESCE(c."lastMessageAt", c."createdAt")`
