import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications/notificationService'
import { scheduleAutomationsForUser } from '@/lib/messaging/automation-service'
import { reviewSchema } from '@/lib/validation/schemas'
import { OpsError, originColumns, type Actor, type Origin } from '@/lib/ops/origin'

/**
 * Review operations shared by /api/reviews and the inbox AI agents. They load, validate and throw
 * OpsError in Spanish; they do not check the session nor write the audit log (the caller does).
 */

export type ReviewInput = { bookingId: string; rating: number; comment?: string | null }

export const reviewWithBookingInclude = {
  booking: {
    include: {
      user: { select: { name: true, email: true } },
      partner: { include: { user: { select: { name: true, email: true } } } },
    },
  },
} as const

/**
 * The actor rates the other side of a COMPLETED booking they are part of: a client rates the partner, a
 * partner rates the client. One rating per side and booking. Recomputes the receiver's average and
 * notifies them (RATING_RECEIVED) plus the REVIEW_RECEIVED automations.
 */
export async function leaveReview(actor: Actor, input: ReviewInput, origin: Origin) {
  const parsed = reviewSchema.safeParse({ ...input, comment: input.comment ?? undefined })
  if (!parsed.success) throw new OpsError(parsed.error.errors[0]?.message || 'Datos inválidos', 400)
  const { bookingId, rating } = parsed.data
  const comment = parsed.data.comment?.trim() || null

  if (actor.role !== 'CLIENT' && actor.role !== 'PARTNER') throw new OpsError('Solo clientes y socios pueden calificar', 403)
  const side = actor.role === 'CLIENT' ? 'client' : 'partner'

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { user: { select: { id: true, name: true } }, partner: { include: { user: { select: { id: true, name: true } } } } },
  })
  if (!booking) throw new OpsError('Reserva no encontrada', 404)
  if (booking.status !== 'COMPLETED') throw new OpsError('Solo puedes calificar servicios completados', 400)

  if (side === 'client' && booking.userId !== actor.userId) throw new OpsError('No puedes calificar esta reserva', 403)
  if (side === 'partner' && booking.partner?.userId !== actor.userId) throw new OpsError('No puedes calificar esta reserva', 403)

  const existing = await prisma.review.findUnique({ where: { bookingId } })
  const now = new Date()

  if (side === 'client') {
    if (existing?.clientToPartnerRating) throw new OpsError('Ya has calificado este servicio', 400)
    if (!booking.partner || !booking.partnerId) throw new OpsError('La reserva no tiene socio asignado', 400)

    const review = await prisma.review.upsert({
      where: { bookingId },
      create: { bookingId, clientToPartnerRating: rating, clientToPartnerComment: comment, clientReviewedAt: now, ...originColumns(origin) },
      update: { clientToPartnerRating: rating, clientToPartnerComment: comment, clientReviewedAt: now },
    })

    const agg = await prisma.review.aggregate({
      where: { clientToPartnerRating: { not: null }, booking: { partnerId: booking.partnerId } },
      _avg: { clientToPartnerRating: true },
      _count: { clientToPartnerRating: true },
    })
    await prisma.partnerProfile.update({
      where: { id: booking.partnerId },
      data: { rating: agg._avg.clientToPartnerRating ?? rating, totalReviews: agg._count.clientToPartnerRating },
    })

    await notifyRated(booking.partner.userId, booking.user.name, rating, bookingId, 'PARTNER')
    return review
  }

  if (existing?.partnerToClientRating) throw new OpsError('Ya has calificado este cliente', 400)

  const review = await prisma.review.upsert({
    where: { bookingId },
    create: { bookingId, partnerToClientRating: rating, partnerToClientComment: comment, partnerReviewedAt: now, ...originColumns(origin) },
    update: { partnerToClientRating: rating, partnerToClientComment: comment, partnerReviewedAt: now },
  })

  const agg = await prisma.review.aggregate({
    where: { partnerToClientRating: { not: null }, booking: { userId: booking.userId } },
    _avg: { partnerToClientRating: true },
    _count: { partnerToClientRating: true },
  })
  await prisma.user.update({
    where: { id: booking.userId },
    data: { clientRating: agg._avg.partnerToClientRating ?? rating, clientTotalReviews: agg._count.partnerToClientRating },
  })

  await notifyRated(booking.userId, booking.partner?.user.name ?? 'El socio', rating, bookingId, 'CLIENT')
  return review
}

async function notifyRated(receiverUserId: string, raterName: string, rating: number, bookingId: string, targetRole: 'CLIENT' | 'PARTNER') {
  await createNotification({
    userId: receiverUserId,
    type: 'RATING_RECEIVED',
    title: 'Nueva calificación recibida',
    message: `${raterName} te ha calificado con ${rating} estrellas`,
    data: { bookingId, rating },
  })
  await scheduleAutomationsForUser(receiverUserId, 'REVIEW_RECEIVED', { targetRole, contextId: bookingId }).catch(() => null)
}

/** The review of a booking, only for its client, its partner or an admin. Null when nobody rated yet. */
export async function reviewsForBooking(actor: Actor, bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { userId: true, partner: { select: { userId: true } } },
  })
  if (!booking) throw new OpsError('Reserva no encontrada', 404)
  const isParty = booking.userId === actor.userId || booking.partner?.userId === actor.userId
  if (actor.role !== 'ADMIN' && !isParty) throw new OpsError('No puedes ver las calificaciones de esta reserva', 403)

  return prisma.review.findUnique({ where: { bookingId }, include: reviewWithBookingInclude })
}
