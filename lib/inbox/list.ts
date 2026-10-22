import { Prisma } from '@prisma/client'
import { INBOX_TABS, type InboxTab } from '@/lib/inbox/tabs'
import { sqlActivity, sqlAwaiting, sqlClosed, sqlOpen, sqlPinned, sqlSnoozeActive, sqlWaitingSince } from '@/lib/inbox/state'

export { INBOX_TABS, DEFAULT_TAB, parseTab, type InboxTab } from '@/lib/inbox/tabs'

export type ListFilters = {
  /** null = every workspace */
  workspaceIds: string[] | null
  channel?: string | null
  status?: string | null
  assignedToId?: string | null
  connectionId?: string | null
  tag?: string | null
  search?: string | null
  unreadOnly?: boolean
}

export type ListContext = { userId: string; nowIso: string }

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (m) => `\\${m}`)
}

/** Every filter except the tab (and, with `withChannel` false, except the channel: per-channel counters). */
export function filtersSql(f: ListFilters, ctx: ListContext, withChannel = true): Prisma.Sql {
  const parts: Prisma.Sql[] = []
  if (f.workspaceIds !== null) {
    parts.push(f.workspaceIds.length ? Prisma.sql`c."workspaceId" IN (${Prisma.join(f.workspaceIds)})` : Prisma.sql`FALSE`)
  }
  if (withChannel && f.channel) parts.push(Prisma.sql`c."channel"::text = ${f.channel}`)
  if (f.status) parts.push(Prisma.sql`c."status"::text = ${f.status}`)
  if (f.assignedToId === 'none') parts.push(Prisma.sql`c."assignedToId" IS NULL AND c."aiHandled" = false`)
  else if (f.assignedToId === 'ai') parts.push(Prisma.sql`c."aiHandled" = true`)
  else if (f.assignedToId) parts.push(Prisma.sql`c."assignedToId" = ${f.assignedToId}`)
  if (f.connectionId === 'none') parts.push(Prisma.sql`c."connectionId" IS NULL`)
  else if (f.connectionId) parts.push(Prisma.sql`c."connectionId" = ${f.connectionId}`)
  if (f.tag) parts.push(Prisma.sql`${f.tag} = ANY(c."tags")`)
  if (f.unreadOnly) {
    parts.push(Prisma.sql`(c."unreadCount" > 0 OR COALESCE((c."customFields"->'inbox'->'unreadFor') @> jsonb_build_array(${ctx.userId}::text), false))`)
  }
  const search = f.search?.trim()
  if (search) {
    const like = `%${escapeLike(search)}%`
    const digits = search.replace(/\D/g, '')
    const or: Prisma.Sql[] = [
      Prisma.sql`c."contactPhone" ILIKE ${like}`,
      Prisma.sql`c."contactName" ILIKE ${like}`,
      Prisma.sql`EXISTS (SELECT 1 FROM "User" u WHERE u."id" = c."userId" AND (u."name" ILIKE ${like} OR u."email" ILIKE ${like}))`,
      Prisma.sql`${search.toLowerCase()} = ANY(c."tags")`,
      Prisma.sql`EXISTS (SELECT 1 FROM "ConversationMessage" m WHERE m."conversationId" = c."id" AND m."isInternal" = false AND m."body" ILIKE ${like})`,
    ]
    if (digits.length >= 4) or.push(Prisma.sql`c."contactPhone" LIKE ${`%${digits}%`}`)
    parts.push(Prisma.sql`(${Prisma.join(or, ' OR ')})`)
  }
  return parts.length ? Prisma.join(parts, ' AND ') : Prisma.sql`TRUE`
}

/** The tab as a SQL condition (same rules as matchesTab in lib/inbox/tabs.ts). */
export function tabSql(tab: InboxTab, ctx: ListContext): Prisma.Sql {
  const snoozed = sqlSnoozeActive(ctx.nowIso)
  const awaiting = sqlAwaiting(ctx.nowIso)
  switch (tab) {
    case 'awaiting': return Prisma.sql`(${sqlOpen} AND ${awaiting} AND NOT ${snoozed})`
    case 'mine': return Prisma.sql`(${sqlOpen} AND c."assignedToId" = ${ctx.userId} AND NOT ${snoozed})`
    case 'ai': return Prisma.sql`(${sqlOpen} AND c."aiHandled" = true)`
    case 'waiting': return Prisma.sql`(${sqlOpen} AND NOT ${awaiting} AND NOT ${snoozed})`
    case 'snoozed': return Prisma.sql`(${sqlOpen} AND ${snoozed})`
    case 'closed': return sqlClosed
    default: return Prisma.sql`TRUE`
  }
}

