/**
 * Changes one side proposes and the other accepts, kept as BookingEvents (no schema change):
 * - Date change proposed by the partner («reschedule_request»): the client accepts or not. The client's own
 *   change keeps working as before (the booking goes back to PENDING and the partner confirms).
 * - Final price proposed by the partner («price_request») on a service in progress or done and unpaid: the
 *   client accepts before paying.
 * An answer is a «reschedule_answer» / «price_answer» event; a request is open while no answer or newer
 * request follows it.
 */
import { prisma } from '@/lib/prisma'
import { bookingWhen, formatBookingWhen } from '@/lib/bookings/when'
import { WA } from '@/lib/messaging/wa-specs'
import { sendWaToUser } from '@/lib/messaging/wa-send'
import { createNotification } from '@/lib/notifications/notificationService'
import { OpsError, type Actor, type Origin } from '@/lib/ops/origin'
import { addBookingEvent, assertBookingAccess, formatCOP, rescheduleBooking, type RescheduleInput } from '@/lib/bookings/ops'

export type RescheduleProposal = { date: string; time: string; at: string; by: 'PARTNER' }
export type PriceProposal = { amount: number; previous: number; note: string; at: string }

const MIN_PRICE = 1000
const MAX_PRICE_FACTOR = 3

const bookingSelect = {
  id: true, userId: true, partnerId: true, status: true, scheduledDate: true, scheduledTime: true, totalPrice: true,
  service: { select: { name: true } },
  user: { select: { name: true } },
  partner: { select: { userId: true, user: { select: { name: true } } } },
  payment: { select: { id: true, status: true, confirmationStatus: true, clientCommission: true, preferenceId: true, mercadopagoId: true } },
} as const

async function load(bookingId: string) {
  const b = await prisma.booking.findUnique({ where: { id: bookingId }, select: bookingSelect })
  if (!b) throw new OpsError('Reserva no encontrada', 404)
  return b
}

function parse<T>(detail: string | null): T | null {
  try {
    return detail ? (JSON.parse(detail) as T) : null
  } catch {
    return null
  }
}

/** Open requests of each kind per booking (the last request with no answer after it). */
export async function openAgreements(bookingIds: string[]) {
  const out = new Map<string, { reschedule?: RescheduleProposal; price?: PriceProposal }>()
  if (!bookingIds.length) return out
  const rows = await prisma.bookingEvent.findMany({
    where: { bookingId: { in: bookingIds }, type: { in: ['reschedule_request', 'reschedule_answer', 'reschedule', 'price_request', 'price_answer'] } },
    orderBy: { createdAt: 'asc' },
    select: { bookingId: true, type: true, detail: true },
  })
  for (const r of rows) {
    const cur = out.get(r.bookingId) ?? {}
    if (r.type === 'reschedule_request') cur.reschedule = parse<RescheduleProposal>(r.detail) ?? undefined
    else if (r.type === 'reschedule_answer' || r.type === 'reschedule') delete cur.reschedule
    else if (r.type === 'price_request') cur.price = parse<PriceProposal>(r.detail) ?? undefined
    else if (r.type === 'price_answer') delete cur.price
    out.set(r.bookingId, cur)
  }
  return out
}

const dataOf = (b: Awaited<ReturnType<typeof load>>) => ({ id: b.id, when: bookingWhen(b), service: b.service?.name ?? 'servicio', price: b.totalPrice, clientName: b.user?.name ?? null, partnerName: b.partner?.user?.name ?? null })

// ─── Date change ────────────────────────────────────────────────────────────

/**
 * The partner asks to move the service: it stays on its date until the client accepts. The client and the
 * team move it directly (rescheduleBooking), as always.
 */
export async function rescheduleOrPropose(actor: Actor, bookingId: string, when: RescheduleInput, origin: Origin) {
  if (actor.role !== 'PARTNER') return { proposed: false as const, ...(await rescheduleBooking(actor, bookingId, when, origin)) }
  const b = await load(bookingId)
  assertBookingAccess(actor, b)
  if (b.status !== 'PENDING' && b.status !== 'CONFIRMED') throw new OpsError('Solo se puede cambiar la fecha de una reserva pendiente o confirmada')
  if (!/^\d{2}:\d{2}$/.test(when.scheduledTime) || Number.isNaN(when.scheduledDate.getTime())) throw new OpsError('Fecha u hora inválida')
  if (bookingWhen(when).getTime() < Date.now() + 60 * 60 * 1000) throw new OpsError('La nueva fecha debe ser al menos una hora después de ahora')
  const proposal: RescheduleProposal = { date: when.scheduledDate.toISOString().slice(0, 10), time: when.scheduledTime, at: new Date().toISOString(), by: 'PARTNER' }
  await addBookingEvent({ bookingId, type: 'reschedule_request', actor, origin, detail: JSON.stringify(proposal) })
  const text = formatBookingWhen(when)
  await sendWaToUser(b.userId, WA.B35({ ...dataOf(b), proposed: text, at: proposal.at }))
  await createNotification({
    userId: b.userId, type: 'BOOKING_CONFIRMED', title: 'El socio propone otra fecha',
    message: `${b.partner?.user?.name ?? 'El socio'} propone mover tu servicio de ${b.service?.name ?? 'servicio'} a ${text}. Acéptalo o recházalo en tus reservas.`,
    data: { bookingId, kind: 'RESCHEDULE_REQUEST' },
  }).catch(() => null)
  return { proposed: true as const, proposal }
}

