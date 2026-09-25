import { NextRequest, NextResponse } from 'next/server'
import { cronRoute } from '@/lib/system/cron'
import { prisma } from '@/lib/prisma'
import { MAX_REMINDERS, REMINDER_INTERVAL_HOURS, sendPaymentReminder } from '@/lib/ops/platform-ops'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const logger = createLogger('cron-payment-reminders')

async function run() {
  const cutoff = new Date(Date.now() - REMINDER_INTERVAL_HOURS * 60 * 60 * 1000)

  const pending = await prisma.payment.findMany({
    where: {
      confirmationStatus: 'CLIENT_REPORTED',
      reminderCount: { lt: MAX_REMINDERS },
      OR: [
        { lastReminderAt: null, clientReportedAt: { lte: cutoff } },
        { lastReminderAt: { lte: cutoff } },
      ],
    },
    include: {
      booking: { include: { partner: { include: { user: true } } } },
    },
    take: 100,
  })

  let sent = 0
  for (const payment of pending) {
    if (await sendPaymentReminder({ id: payment.id, bookingId: payment.bookingId, clientReportedMethod: payment.clientReportedMethod, partnerUserId: payment.booking.partner?.user?.id ?? null })) sent++
  }

  return { scanned: pending.length, sent }
}

async function handle(request: NextRequest) {
  const secret = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && secret !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await run()
    logger.info('Payment reminders sent', result)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    logger.error('Payment reminders error', { err })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const GET = cronRoute('payment-reminders', handle)
export const POST = GET
