import type { Prisma } from '@prisma/client'
import { emitUserDataBroadcast } from '@/lib/supabase-admin'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { sanitizeObject } from '@/lib/validation/sanitize'
import { notifyNewProposal, notifyProposalAccepted, notifyProposalRejected } from '@/lib/notifications/notificationService'
import { scheduleAutomationsForUser } from '@/lib/messaging/automation-service'
import { recordPromptContext } from '@/lib/pwa/adoption-strategy'
import { OpsError, actorTypeOf, originColumns, type Actor, type Origin } from '@/lib/ops/origin'
import { loadPlatformConfig, preferredDateOnly } from '@/lib/service-requests/ops'
import { DEFAULT_BOOKING_TIME, bogotaClockTime, bookingWhen, dateOnlyUtc } from '@/lib/bookings/when'
import { effectiveRates } from '@/lib/payments/commission'

/**
 * Proposal operations shared by the app routes and the inbox AI agents. Same contract as the other
 * lib/*\/ops.ts: load, validate state, throw OpsError in Spanish; the caller checks the session and audits.
 */

const logger = createLogger('proposals-ops')

export const proposalInputSchema = z.object({
  serviceRequestId: z.string().min(1, 'La solicitud de servicio es requerida'),
  price: z.number().positive('El precio debe ser mayor a 0').max(100000000, 'El precio es demasiado alto'),
  notes: z.string().max(2000, 'La descripción es demasiado larga').nullable().optional(),
  /** Day and time the partner offers (Bogotá); accepting the proposal books it then */
  proposedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)').nullable().optional(),
  proposedTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (HH:mm)').nullable().optional(),
})
export type ProposalInput = z.input<typeof proposalInputSchema>