/** The client accepts (the booking moves, keeping its status) or turns down the partner's date. `notAfter`: a WhatsApp button only answers the request it was sent for. */
export async function answerReschedule(actor: Actor, bookingId: string, accept: boolean, origin: Origin, notAfter?: Date) {
  const b = await load(bookingId)
  assertBookingAccess(actor, b)
  if (actor.role !== 'CLIENT') throw new OpsError('Responde el cliente de la reserva', 403)
  const open = (await openAgreements([bookingId])).get(bookingId)?.reschedule
  if (!open) return { message: 'No hay ningún cambio de fecha pendiente.' }
  if (notAfter && Date.parse(open.at) > notAfter.getTime() + 60_000) return { message: 'El socio propuso otra fecha después de ese mensaje: revisa la propuesta nueva en tus reservas.' }
  const partnerUserId = b.partner?.userId ?? null
  if (!accept) {
    await addBookingEvent({ bookingId, type: 'reschedule_answer', actor, origin, detail: 'El cliente no aceptó el cambio de fecha' })
    if (partnerUserId) {
      await createNotification({ userId: partnerUserId, type: 'BOOKING_CONFIRMED', title: 'El cliente no aceptó la nueva fecha', message: `La reserva de ${b.service?.name ?? 'servicio'} sigue para ${formatBookingWhen(b)}. Si no puedes ir, cancélala con tiempo.`, data: { bookingId, kind: 'RESCHEDULE_REJECTED' } }).catch(() => null)
    }
    return { message: `Entendido: tu servicio sigue para ${formatBookingWhen(b)}. Le avisamos al socio.` }
  }
  const when = { scheduledDate: new Date(`${open.date}T00:00:00.000Z`), scheduledTime: open.time }
  // The move first: if it fails (the date is now too close, the booking changed) the proposal stays open
  await rescheduleBooking(actor, bookingId, when, origin, { agreed: true })
  await addBookingEvent({ bookingId, type: 'reschedule_answer', actor, origin, detail: 'El cliente aceptó el cambio de fecha del socio' })
  return { message: `Listo: tu servicio quedó para ${formatBookingWhen(when)}.` }
}

// ─── Final price ────────────────────────────────────────────────────────────

const unpaid = (b: Awaited<ReturnType<typeof load>>) =>
  b.payment?.status !== 'APPROVED' && !['CONFIRMED', 'CLIENT_REPORTED', 'DISPUTED'].includes(b.payment?.confirmationStatus ?? 'NONE')

/** An online checkout already started keeps its own amount: the price changes only through the team then. */
const onlineStarted = (b: Awaited<ReturnType<typeof load>>) => Boolean(b.payment && (b.payment.preferenceId || b.payment.mercadopagoId || (b.payment.clientCommission ?? 0) > 0))

/** The partner proposes the final price (more work than quoted, or less): the client accepts before paying. */
export async function proposePrice(actor: Actor, bookingId: string, input: { amount: number; note: string }, origin: Origin) {
  if (actor.role !== 'PARTNER') throw new OpsError('Solo el socio puede proponer el precio final', 403)
  const b = await load(bookingId)
  assertBookingAccess(actor, b)
  if (b.status !== 'IN_PROGRESS' && b.status !== 'COMPLETED') throw new OpsError('El precio final se propone con el servicio en curso o terminado')
  if (!unpaid(b)) throw new OpsError('El pago ya está reportado o confirmado: escribe a soporte para cambiar el precio')
  if (onlineStarted(b)) throw new OpsError('El cliente ya empezó a pagar en línea: escribe a soporte para cambiar el precio')
  const amount = Math.round(Number(input.amount))
  const note = input.note.trim()
  if (!Number.isFinite(amount) || amount < MIN_PRICE) throw new OpsError('Escribe un precio válido')
  if (amount > b.totalPrice * MAX_PRICE_FACTOR) throw new OpsError(`El precio no puede ser más de ${MAX_PRICE_FACTOR} veces el acordado: habla con soporte`)
  if (amount === b.totalPrice) throw new OpsError('Es el mismo precio acordado')
  if (note.length < 5) throw new OpsError('Explícale al cliente el porqué del cambio (mínimo 5 caracteres)')
  // One accepted change per booking: repeated changes would stack the 3x bound
  const accepted = await prisma.bookingEvent.findFirst({ where: { bookingId, type: 'price_answer', detail: { startsWith: 'El cliente aceptó' } }, select: { id: true } })
  if (accepted) throw new OpsError('El precio final ya se ajustó una vez: escribe a soporte para otro cambio')
  const proposal: PriceProposal = { amount, previous: b.totalPrice, note: note.slice(0, 300), at: new Date().toISOString() }
  await addBookingEvent({ bookingId, type: 'price_request', actor, origin, detail: JSON.stringify(proposal) })
  await sendWaToUser(b.userId, WA.B37({ ...dataOf(b), amount, previous: b.totalPrice, at: proposal.at }))
  await createNotification({
    userId: b.userId, type: 'PAYMENT_PENDING_REMINDER', title: 'El socio propone un precio final',
    message: `${b.partner?.user?.name ?? 'El socio'} propone ${formatCOP(amount)} (antes ${formatCOP(b.totalPrice)}) para ${b.service?.name ?? 'tu servicio'}: «${proposal.note}». Acéptalo o recházalo en tus reservas.`,
    data: { bookingId, kind: 'PRICE_REQUEST' },
  }).catch(() => null)
  return { proposal }
}

