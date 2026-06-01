import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications/notificationService'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const logger = createLogger('cron-notification-reminders')

function combineDateAndTime(date: Date, time: string): Date | null {
  const [hh, mm] = (time || '').split(':').map((n) => Number.parseInt(n, 10))
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null
  const d = new Date(date)
  d.setHours(hh, mm, 0, 0)
  return d
}

async function runBookingReminder24h(now: Date) {
  const in23h = new Date(now.getTime() + 23 * 60 * 60 * 1000)
  const in25h = new Date(now.getTime() + 25 * 60 * 60 * 1000)

  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ['CONFIRMED'] },
      scheduledDate: { gte: in23h, lte: in25h },
    },
    include: { partner: { include: { user: true } } },
    take: 200,
  })

  let sent = 0
  for (const b of bookings) {
    const startsAt = combineDateAndTime(b.scheduledDate, b.scheduledTime) ?? b.scheduledDate
    const diffH = (startsAt.getTime() - now.getTime()) / (60 * 60 * 1000)
    if (diffH < 23 || diffH > 25) continue

    await createNotification({
      userId: b.userId,
      type: 'BOOKING_REMINDER_24H',
      title: 'Recordatorio: tu servicio es mañana',
      message: `Mañana a las ${b.scheduledTime} tienes el servicio agendado.`,
      data: { bookingId: b.id },
    })

    if (b.partner?.user?.id) {
      await createNotification({
        userId: b.partner.user.id,
        type: 'BOOKING_REMINDER_24H',
        title: 'Recordatorio: servicio agendado mañana',
        message: `Mañana a las ${b.scheduledTime} tienes el servicio agendado.`,
        data: { bookingId: b.id },
      })
    }
    sent++
  }
  return sent
}

async function runBookingStartingSoon(now: Date) {
  const inHalfH = new Date(now.getTime() + 30 * 60 * 1000)
  const inHourPlus = new Date(now.getTime() + 90 * 60 * 1000)

  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ['CONFIRMED'] },
      scheduledDate: { gte: inHalfH, lte: inHourPlus },
    },
    include: { partner: { include: { user: true } } },
    take: 200,
  })

  let sent = 0
  for (const b of bookings) {
    const startsAt = combineDateAndTime(b.scheduledDate, b.scheduledTime) ?? b.scheduledDate
    const diffMin = (startsAt.getTime() - now.getTime()) / (60 * 1000)
    if (diffMin < 30 || diffMin > 90) continue

    await createNotification({
      userId: b.userId,
      type: 'BOOKING_STARTING_SOON',
      title: 'Tu servicio empieza pronto',
      message: `Tu servicio empieza a las ${b.scheduledTime}.`,
      data: { bookingId: b.id },
    })

    if (b.partner?.user?.id) {
      await createNotification({
        userId: b.partner.user.id,
        type: 'BOOKING_STARTING_SOON',
        title: 'Tu servicio empieza pronto',
        message: `El servicio empieza a las ${b.scheduledTime}.`,
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
    select: { id: true, userId: true, service: { select: { name: true } } },
    take: 200,
  })

  for (const r of requests) {
    await createNotification({
      userId: r.userId,
      type: 'REQUEST_EXPIRING_SOON',
      title: 'Tu solicitud expira pronto',
      message: `Tu solicitud de ${r.service.name} expira en menos de 2 horas. Revisa las propuestas recibidas.`,
      data: { serviceRequestId: r.id },
    })
  }
  return requests.length
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

async function handler(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  const now = new Date()
  try {
    const [r24, r1, expiring, ratings] = await Promise.all([
      runBookingReminder24h(now).catch((e) => { logger.error('24h reminder failed', e); return 0 }),
      runBookingStartingSoon(now).catch((e) => { logger.error('1h reminder failed', e); return 0 }),
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

export const GET = handler
export const POST = handler
