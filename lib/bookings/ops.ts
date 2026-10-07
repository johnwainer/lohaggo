import { prisma } from '@/lib/prisma'
import { emitUserDataBroadcast } from '@/lib/supabase-admin'
import { createLogger } from '@/lib/logger'
import { notifyBookingStatusChange, createNotification } from '@/lib/notifications/notificationService'
import { computeRefundPolicy, calculateSlaDueAt } from '@/lib/launch-ops'
import { recordPromptContext } from '@/lib/pwa/adoption-strategy'
import { scheduleAutomationsForUser } from '@/lib/messaging/automation-service'
import { APP_ORIGIN, OpsError, actorTypeOf, originColumns, type Actor, type Origin } from '@/lib/ops/origin'
import { runAfterResponse } from '@/lib/ops/after'
import type { BookingStatus } from '@prisma/client'
import { BOOKING_STATUS_LABEL, canTransition, transitionRoleOf, type TransitionRole } from '@/lib/bookings/transitions'

/**
 * Booking operations shared by the API routes, the admin and the inbox AI agents. They load, check
 * ownership and state, write the change plus its BookingEvent and fire the same side effects the app
 * always had. They do not check the session (the caller builds the Actor) nor write the audit log.
 */

export { BOOKING_TRANSITIONS, BOOKING_STATUS_LABEL, canTransition, transitionRoleOf, type TransitionRole } from '@/lib/bookings/transitions'

const logger = createLogger('bookings-ops')

export { bookingWhen, formatBookingWhen } from '@/lib/bookings/when'
import { bookingWhen, dateOnlyUtc, formatBookingWhen } from '@/lib/bookings/when'

export const formatCOP = (n: number) => `$${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n)}`

type SummaryInput = {
  id: string
  scheduledDate: Date
  scheduledTime: string
  address: string
  totalPrice: number
  status: BookingStatus
  service?: { name: string } | null
  partner?: { user?: { name?: string | null } | null } | null
}

/** One compact Spanish line about a booking, for an agent to read or repeat in a chat. */
export function bookingSummaryForChat(b: SummaryInput) {
  const parts = [
    `Reserva #${b.id.slice(-6)}`,
    b.service?.name ?? 'Servicio',
    formatBookingWhen(b),
    b.address,
    formatCOP(b.totalPrice),
    BOOKING_STATUS_LABEL[b.status],
  ]
  if (b.partner?.user?.name) parts.push(`socio ${b.partner.user.name}`)
  return parts.join(' · ')
}

export const BOOKING_INCLUDE = {
  service: true,
  user: { select: { name: true, email: true, phone: true } },
  partner: { include: { user: { select: { id: true, name: true, phone: true } } } },
} as const

/** Throws 403 unless the actor may act on the booking: owner client, the booking's partner, or any admin. */
export function assertBookingAccess(actor: Actor, booking: { userId: string; partnerId: string | null }) {
  if (actor.role === 'ADMIN') return
  if (actor.role === 'CLIENT' && booking.userId === actor.userId) return
  if (actor.role === 'PARTNER') {
    if (!actor.partnerId) throw new OpsError('Perfil de socio no encontrado', 403)
    if (booking.partnerId === actor.partnerId) return
  }
  throw new OpsError('No autorizado', 403)
}

export async function loadBooking(bookingId: string) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
  if (!booking) throw new OpsError('Reserva no encontrada', 404)
  return booking
}

export async function addBookingEvent(p: {
  bookingId: string
  type: 'status' | 'reschedule' | 'payment' | 'guarantee'
  actor: Actor
  origin: Origin
  fromStatus?: BookingStatus | null
  toStatus?: BookingStatus | null
  detail?: string | null
}) {
  const event = await prisma.bookingEvent.create({
    data: {
      bookingId: p.bookingId,
      type: p.type,
      fromStatus: p.fromStatus ?? null,
      toStatus: p.toStatus ?? null,
      actorType: actorTypeOf(p.actor, p.origin),
      actorId: p.actor.userId,
      ...originColumns(p.origin),
      detail: p.detail ?? null,
    },
  })
  // Every change to a booking passes here: the client's and the partner's open panels reload it
  void prisma.booking.findUnique({ where: { id: p.bookingId }, select: { userId: true, partner: { select: { userId: true } } } })
    .then((b) => {
      if (b?.userId) void emitUserDataBroadcast(b.userId, 'bookings')
      if (b?.partner?.userId) void emitUserDataBroadcast(b.partner.userId, 'bookings')
    })
    .catch(() => null)
  return event
}

