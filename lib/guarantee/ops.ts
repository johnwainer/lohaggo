import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications/notificationService'
import { ADMIN_ORIGIN, OpsError, originColumns, type Actor, type Origin } from '@/lib/ops/origin'
import { addBookingEvent, bookingWhen, transitionBooking } from '@/lib/bookings/ops'
import { createServiceRequest } from '@/lib/service-requests/ops'
import { setPartnerAvailability } from '@/lib/ops/platform-ops'
import {
  ACTIVE_STATUSES, claimPriority, eligibility, isActiveStatus, isGuaranteeRemedy, isGuaranteeType, isOnlinePayment, isOverdue,
  REDO_WINDOW_HOURS, REMEDY_LABEL, remedyAllowed, remedyOptions, slaDueAt, statusAfter, STRIKE_WINDOW_DAYS, strikeConsequence, STRIKES_TO_PAUSE,
  TYPE_LABEL, type GuaranteeRemedy, type GuaranteeStatus, type GuaranteeType,
} from '@/lib/guarantee/policy'

/**
 * Guarantee operations shared by the client's chat agent (reportar_problema_servicio), the admin screen and
 * the routes. They check who acts and the policy (lib/guarantee/policy.ts), write the claim, its support
 * case and the booking's history, and notify. No session checks, no audit log (the caller does).
 */

const short = (id: string) => id.slice(-6)
const DAY = 24 * 3600_000

export type OpenClaimInput = { bookingId: string; type: GuaranteeType; description: string; photoUrls?: string[] }

const validPhoto = (u: unknown): u is string => typeof u === 'string' && /^https?:\/\/\S+$/i.test(u.trim())

/** When the booking was marked completed: its last BookingEvent to COMPLETED, else its last update. */
async function completedAtOf(booking: { id: string; status: string; updatedAt: Date }) {
  if (booking.status !== 'COMPLETED') return null
  const ev = await prisma.bookingEvent.findFirst({ where: { bookingId: booking.id, type: 'status', toStatus: 'COMPLETED' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
  return ev?.createdAt ?? booking.updatedAt
}

async function notifyAdmins(title: string, message: string, data: Record<string, unknown>) {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } })
  await Promise.all(admins.map((a) => createNotification({ userId: a.id, type: 'BOOKING_CONFIRMED', title, message, data }).catch(() => null)))
}

/** Strikes of a partner in the last STRIKE_WINDOW_DAYS days. */
export async function partnerStrikes(partnerId: string, now = new Date()) {
  return prisma.guaranteeClaim.count({ where: { partnerId, partnerStrike: true, createdAt: { gte: new Date(now.getTime() - STRIKE_WINDOW_DAYS * DAY) } } })
}

/**
 * The client (owner of the booking) or an admin opens a guarantee claim. Checks the policy's eligibility
 * and that there is no other active claim on the booking; creates the claim, its GUARANTEE support case
 * and a BookingEvent, and tells the partner and the admins.
 */
