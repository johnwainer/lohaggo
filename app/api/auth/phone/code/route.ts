import { NextRequest, NextResponse } from 'next/server'
import { requestPhoneCode } from '@/lib/accounts/phone-login'
import { clientIp } from '@/lib/rate-limit-store'

export const dynamic = 'force-dynamic'

/** { phone } → a login code by WhatsApp. Same answer whether the number has an account or not. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const r = await requestPhoneCode({ phone: typeof body.phone === 'string' ? body.phone : '', ip: clientIp(request.headers) })
  return r.ok ? NextResponse.json({ ok: true, sentTo: r.sentTo }) : NextResponse.json({ error: r.error }, { status: r.status })
}
