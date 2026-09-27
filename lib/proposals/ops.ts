import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { sanitizeObject } from '@/lib/validation/sanitize'
import { notifyNewProposal, notifyProposalAccepted, notifyProposalRejected } from '@/lib/notifications/notificationService'
import { scheduleAutomationsForUser } from '@/lib/messaging/automation-service'
import { recordPromptContext } from '@/lib/pwa/adoption-strategy'
import { OpsError, actorTypeOf, originColumns, type Actor, type Origin } from '@/lib/ops/origin'
import { loadPlatformConfig } from '@/lib/service-requests/ops'
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

  const existing = await prisma.proposal.findUnique({ where: { serviceRequestId_partnerId: { serviceRequestId: sr.id, partnerId: partner.id } }, select: { id: true } })
  if (existing) throw new OpsError('Ya has enviado una propuesta para esta solicitud', 400)

  const proposal = await prisma.proposal.create({
    data: { serviceRequestId: sr.id, partnerId: partner.id, price: data.price, notes: data.notes || null, status: 'PENDING', ...originColumns(origin) },
    include: proposalInclude,
  })

  try {
    await notifyNewProposal(proposal.id)
  } catch (err) {
    logger.warn('notifyNewProposal failed (non-fatal)', { proposalId: proposal.id, err })
  }
  await recordPromptContext(sr.userId, 'CLIENT_PROPOSAL_RECEIVED', { proposalId: proposal.id, serviceRequestId: sr.id }).catch(() => undefined)

  return proposal
}

export function bogotaTime(d: Date) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false }).format(d).replace(/^24/, '00')
}

/** The next full hour from now (urgent request with no date). */
export function nextFullHour(now = new Date()) {
  const d = new Date(now)
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  return d
}

export function resolveSchedule(
  sr: { preferredDate: Date | null; preferredTime: string | null; isUrgent: boolean },
  opts?: { scheduledDate?: Date; scheduledTime?: string },
  now = new Date(),
) {
  if (opts?.scheduledDate) return { scheduledDate: opts.scheduledDate, scheduledTime: opts.scheduledTime || sr.preferredTime || bogotaTime(opts.scheduledDate) }
  if (sr.preferredDate) return { scheduledDate: sr.preferredDate, scheduledTime: opts?.scheduledTime || sr.preferredTime || bogotaTime(sr.preferredDate) }
  const next = nextFullHour(now)
  return { scheduledDate: next, scheduledTime: opts?.scheduledTime || bogotaTime(next) }
}

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
  const { scheduledDate, scheduledTime } = resolveSchedule(sr, opts)

  const { booking, rejectedIds } = await prisma.$transaction(async (tx) => {
    await tx.proposal.update({ where: { id: proposalId }, data: { status: 'ACCEPTED' } })

    const others = await tx.proposal.findMany({ where: { serviceRequestId: sr.id, id: { not: proposalId }, status: 'PENDING' }, select: { id: true } })
    const rejectedIds = others.map((p) => p.id)
    if (rejectedIds.length > 0) await tx.proposal.updateMany({ where: { id: { in: rejectedIds } }, data: { status: 'REJECTED' } })

    await tx.serviceRequest.update({ where: { id: sr.id }, data: { status: 'ACCEPTED' } })

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

  for (const id of rejectedIds) {
    try {
      await notifyProposalRejected(id)
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
