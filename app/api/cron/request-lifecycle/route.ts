import { NextResponse } from 'next/server'
import { cronRoute } from '@/lib/system/cron'
import { expireOverdueRequests, resendUnansweredRequests } from '@/lib/service-requests/ops'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Every 15 min: one more round to partners for requests without proposals after 2 h, then expiry. */
export const GET = cronRoute('request-lifecycle', async () => {
  const now = new Date()
  const resend = await resendUnansweredRequests(now)
  const expiry = await expireOverdueRequests(now)
  return NextResponse.json({ ok: true, ...resend, ...expiry })
})
export const POST = GET
