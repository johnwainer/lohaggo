import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { verifyPhoneCode } from '@/lib/accounts/phone-login'
import { acquisitionFrom } from '@/lib/analytics/acquisition'
import { clientIp } from '@/lib/rate-limit-store'
import { setSessionCookie } from '@/lib/session-cookie'

export const dynamic = 'force-dynamic'

/** { phone, code, name?, email? } → signs in (or creates the client account) and sets the session cookie. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  const r = await verifyPhoneCode({
    phone: str(body.phone), code: str(body.code), name: str(body.name) || null, email: str(body.email) || null,
    ip: clientIp(request.headers), acquisition: (acquisitionFrom(request, null) as Prisma.InputJsonValue | null) ?? null,
  })
  if (!r.ok) return NextResponse.json({ error: r.error, code: r.code, remaining: r.remaining }, { status: r.status })
  const response = NextResponse.json({ ok: true, created: r.created, role: r.user.role, name: r.user.name })
  await setSessionCookie(response, r.user)
  return response
}
