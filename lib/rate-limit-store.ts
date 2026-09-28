/**
 * Fixed-window counters shared by every server instance, in Postgres (RateLimitHit): one atomic upsert per
 * hit. If the database fails the counter falls back to this instance's memory, so a limit never blocks
 * everyone nor disappears. Expired rows are swept now and then by the hits themselves.
 */
import { prisma } from '@/lib/prisma'

const memory = new Map<string, { count: number; resetAt: number }>()

export type Hit = { count: number; resetAt: number }

export function memoryHit(key: string, windowMs: number, now: number): Hit {
  const cur = memory.get(key)
  if (!cur || cur.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + windowMs }
    memory.set(key, fresh)
    if (memory.size > 5000) for (const [k, v] of Array.from(memory.entries())) if (v.resetAt <= now) memory.delete(k)
    return fresh
  }
  cur.count++
  return cur
}

/** Counts one hit for `key` in the current window and returns the total so far. */
export async function hit(key: string, windowMs: number, now = Date.now()): Promise<Hit> {
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs)
  const resetAt = windowStart.getTime() + windowMs
  try {
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO "RateLimitHit" ("key", "windowStart", "count", "expiresAt")
      VALUES (${key.slice(0, 300)}, ${windowStart}, 1, ${new Date(resetAt)})
      ON CONFLICT ("key", "windowStart") DO UPDATE SET "count" = "RateLimitHit"."count" + 1
      RETURNING "count"`
    if (Math.random() < 0.02) void prisma.rateLimitHit.deleteMany({ where: { expiresAt: { lt: new Date(now) } } }).catch(() => null)
    return { count: Number(rows[0]?.count ?? 1), resetAt }
  } catch {
    return memoryHit(key, windowMs, now)
  }
}

/** Gives back a hit (a successful login that should not count). */
export async function unhit(key: string, windowMs: number, now = Date.now()) {
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs)
  await prisma.rateLimitHit.updateMany({ where: { key: key.slice(0, 300), windowStart, count: { gt: 0 } }, data: { count: { decrement: 1 } } }).catch(() => {
    const cur = memory.get(key)
    if (cur && cur.count > 0) cur.count--
  })
}

/** Over the limit after counting this hit? */
export async function overLimit(key: string, windowMs: number, max: number) {
  const h = await hit(key, windowMs)
  return { blocked: h.count > max, retryAfterSec: Math.max(1, Math.ceil((h.resetAt - Date.now()) / 1000)), count: h.count }
}

/** The client's IP as the platform sees it (Vercel sets x-real-ip / the first x-forwarded-for hop). */
export function clientIp(headers: Headers) {
  return (headers.get('x-real-ip') || headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').trim().slice(0, 64)
}
