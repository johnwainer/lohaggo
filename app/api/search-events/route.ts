import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getClientIpFromHeaders } from '@/lib/security/bot-protection'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sanitizeSearchQuery } from '@/lib/filters/searchFilter'
import { normalizeQuery } from '@/lib/analytics/core'
import { VISITOR_COOKIE } from '@/lib/analytics/acquisition'

export const dynamic = 'force-dynamic'

/** Best-effort flood guard per instance: a person does not search 30 times a minute. */
const hits = new Map<string, { n: number; reset: number }>()
function allowed(key: string) {
  const now = Date.now()
  const h = hits.get(key)
  if (!h || now > h.reset) {
    hits.set(key, { n: 1, reset: now + 60_000 })
    if (hits.size > 5000) hits.clear()
    return true
  }
  h.n++
  return h.n <= 30
}

/**
 * Every search on the site, with how many results it had, for Analítica (visitors included,
 * searches without results included). The person's own recent searches stay in /api/search-history.
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-real-ip') || getClientIpFromHeaders(request.headers)
  if (!allowed(ip)) return NextResponse.json({ ok: false }, { status: 429 })
  const body = await request.json().catch(() => ({}))
  const query = sanitizeSearchQuery(typeof body.query === 'string' ? body.query.slice(0, 120) : '')
  const resultCount = Number.isFinite(Number(body.resultCount)) ? Math.max(0, Math.min(10_000, Math.round(Number(body.resultCount)))) : null
  if (!query || query.trim().length < 2 || resultCount === null) return NextResponse.json({ ok: false }, { status: 400 })

  const session = await getServerSession(authOptions).catch(() => null)
  let visitorId = request.cookies.get(VISITOR_COOKIE)?.value
  const newVisitor = !visitorId || !/^[a-f0-9-]{36}$/.test(visitorId)
  if (newVisitor) visitorId = randomUUID()
  const source = body.source === 'home' || body.source === 'servicios' ? body.source : 'servicios'

  await prisma.searchEvent.create({
    data: {
      query: query.trim().slice(0, 120),
      normalized: normalizeQuery(query),
      resultCount,
      userId: session?.user?.id ?? null,
      visitorId,
      role: session?.user?.role ?? null,
      city: (request.headers.get('x-city-slug') || '').slice(0, 40) || null,
      source,
    },
  }).catch(() => null)

  const res = NextResponse.json({ ok: true })
  if (newVisitor) res.cookies.set(VISITOR_COOKIE, visitorId!, { maxAge: 365 * 86400, path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production', httpOnly: true })
  return res
}
