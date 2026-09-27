import { prisma } from '@/lib/prisma'
import { createNotification } from '@/lib/notifications/notificationService'
import { getMercadoPagoClient } from '@/lib/mercadopago'
import { Preference } from 'mercadopago'
import { env } from '@/lib/env'
import { createLogger } from '@/lib/logger'
import { APP_ORIGIN, OpsError, originColumns, type Actor, type Origin } from '@/lib/ops/origin'
import { addBookingEvent, formatCOP } from '@/lib/bookings/ops'
import { bookingRates, clientBreakdown, loadEffectiveRates, rateOrEffective } from '@/lib/payments/commission'
import type { OfflinePaymentMethod, PaymentConfirmationStatus, PaymentStatus } from '@prisma/client'

/**
 * Payment operations shared by the routes, the admin and the inbox AI agents: offline payment report and
 * confirmation, MercadoPago links and the partner payout. No session checks, no audit log (the caller does).
 */

const logger = createLogger('payments-ops')

/** The two methods a person reports by hand; MERCADOPAGO arrives through the webhook. */
export type OfflineMethod = Extract<OfflinePaymentMethod, 'CASH' | 'DIRECT_TRANSFER'>

export const METHOD_LABEL: Record<OfflinePaymentMethod, string> = { CASH: 'efectivo', DIRECT_TRANSFER: 'transferencia', MERCADOPAGO: 'MercadoPago' }

async function assertMethodEnabled(method: OfflineMethod) {
  const config = await prisma.platformConfig.findFirst({ select: { cashEnabled: true, transferEnabled: true } })
  if (method === 'CASH' && !config?.cashEnabled) throw new OpsError('El pago en efectivo no está habilitado')
  if (method === 'DIRECT_TRANSFER' && !config?.transferEnabled) throw new OpsError('La transferencia directa no está habilitada')
}

async function loadBookingWithPayment(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payment: true, partner: { include: { user: { select: { id: true, name: true } } } }, user: { select: { id: true, name: true } } },
  })
  if (!booking) throw new OpsError('Reserva no encontrada', 404)
  return booking
}

async function notifyAdmins(message: string, bookingId: string) {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } })
  await Promise.all(admins.map((a) => createNotification({
    userId: a.id,
    type: 'PAYMENT_REJECTED_BY_PARTNER',
    title: 'Disputa de pago',
    message,
    data: { bookingId, kind: 'PAYMENT_DISPUTE_ADMIN_ALERT' },
  })))
}

/**
 * The partner's payout for an approved payment, created once. Commission: the rate saved on the booking or
 * the platform's current effective one (0 while commission is off); the money goes to the partner's default active bank account when there is one.
 */
export async function ensurePayoutForPayment(
  payment: { id: string; serviceAmount: number | null; totalAmount: number | null },
  booking: { id: string; partnerId: string | null; partnerCommissionRate: number | null },
) {
  if (!booking.partnerId) {
    logger.warn('Payout not created: booking without partnerId', { bookingId: booking.id, paymentId: payment.id })
    return null
  }
  const existing = await prisma.payout.findUnique({ where: { paymentId: payment.id } })
  if (existing) return existing

  const rate = booking.partnerCommissionRate !== null && booking.partnerCommissionRate !== undefined
    ? rateOrEffective(booking.partnerCommissionRate, 0)
    : (await loadEffectiveRates()).partner
  const serviceAmount = Number(payment.serviceAmount ?? payment.totalAmount ?? 0)
  const partnerCommission = Math.round((serviceAmount * rate) / 100)
  const bankAccount = await prisma.partnerBankAccount.findFirst({ where: { partnerId: booking.partnerId, isDefault: true, isActive: true }, select: { id: true } })

  return prisma.payout.create({
    data: {
      paymentId: payment.id,
      partnerId: booking.partnerId,
      bankAccountId: bankAccount?.id ?? null,
      amount: serviceAmount,
      partnerCommission,
      partnerCommissionRate: rate,
      netAmount: serviceAmount - partnerCommission,
      status: 'PENDING',
    },
  })
}

