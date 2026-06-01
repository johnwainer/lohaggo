import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications/notificationService'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const logger = createLogger('cron-payment-reminders')

const REMINDER_INTERVAL_HOURS = 24
const MAX_REMINDERS = 5

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
    const partnerUserId = payment.booking.partner?.user?.id
    if (!partnerUserId) continue

    await createNotification({
      userId: partnerUserId,
      type: 'BOOKING_COMPLETED',
      title: 'Recordatorio: confirma el pago del cliente',
      message: `El cliente reporto haber pagado en ${payment.clientReportedMethod === 'CASH' ? 'efectivo' : 'transferencia'}. Confirma o rechaza desde tu panel.`,
      data: { bookingId: payment.bookingId, kind: 'PAYMENT_REMINDER' },
    })

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        lastReminderAt: new Date(),
        reminderCount: { increment: 1 },
      },
    })
    sent++
  }

  return { scanned: pending.length, sent }
}

export async function POST(request: NextRequest) {
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

export async function GET(request: NextRequest) {
  return POST(request)
}
