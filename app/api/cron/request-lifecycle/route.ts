import { NextResponse } from 'next/server'
import { cronRoute } from '@/lib/system/cron'
import { autoExtendExpiringRequests, expireOverdueRequests, resendUnansweredRequests } from '@/lib/service-requests/ops'
import { widenUnansweredRequests } from '@/lib/service-requests/reach'
import { runWaLifecycle } from '@/lib/messaging/wa-scheduled'
import { runBookingFollowups } from '@/lib/bookings/followups'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Every 15 min: one more round to partners for requests without proposals after 2 h, more partners (bordering
 * zones at 60 min, the whole city at 3 h), the extension of unanswered requests whose date is still ahead, then
 * expiry, then the
 * time-based WhatsApp templates (unconfirmed and running bookings, requests without partners, guarantee
 * deadlines, the 7:00 summary and the 9:00 documents digest), and the follow-up of accepted bookings
 * (unconfirmed, no-show, not closed, unpaid: lib/bookings/followups.ts).
 */
export const GET = cronRoute('request-lifecycle', async () => {
  const now = new Date()
  const resend = await resendUnansweredRequests(now)
  const reach = await widenUnansweredRequests(now).catch(() => ({ widenError: 1 }))
  const extension = await autoExtendExpiringRequests(now).catch(() => ({ extendError: 1 }))
  const expiry = await expireOverdueRequests(now)
  const whatsapp = await runWaLifecycle(now).catch(() => ({ error: 1 }))
  const followups = await runBookingFollowups(now).catch(() => ({ error: 1 }))
  return NextResponse.json({ ok: true, ...resend, ...reach, ...extension, ...expiry, whatsapp, followups })
})
export const POST = GET