const offlineCreateBase = (booking: { id: string; userId: string; totalPrice: number }) => ({
  bookingId: booking.id,
  userId: booking.userId,
  amount: booking.totalPrice,
  serviceAmount: booking.totalPrice,
  clientCommission: 0,
  clientCommissionRate: 0,
  totalAmount: booking.totalPrice,
})

/**
 * The client says they paid in cash or by transfer. Normally the payment waits for the partner
 * (CLIENT_REPORTED). If the partner had already recorded a method, matching it confirms the payment and a
 * different one opens a dispute for the admins.
 */
export async function reportClientPayment(actor: Actor, bookingId: string, input: { method: OfflineMethod; note?: string }, origin: Origin) {
  if (actor.role !== 'CLIENT') throw new OpsError('Solo el cliente puede reportar el pago', 403)
  await assertMethodEnabled(input.method)

  const booking = await loadBookingWithPayment(bookingId)
  if (booking.userId !== actor.userId) throw new OpsError('No autorizado', 403)
  if (booking.status !== 'COMPLETED') throw new OpsError('La reserva debe estar completada para reportar el pago')
  if (booking.payment?.confirmationStatus === 'CONFIRMED' || booking.payment?.status === 'APPROVED') throw new OpsError('El pago ya está confirmado', 409)

  const partnerMethod = booking.payment?.partnerConfirmedMethod ?? null
  let confirmationStatus: PaymentConfirmationStatus = 'CLIENT_REPORTED'
  let paymentStatus: PaymentStatus = 'PENDING'
  if (partnerMethod) {
    if (partnerMethod === input.method) { confirmationStatus = 'CONFIRMED'; paymentStatus = 'APPROVED' }
    else confirmationStatus = 'DISPUTED'
  }
  const now = new Date()
  const paidAt = paymentStatus === 'APPROVED' ? now : undefined

  const payment = await prisma.payment.upsert({
    where: { bookingId: booking.id },
    create: {
      ...offlineCreateBase(booking),
      status: paymentStatus,
      confirmationStatus,
      clientReportedMethod: input.method,
      clientReportedAt: now,
      clientReportNote: input.note,
      paidAt,
      ...originColumns(origin),
    },
    update: {
      confirmationStatus,
      status: paymentStatus,
      clientReportedMethod: input.method,
      clientReportedAt: now,
      clientReportNote: input.note,
      paidAt,
      partnerRejectedAt: null,
      rejectionReason: null,
    },
  })

  await addBookingEvent({ bookingId, type: 'payment', actor, origin, detail: `Cliente reportó pago en ${METHOD_LABEL[input.method]}` })

  // WhatsApp templates first (C20 to the partner, D5 to the team on a mismatch)
  const wa = await import('@/lib/messaging/wa-events')
  if (confirmationStatus === 'CLIENT_REPORTED') await wa.waPaymentReported(booking.id, input.method, now)
  else if (confirmationStatus === 'DISPUTED') await wa.waPaymentDispute(booking.id, now)

  const partnerUserId = booking.partner?.user?.id
  if (confirmationStatus === 'CONFIRMED') {
    await ensurePayoutForPayment(payment, booking)
    if (partnerUserId) {
      await createNotification({
        userId: partnerUserId,
        type: 'PAYMENT_CONFIRMED_BY_PARTNER',
        title: 'Pago confirmado por el cliente',
        message: 'El cliente confirmó el método de pago. La reserva está marcada como pagada.',
        data: { bookingId: booking.id, kind: 'PAYMENT_CONFIRMED' },
      })
    }
  } else if (confirmationStatus === 'CLIENT_REPORTED') {
    if (partnerUserId) {
      await createNotification({
        userId: partnerUserId,
        type: 'PAYMENT_REPORTED_BY_CLIENT',
        title: 'Cliente reportó el pago',
        message: `El cliente reportó haber pagado en ${METHOD_LABEL[input.method]}. Confirma la recepción.`,
        data: { bookingId: booking.id, method: input.method, kind: 'PAYMENT_REPORTED_BY_CLIENT' },
      })
    }
  } else {
    if (partnerUserId) {
      await createNotification({
        userId: partnerUserId,
        type: 'PAYMENT_REJECTED_BY_PARTNER',
        title: 'Discrepancia en el método de pago',
        message: 'El método reportado por el cliente no coincide con el tuyo. Un administrador revisará el caso.',
        data: { bookingId: booking.id, kind: 'PAYMENT_DISPUTED' },
      })
    }
    await notifyAdmins(`Booking ${booking.id}: cliente reportó ${input.method}, socio había reportado ${partnerMethod}.`, booking.id)
  }

  logger.info('Client reported payment', { bookingId: booking.id, userId: actor.userId, method: input.method, origin: origin.via })
  return payment
}