const AUTOMATION_TRIGGER: Partial<Record<BookingStatus, 'BOOKING_CONFIRMED' | 'BOOKING_COMPLETED' | 'BOOKING_CANCELLED'>> = {
  CONFIRMED: 'BOOKING_CONFIRMED',
  COMPLETED: 'BOOKING_COMPLETED',
  CANCELLED: 'BOOKING_CANCELLED',
}

/** Everything the app always did after a status change: notifications, PWA prompt context, automations. */
async function afterStatusChange(actor: Actor, booking: { id: string; userId: string; partnerId: string | null }, to: BookingStatus) {
  await notifyBookingStatusChange(booking.id, to)

  if (actor.role === 'PARTNER') {
    await recordPromptContext(actor.userId, 'PARTNER_BOOKING_STATUS_CHANGED', { bookingId: booking.id, status: to }).catch(() => undefined)
  }

  const trigger = AUTOMATION_TRIGGER[to]
  if (!trigger) return
  scheduleAutomationsForUser(booking.userId, trigger, { targetRole: 'CLIENT', contextId: booking.id }).catch(() => null)
  if (booking.partnerId) {
    const partner = await prisma.partnerProfile.findUnique({ where: { id: booking.partnerId }, select: { userId: true } })
    if (partner) scheduleAutomationsForUser(partner.userId, trigger, { targetRole: 'PARTNER', contextId: booking.id }).catch(() => null)
  }
}

/** Refund case, incident and support case when a paid booking is cancelled (what the DELETE route did). */
async function openRefundCaseIfPaid(actor: Actor, origin: Origin, booking: { id: string; userId: string; partnerId: string | null; status: BookingStatus; scheduledDate: Date; scheduledTime: string }) {
  const payment = await prisma.payment.findUnique({ where: { bookingId: booking.id }, select: { id: true, status: true, totalAmount: true } })
  if (!payment || payment.status !== 'APPROVED') return null

  const policy = computeRefundPolicy({ bookingStatus: booking.status, totalAmount: Number(payment.totalAmount), scheduledDate: bookingWhen(booking) })
  const requestedBy = actor.email ?? 'chat'
  const severity = policy.requiresManualReview ? 'HIGH' : 'MEDIUM'

  const refundCase = await prisma.refundCase.create({
    data: {
      bookingId: booking.id,
      paymentId: payment.id,
      userId: booking.userId,
      partnerId: booking.partnerId || null,
      reason: 'Cancelación de reserva',
      policyCode: policy.policyCode,
      status: policy.requiresManualReview ? 'UNDER_REVIEW' : 'APPROVED',
      requestedAmount: Number(payment.totalAmount),
      approvedAmount: policy.requiresManualReview ? null : policy.refundableAmount,
      requestedBy,
      reviewNotes: policy.reason,
      metadata: JSON.stringify({ source: 'booking-cancel', cancelledByRole: actor.role, refundableAmount: policy.refundableAmount, origin: origin.via }),
    },
  })
  const { waRefundStatus } = await import('@/lib/messaging/wa-events')
  await waRefundStatus(refundCase.id)

  const incident = await prisma.paymentIncident.create({
    data: {
      paymentId: payment.id,
      bookingId: booking.id,
      userId: booking.userId,
      partnerId: booking.partnerId || null,
      incidentType: 'REFUND_DISPUTE',
      status: policy.requiresManualReview ? 'ACTION_REQUIRED' : 'RESOLVED',
      severity,
      source: 'booking-cancel',
      title: 'Caso de reembolso por cancelación',
      description: policy.reason,
      assignedTo: 'ops@lohaggo.com',
      slaDueAt: calculateSlaDueAt(severity),
      metadata: JSON.stringify({ refundCaseId: refundCase.id }),
    },
  })

  await prisma.paymentIncidentEvent.create({
    data: { incidentId: incident.id, actorEmail: requestedBy, action: 'REFUND_CASE_CREATED', note: `Caso ${refundCase.id} creado por cancelación` },
  })

  await prisma.adminSupportCase.create({
    data: {
      userId: booking.userId,
      bookingId: booking.id,
      priority: severity,
      status: 'OPEN',
      queue: 'REFUNDS',
      subject: `Reembolso por cancelación #${booking.id}`,
      description: `${policy.reason}. Monto solicitado: ${payment.totalAmount}`,
      assignedTo: 'ops@lohaggo.com',
      slaDueAt: calculateSlaDueAt(severity),
    },
  })

  return refundCase
}

