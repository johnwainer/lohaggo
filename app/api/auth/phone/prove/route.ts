import { NextRequest, NextResponse } from 'next/server'
import { provePhoneCode } from '@/lib/accounts/phone-login'
import { clientIp } from '@/lib/rate-limit-store'

export const dynamic = 'force-dynamic'

/** { phone, code } → a short-lived proof of the number for /api/register (creates and signs in nothing). */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  const r = await provePhoneCode({ phone: str(body.phone), code: str(body.code), ip: clientIp(request.headers) })
  if (!r.ok) return NextResponse.json({ error: r.error, code: r.code, remaining: r.remaining }, { status: r.status })
  return NextResponse.json({ ok: true, proof: r.proof })
}