/**
 * The partner confirms the money arrived. Matching the client's report (or no report yet) approves the
 * payment and creates the payout; a different method opens a dispute.
 */
export async function confirmPartnerPayment(actor: Actor, bookingId: string, input: { method: OfflineMethod }, origin: Origin) {
  if (actor.role !== 'PARTNER' || !actor.partnerId) throw new OpsError('Solo el socio puede confirmar la recepción', 403)

  const booking = await loadBookingWithPayment(bookingId)
  if (booking.partnerId !== actor.partnerId) throw new OpsError('No autorizado', 403)
  if (booking.status !== 'COMPLETED') throw new OpsError('La reserva debe estar completada')
  await assertMethodEnabled(input.method)
  if (booking.payment?.confirmationStatus === 'CONFIRMED' || booking.payment?.status === 'APPROVED') throw new OpsError('El pago ya está confirmado', 409)

  const clientReported = booking.payment?.confirmationStatus === 'CLIENT_REPORTED'
  const disputed = clientReported && booking.payment?.clientReportedMethod !== input.method
  const confirmationStatus: PaymentConfirmationStatus = disputed ? 'DISPUTED' : 'CONFIRMED'
  const paymentStatus: PaymentStatus = disputed ? 'PENDING' : 'APPROVED'
  const now = new Date()
  const paidAt = disputed ? undefined : now

  const payment = await prisma.payment.upsert({
    where: { bookingId: booking.id },
    create: {
      ...offlineCreateBase(booking),
      status: paymentStatus,
      confirmationStatus,
      partnerConfirmedMethod: input.method,
      partnerConfirmedAt: now,
      paidAt,
      ...originColumns(origin),
    },
    update: {
      confirmationStatus,
      status: paymentStatus,
      partnerConfirmedMethod: input.method,
      partnerConfirmedAt: now,
      paidAt,
      partnerRejectedAt: null,
      rejectionReason: null,
    },
  })

  await addBookingEvent({
    bookingId, type: 'payment', actor, origin,
    detail: disputed ? `Socio confirmó pago en ${METHOD_LABEL[input.method]}: no coincide con el cliente, en disputa` : `Socio confirmó pago en ${METHOD_LABEL[input.method]}`,
  })

  const wa = await import('@/lib/messaging/wa-events')
  if (!disputed) await wa.waPaymentConfirmed(booking.id)
  else await wa.waPaymentDispute(booking.id, now)

  if (!disputed) {
    await ensurePayoutForPayment(payment, booking)
    await createNotification({
      userId: booking.userId,
      type: 'PAYMENT_CONFIRMED_BY_PARTNER',
      title: clientReported ? 'Pago confirmado por el socio' : 'El socio marcó tu reserva como pagada',
      message: clientReported
        ? 'El socio confirmó la recepción del pago. Tu reserva está marcada como pagada.'
        : 'El socio confirmó haber recibido el pago. Tu reserva queda marcada como pagada.',
      data: { bookingId: booking.id, kind: 'PAYMENT_CONFIRMED' },
    })
  } else {
    await createNotification({
      userId: booking.userId,
      type: 'PAYMENT_REJECTED_BY_PARTNER',
      title: 'Discrepancia en el método de pago',
      message: 'El método reportado no coincide con el del socio. Un administrador revisará el caso.',
      data: { bookingId: booking.id, kind: 'PAYMENT_DISPUTED' },
    })
    await notifyAdmins(`Booking ${booking.id}: cliente reportó ${booking.payment?.clientReportedMethod}, socio reportó ${input.method}.`, booking.id)
  }

  logger.info('Partner confirmed payment', { bookingId: booking.id, partnerUserId: actor.userId, method: input.method, confirmationStatus, origin: origin.via })
  return payment
}