/**
 * Moves a booking to `to` on behalf of the actor: ownership (403), state machine (400, or 409 when it is
 * already there), update + BookingEvent, then the app's side effects. Cancelling a paid booking also opens
 * the refund case.
 */
export async function transitionBooking(actor: Actor, bookingId: string, to: BookingStatus, origin: Origin, opts: { reason?: string; reopen?: boolean } = {}) {
  const booking = await loadBooking(bookingId)
  assertBookingAccess(actor, booking)

  const check = canTransition(booking.status, to, transitionRoleOf(actor))
  if (!check.ok) throw new OpsError(check.reason, booking.status === to ? 409 : 400)
  // Clients and partners always say why they cancel (the other side and support see it)
  if (to === 'CANCELLED' && actor.role !== 'ADMIN' && (opts.reason ?? '').trim().length < 5) throw new OpsError('Cuéntanos el motivo de la cancelación', 400)

  // Guarded on the status read: two changes at once (partner + client, or a double tap) apply only once
  const res = await prisma.booking.updateMany({ where: { id: bookingId, status: booking.status }, data: { status: to } })
  if (res.count === 0) throw new OpsError('La reserva cambió de estado; recarga', 409)
  if (to === 'COMPLETED') await countCompletedService(booking)
  const updated = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId }, include: BOOKING_INCLUDE })
  await addBookingEvent({ bookingId, type: 'status', actor, origin, fromStatus: booking.status, toStatus: to, detail: opts.reason ?? null })

  if (to === 'CANCELLED') await openRefundCaseIfPaid(actor, origin, booking)
  // The partner dropped it, or the team cancelled it to give it to other partners
  const reopened = to === 'CANCELLED' && (actor.role === 'PARTNER' || (actor.role === 'ADMIN' && opts.reopen)) ? await reopenRequestAfterPartnerCancel(booking) : false
  // WhatsApp template first: the notifications' free-text WhatsApp is then skipped for that person
  const { waBookingStatus } = await import('@/lib/messaging/wa-events')
  await waBookingStatus({ bookingId, from: booking.status, to, actorRole: actor.role, origin, reopened, reason: opts.reason ?? null })
  await afterStatusChange(actor, booking, to)
  if (to === 'COMPLETED') schedulePurchaseConversion(bookingId)

  return updated
}

/** One more completed service for the partner and the client (called once, on the move into COMPLETED). */
async function countCompletedService(booking: { id: string; userId: string; partnerId: string | null }) {
  try {
    await prisma.$transaction([
      ...(booking.partnerId ? [prisma.partnerProfile.update({ where: { id: booking.partnerId }, data: { completedServicesCount: { increment: 1 } } })] : []),
      prisma.user.update({ where: { id: booking.userId }, data: { completedServicesCount: { increment: 1 } } }),
    ])
  } catch (err) {
    logger.warn('completedServicesCount not incremented (non-fatal)', { bookingId: booking.id, err: err instanceof Error ? err.message : err })
  }
}

/** Purchase to Meta / GA4 after the response; the ledger keeps it to one per booking (completed or paid). */
export function schedulePurchaseConversion(bookingId: string) {
  runAfterResponse(async () => {
    const { sendPurchaseConversion } = await import('@/lib/analytics/conversions')
    await sendPurchaseConversion(bookingId)
  })
}

export const REQUEST_REOPEN_ACTION = 'REQUEST_REOPEN'

/**
 * The partner dropped a booking: its request opens again for 24 h so other partners can propose (the
 * proposals the client had not chosen come back), and matching partners are told. Returns whether it reopened.
 */