const money = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`

const proposalInclude = {
  partner: { include: { user: { select: { name: true } } } },
  serviceRequest: { include: { service: true, user: { select: { name: true, email: true } } } },
} satisfies Prisma.ProposalInclude

export const bookingInclude = {
  service: true,
  user: { select: { name: true, phone: true } },
  partner: { include: { user: { select: { id: true, name: true, phone: true } } } },
} satisfies Prisma.BookingInclude

/** A partner sends an offer on an open request. The strictest rules of the two former routes apply. */
export async function createProposal(actor: Actor, input: ProposalInput, origin: Origin) {
  const parsed = proposalInputSchema.safeParse(input)
  if (!parsed.success) throw new OpsError(parsed.error.errors[0]?.message || 'Datos inválidos', 400)
  const data = sanitizeObject(parsed.data)

  const partner = await prisma.partnerProfile.findUnique({ where: { userId: actor.userId }, select: { id: true, isActive: true, verified: true } })
  if (!partner) throw new OpsError('Solo los socios pueden enviar propuestas', 403)
  if (!partner.isActive || !partner.verified) throw new OpsError('Tu cuenta debe estar verificada y activa para enviar propuestas', 403)

  const sr = await prisma.serviceRequest.findUnique({ where: { id: data.serviceRequestId }, include: { service: true } })
  if (!sr) throw new OpsError('Solicitud no encontrada', 404)
  if (sr.status !== 'ACTIVE') throw new OpsError('Esta solicitud ya no está activa', 400)
  if (new Date(sr.expiresAt).getTime() <= Date.now()) throw new OpsError('Esta solicitud ha expirado', 400)
  if (sr.partnerId && sr.partnerId !== partner.id) throw new OpsError('Esta solicitud es directa para otro socio', 403)

  if (data.price < sr.service.basePrice) throw new OpsError(`El precio de la propuesta no puede ser menor al precio base del servicio (${money(sr.service.basePrice)})`, 400)
  const config = await loadPlatformConfig()
  if (config) {
    if (data.price < config.minServicePrice) throw new OpsError(`El precio mínimo en la plataforma es ${money(config.minServicePrice)}`, 400)
    if (data.price > config.maxServicePrice) throw new OpsError(`El precio máximo en la plataforma es ${money(config.maxServicePrice)}`, 400)
  }

  if (sr.partnerId !== partner.id) {
    const offers = await prisma.partnerService.findFirst({ where: { partnerId: partner.id, serviceId: sr.serviceId, city: sr.city, active: true }, select: { id: true } })
    if (!offers) throw new OpsError('No ofreces este servicio en la ciudad solicitada', 400)
  }

  // Stored as the date-only day (00:00 UTC) plus proposedTime; the checks use the real Bogotá moment
  const proposedDay = data.proposedDate ? preferredDateOnly(data.proposedDate) : null
  if (data.proposedDate && !proposedDay) throw new OpsError('Fecha propuesta inválida', 400)
  if (proposedDay) {
    const proposedAt = bookingWhen({ scheduledDate: proposedDay, scheduledTime: data.proposedTime || '00:00' })
    const minAt = Date.now() + (data.proposedTime ? 60 * 60_000 : -24 * 3600_000)
    if (proposedAt.getTime() < minAt) throw new OpsError(data.proposedTime ? 'La hora propuesta debe ser al menos en una hora' : 'La fecha propuesta ya pasó', 400)
    if (proposedAt.getTime() > Date.now() + 60 * 24 * 3600_000) throw new OpsError('Propón una fecha dentro de los próximos 60 días', 400)
  }

  const existing = await prisma.proposal.findUnique({ where: { serviceRequestId_partnerId: { serviceRequestId: sr.id, partnerId: partner.id } }, select: { id: true } })
  if (existing) throw new OpsError('Ya has enviado una propuesta para esta solicitud', 400)

  const proposal = await prisma.proposal.create({
    data: { serviceRequestId: sr.id, partnerId: partner.id, price: data.price, notes: data.notes || null, proposedDate: proposedDay, proposedTime: proposedDay ? data.proposedTime || null : null, status: 'PENDING', ...originColumns(origin) },
    include: proposalInclude,
  })

  try {
    await notifyNewProposal(proposal.id)
  } catch (err) {
    logger.warn('notifyNewProposal failed (non-fatal)', { proposalId: proposal.id, err })
  }
  // The client's open panel shows the new proposal at once (also if the notification could not be created)
  void emitUserDataBroadcast(sr.userId, 'requests')
  await recordPromptContext(sr.userId, 'CLIENT_PROPOSAL_RECEIVED', { proposalId: proposal.id, serviceRequestId: sr.id }).catch(() => undefined)

  return proposal
}

export function bogotaTime(d: Date) {
  return bogotaClockTime(d)
}

/** The next full hour from now (urgent request with no date). */
export function nextFullHour(now = new Date()) {
  const d = new Date(now)
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  return d
}

/** The hour an instant carries, unless it is a date-only value or a bare Bogotá midnight (older rows). */
function clockOf(d: Date): string | null {
  const isUtcMidnight = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0
  if (isUtcMidnight) return null
  const t = bogotaTime(d)
  return t === '00:00' ? null : t
}

/**
 * The booking's day and hour, stored the date-only way: `scheduledDate` is the Bogotá calendar day at
 * 00:00 UTC and the hour lives only in `scheduledTime` (never 00:00 by default: 09:00).
 */
export function resolveSchedule(
  sr: { preferredDate: Date | null; preferredTime: string | null; isUrgent: boolean },
  opts?: { scheduledDate?: Date; scheduledTime?: string },
  now = new Date(),
) {
  if (opts?.scheduledDate) {
    return { scheduledDate: dateOnlyUtc(opts.scheduledDate), scheduledTime: opts.scheduledTime || clockOf(opts.scheduledDate) || sr.preferredTime || DEFAULT_BOOKING_TIME }
  }
  if (sr.preferredDate) {
    return { scheduledDate: dateOnlyUtc(sr.preferredDate), scheduledTime: opts?.scheduledTime || sr.preferredTime || clockOf(sr.preferredDate) || DEFAULT_BOOKING_TIME }
  }
  const next = nextFullHour(now)
  return { scheduledDate: dateOnlyUtc(next), scheduledTime: opts?.scheduledTime || bogotaTime(next) }
}

/** AdminAuditLog marker (entityType ServiceRequest) with the proposal ids an accept rejected. */
export const PROPOSALS_CLOSED_BY_ACCEPT = 'PROPOSALS_CLOSED_BY_ACCEPT'

/** The client accepts an offer: the other pending offers are rejected and the booking is created. */
export async function acceptProposal(actor: Actor, proposalId: string, origin: Origin, opts?: { scheduledDate?: Date; scheduledTime?: string }) {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: { serviceRequest: { include: { user: true, service: true } }, partner: { include: { user: true } } },
  })
  if (!proposal) throw new OpsError('Propuesta no encontrada', 404)
  if (proposal.serviceRequest.userId !== actor.userId) throw new OpsError('No tienes permiso para aceptar esta propuesta', 403)
  if (proposal.serviceRequest.status !== 'ACTIVE') throw new OpsError('Esta solicitud ya no está activa', 400)
  if (proposal.status !== 'PENDING') throw new OpsError('Esta propuesta ya no está disponible', 400)
  if (proposal.serviceRequest.expiresAt && proposal.serviceRequest.expiresAt.getTime() < Date.now()) {
    throw new OpsError('Esta solicitud venció: reactívala para aceptar propuestas', 400)
  }

  const rates = effectiveRates(await loadPlatformConfig())
  const sr = proposal.serviceRequest
  // The client's own change wins; otherwise the date the partner proposed; otherwise the request's
  const proposed = proposal.proposedDate ? { scheduledDate: proposal.proposedDate, scheduledTime: proposal.proposedTime ?? sr.preferredTime ?? DEFAULT_BOOKING_TIME } : undefined
  const chosen = opts?.scheduledDate ? opts : proposed
  const { scheduledDate, scheduledTime } = resolveSchedule(sr, chosen ?? opts)
  // A date the client or the partner chose must still be ahead (the request's own date is kept as it came)
  if (chosen && bookingWhen({ scheduledDate, scheduledTime }).getTime() < Date.now() + 60 * 60_000) {
    throw new OpsError('Elige una fecha y hora futura (al menos en una hora)', 400)
  }

  // Asked for by name: the default reads leave attribution out (lib/prisma-tracking.ts)
  const touches = await prisma.serviceRequest.findUnique({ where: { id: sr.id }, select: { acquisition: true, lastTouch: true } })

  const { booking, rejectedIds } = await prisma.$transaction(async (tx) => {
    // Guarded writes: two accepts at once (or an accept racing a cancel) must not create two bookings
    const took = await tx.proposal.updateMany({ where: { id: proposalId, status: 'PENDING' }, data: { status: 'ACCEPTED' } })
    if (took.count === 0) throw new OpsError('Esta solicitud ya tiene una reserva', 409)
    const closed = await tx.serviceRequest.updateMany({ where: { id: sr.id, status: 'ACTIVE' }, data: { status: 'ACCEPTED' } })
    if (closed.count === 0) throw new OpsError('Esta solicitud ya tiene una reserva', 409)

    const others = await tx.proposal.findMany({ where: { serviceRequestId: sr.id, id: { not: proposalId }, status: 'PENDING' }, select: { id: true } })
    const rejectedIds = others.map((p) => p.id)
    if (rejectedIds.length > 0) await tx.proposal.updateMany({ where: { id: { in: rejectedIds } }, data: { status: 'REJECTED' } })

    const booking = await tx.booking.create({
      data: {
        userId: sr.userId,
        serviceId: sr.serviceId,
        partnerId: proposal.partnerId,
        proposalId,
        scheduledDate,
        scheduledTime,
        address: sr.address,
        notes: sr.notes,
        city: sr.city,
        status: 'PENDING',
        totalPrice: proposal.price,
        clientCommissionRate: rates.client,
        partnerCommissionRate: rates.partner,
        ...originColumns(origin),
        ...(touches?.acquisition ? { acquisition: touches.acquisition as Prisma.InputJsonValue } : {}),
        ...(touches?.lastTouch ? { lastTouch: touches.lastTouch as Prisma.InputJsonValue } : {}),
      },
      include: bookingInclude,
    })

    await tx.bookingEvent.create({
      data: {
        bookingId: booking.id,
        type: 'status',
        fromStatus: null,
        toStatus: 'PENDING',
        actorType: actorTypeOf(actor, origin),
        actorId: actor.userId,
        ...originColumns(origin),
        detail: 'Reserva creada al aceptar la propuesta',
      },
    })

    return { booking, rejectedIds }
  })

  // Which proposals this accept closed: if the partner later drops the booking, only these come back
  if (rejectedIds.length) {
    try {
      await prisma.adminAuditLog.create({ data: { action: PROPOSALS_CLOSED_BY_ACCEPT, entityType: 'ServiceRequest', entityId: sr.id, actorEmail: 'sistema', details: JSON.stringify({ bookingId: booking.id, proposalIds: rejectedIds }) } })
    } catch (err) {
      logger.warn('closed-proposals marker failed (non-fatal)', { serviceRequestId: sr.id, err })
    }
  }

  // WhatsApp templates first (B8 to the client, C12 to the partner): the notifications' free text is then skipped
  const { waProposalAccepted } = await import('@/lib/messaging/wa-events')
  await waProposalAccepted(booking.id, origin)

  for (const id of rejectedIds) {
    try {
      await notifyProposalRejected(id, { notChosen: true })
    } catch (err) {
      logger.warn('notifyProposalRejected failed (non-fatal)', { proposalId: id, err })
    }
  }
  try {
    await notifyProposalAccepted(proposalId)
  } catch (err) {
    logger.warn('notifyProposalAccepted failed (non-fatal)', { proposalId, err })
  }

  scheduleAutomationsForUser(booking.userId, 'BOOKING_CREATED', { targetRole: 'CLIENT', contextId: booking.id }).catch(() => null)
  if (booking.partner?.user?.id) {
    scheduleAutomationsForUser(booking.partner.user.id, 'BOOKING_CREATED', { targetRole: 'PARTNER', contextId: booking.id }).catch(() => null)
  }

  return booking
}

/** The client turns down one pending offer; the request stays open. */
export async function rejectProposal(actor: Actor, proposalId: string, _origin: Origin) {
  const proposal = await prisma.proposal.findUnique({ where: { id: proposalId }, select: { id: true, status: true, serviceRequest: { select: { userId: true } } } })
  if (!proposal) throw new OpsError('Propuesta no encontrada', 404)
  if (proposal.serviceRequest.userId !== actor.userId) throw new OpsError('No tienes permiso para rechazar esta propuesta', 403)
  if (proposal.status !== 'PENDING') throw new OpsError('Esta propuesta ya no está pendiente', 400)

  const updated = await prisma.proposal.update({ where: { id: proposalId }, data: { status: 'REJECTED' }, include: proposalInclude })
  try {
    await notifyProposalRejected(proposalId)
  } catch (err) {
    logger.warn('notifyProposalRejected failed (non-fatal)', { proposalId, err })
  }
  return updated
}

export async function listProposalsForClient(userId: string, requestId?: string) {
  return prisma.proposal.findMany({
    where: { serviceRequest: { userId, ...(requestId ? { id: requestId } : {}) } },
    include: proposalInclude,
    orderBy: { createdAt: 'desc' },
  })
}

export async function listProposalsForPartner(partnerId: string) {
  return prisma.proposal.findMany({
    where: { partnerId },
    include: {
      serviceRequest: { include: { service: { include: { category: true } }, user: { select: { name: true, phone: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

type ProposalForSummary = {
  id: string
  price: number
  notes?: string | null
  partner: { rating: number; totalReviews: number; user: { name: string | null } }
}

/** «Propuesta #abc123 de Darwin (4.8★, 12 reseñas): $130.000 · "nota"» */
export function proposalSummaryForChat(p: ProposalForSummary) {
  const name = p.partner.user.name || 'un socio'
  const rep = p.partner.totalReviews > 0
    ? `${p.partner.rating.toFixed(1)}★, ${p.partner.totalReviews} reseña${p.partner.totalReviews === 1 ? '' : 's'}`
    : 'sin reseñas aún'
  const note = p.notes?.trim() ? ` · "${p.notes.trim()}"` : ''
  return `Propuesta #${p.id.slice(-6)} de ${name} (${rep}): ${money(p.price)}${note}`
}