/** The partner says the reported money never arrived; the client can report again. */
export async function rejectPartnerPayment(actor: Actor, bookingId: string, reason: string, origin: Origin) {
  if (actor.role !== 'PARTNER' || !actor.partnerId) throw new OpsError('Solo el socio puede rechazar el pago', 403)
  const trimmed = reason.trim()
  if (trimmed.length < 5) throw new OpsError('Cuenta el motivo del rechazo (mínimo 5 caracteres)')

  const booking = await loadBookingWithPayment(bookingId)
  if (booking.partnerId !== actor.partnerId) throw new OpsError('No autorizado', 403)
  if (!booking.payment) throw new OpsError('No hay reporte de pago para rechazar')
  if (booking.payment.confirmationStatus !== 'CLIENT_REPORTED') throw new OpsError('Solo se rechaza un pago que el cliente reportó y aún no está confirmado', 409)

  const payment = await prisma.payment.update({
    where: { id: booking.payment.id },
    data: {
      confirmationStatus: 'REJECTED_BY_PARTNER',
      status: 'PENDING',
      partnerRejectedAt: new Date(),
      rejectionReason: trimmed,
      clientReportedMethod: null,
      clientReportedAt: null,
      clientReportNote: null,
      partnerConfirmedMethod: null,
      partnerConfirmedAt: null,
      paidAt: null,
    },
  })

  await addBookingEvent({ bookingId, type: 'payment', actor, origin, detail: `Socio rechazó el pago reportado: ${trimmed}` })
  // B17 to the client and D5 to the team (it is a dispute)
  const { waPaymentRejected } = await import('@/lib/messaging/wa-events')
  await waPaymentRejected(booking.id, trimmed)
  await createNotification({
    userId: booking.userId,
    type: 'PAYMENT_REJECTED_BY_PARTNER',
    title: 'El socio rechazó el pago reportado',
    message: `Motivo: ${trimmed}. Por favor reporta el pago nuevamente desde tu panel.`,
    data: { bookingId: booking.id, kind: 'PAYMENT_REJECTED_BY_PARTNER', reason: trimmed },
  })

  logger.info('Partner rejected payment', { bookingId: booking.id, partnerUserId: actor.userId, origin: origin.via })
  return payment
}

/** The client takes back a report the partner has not answered yet. */
export async function undoClientReport(actor: Actor, bookingId: string) {
  if (actor.role !== 'CLIENT') throw new OpsError('Solo el cliente puede des-reportar', 403)
  const booking = await loadBookingWithPayment(bookingId)
  if (booking.userId !== actor.userId) throw new OpsError('No autorizado', 403)
  if (!booking.payment || booking.payment.confirmationStatus !== 'CLIENT_REPORTED') throw new OpsError('No hay reporte para deshacer')

  const payment = await prisma.payment.update({
    where: { id: booking.payment.id },
    data: { confirmationStatus: 'NONE', clientReportedMethod: null, clientReportedAt: null, clientReportNote: null },
  })
  logger.info('Client un-reported payment', { bookingId: booking.id, userId: actor.userId })
  return payment
}

/**
 * Creates (or refreshes) the MercadoPago preference for a booking and stores the pending payment with the
 * commission breakdown. Only the client who owns the booking. Used by POST /api/payments/create.
 */
