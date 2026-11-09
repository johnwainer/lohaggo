import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getClientIpFromHeaders } from '@/lib/security/bot-protection'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { VISITOR_COOKIE } from '@/lib/analytics/acquisition'
import { recordSearch, searchAllowed } from '@/lib/analytics/search-log'

export const dynamic = 'force-dynamic'

/**
 * A search event sent by the browser (pages whose search does not go through /api/services). The catalogue
 * search is recorded by /api/services itself (track=1); both end in lib/analytics/search-log.ts, which
 * merges the keystrokes of one search into one row.
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-real-ip') || getClientIpFromHeaders(request.headers)
  if (!searchAllowed(ip)) return NextResponse.json({ ok: false }, { status: 429 })
  const body = await request.json().catch(() => ({}))
  const query = typeof body.query === 'string' ? body.query.slice(0, 120) : ''
  const resultCount = Number.isFinite(Number(body.resultCount)) ? Number(body.resultCount) : null
  if (query.trim().length < 2 || resultCount === null) return NextResponse.json({ ok: false }, { status: 400 })

  const session = await getServerSession(authOptions).catch(() => null)
  let visitorId = request.cookies.get(VISITOR_COOKIE)?.value
  const newVisitor = !visitorId || !/^[a-f0-9-]{36}$/.test(visitorId)
  if (newVisitor) visitorId = randomUUID()
  const source = body.source === 'home' ? 'home' : 'servicios'

  const r = await recordSearch({
    query, resultCount, source,
    userId: session?.user?.id ?? null, visitorId, role: session?.user?.role ?? null,
    city: (request.headers.get('x-city-slug') || '').slice(0, 40) || null,
  })

  const res = NextResponse.json({ ok: r.recorded })
  if (newVisitor) res.cookies.set(VISITOR_COOKIE, visitorId!, { maxAge: 365 * 86400, path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production', httpOnly: true })
  return res
}