export async function openGuaranteeClaim(actor: Actor, input: OpenClaimInput, origin: Origin, now = new Date()) {
  if (!isGuaranteeType(input.type)) throw new OpsError('Tipo de reclamo inválido: NO_SHOW, BAD_WORK o DAMAGE')
  const description = String(input.description ?? '').trim()
  if (description.length < 10) throw new OpsError('Describe lo que pasó con un poco más de detalle (qué y a qué hora).')
  if (description.length > 2000) throw new OpsError('La descripción es demasiado larga (máximo 2.000 caracteres).')
  const photoUrls = (input.photoUrls ?? []).filter(validPhoto).map((u) => u.trim()).slice(0, 10)

  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    include: { service: { select: { name: true } }, user: { select: { name: true } }, partner: { select: { id: true, userId: true, user: { select: { name: true } } } } },
  })
  if (!booking) throw new OpsError('Reserva no encontrada', 404)
  if (actor.role !== 'ADMIN' && !(actor.role === 'CLIENT' && booking.userId === actor.userId)) throw new OpsError('Solo el cliente de la reserva puede reclamar la garantía', 403)

  const completedAt = await completedAtOf(booking)
  const check = eligibility({ status: booking.status, partnerId: booking.partnerId, scheduledAt: bookingWhen(booking), completedAt }, input.type, now)
  if (!check.ok) throw new OpsError(check.reason)

  const active = await prisma.guaranteeClaim.findFirst({ where: { bookingId: booking.id, status: { in: ACTIVE_STATUSES } }, select: { id: true } })
  if (active) throw new OpsError(`Ya hay un reclamo de garantía abierto para esta reserva (#${short(active.id)}). El equipo lo está atendiendo.`, 409)

  const due = slaDueAt(now)
  const serviceName = booking.service?.name ?? 'el servicio'
  const supportCase = await prisma.adminSupportCase.create({
    data: {
      userId: booking.userId,
      role: 'CLIENT',
      bookingId: booking.id,
      priority: claimPriority(input.type),
      status: 'OPEN',
      queue: 'GUARANTEE',
      subject: `Garantía: ${TYPE_LABEL[input.type]} · reserva #${short(booking.id)}`,
      description: `${description}${photoUrls.length ? `\n\nFotos: ${photoUrls.join(' ')}` : ''}`,
      slaDueAt: due,
    },
  })

  const claim = await prisma.guaranteeClaim.create({
    data: {
      bookingId: booking.id,
      clientId: booking.userId,
      partnerId: booking.partnerId,
      type: input.type,
      description,
      photoUrls,
      status: 'OPEN',
      supportCaseId: supportCase.id,
      slaDueAt: due,
      ...originColumns(origin),
    },
  })

  await addBookingEvent({ bookingId: booking.id, type: 'guarantee', actor, origin, detail: `Reclamo de garantía abierto: ${TYPE_LABEL[input.type]}` })

  const data = { bookingId: booking.id, claimId: claim.id, kind: 'GUARANTEE_CLAIM' }
  if (booking.partner?.userId) {
    await createNotification({
      userId: booking.partner.userId,
      type: 'BOOKING_CONFIRMED',
      title: 'Reclamo de garantía',
      message: `${booking.user?.name ?? 'El cliente'} reportó un problema con ${serviceName} (${TYPE_LABEL[input.type].toLowerCase()}). El equipo de LoHaggo te contactará para resolverlo.`,
      data,
    }).catch(() => null)
  }
  await notifyAdmins('Nuevo reclamo de garantía', `${TYPE_LABEL[input.type]} en la reserva #${short(booking.id)} (${serviceName}). Resolver antes de 72 h.`, { ...data, kind: 'GUARANTEE_ADMIN_ALERT' })

  return claim
}

export type ResolveInput = { remedy: GuaranteeRemedy; note: string; partnerStrike: boolean }

const CLIENT_MESSAGE: Record<GuaranteeRemedy, string> = {
  redo: `El socio volverá a corregir el trabajo sin costo dentro de ${REDO_WINDOW_HOURS} horas.`,
  reassign: 'Creamos una solicitud nueva, urgente y con prioridad, para que otro socio te atienda. Te llegarán propuestas en breve.',
  cancel_free: 'Cancelamos tu reserva sin costo.',
  refund: 'Tu reembolso quedó registrado; el equipo te confirmará cuando se haga efectivo.',
  mediation: 'Nuestro equipo está mediando con el socio y te contactará con el resultado.',
  reject: 'Revisamos tu reclamo y no está cubierto por la garantía.',
}

/**
 * An admin applies a remedy of the policy to an active claim: redo, reassign (new urgent request in the
 * client's name), free cancellation, refund (only with an approved online payment), mediation or reject.
 * Marks the strike and pauses the partner at STRIKES_TO_PAUSE; updates the support case and tells both.
 */