async function reopenRequestAfterPartnerCancel(booking: { id: string; proposalId: string | null; partnerId: string | null }) {
  try {
    if (!booking.proposalId) return false
    const proposal = await prisma.proposal.findUnique({ where: { id: booking.proposalId }, select: { id: true, serviceRequestId: true, serviceRequest: { select: { status: true, partnerId: true } } } })
    if (!proposal || proposal.serviceRequest.status !== 'ACCEPTED') return false
    const expiresAt = new Date(Date.now() + 24 * 3600_000)
    const res = await prisma.serviceRequest.updateMany({
      where: { id: proposal.serviceRequestId, status: 'ACCEPTED' },
      // A request directed to this partner opens to everyone
      data: { status: 'ACTIVE', expiresAt, ...(proposal.serviceRequest.partnerId ? { partnerId: null } : {}) },
    })
    if (res.count === 0) return false
    await prisma.proposal.update({ where: { id: proposal.id }, data: { status: 'REJECTED' } })
    // Only the proposals the accept closed come back (not the ones the client turned down before)
    const closed = await prisma.adminAuditLog.findFirst({ where: { action: 'PROPOSALS_CLOSED_BY_ACCEPT', entityType: 'ServiceRequest', entityId: proposal.serviceRequestId }, orderBy: { createdAt: 'desc' }, select: { details: true } })
    const closedIds = closedProposalIds(closed?.details).filter((id) => id !== proposal.id)
    const restored = closedIds.length
      ? await prisma.proposal.updateMany({ where: { id: { in: closedIds }, serviceRequestId: proposal.serviceRequestId, status: 'REJECTED' }, data: { status: 'PENDING' } })
      : { count: 0 }
    const previousReopens = await prisma.adminAuditLog.count({ where: { action: REQUEST_REOPEN_ACTION, entityType: 'ServiceRequest', entityId: proposal.serviceRequestId } })
    await prisma.adminAuditLog.create({
      data: { action: REQUEST_REOPEN_ACTION, entityType: 'ServiceRequest', entityId: proposal.serviceRequestId, actorEmail: 'sistema', details: JSON.stringify({ bookingId: booking.id, restoredProposals: restored.count, expiresAt: expiresAt.toISOString() }) },
    })
    const { notifyNewServiceRequest } = await import('@/lib/notifications/notificationService')
    await notifyNewServiceRequest(proposal.serviceRequestId, { partnersOnly: true, round: 20 + previousReopens + 1 }).catch(() => 0)
    return true
  } catch (err) {
    logger.warn('Request not reopened after the partner cancelled (the booking is cancelled anyway)', { bookingId: booking.id, err: err instanceof Error ? err.message : err })
    return false
  }
}

function closedProposalIds(details?: string | null): string[] {
  try {
    const ids = (JSON.parse(details ?? '{}') as { proposalIds?: unknown }).proposalIds
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * Status change made by the platform itself (a payment webhook, a cron): no role check, actorType 'system',
 * origin app. Returns null when the booking is already there.
 */
export async function systemTransition(bookingId: string, to: BookingStatus, detail?: string) {
  const booking = await loadBooking(bookingId)
  if (booking.status === to) return null
  const res = await prisma.booking.updateMany({ where: { id: bookingId, status: booking.status }, data: { status: to } })
  if (res.count === 0) return null
  if (to === 'COMPLETED') await countCompletedService(booking)
  const updated = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId }, include: BOOKING_INCLUDE })
  await prisma.bookingEvent.create({
    data: { bookingId, type: 'status', fromStatus: booking.status, toStatus: to, actorType: 'system', ...originColumns(APP_ORIGIN), detail: detail ?? null },
  })
  if (to === 'COMPLETED') schedulePurchaseConversion(bookingId)
  return updated
}

export type RescheduleInput = { scheduledDate: Date; scheduledTime: string }

/**
 * Moves the service to another date/time. Only PENDING or CONFIRMED bookings; at least one hour ahead.
 * When the client moves a CONFIRMED booking it goes back to PENDING so the partner confirms again.
 */
