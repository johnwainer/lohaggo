import { NextRequest, NextResponse } from 'next/server'
import { getClientIpFromHeaders } from '@/lib/security/bot-protection'
import { recordError } from '@/lib/system/errors'

export const dynamic = 'force-dynamic'

const hits = new Map<string, { n: number; reset: number }>()

/** Browser errors (uncaught exceptions and rejections) for Salud del sistema. Few per visitor, no personal data. */
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-real-ip') || getClientIpFromHeaders(request.headers)
  const now = Date.now()
  const h = hits.get(ip)
  if (!h || now > h.reset) hits.set(ip, { n: 1, reset: now + 10 * 60_000 })
  else if (++h.n > 10) return NextResponse.json({ ok: false }, { status: 429 })
  if (hits.size > 5000) hits.clear()

  const body = await request.json().catch(() => ({}))
  const message = typeof body.message === 'string' ? body.message.slice(0, 500) : ''
  if (!message) return NextResponse.json({ ok: false }, { status: 400 })
  const path = typeof body.path === 'string' ? body.path.split('?')[0].slice(0, 200) : null
  await recordError({
    source: 'client',
    context: typeof body.kind === 'string' ? body.kind.slice(0, 40) : 'error',
    message,
    route: path,
    sample: { stack: typeof body.stack === 'string' ? body.stack.slice(0, 1500) : undefined, file: typeof body.file === 'string' ? body.file.slice(0, 200) : undefined, ua: request.headers.get('user-agent')?.slice(0, 200) },
  })
  return NextResponse.json({ ok: true })
}