export async function createMercadoPagoPreference(actor: Actor, bookingId: string, origin: Origin = APP_ORIGIN) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { service: true, user: true } })
  if (!booking) throw new OpsError('Reserva no encontrada', 404)
  if (booking.userId !== actor.userId) throw new OpsError('No autorizado', 403)

  const existingPayment = await prisma.payment.findUnique({ where: { bookingId } })
  if (existingPayment && existingPayment.status === 'APPROVED') throw new OpsError('Esta reserva ya ha sido pagada')

  const rates = await bookingRates(booking)
  if (rates.source === 'platform') logger.warn('Using current effective client commission rate', { bookingId, rateSource: 'platform' })
  const { serviceAmount, clientCommission, clientCommissionRate, totalAmount } = clientBreakdown(booking.totalPrice, rates.client)

  let mercadopago
  try {
    mercadopago = (await getMercadoPagoClient()).client
  } catch {
    throw new OpsError('MercadoPago no está configurado')
  }
  const preference = await new Preference(mercadopago).create({
    body: {
      items: [{ id: bookingId, title: `Servicio: ${booking.service?.name}`, description: booking.service?.name || '', quantity: 1, unit_price: totalAmount, currency_id: 'COP' }],
      payer: { name: booking.user?.name || '', email: booking.user?.email || '' },
      back_urls: {
        success: `${env.NEXT_PUBLIC_APP_URL}/bookings/${bookingId}?payment=success`,
        failure: `${env.NEXT_PUBLIC_APP_URL}/bookings/${bookingId}?payment=failure`,
        pending: `${env.NEXT_PUBLIC_APP_URL}/bookings/${bookingId}?payment=pending`,
      },
      auto_return: 'approved',
      notification_url: `${env.NEXT_PUBLIC_APP_URL}/api/payments/webhook`,
      external_reference: bookingId,
    },
  })

  const money = { amount: totalAmount, serviceAmount, clientCommission, clientCommissionRate, totalAmount }
  if (existingPayment) {
    await prisma.payment.update({ where: { id: existingPayment.id }, data: { preferenceId: preference.id, mercadopagoId: null, status: 'PENDING', ...money } })
  } else {
    await prisma.payment.create({ data: { bookingId, userId: actor.userId, preferenceId: preference.id, status: 'PENDING', ...money, ...originColumns(origin) } })
  }

  return {
    preferenceId: preference.id,
    initPoint: preference.init_point,
    sandboxInitPoint: preference.sandbox_init_point,
    breakdown: { serviceAmount, clientCommission, clientCommissionRate, totalAmount },
  }
}

/** A link the client can open to pay with MercadoPago, when the platform has it on. */
export async function mercadoPagoLinkFor(actor: Actor, bookingId: string, origin: Origin = APP_ORIGIN) {
  const config = await prisma.platformConfig.findFirst({ select: { mercadoPagoEnabled: true } })
  if (!config?.mercadoPagoEnabled) throw new OpsError('MercadoPago no está habilitado')
  const pref = await createMercadoPagoPreference(actor, bookingId, origin)
  const url = pref.initPoint ?? pref.sandboxInitPoint
  if (!url) throw new OpsError('MercadoPago no devolvió un enlace de pago', 502)
  return { url, total: pref.breakdown.totalAmount }
}

type PaymentSummaryInput = {
  totalPrice: number
  payment?: { status: PaymentStatus; confirmationStatus: PaymentConfirmationStatus; totalAmount?: number | null; clientReportedMethod?: OfflinePaymentMethod | null } | null
}

/** «Pago: $130.000 · pendiente / reportado por el cliente (efectivo) / confirmado / en disputa». */
export function paymentSummaryForChat(booking: PaymentSummaryInput) {
  const p = booking.payment
  const amount = formatCOP(Number(p?.totalAmount ?? booking.totalPrice))
  let state = 'pendiente'
  if (p) {
    if (p.status === 'APPROVED' || p.confirmationStatus === 'CONFIRMED') state = 'confirmado'
    else if (p.status === 'REFUNDED') state = 'reembolsado'
    else if (p.confirmationStatus === 'DISPUTED') state = 'en disputa'
    else if (p.confirmationStatus === 'CLIENT_REPORTED') state = `reportado por el cliente${p.clientReportedMethod ? ` (${METHOD_LABEL[p.clientReportedMethod]})` : ''}`
    else if (p.confirmationStatus === 'REJECTED_BY_PARTNER') state = 'rechazado por el socio'
    else if (p.status === 'REJECTED') state = 'rechazado'
    else if (p.status === 'CANCELLED') state = 'cancelado'
  }
  return `Pago: ${amount} · ${state}`
}
