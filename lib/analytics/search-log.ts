/**
 * One SearchEvent per finished search, for Analítica (visitors and searches without results included).
 * Recorded by the server where the search runs (/api/services, the chat agent), so it no longer depends
 * on a separate request from the browser that blockers, a fast navigation or a debounce timer could drop.
 * Typing «plo», «plom», «plomero» in a row is one search: the row is updated instead of adding three.
 */
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { normalizeQuery } from '@/lib/analytics/core'
import { sanitizeSearchQuery } from '@/lib/filters/searchFilter'
import type { SearchSource } from '@/lib/analytics/search-sources'

const logger = createLogger('search-log')

/** Best-effort flood guard per instance: a person does not search 30 times a minute. */
const hits = new Map<string, { n: number; reset: number }>()
export function searchAllowed(key: string, now = Date.now()) {
  const h = hits.get(key)
  if (!h || now > h.reset) {
    hits.set(key, { n: 1, reset: now + 60_000 })
    if (hits.size > 5000) hits.clear()
    return true
  }
  h.n++
  return h.n <= 30
}

/** Keystrokes of the same search arrive within this window */
export const SEARCH_MERGE_MS = 90_000

/** The new query continues (or trims) the previous one of the same person a moment ago: same search. Pure. */
export function continuesSearch(prev: { normalized: string; createdAt: Date; source: string } | null, next: { normalized: string; source: string }, now: Date) {
  if (!prev || prev.source !== next.source) return false
  if (now.getTime() - prev.createdAt.getTime() > SEARCH_MERGE_MS) return false
  return prev.normalized === next.normalized || next.normalized.startsWith(prev.normalized) || prev.normalized.startsWith(next.normalized)
}

export type SearchRecord = {
  query: string
  resultCount: number
  source: SearchSource
  userId?: string | null
  visitorId?: string | null
  role?: string | null
  city?: string | null
}

export async function recordSearch(r: SearchRecord, now: Date = new Date()) {
  const query = sanitizeSearchQuery(String(r.query ?? '').slice(0, 120))
  if (!query) return { recorded: false as const, reason: 'invalid' }
  const normalized = normalizeQuery(query)
  if (normalized.length < 2) return { recorded: false as const, reason: 'invalid' }
  const resultCount = Math.max(0, Math.min(10_000, Math.round(Number(r.resultCount) || 0)))
  const who = r.userId ? { userId: r.userId } : r.visitorId ? { visitorId: r.visitorId } : null
  try {
    if (who) {
      const prev = await prisma.searchEvent.findFirst({
        where: { ...who, createdAt: { gte: new Date(now.getTime() - SEARCH_MERGE_MS) } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, normalized: true, createdAt: true, source: true },
      })
      if (prev && continuesSearch(prev, { normalized, source: r.source }, now)) {
        // The longer text is what the person meant; the count is that of the latest results they saw
        const longer = normalized.length >= prev.normalized.length
        await prisma.searchEvent.update({ where: { id: prev.id }, data: { ...(longer ? { query: query.trim().slice(0, 120), normalized } : {}), resultCount, createdAt: now } })
        return { recorded: true as const, merged: true }
      }
    }
    await prisma.searchEvent.create({
      data: {
        query: query.trim().slice(0, 120), normalized, resultCount,
        userId: r.userId ?? null, visitorId: r.visitorId ?? null, role: r.role ?? null,
        city: r.city?.slice(0, 40) || null, source: r.source,
      },
    })
    return { recorded: true as const, merged: false }
  } catch (err) {
    // Never silent: a failing insert (e.g. a column missing in the database) must show in the logs
    logger.warn('Search event not recorded', { source: r.source, err: err instanceof Error ? err.message : String(err) })
    return { recorded: false as const, reason: 'db' }
  }
}
