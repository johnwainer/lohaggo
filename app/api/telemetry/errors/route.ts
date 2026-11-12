import { NextRequest, NextResponse } from 'next/server'
import { getClientIpFromHeaders } from '@/lib/security/bot-protection'
import { recordError } from '@/lib/system/errors'
import { rateLimitResponse } from '@/lib/rate-limit-route'

export const dynamic = 'force-dynamic'

/** Browser errors (uncaught exceptions and rejections) for Salud del sistema. Few per visitor, no personal data. */
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-real-ip') || getClientIpFromHeaders(request.headers)
  const limited = await rateLimitResponse([{ key: `telemetry-errors:${ip}`, windowMs: 10 * 60_000, max: 10 }])
  if (limited) return NextResponse.json({ ok: false }, { status: 429, headers: limited.headers })

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