/** The client accepts (the booking's price changes before paying) or turns it down (the agreed price stays). */
export async function answerPrice(actor: Actor, bookingId: string, accept: boolean, origin: Origin, notAfter?: Date) {
  const b = await load(bookingId)
  assertBookingAccess(actor, b)
  if (actor.role !== 'CLIENT') throw new OpsError('Responde el cliente de la reserva', 403)
  const open = (await openAgreements([bookingId])).get(bookingId)?.price
  if (!open) return { message: 'No hay ningún cambio de precio pendiente.' }
  if (notAfter && Date.parse(open.at) > notAfter.getTime() + 60_000) return { message: 'El socio propuso otro precio después de ese mensaje: revísalo en tus reservas.' }
  const partnerUserId = b.partner?.userId ?? null
  if (!accept) {
    await addBookingEvent({ bookingId, type: 'price_answer', actor, origin, detail: `El cliente no aceptó el precio de ${formatCOP(open.amount)}` })
    if (partnerUserId) await createNotification({ userId: partnerUserId, type: 'PAYMENT_REJECTED_BY_PARTNER', title: 'El cliente no aceptó el nuevo precio', message: `Se mantiene ${formatCOP(b.totalPrice)} para ${b.service?.name ?? 'el servicio'}. Si no están de acuerdo, escríbenos y el equipo media.`, data: { bookingId, kind: 'PRICE_REJECTED' } }).catch(() => null)
    return { message: `Entendido: se mantiene el precio acordado de ${formatCOP(b.totalPrice)}. Si hay un desacuerdo, escríbenos y te ayudamos.` }
  }
  if (b.status !== 'IN_PROGRESS' && b.status !== 'COMPLETED') throw new OpsError('La reserva ya no admite cambio de precio')
  if (!unpaid(b) || onlineStarted(b)) throw new OpsError('El pago ya está en curso: escríbenos para ajustar el precio')
  // Guarded on the price and on a payment nobody reported meanwhile (a report between the check and here wins)
  const changed = await prisma.$transaction(async (tx) => {
    const pay = await tx.payment.findUnique({ where: { bookingId }, select: { id: true, status: true, confirmationStatus: true, preferenceId: true, mercadopagoId: true } })
    if (pay && (pay.status === 'APPROVED' || pay.preferenceId || pay.mercadopagoId || !['NONE', 'REJECTED_BY_PARTNER'].includes(pay.confirmationStatus))) return false
    const res = await tx.booking.updateMany({ where: { id: bookingId, totalPrice: open.previous, status: { in: ['IN_PROGRESS', 'COMPLETED'] } }, data: { totalPrice: open.amount } })
    if (!res.count) return false
    if (pay) await tx.payment.update({ where: { id: pay.id }, data: { amount: open.amount, serviceAmount: open.amount, totalAmount: open.amount } })
    return true
  })
  if (!changed) throw new OpsError('La reserva o el pago cambiaron mientras respondías: recarga y revisa', 409)
  await addBookingEvent({ bookingId, type: 'price_answer', actor, origin, detail: `El cliente aceptó el precio final: ${formatCOP(open.previous)} → ${formatCOP(open.amount)}` })
  if (partnerUserId) await createNotification({ userId: partnerUserId, type: 'PAYMENT_CONFIRMED_BY_PARTNER', title: 'El cliente aceptó el precio final', message: `La reserva de ${b.service?.name ?? 'servicio'} quedó en ${formatCOP(open.amount)}.`, data: { bookingId, kind: 'PRICE_ACCEPTED' } }).catch(() => null)
  return { message: `Listo: el precio final quedó en ${formatCOP(open.amount)}.` }
}