export async function rescheduleBooking(actor: Actor, bookingId: string, when: RescheduleInput, origin: Origin) {
  const booking = await loadBooking(bookingId)
  assertBookingAccess(actor, booking)

  if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
    throw new OpsError(`Una reserva ${BOOKING_STATUS_LABEL[booking.status].toLowerCase()} no se puede reprogramar`)
  }
  if (!/^\d{2}:\d{2}$/.test(when.scheduledTime)) throw new OpsError('La hora debe tener el formato HH:mm')
  if (Number.isNaN(when.scheduledDate.getTime())) throw new OpsError('Fecha inválida')
  const at = bookingWhen(when)
  if (at.getTime() < Date.now() + 60 * 60 * 1000) throw new OpsError('La nueva fecha debe ser al menos una hora después de ahora')

  const previous = { scheduledDate: booking.scheduledDate, scheduledTime: booking.scheduledTime }
  const before = formatBookingWhen(previous)
  const after = formatBookingWhen(when)
  const backToPending = booking.status === 'CONFIRMED' && actor.role === 'CLIENT'

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    // Stored the date-only way (the Bogotá day at 00:00 UTC); the hour lives in scheduledTime
    data: { scheduledDate: dateOnlyUtc(when.scheduledDate), scheduledTime: when.scheduledTime, ...(backToPending ? { status: 'PENDING' as BookingStatus } : {}) },
    include: BOOKING_INCLUDE,
  })
  await addBookingEvent({ bookingId, type: 'reschedule', actor, origin, detail: `de ${before} a ${after}` })
  if (backToPending) {
    await addBookingEvent({ bookingId, type: 'status', actor, origin, fromStatus: 'CONFIRMED', toStatus: 'PENDING', detail: 'Reprogramada por el cliente: el socio debe confirmar de nuevo' })
    // notifyBookingStatusChange has no PENDING message, so the reschedule notice below carries the news.
  }

  const { waBookingRescheduled } = await import('@/lib/messaging/wa-events')
  await waBookingRescheduled({ bookingId, actorRole: actor.role })

  // There is no NotificationType for a reschedule; BOOKING_CONFIRMED is the booking-flavoured type whose
  // action URL lands on the bookings tab of both panels, so it is reused with its own title and message.
  const serviceName = updated.service?.name ?? 'tu servicio'
  const recipients: string[] = []
  if (actor.role !== 'CLIENT') recipients.push(booking.userId)
  if (actor.role !== 'PARTNER' && updated.partner?.user?.id) recipients.push(updated.partner.user.id)
  for (const userId of recipients) {
    const forPartner = userId !== booking.userId
    await createNotification({
      userId,
      type: 'BOOKING_CONFIRMED',
      title: 'Reserva reprogramada',
      message: forPartner
        ? `La reserva de ${serviceName} con ${updated.user?.name ?? 'el cliente'} pasó a ${after}.${backToPending ? ' Confírmala de nuevo.' : ''}`
        : `Tu reserva de ${serviceName} pasó a ${after}.`,
      data: { bookingId, kind: 'BOOKING_RESCHEDULED', previous: before, next: after },
    })
  }

  return { booking: updated, previous }
}

export const BOOKINGS_LIST_INCLUDE = {
  service: { include: { category: true } },
  user: { select: { name: true, email: true, phone: true } },
  partner: {
    include: {
      user: { select: { name: true, email: true } },
      bankAccounts: {
        where: { isDefault: true },
        select: { bankName: true, accountType: true, accountNumber: true, accountHolderName: true, holderDocumentNumber: true, isDefault: true },
        take: 1,
      },
    },
  },
  review: { select: { id: true, clientToPartnerRating: true, partnerToClientRating: true } },
  payment: {
    select: {
      id: true, status: true, totalAmount: true, confirmationStatus: true, clientReportedMethod: true, clientReportedAt: true,
      partnerConfirmedMethod: true, partnerConfirmedAt: true, partnerRejectedAt: true, rejectionReason: true,
    },
  },
} as const

/** The actor's bookings: the client's own, the partner's assigned ones, everything for an admin. */
export async function bookingsFor(actor: Actor, opts: { status?: BookingStatus[]; upcomingOnly?: boolean; take?: number } = {}) {
  const where: Record<string, unknown> = {}
  if (actor.role === 'CLIENT') where.userId = actor.userId
  else if (actor.role === 'PARTNER') {
    if (!actor.partnerId) return []
    where.partnerId = actor.partnerId
  }
  if (opts.status?.length) where.status = { in: opts.status }
  if (opts.upcomingOnly) {
    // Today's Bogotá day as stored (date-only at 00:00 UTC); older instant rows of that day fall after it too
    where.scheduledDate = { gte: dateOnlyUtc(new Date()) }
  }
  const rows = await prisma.booking.findMany({
    where,
    include: BOOKINGS_LIST_INCLUDE,
    orderBy: opts.upcomingOnly ? { scheduledDate: 'asc' } : { createdAt: 'desc' },
    ...(opts.take ? { take: opts.take } : {}),
  })
  // The partner's bank account is only needed to pay by transfer: once the service is done and while it is unpaid
  return rows.map((b) => {
    const needsTransfer = b.status === 'COMPLETED' && b.payment?.status !== 'APPROVED' && b.payment?.confirmationStatus !== 'CONFIRMED'
    return needsTransfer || !b.partner ? b : { ...b, partner: { ...b.partner, bankAccounts: [] } }
  })
}