export async function resolveGuaranteeClaim(actor: Actor, claimId: string, input: ResolveInput, now = new Date()) {
  if (actor.role !== 'ADMIN') throw new OpsError('Solo el equipo resuelve reclamos de garantía', 403)
  if (!isGuaranteeRemedy(input.remedy)) throw new OpsError('Remedio inválido')
  const note = String(input.note ?? '').trim()
  if (note.length < 5) throw new OpsError('Escribe una nota con lo que se decidió.')

  const claim = await prisma.guaranteeClaim.findUnique({
    where: { id: claimId },
    include: {
      booking: {
        include: {
          service: { select: { id: true, name: true } },
          user: { select: { id: true, name: true, email: true } },
          partner: { select: { id: true, userId: true } },
          payment: { select: { id: true, status: true, totalAmount: true, mercadopagoId: true, partnerConfirmedMethod: true } },
        },
      },
    },
  })
  if (!claim) throw new OpsError('Reclamo no encontrado', 404)
  if (!isActiveStatus(claim.status)) throw new OpsError('Este reclamo ya está cerrado', 409)
  const type = claim.type as GuaranteeType
  const booking = claim.booking
  const paidOnline = isOnlinePayment(booking.payment)
  if (!remedyAllowed(type, input.remedy, paidOnline)) {
    throw new OpsError(input.remedy === 'refund' ? 'Solo hay reembolso cuando el cliente pagó en línea con LoHaggo y el pago está aprobado.' : `«${REMEDY_LABEL[input.remedy]}» no aplica a un reclamo de ${TYPE_LABEL[type].toLowerCase()}.`)
  }

  const previous = { status: claim.status, remedy: claim.remedy, partnerStrike: claim.partnerStrike }
  let extra = ''

  if (input.remedy === 'reassign') {
    const clientActor: Actor = { userId: booking.userId, role: 'CLIENT', email: booking.user?.email ?? null }
    const request = await createServiceRequest(clientActor, {
      serviceId: booking.serviceId,
      address: booking.address,
      city: booking.city,
      notes: `Garantía de la reserva #${short(booking.id)}.${booking.notes ? ` ${booking.notes}` : ''}`.slice(0, 2000),
      isUrgent: true,
      preferredDate: null,
      preferredTime: null,
      photoUrls: [],
    }, ADMIN_ORIGIN)
    extra = ` Solicitud nueva #${short(request.id)}.`
    // The original booking of a no-show is dropped so its partner stops seeing it
    if (type === 'NO_SHOW' && (booking.status === 'PENDING' || booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS')) {
      await transitionBooking(actor, booking.id, 'CANCELLED', ADMIN_ORIGIN, { reason: 'Garantía: el socio no llegó; se reasignó a otro socio' }).catch(() => null)
    }
  } else if (input.remedy === 'cancel_free') {
    await transitionBooking(actor, booking.id, 'CANCELLED', ADMIN_ORIGIN, { reason: `Garantía: cancelación sin costo (${TYPE_LABEL[type].toLowerCase()})` })
  } else if (input.remedy === 'refund') {
    const payment = booking.payment!
    const amount = Math.min(Number(payment.totalAmount), Number(booking.totalPrice) || Number(payment.totalAmount))
    const approved = type === 'NO_SHOW'
    const refund = await prisma.refundCase.create({
      data: {
        bookingId: booking.id,
        paymentId: payment.id,
        userId: booking.userId,
        partnerId: booking.partnerId,
        reason: `Garantía: ${TYPE_LABEL[type]}`,
        policyCode: `GUARANTEE_${type}`,
        status: approved ? 'APPROVED' : 'UNDER_REVIEW',
        requestedAmount: amount,
        approvedAmount: approved ? amount : null,
        requestedBy: actor.email ?? 'admin',
        reviewedBy: approved ? (actor.email ?? 'admin') : null,
        reviewNotes: note,
        metadata: JSON.stringify({ source: 'guarantee', claimId: claim.id }),
      },
    })
    extra = ` Caso de reembolso #${short(refund.id)} (${approved ? 'aprobado, total' : 'en revisión'}).`
  } else if (input.remedy === 'redo' && booking.partner?.userId) {
    await createNotification({
      userId: booking.partner.userId,
      type: 'BOOKING_CONFIRMED',
      title: 'Corrección por garantía',
      message: `El cliente acepta que vuelvas a corregir ${booking.service?.name ?? 'el trabajo'} sin costo. Coordina con él y hazlo dentro de ${REDO_WINDOW_HOURS} horas.`,
      data: { bookingId: booking.id, claimId: claim.id, kind: 'GUARANTEE_REDO' },
    }).catch(() => null)
  }

  const strike = Boolean(input.partnerStrike) && input.remedy !== 'reject' && Boolean(claim.partnerId)
  const status: GuaranteeStatus = statusAfter(type, input.remedy)
  const closed = !isActiveStatus(status)
  const updated = await prisma.guaranteeClaim.update({
    where: { id: claim.id },
    data: {
      status,
      remedy: input.remedy,
      partnerStrike: strike,
      resolvedById: actor.userId,
      resolutionNote: `${note}${extra}`,
      resolvedAt: closed ? now : null,
    },
  })

  let consequence: ReturnType<typeof strikeConsequence> = 'none'
  if (strike && claim.partnerId) {
    const strikes = await partnerStrikes(claim.partnerId, now)
    consequence = strikeConsequence(strikes)
    if (consequence !== 'none') {
      await setPartnerAvailability(claim.partnerId, false)
      await prisma.adminSupportCase.create({
        data: {
          userId: booking.partner?.userId ?? null,
          role: 'PARTNER',
          bookingId: booking.id,
          priority: consequence === 'review_suspension' ? 'CRITICAL' : 'HIGH',
          status: 'OPEN',
          queue: 'GUARANTEE',
          subject: consequence === 'review_suspension' ? `Decidir suspensión del socio (${strikes} faltas en ${STRIKE_WINDOW_DAYS} días)` : `Revisión del socio: ${strikes} faltas en ${STRIKE_WINDOW_DAYS} días (pausado)`,
          description: `El socio acumula ${strikes} faltas de garantía en ${STRIKE_WINDOW_DAYS} días; se pausó su disponibilidad automáticamente. ${consequence === 'review_suspension' ? 'El equipo decide si suspende la cuenta (no es automático).' : 'Revisar el caso antes de reactivarlo.'}`,
          slaDueAt: slaDueAt(now),
        },
      }).catch(() => null)
    }
    if (booking.partner?.userId) {
      await createNotification({
        userId: booking.partner.userId,
        type: 'BOOKING_CONFIRMED',
        title: consequence === 'none' ? 'Falta registrada por garantía' : 'Tu disponibilidad quedó en pausa',
        message: consequence === 'none'
          ? `Se registró una falta en tu cuenta por la reserva #${short(booking.id)}. Con ${STRIKES_TO_PAUSE} faltas en ${STRIKE_WINDOW_DAYS} días tu cuenta se pausa.`
          : `Acumulas ${strikes} faltas en ${STRIKE_WINDOW_DAYS} días: pausamos tu disponibilidad mientras el equipo revisa tu caso.`,
        data: { bookingId: booking.id, claimId: claim.id, kind: 'GUARANTEE_STRIKE' },
      }).catch(() => null)
    }
  }

  if (claim.supportCaseId) {
    await prisma.adminSupportCase.update({
      where: { id: claim.supportCaseId },
      data: {
        status: closed ? 'RESOLVED' : 'IN_PROGRESS',
        resolutionNote: `${REMEDY_LABEL[input.remedy]}: ${note}${extra}`,
        firstResponseAt: now,
        ...(closed ? { resolvedAt: now } : {}),
      },
    }).catch(() => null)
  }

  await addBookingEvent({ bookingId: booking.id, type: 'guarantee', actor, origin: ADMIN_ORIGIN, detail: `Garantía: ${REMEDY_LABEL[input.remedy]}${strike ? ' · falta al socio' : ''}` })

  await createNotification({
    userId: booking.userId,
    type: 'BOOKING_CONFIRMED',
    title: 'Tu reclamo de garantía',
    message: `${CLIENT_MESSAGE[input.remedy]}${input.remedy === 'reject' ? ` ${note}` : ''}`,
    data: { bookingId: booking.id, claimId: claim.id, kind: 'GUARANTEE_RESOLVED', remedy: input.remedy },
  }).catch(() => null)

  return { claim: updated, previous, consequence }
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export type ClaimFilter = { status?: 'active' | 'overdue' | 'closed' | 'all' | GuaranteeStatus; type?: GuaranteeType; partnerId?: string; take?: number }

const LIST_INCLUDE = {
  booking: {
    select: {
      id: true, status: true, scheduledDate: true, scheduledTime: true, totalPrice: true, city: true,
      service: { select: { name: true } },
      user: { select: { id: true, name: true } },
      partner: { select: { id: true, user: { select: { name: true } } } },
    },
  },
} as const

export async function listGuaranteeClaims(filter: ClaimFilter = {}, now = new Date()) {
  const where: Record<string, unknown> = {}
  const st = filter.status ?? 'active'
  if (st === 'active') where.status = { in: ACTIVE_STATUSES }
  else if (st === 'overdue') { where.status = { in: ACTIVE_STATUSES }; where.slaDueAt = { lt: now } }
  else if (st === 'closed') where.status = { notIn: ACTIVE_STATUSES }
  else if (st !== 'all') where.status = st
  if (filter.type && isGuaranteeType(filter.type)) where.type = filter.type
  if (filter.partnerId) where.partnerId = filter.partnerId

  const rows = await prisma.guaranteeClaim.findMany({
    where,
    orderBy: st === 'closed' || st === 'all' ? { createdAt: 'desc' } : { slaDueAt: 'asc' },
    take: Math.min(Math.max(filter.take ?? 100, 1), 200),
    include: LIST_INCLUDE,
  })
  const partnerIds = Array.from(new Set(rows.map((r) => r.partnerId).filter((p): p is string => Boolean(p))))
  const strikeRows = partnerIds.length
    ? await prisma.guaranteeClaim.groupBy({ by: ['partnerId'], where: { partnerId: { in: partnerIds }, partnerStrike: true, createdAt: { gte: new Date(now.getTime() - STRIKE_WINDOW_DAYS * DAY) } }, _count: { _all: true } })
    : []
  const strikes = new Map(strikeRows.map((s) => [s.partnerId, s._count._all]))
  return rows.map((r) => ({ ...r, overdue: isOverdue(r, now), partnerStrikes: r.partnerId ? strikes.get(r.partnerId) ?? 0 : 0 }))
}

/** Everything the admin needs to decide: the claim, booking, client, partner, strikes and the remedies. */
export async function getGuaranteeClaim(id: string, now = new Date()) {
  const claim = await prisma.guaranteeClaim.findUnique({
    where: { id },
    include: {
      booking: {
        include: {
          service: { select: { name: true } },
          user: { select: { id: true, name: true, email: true, phone: true } },
          partner: { select: { id: true, isAvailable: true, user: { select: { id: true, name: true, email: true, phone: true } } } },
          payment: { select: { id: true, status: true, totalAmount: true, mercadopagoId: true, partnerConfirmedMethod: true, clientReportedMethod: true } },
          events: { orderBy: { createdAt: 'asc' }, select: { id: true, type: true, fromStatus: true, toStatus: true, actorType: true, origin: true, detail: true, createdAt: true } },
          refundCases: { orderBy: { createdAt: 'desc' }, select: { id: true, status: true, requestedAmount: true, approvedAmount: true, policyCode: true, createdAt: true } },
        },
      },
    },
  })
  if (!claim) throw new OpsError('Reclamo no encontrado', 404)
  const [strikes, supportCase, history] = await Promise.all([
    claim.partnerId ? partnerStrikes(claim.partnerId, now) : Promise.resolve(0),
    claim.supportCaseId ? prisma.adminSupportCase.findUnique({ where: { id: claim.supportCaseId }, select: { id: true, status: true, priority: true, assignedTo: true, resolutionNote: true } }) : Promise.resolve(null),
    claim.partnerId ? prisma.guaranteeClaim.findMany({ where: { partnerId: claim.partnerId, id: { not: claim.id } }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, type: true, status: true, partnerStrike: true, createdAt: true } }) : Promise.resolve([]),
  ])
  const paidOnline = isOnlinePayment(claim.booking.payment)
  return {
    claim: { ...claim, overdue: isOverdue(claim, now) },
    partnerStrikes: strikes,
    partnerHistory: history,
    supportCase,
    paidOnline,
    remedies: remedyOptions(claim.type as GuaranteeType, paidOnline),
  }
}

/** Numbers for Haggo and the dashboard: active, overdue, strikes in the window and partners at the limit. */
export async function guaranteeStats(now = new Date()) {
  const since = new Date(now.getTime() - STRIKE_WINDOW_DAYS * DAY)
  const [open, overdue, strikeRows] = await Promise.all([
    prisma.guaranteeClaim.count({ where: { status: { in: ACTIVE_STATUSES } } }),
    prisma.guaranteeClaim.count({ where: { status: { in: ACTIVE_STATUSES }, slaDueAt: { lt: now } } }),
    prisma.guaranteeClaim.groupBy({ by: ['partnerId'], where: { partnerStrike: true, partnerId: { not: null }, createdAt: { gte: since } }, _count: { _all: true } }),
  ])
  return {
    open,
    overdue,
    strikesLast90: strikeRows.reduce((a, r) => a + r._count._all, 0),
    partnersAtLimit: strikeRows.filter((r) => r.partnerId && strikeConsequence(r._count._all) !== 'none').map((r) => ({ partnerId: r.partnerId as string, strikes: r._count._all })),
  }
}
