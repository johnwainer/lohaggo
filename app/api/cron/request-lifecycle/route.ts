import { NextResponse } from 'next/server'
import { cronRoute } from '@/lib/system/cron'
import { expireOverdueRequests, resendUnansweredRequests } from '@/lib/service-requests/ops'
import { runWaLifecycle } from '@/lib/messaging/wa-scheduled'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Every 15 min: one more round to partners for requests without proposals after 2 h, then expiry, then the
 * time-based WhatsApp templates (unconfirmed and running bookings, requests without partners, guarantee
 * deadlines, the 7:00 summary and the 9:00 documents digest).
 */
export const GET = cronRoute('request-lifecycle', async () => {
  const now = new Date()
  const resend = await resendUnansweredRequests(now)
  const expiry = await expireOverdueRequests(now)
  const whatsapp = await runWaLifecycle(now).catch(() => ({ error: 1 }))
  return NextResponse.json({ ok: true, ...resend, ...expiry, whatsapp })
})
export const POST = GET