/** «Por responder»: the one waiting the longest first; every other tab: latest activity first. */
export function sortSql(tab: InboxTab) {
  return tab === 'awaiting' ? { key: sqlWaitingSince, asc: true } : { key: sqlActivity, asc: false }
}

export type Cursor = { p: boolean; t: string; i: string }

export function encodeCursor(c: Cursor) {
  return Buffer.from(JSON.stringify(c)).toString('base64url')
}

export function decodeCursor(raw: string | null | undefined): Cursor | null {
  if (!raw) return null
  try {
    const c = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    if (typeof c?.p !== 'boolean' || typeof c?.t !== 'string' || typeof c?.i !== 'string' || Number.isNaN(Date.parse(c.t))) return null
    return c as Cursor
  } catch {
    return null
  }
}

/**
 * One page of conversation ids: pinned (by this viewer) first, then the tab's order, keyset-paginated on
 * (pinned, sort time, id) so «Cargar más» never repeats or skips rows.
 */
export function pageQuery(tab: InboxTab, f: ListFilters, ctx: ListContext, cursor: Cursor | null, limit: number): Prisma.Sql {
  const { key, asc } = sortSql(tab)
  const pinned = sqlPinned(ctx.userId)
  let after = Prisma.sql`TRUE`
  if (cursor) {
    const t = Prisma.sql`(${cursor.t}::timestamptz AT TIME ZONE 'UTC')`
    const beyond = asc
      ? Prisma.sql`(s.sort_at > ${t} OR (s.sort_at = ${t} AND s.id > ${cursor.i}))`
      : Prisma.sql`(s.sort_at < ${t} OR (s.sort_at = ${t} AND s.id < ${cursor.i}))`
    after = cursor.p ? Prisma.sql`(s.pinned = false OR ${beyond})` : Prisma.sql`(s.pinned = false AND ${beyond})`
  }
  return Prisma.sql`
    SELECT s.id, s.pinned, s.sort_at FROM (
      SELECT c."id" AS id, ${pinned} AS pinned, ${key} AS sort_at
      FROM "Conversation" c
      WHERE ${filtersSql(f, ctx)} AND ${tabSql(tab, ctx)}
    ) s
    WHERE ${after}
    ORDER BY s.pinned DESC, s.sort_at ${asc ? Prisma.sql`ASC` : Prisma.sql`DESC`}, s.id ${asc ? Prisma.sql`ASC` : Prisma.sql`DESC`}
    LIMIT ${limit + 1}`
}

/** Every tab counter in one query (same secondary filters as the list). */
export function countsQuery(f: ListFilters, ctx: ListContext): Prisma.Sql {
  const cols = INBOX_TABS.map((tab) => Prisma.sql`count(*) FILTER (WHERE ${tabSql(tab, ctx)})::int AS ${Prisma.raw(`"${tab}"`)}`)
  return Prisma.sql`SELECT ${Prisma.join(cols, ', ')} FROM "Conversation" c WHERE ${filtersSql(f, ctx)}`
}

/** Per-channel counters inside the current tab (every filter but the channel). */
export function channelCountsQuery(tab: InboxTab, f: ListFilters, ctx: ListContext): Prisma.Sql {
  return Prisma.sql`SELECT c."channel"::text AS channel, count(*)::int AS n FROM "Conversation" c WHERE ${filtersSql(f, ctx, false)} AND ${tabSql(tab, ctx)} GROUP BY 1`
}

/** Per-account counters inside the current tab (every filter but the account). */
export function connectionCountsQuery(tab: InboxTab, f: ListFilters, ctx: ListContext): Prisma.Sql {
  return Prisma.sql`SELECT c."connectionId" AS "connectionId", count(*)::int AS n FROM "Conversation" c WHERE ${filtersSql({ ...f, connectionId: null }, ctx)} AND ${tabSql(tab, ctx)} GROUP BY 1`
}
