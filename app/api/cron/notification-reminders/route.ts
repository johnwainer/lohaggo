import { NextRequest, NextResponse } from 'next/server'
import { cronRoute } from '@/lib/system/cron'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications/notificationService'
import { createLogger } from '@/lib/logger'
import { formatBookingWhen } from '@/lib/bookings/ops'
import { REMINDER_WINDOWS, candidateScheduledRange, expiringSoonMessage, inReminderWindow } from '@/lib/notifications/reminder-window'

export const dynamic = 'force-dynamic'

const logger = createLogger('cron-notification-reminders')

/** Whether this user already got this reminder type for this entity recently (the windows span several runs). */
async function alreadyReminded(userId: string, type: 'BOOKING_REMINDER_24H' | 'BOOKING_STARTING_SOON' | 'REQUEST_EXPIRING_SOON', entityId: string, since: Date) {
  const hit = await prisma.notification.findFirst({ where: { userId, type, createdAt: { gte: since }, data: { contains: entityId } }, select: { id: true } })
  return Boolean(hit)
}

async function remindBookings(now: Date, kind: 'day' | 'soon') {
  const bookings = await prisma.booking.findMany({
    where: { status: 'CONFIRMED', scheduledDate: candidateScheduledRange(now) },
    include: { partner: { include: { user: true } } },
    take: 500,
  })
  const type = kind === 'day' ? 'BOOKING_REMINDER_24H' as const : 'BOOKING_STARTING_SOON' as const
  const since = new Date(now.getTime() - 26 * 3600_000)

  let sent = 0
  for (const b of bookings) {
    if (!inReminderWindow(b, now, REMINDER_WINDOWS[kind])) continue
    if (await alreadyReminded(b.userId, type, b.id, since)) continue
    const time = formatBookingWhen(b).split(' ').pop()

    await createNotification({
      userId: b.userId,
      type,
      title: kind === 'day' ? 'Recordatorio: tu servicio es mañana' : 'Tu servicio empieza pronto',
      message: kind === 'day' ? `Mañana a las ${time} tienes el servicio agendado.` : `Tu servicio empieza a las ${time}.`,
      data: { bookingId: b.id },
    })

    if (b.partner?.user?.id) {
      await createNotification({
        userId: b.partner.user.id,
        type,
        title: kind === 'day' ? 'Recordatorio: servicio agendado mañana' : 'Tu servicio empieza pronto',
        message: kind === 'day' ? `Mañana a las ${time} tienes el servicio agendado.` : `El servicio empieza a las ${time}.`,
        data: { bookingId: b.id },
      })
    }
    sent++
  }
  return sent
}

async function runRequestExpiringSoon(now: Date) {
  const in1h = new Date(now.getTime() + 60 * 60 * 1000)
  const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000)

  const requests = await prisma.serviceRequest.findMany({
    where: {
      status: 'ACTIVE',
      expiresAt: { gte: in1h, lte: in2h },
    },
    select: { id: true, userId: true, service: { select: { name: true } }, _count: { select: { proposals: true } } },
    take: 200,
  })

  let sent = 0
  for (const r of requests) {
    if (await alreadyReminded(r.userId, 'REQUEST_EXPIRING_SOON', r.id, new Date(now.getTime() - 3 * 3600_000))) continue
    await createNotification({
      userId: r.userId,
      type: 'REQUEST_EXPIRING_SOON',
      title: 'Tu solicitud expira pronto',
      message: expiringSoonMessage(r.service.name, r._count.proposals),
      data: { serviceRequestId: r.id, url: '/dashboard?tab=requests' },
    })
    sent++
  }
  return sent
}

async function runRatingReminder(now: Date) {
  const cutoffStart = new Date(now.getTime() - 26 * 60 * 60 * 1000)
  const cutoffEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // Bookings completados o pagados hace ~24h sin review completo
  const candidates = await prisma.booking.findMany({
    where: {
      status: { in: ['COMPLETED'] },
      updatedAt: { gte: cutoffStart, lte: cutoffEnd },
    },
    select: {
      id: true,
      userId: true,
      partner: { select: { user: { select: { id: true } } } },
      review: { select: { clientToPartnerRating: true, partnerToClientRating: true } },
    },
    take: 200,
  })

  let sent = 0
  for (const b of candidates) {
    const r = b.review
    if (!r?.clientToPartnerRating) {
      await createNotification({
        userId: b.userId,
        type: 'RATING_REMINDER',
        title: 'Califica tu servicio',
        message: 'Tu opinión ayuda a la comunidad. Califica el servicio que recibiste ayer.',
        data: { bookingId: b.id },
      })
      sent++
    }
    if (!r?.partnerToClientRating && b.partner?.user?.id) {
      await createNotification({
        userId: b.partner.user.id,
        type: 'RATING_REMINDER',
        title: 'Califica a tu cliente',
        message: 'Tu opinión ayuda a la comunidad. Califica al cliente del servicio que completaste ayer.',
        data: { bookingId: b.id },
      })
      sent++
    }
  }
  return sent
}

async function handler(_req: NextRequest) {
  const now = new Date()
  try {
    const [r24, r1, expiring, ratings] = await Promise.all([
      remindBookings(now, 'day').catch((e) => { logger.error('24h reminder failed', e); return 0 }),
      remindBookings(now, 'soon').catch((e) => { logger.error('1h reminder failed', e); return 0 }),
      runRequestExpiringSoon(now).catch((e) => { logger.error('request expiring failed', e); return 0 }),
      runRatingReminder(now).catch((e) => { logger.error('rating reminder failed', e); return 0 }),
    ])
    logger.info('Notification reminders run complete', { r24, r1, expiring, ratings })
    return NextResponse.json({ ok: true, sent: { booking24h: r24, bookingSoon: r1, requestExpiring: expiring, ratingReminder: ratings } })
  } catch (error) {
    logger.error('Cron failed', error)
    return NextResponse.json({ ok: false, error: 'Cron run failed' }, { status: 500 })
  }
}

export const GET = cronRoute('notification-reminders', handler)
export const POST = GET
