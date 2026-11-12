import { NextRequest, NextResponse } from 'next/server'
import { bookingWhen } from '@/lib/bookings/when'
import { FOLLOWUP_SINCE, marksFor } from '@/lib/bookings/followups'
import { clientReminderText, partnerDayReminderText, reminderPlan } from '@/lib/bookings/followups-core'
import { cronRoute } from '@/lib/system/cron'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications/notificationService'
import { createLogger } from '@/lib/logger'
import { formatBookingWhen } from '@/lib/bookings/ops'
import { REMINDER_WINDOWS, candidateScheduledRange, expiringSoonMessage, inReminderWindow } from '@/lib/notifications/reminder-window'
import { waBookingReminder, waRatingReminder, waRequestExpiring } from '@/lib/messaging/wa-events'
import { runWaPaymentPending } from '@/lib/messaging/wa-scheduled'
import { willAutoExtend } from '@/lib/service-requests/ops'

export const dynamic = 'force-dynamic'

const logger = createLogger('cron-notification-reminders')

type ReminderType = 'BOOKING_REMINDER_24H' | 'BOOKING_STARTING_SOON' | 'REQUEST_EXPIRING_SOON'

/**
 * One query for all the users of the run (userId + type + createdAt are the filters the existing indexes serve),
 * then the entity id is matched in memory: no per-candidate `data contains` scan. The windows span several runs,
 * so each side must be checked on its own.
 */
async function remindedChecker(userIds: string[], type: ReminderType, since: Date) {
  const rows = userIds.length ? await prisma.notification.findMany({ where: { userId: { in: Array.from(new Set(userIds)) }, type, createdAt: { gte: since } }, select: { userId: true, data: true } }) : []
  const byUser = new Map<string, string[]>()
  for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r.data ?? ''])
  return (userId: string, entityId: string) => (byUser.get(userId) ?? []).some((d) => d.includes(entityId))
}

async function remindBookings(now: Date, kind: 'day' | 'soon') {
  const bookings = await prisma.booking.findMany({
    where: { status: 'CONFIRMED', scheduledDate: candidateScheduledRange(now) },
    select: { id: true, userId: true, scheduledDate: true, scheduledTime: true, address: true, city: true, totalPrice: true, service: { select: { name: true } }, user: { select: { name: true } }, partner: { select: { userId: true, rating: true, totalReviews: true, user: { select: { name: true } } } }, proposal: { select: { notes: true } } },
    take: 500,
  })
  const type = kind === 'day' ? 'BOOKING_REMINDER_24H' as const : 'BOOKING_STARTING_SOON' as const
  const since = new Date(now.getTime() - 26 * 3600_000)
  const due = bookings.filter((b) => inReminderWindow(b, now, REMINDER_WINDOWS[kind]))
  const marks = await marksFor(due.map((b) => b.id))
  const reminded = await remindedChecker(due.flatMap((b) => [b.userId, ...(b.partner?.userId ? [b.partner.userId] : [])]), type, since)

  let sent = 0
  for (const b of due) {
    // One reminder per moment per person: the window spans several runs, so each side is checked on its own
    const when = bookingWhen(b).getTime()
    const plan = reminderPlan(kind, { now: now.getTime(), when, followupLive: when >= FOLLOWUP_SINCE.getTime(), marks: marks.get(b.id) ?? new Map() })
    const client = plan.client && !reminded(b.userId, b.id) ? plan.client : null
    const partnerUserId = plan.partner && b.partner?.userId && !reminded(b.partner.userId, b.id) ? b.partner.userId : null
    if (!client && !partnerUserId) continue
    const time = formatBookingWhen(b).split(' ').pop()
    const service = b.service?.name ?? 'servicio'
    // B11/B12 + C17/C18 by template first (deduped per booking and hour); the notifications' free-text WhatsApp is then skipped.
    // At night the client gets it only in the app and push.
    await waBookingReminder(b.id, kind, { skipClient: client !== 'all', skipPartner: !partnerUserId })

    if (client) {
      await createNotification({
        userId: b.userId,
        type,
        title: kind === 'day' ? 'Recordatorio: tu servicio es mañana' : 'Tu servicio empieza pronto',
        // The partner's first name and rating, and what to have ready (access, materials when agreed)
        message: clientReminderText({ kind, service, time: time ?? '', partnerName: b.partner?.user?.name ?? null, rating: b.partner?.rating ?? null, reviews: b.partner?.totalReviews ?? 0, proposalNotes: b.proposal?.notes ?? null }),
        data: { bookingId: b.id, url: '/dashboard?tab=bookings' },
        ...(client === 'app' ? { channels: ['PUSH' as const] } : {}),
      })
    }

    if (partnerUserId) {
      // After the booking the partner sees the exact address (and the day before, the client's first name and the agreed price)
      await createNotification({
        userId: partnerUserId,
        type,
        title: kind === 'day' ? 'Recordatorio: servicio agendado mañana' : 'Tu servicio empieza pronto',
        message: kind === 'day'
          ? partnerDayReminderText({ service, time: time ?? '', clientName: b.user?.name ?? null, address: b.address, city: b.city, price: b.totalPrice })
          : `${service} con ${b.user?.name ?? 'el cliente'} empieza a las ${time} en ${b.address}, ${b.city}. Al llegar, márcalo como iniciado.`,
        data: { bookingId: b.id, url: '/partner?tab=bookings' },
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
    select: { id: true, userId: true, preferredDate: true, preferredTime: true, isUrgent: true, expiresAt: true, service: { select: { name: true } }, _count: { select: { proposals: true } } },
    take: 200,
  })

  const reminded = await remindedChecker(requests.map((r) => r.userId), 'REQUEST_EXPIRING_SOON', new Date(now.getTime() - 3 * 3600_000))
  let sent = 0
  for (const r of requests) {
    if (reminded(r.userId, r.id)) continue
    // Unanswered with its date still ahead: request-lifecycle extends it instead (B5 only when it really expires)
    if (await willAutoExtend({ ...r, proposals: r._count.proposals }, now).catch(() => false)) continue
    await waRequestExpiring(r.id, now)
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
      await waRatingReminder(b.id)
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
    const [r24, r1, expiring, ratings, paymentPending] = await Promise.all([
      remindBookings(now, 'day').catch((e) => { logger.error('24h reminder failed', e); return 0 }),
      remindBookings(now, 'soon').catch((e) => { logger.error('1h reminder failed', e); return 0 }),
      runRequestExpiringSoon(now).catch((e) => { logger.error('request expiring failed', e); return 0 }),
      runRatingReminder(now).catch((e) => { logger.error('rating reminder failed', e); return 0 }),
      runWaPaymentPending(now).catch((e) => { logger.error('payment pending WhatsApp failed', e); return {} }),
    ])
    logger.info('Notification reminders run complete', { r24, r1, expiring, ratings, paymentPending })
    return NextResponse.json({ ok: true, sent: { booking24h: r24, bookingSoon: r1, requestExpiring: expiring, ratingReminder: ratings, whatsapp: paymentPending } })
  } catch (error) {
    logger.error('Cron failed', error)
    return NextResponse.json({ ok: false, error: 'Cron run failed' }, { status: 500 })
  }
}

export const GET = cronRoute('notification-reminders', handler)
export const POST = GET
