/** What the inbox shows of a person's bookings and requests next to the chat. Pure (shared by the API and the panel). */
import type { BookingStatus } from '@prisma/client'
import { canTransition } from '@/lib/bookings/transitions'

export const UNPAID_LOOKBACK_DAYS = 14

type PaymentLike = { status?: string | null; confirmationStatus?: string | null } | null | undefined

export type PaymentState = { label: string; tone: 'ok' | 'warn' | 'bad' | 'none'; settled: boolean }

/** The payment of a booking in a few words: «Pagado», «Pago reportado», «Pago pendiente»… */
export function paymentState(status: string, payment: PaymentLike): PaymentState {
  if (payment?.status === 'REFUNDED') return { label: 'Reembolsado', tone: 'none', settled: true }
  if (payment?.status === 'APPROVED' || payment?.confirmationStatus === 'CONFIRMED') return { label: 'Pagado', tone: 'ok', settled: true }
  if (payment?.confirmationStatus === 'DISPUTED') return { label: 'Pago en disputa', tone: 'bad', settled: false }
  if (payment?.confirmationStatus === 'REJECTED_BY_PARTNER') return { label: 'El socio no recibió el pago', tone: 'bad', settled: false }
  if (payment?.confirmationStatus === 'CLIENT_REPORTED' || payment?.confirmationStatus === 'PARTNER_REPORTED') return { label: 'Pago reportado', tone: 'warn', settled: false }
  if (status === 'COMPLETED') return { label: 'Sin pagar', tone: 'bad', settled: false }
  if (status === 'CANCELLED') return { label: 'Sin pago', tone: 'none', settled: false }
  return { label: payment ? 'Pago pendiente' : 'Se paga al terminar', tone: 'none', settled: false }
}

/** Active bookings, and completed ones still unpaid from the last 14 days. */
export function isRelevantBooking(b: { status: string; scheduledDate: Date | string; payment?: PaymentLike }, now: Date = new Date()) {
  if (b.status === 'PENDING' || b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS') return true
  if (b.status !== 'COMPLETED') return false
  const since = now.getTime() - UNPAID_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  return new Date(b.scheduledDate).getTime() >= since && !paymentState(b.status, b.payment).settled
}

/** The team may cancel it and offer the request to other partners again. */
export function canCancelAndReopen(status: string, requestId: string | null) {
  return Boolean(requestId) && canTransition(status as BookingStatus, 'CANCELLED', 'admin').ok
}

export const shortRef = (id: string) => id.slice(-6)
