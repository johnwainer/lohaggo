/**
 * Automatic follow-up of an accepted booking until it is paid. Run every 15 min (request-lifecycle) and
 * answered by the client and the partner from WhatsApp buttons (lib/bookings/followup-buttons.ts) or the app
 * (POST /api/bookings/[id]/followup):
 * - PENDING the partner does not confirm → the client chooses: look for another partner or wait. At the
 *   service hour it is cancelled without cost and the client is offered to reopen the request.
 * - CONFIRMED and the hour passed without starting → the partner is asked if they arrived, then the client.
 *   «No ha llegado» opens a NO_SHOW guarantee claim; 30 min later without starting it is cancelled and the
 *   client is offered another partner. The strike stays the team's decision (the claim).
 * - IN_PROGRESS for hours → the client is asked if it finished; 24 h without an answer it is completed.
 * - COMPLETED unpaid → second reminder to the client, the partner is asked if they got paid, and the team
 *   steps in on what nobody solves (support case + D11).
 * - Appointment guarantee: the client re-confirms the day before (18:00) and again 3 h before; 90 min before
 *   without it the booking is «en espera» and the partner is told not to leave (no strike for them); 1 h after
 *   the hour it is cancelled as the client's fault. Before leaving, the partner taps «Voy a salir»: the client
 *   answers «Sí, aquí estaré» or the partner is told not to go and may release it without a strike.
 *   Every notice goes out on the app, push, email, SMS and WhatsApp (critical notifications).
 * Marks are BookingEvents of type «followup» (their text is what the admin's history shows): no schema change.
 */
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { emitUserDataBroadcast } from '@/lib/supabase-admin'
import { bookingWhen, formatBookingWhen } from '@/lib/bookings/when'
import { WA } from '@/lib/messaging/wa-specs'
import { sendWaToAdmins, sendWaToUser } from '@/lib/messaging/wa-send'
import { createNotification, notifyBookingStatusChange } from '@/lib/notifications/notificationService'
import { APP_ORIGIN, OpsError, originColumns, type Actor, type Origin } from '@/lib/ops/origin'
import { addBookingEvent, assertBookingAccess, reopenRequestAfterPartnerCancel, systemTransition, transitionBooking } from '@/lib/bookings/ops'
import type { OfflineMethod } from '@/lib/payments/ops'
import { recordOperationalStrike } from '@/lib/partners/strikes'

const logger = createLogger('booking-followups')
const APP_URL = 'https://www.lohaggo.com'
const MIN = 60_000
const H = 60 * MIN
const DAY = 24 * H

/** Timings (exported for the tests and the admin's explanations). */
export const FOLLOWUP_TIMING = {
  askClientUnconfirmedAfterMs: 3 * H,
  askClientUnconfirmedBeforeServiceMs: 4 * H,
  askClientUnconfirmedLongMs: 12 * H,
  cancelUnconfirmedAfterServiceMs: 15 * MIN,
  askPartnerArrivalMs: 20 * MIN,
  askClientArrivalMs: 40 * MIN,
  noShowGraceMs: 30 * MIN,
  askClientDoneMs: 6 * H,
  autoCompleteAfterAskMs: 18 * H,
  autoCompleteMinMs: 24 * H,
  askPartnerPaidMs: 48 * H,
  secondPaymentReminderMs: 72 * H,
  escalateUnpaidMs: 5 * DAY,
  escalateReportedMs: 6 * DAY,
  escalateDisputedMs: 24 * H,
  rebookWindowMs: 7 * DAY,
  clientAbsentGraceMs: 30 * MIN,
  secondRatingReminderMs: 72 * H,
  /** Re-confirmation: asked the day before at this Bogotá hour (or at once when the booking is closer) */
  reconfirmAskHour: 18,
  reconfirmUrgeBeforeMs: 3 * H,
  reconfirmHoldBeforeMs: 90 * MIN,
  /** The client always gets at least this long to answer before the hold */
  reconfirmMinAnswerMs: 30 * MIN,
  reconfirmCancelAfterMs: 60 * MIN,
  departAnswerMs: 10 * MIN,
  /** «Voy a salir» from this long before the service until 2 h after */
  departFromMs: 3 * H,
} as const
const T = FOLLOWUP_TIMING

/** The follow-up only acts on what happened after it went live: older bookings stay with the team (Haggo flags). */
export const FOLLOWUP_SINCE = new Date('2026-10-22T03:00:00Z')
/** Per run: a bad day never cancels or escalates dozens at once. */
const MAX_CANCELS_PER_RUN = 20
const MAX_ESCALATIONS_PER_RUN = 10

/** The text of each mark: how it is found again and what the admin's history shows. */
export const FOLLOWUP_MARK = {
  askedClientRebook: 'Seguimiento: le preguntamos al cliente si busca otro socio (el socio no confirma)',
  clientWaits: 'El cliente prefiere esperar a que el socio confirme',
  askedPartnerArrival: 'Seguimiento: le preguntamos al socio si ya llegó',
  askedClientArrival: 'Seguimiento: le preguntamos al cliente si el socio llegó',
  noShowReported: 'El cliente reportó que el socio no ha llegado',
  partnerOnWay: 'El socio dijo que va en camino',
  askedClientDone: 'Seguimiento: le preguntamos al cliente si el servicio terminó',
  clientNotDone: 'El cliente dijo que el servicio aún no termina',
  askedPartnerPaid: 'Seguimiento: le preguntamos al socio si ya le pagaron',
  partnerNotPaid: 'El socio dijo que el cliente aún no le paga',
  paymentEscalated: 'Seguimiento: el pago pasó al equipo',
  rebookDeclined: 'El cliente no quiere buscar otro socio',
  rebooked: 'El cliente pidió otro socio: la solicitud se abrió de nuevo',
  clientAbsentReported: 'El socio llegó y no encontró al cliente',
  clientHere: 'El cliente dijo que ya está en el lugar',
  clientNoShow: 'El cliente no estaba en el lugar ni respondió',
  clientLateCancel: 'Cancelación tardía del cliente (menos de 24 horas)',
  askedRatingAgain: 'Seguimiento: segundo recordatorio para calificar',
  reconfirmAsked: 'Garantía de cita: le pedimos al cliente que confirme',
  reconfirmUrged: 'Garantía de cita: segundo aviso al cliente para confirmar',
  clientReconfirmed: 'El cliente confirmó la cita',
  appointmentOnHold: 'Garantía de cita: en espera, el cliente no confirmó (el socio no sale)',
  partnerDeparting: 'El socio avisó que va a salir',
  clientWaiting: 'El cliente confirmó que espera al socio',
  clientNeedsOtherTime: 'El cliente pidió otra hora cuando el socio iba a salir',
  departNoAnswer: 'Garantía de cita: el cliente no respondió al aviso de salida',
  clientUnconfirmed: 'El cliente no confirmó la cita (falta del cliente)',
} as const
export type FollowupMark = keyof typeof FOLLOWUP_MARK
const MARK_BY_TEXT = new Map<string, FollowupMark>(Object.entries(FOLLOWUP_MARK).map(([k, v]) => [v, k as FollowupMark]))

export const CANCEL_REASON = {
  unconfirmed: 'El socio no confirmó la reserva antes de la hora del servicio',
  no_show: 'El socio no llegó al servicio (reportado por el cliente)',
  client_absent: 'El cliente no estaba en el lugar y no respondió',
  client_unconfirmed: 'El cliente no confirmó la cita a tiempo',
  client_other_time: 'El cliente pidió otra hora cuando el socio iba a salir y no la reprogramó',
} as const
type CancelKind = keyof typeof CANCEL_REASON

type Tally = Record<string, number>
const bump = (t: Tally, k: string, n = 1) => { if (n) t[k] = (t[k] ?? 0) + n }

async function step(t: Tally, name: string, fn: () => Promise<void>) {
  try {
    await fn()
  } catch (err) {
    t[`${name}_error`] = 1
    logger.warn(`Follow-up step ${name} failed`, { err: err instanceof Error ? err.message : err })
  }
}

const bookingSelect = {
  id: true, userId: true, partnerId: true, proposalId: true, status: true, scheduledDate: true, scheduledTime: true,
  totalPrice: true, address: true, city: true, createdAt: true, updatedAt: true,
  service: { select: { name: true } },
  user: { select: { name: true } },
  partner: { select: { id: true, userId: true, user: { select: { name: true } } } },
  payment: { select: { status: true, confirmationStatus: true, clientReportedAt: true } },
  proposal: { select: { serviceRequestId: true, serviceRequest: { select: { status: true } } } },
} as const
type Row = {
  id: string; userId: string; partnerId: string | null; proposalId: string | null; status: string; scheduledDate: Date; scheduledTime: string
  totalPrice: number; address: string; city: string; createdAt: Date; updatedAt: Date
  service: { name: string } | null; user: { name: string } | null; partner: { id: string; userId: string; user: { name: string } | null } | null
  payment: { status: string; confirmationStatus: string; clientReportedAt: Date | null } | null
  proposal: { serviceRequestId: string; serviceRequest: { status: string } } | null
}
const dataOf = (b: Row) => ({ id: b.id, when: bookingWhen(b), service: b.service?.name ?? 'servicio', price: b.totalPrice, clientName: b.user?.name ?? null, partnerName: b.partner?.user?.name ?? null, address: b.address, city: b.city })

async function loadRow(bookingId: string): Promise<Row> {
  const b = await prisma.booking.findUnique({ where: { id: bookingId }, select: bookingSelect })
  if (!b) throw new OpsError('Reserva no encontrada', 404)
  return b as Row
}

// ─── Marks ──────────────────────────────────────────────────────────────────

type Marks = Map<FollowupMark, Date>

/** Marks about one date of the service: a reschedule starts them over (a «confirmo» is for the old date). */
const APPOINTMENT_MARKS: FollowupMark[] = ['reconfirmAsked', 'reconfirmUrged', 'clientReconfirmed', 'appointmentOnHold', 'partnerDeparting', 'clientWaiting', 'clientNeedsOtherTime', 'departNoAnswer', 'askedPartnerArrival', 'askedClientArrival']

/** The latest time of each mark per booking, in one query (appointment marks only after the last reschedule). */
async function marksFor(ids: string[]): Promise<Map<string, Marks>> {
  const out = new Map<string, Marks>()
  if (!ids.length) return out
  const rows = await prisma.bookingEvent.findMany({ where: { bookingId: { in: ids }, type: { in: ['followup', 'reschedule'] } }, select: { bookingId: true, type: true, detail: true, createdAt: true } })
  const moved = new Map<string, Date>()
  for (const r of rows) if (r.type === 'reschedule' && (!moved.get(r.bookingId) || moved.get(r.bookingId)! < r.createdAt)) moved.set(r.bookingId, r.createdAt)
  for (const r of rows) {
    if (r.type !== 'followup') continue
    const kind = r.detail ? MARK_BY_TEXT.get(r.detail) : undefined
    if (!kind) continue
    const since = moved.get(r.bookingId)
    if (since && r.createdAt < since && APPOINTMENT_MARKS.includes(kind)) continue
    const m = out.get(r.bookingId) ?? new Map<FollowupMark, Date>()
    const prev = m.get(kind)
    if (!prev || prev < r.createdAt) m.set(kind, r.createdAt)
    out.set(r.bookingId, m)
  }
  return out
}

async function marksOf(bookingId: string): Promise<Marks> {
  return (await marksFor([bookingId])).get(bookingId) ?? new Map()
}

function broadcast(b: { userId: string; partner?: { userId: string } | null }) {
  void emitUserDataBroadcast(b.userId, 'bookings')
  if (b.partner?.userId) void emitUserDataBroadcast(b.partner.userId, 'bookings')
}

/** A mark by the platform (actorType system) or, with an actor, by that person. */
async function mark(b: Row, kind: FollowupMark, actor?: Actor, origin: Origin = APP_ORIGIN) {
  if (actor) {
    await addBookingEvent({ bookingId: b.id, type: 'followup', actor, origin, detail: FOLLOWUP_MARK[kind] })
    return
  }
  await prisma.bookingEvent.create({ data: { bookingId: b.id, type: 'followup', actorType: 'system', ...originColumns(APP_ORIGIN), detail: FOLLOWUP_MARK[kind] } })
  broadcast(b)
}

/** When the booking last entered a status (its BookingEvent), else its last update. */
async function enteredAt(bookingIds: string[], status: string): Promise<Map<string, Date>> {
  const out = new Map<string, Date>()
  if (!bookingIds.length) return out
  const rows = await prisma.bookingEvent.findMany({ where: { bookingId: { in: bookingIds }, type: 'status', toStatus: status }, select: { bookingId: true, createdAt: true } })
  for (const r of rows) {
    const prev = out.get(r.bookingId)
    if (!prev || prev < r.createdAt) out.set(r.bookingId, r.createdAt)
  }
  return out
}

const paid = (b: Row) => b.payment?.status === 'APPROVED' || b.payment?.confirmationStatus === 'CONFIRMED'

// ─── Appointment guarantee ─────────────────────────────────────────────────

/** The client said the appointment stands (re-confirmation or «aquí estaré»). */
const clientConfirmed = (m: Marks) => m.has('clientReconfirmed') || m.has('clientWaiting')

/** 22:00–06:00 in Bogotá. */
export const isNight = (ms: number) => { const h = new Date(ms - 5 * H).getUTCHours(); return h >= 22 || h < 6 }

/** When the re-confirmation is asked: the day before at T.reconfirmAskHour (Bogotá). */
export function reconfirmAskAt(when: Date) {
  const day = new Date(when.getTime() - 5 * H).toISOString().slice(0, 10)
  return new Date(Date.parse(`${day}T00:00:00-05:00`) - (24 - T.reconfirmAskHour) * H)
}

/** When the booking goes on hold without the client's word: 90 min before, and never sooner than 30 min after asking. */
export function reconfirmHoldAt(when: Date, askedAt: Date) {
  return new Date(Math.max(when.getTime() - T.reconfirmHoldBeforeMs, askedAt.getTime() + T.reconfirmMinAnswerMs))
}

/**
 * Whether the partner may release the booking without a strike, and as what: the client never confirmed
 * (on hold, from the service hour on; or no answer to «Voy a salir» when they had not confirmed either), or
 * asked for another time when the partner was leaving. A client who confirmed is never released for not
 * answering one more message.
 */
export function releaseKind(m: Marks, when: number, now: number): 'client_unconfirmed' | 'client_other_time' | null {
  const departed = m.get('partnerDeparting')
  const later = m.get('clientNeedsOtherTime')
  if (departed && later && later >= departed) return 'client_other_time'
  if (clientConfirmed(m)) return null
  if (m.has('appointmentOnHold') && now >= when) return 'client_unconfirmed'
  if (departed && openDeparture(m) && now >= departed.getTime() + T.departAnswerMs) return 'client_unconfirmed'
  return null
}

/** The partner was told not to leave: they must never get «¿llegaste?», a «no llegó» or a strike for it. */
function toldNotToGo(m: Marks) {
  if (clientConfirmed(m) && !(m.get('clientNeedsOtherTime') && m.get('partnerDeparting') && m.get('clientNeedsOtherTime')! >= m.get('partnerDeparting')!)) return false
  const departed = m.get('partnerDeparting')
  const later = m.get('clientNeedsOtherTime')
  return m.has('appointmentOnHold') || m.has('departNoAnswer') || Boolean(departed && later && later >= departed)
}

/** The pending «Voy a salir»: departed and the client has not answered since. */
function openDeparture(m: Marks) {
  const d = m.get('partnerDeparting')
  if (!d) return null
  const answered = [m.get('clientWaiting'), m.get('clientNeedsOtherTime')].some((x) => x && x >= d)
  return answered ? null : d
}

/** Every channel the person has (app, push, email, SMS, WhatsApp text in the window), with this exact text. */
async function critical(userId: string, type: 'BOOKING_REMINDER_24H' | 'BOOKING_STARTING_SOON' | 'BOOKING_CONFIRMED' | 'BOOKING_CANCELLED', title: string, message: string, data: Record<string, unknown>, opts: { quiet?: boolean } = {}) {
  // The reminder types are how the reminders cron dedupes B11/B12: these notices use their own types
  const own = type === 'BOOKING_CANCELLED' ? type : 'BOOKING_CONFIRMED'
  // At night (22:00–06:00 Bogotá) a client is told only in the app and by push: no SMS, email or WhatsApp at 4 a. m.
  await createNotification({ userId, type: own, title, message, data, critical: true, ...(opts.quiet ? { channels: ['PUSH'] } : {}) }).catch((err) => logger.warn('Critical notice not sent', { userId, err: err instanceof Error ? err.message : err }))
}

async function clientLink(b: Row) {
  const { appointmentLink } = await import('@/lib/bookings/appointment-token')
  return appointmentLink(b.id, b.userId)
}

async function tellPartnerConfirmed(b: Row, waiting: boolean) {
  if (!b.partner?.userId) return
  const at = new Date().toISOString()
  await sendWaToUser(b.partner.userId, waiting ? WA.C45({ ...dataOf(b), at }) : WA.C42(dataOf(b)))
  await critical(b.partner.userId, 'BOOKING_CONFIRMED', waiting ? 'El cliente te espera' : 'El cliente confirmó la cita',
    waiting
      ? `${b.user?.name ?? 'El cliente'} confirmó que te espera para ${b.service?.name ?? 'el servicio'} (reserva #${b.id.slice(-6)}). Puedes salir tranquilo.`
      : `${b.user?.name ?? 'El cliente'} confirmó ${b.service?.name ?? 'el servicio'} de ${formatBookingWhen(b)} (reserva #${b.id.slice(-6)}). Antes de salir toca «Voy a salir» en la app.`,
    { bookingId: b.id, kind: waiting ? 'CLIENT_WAITING' : 'CLIENT_RECONFIRMED', url: '/partner?tab=bookings' })
}

// ─── System changes with their notices ──────────────────────────────────────

/** Cancels on the platform's behalf and tells the partner why (C35 / C38). Returns false if it already moved. */
async function systemCancel(b: Row, kind: CancelKind) {
  const done = await systemTransition(b.id, 'CANCELLED', CANCEL_REASON[kind])
  if (!done) return false
  broadcast(b)
  const data = dataOf(b)
  if (b.partner?.userId && (kind === 'client_unconfirmed' || kind === 'client_other_time')) {
    await sendWaToUser(b.partner.userId, WA.C32({ ...data, reason: kind === 'client_other_time' ? 'el cliente pidió otra hora; no tienes ninguna falta' : 'el cliente no confirmó la cita a tiempo; no tienes ninguna falta' }))
    await critical(b.partner.userId, 'BOOKING_CANCELLED', 'Reserva liberada sin falta para ti', `Cancelamos la reserva #${b.id.slice(-6)} de ${data.service} porque ${kind === 'client_other_time' ? 'el cliente pidió otra hora' : 'el cliente no confirmó la cita'}. No tienes ninguna falta.`, { bookingId: b.id, kind: 'AUTO_CANCEL_CLIENT_UNCONFIRMED', url: '/partner?tab=bookings' })
  } else if (b.partner?.userId && kind === 'client_absent') {
    await sendWaToUser(b.partner.userId, WA.C41(data))
    await createNotification({ userId: b.partner.userId, type: 'BOOKING_CANCELLED', title: 'Reserva cancelada: el cliente no estaba', message: `Cancelamos la reserva #${b.id.slice(-6)} de ${data.service} porque el cliente no estaba ni respondió. Gracias por avisar; quedó registrado.`, data: { bookingId: b.id, kind: 'AUTO_CANCEL_CLIENT_ABSENT' } }).catch(() => null)
  } else if (b.partner?.userId) {
    await sendWaToUser(b.partner.userId, kind === 'no_show' ? WA.C38(data) : WA.C35(data))
    await createNotification({
      userId: b.partner.userId,
      type: 'BOOKING_CANCELLED',
      title: kind === 'no_show' ? 'Reserva cancelada: el cliente reportó que no llegaste' : 'Reserva cancelada por falta de confirmación',
      message: kind === 'no_show'
        ? `Cancelamos la reserva #${b.id.slice(-6)} de ${data.service} porque el cliente reportó que no llegaste. El equipo revisará el caso.`
        : `La reserva #${b.id.slice(-6)} de ${data.service} se canceló porque no la confirmaste antes de la hora del servicio.`,
      data: { bookingId: b.id, kind: `AUTO_CANCEL_${kind.toUpperCase()}` },
    }).catch(() => null)
  }
  return true
}

/** Cancelled by the platform from the cron: the client hears it and is offered another partner (B31 / B33). */
async function cancelAndOffer(b: Row, kind: CancelKind) {
  if (!(await systemCancel(b, kind))) return false
  if (kind === 'client_other_time') {
    await sendWaToUser(b.userId, WA.B28({ ...dataOf(b), reason: 'pediste otra hora y el socio liberó la cita' }))
    await critical(b.userId, 'BOOKING_CANCELLED', 'Tu cita se canceló', `Pediste otra hora para ${dataOf(b).service} y el socio liberó la cita. Si aún lo necesitas, crea una solicitud nueva o escríbenos.`, { bookingId: b.id, kind: 'AUTO_CANCEL_CLIENT_OTHER_TIME', url: '/dashboard?tab=bookings' })
    return true
  }
  if (kind === 'client_unconfirmed') {
    await mark(b, 'clientUnconfirmed')
    await sendWaToUser(b.userId, WA.B28({ ...dataOf(b), reason: 'no confirmaste la cita a tiempo y el socio no salió' }))
    await critical(b.userId, 'BOOKING_CANCELLED', 'Cancelamos tu cita', `No confirmaste tu servicio de ${dataOf(b).service} a tiempo, así que el socio no salió y cancelamos la reserva. Si aún lo necesitas, crea una solicitud nueva.`, { bookingId: b.id, kind: 'AUTO_CANCEL_CLIENT_UNCONFIRMED', url: '/dashboard?tab=bookings' })
    return true
  }
  if (kind === 'client_absent') {
    await mark(b, 'clientNoShow')
    await sendWaToUser(b.userId, WA.B28({ ...dataOf(b), reason: 'el socio llegó, no te encontró y no respondiste a tiempo' }))
    await createNotification({ userId: b.userId, type: 'BOOKING_CANCELLED', title: 'Cancelamos tu reserva', message: `El socio llegó a tu servicio de ${dataOf(b).service} y no te encontró, y no respondiste a tiempo. Si fue un error, escríbenos.`, data: { bookingId: b.id, kind: 'AUTO_CANCEL_CLIENT_ABSENT' } }).catch(() => null)
    return true
  }
  if (kind === 'unconfirmed') await recordOperationalStrike({ id: b.id, partnerId: b.partnerId, partnerUserId: b.partner?.userId ?? null, service: b.service?.name ?? 'el servicio' }, 'unconfirmed')
  const data = dataOf(b)
  await sendWaToUser(b.userId, kind === 'no_show' ? WA.B33(data) : WA.B31(data))
  await createNotification({
    userId: b.userId,
    type: 'BOOKING_CANCELLED',
    title: kind === 'no_show' ? 'Cancelamos tu reserva sin costo' : 'El socio no confirmó tu reserva',
    message: `${kind === 'no_show' ? 'El socio no llegó' : 'El socio no confirmó a tiempo'}: cancelamos la reserva de ${data.service} sin costo. ¿Buscamos otro socio? Toca «Buscar otro socio» en tus reservas.`,
    data: { bookingId: b.id, kind: 'REBOOK_OFFER' },
  }).catch(() => null)
  return true
}

/** Completed on the platform's behalf, with the same notices as when the partner marks it (B14 / C22). */
async function systemComplete(b: Row, detail: string) {
  const done = await systemTransition(b.id, 'COMPLETED', detail)
  if (!done) return false
  broadcast(b)
  const { waBookingStatus } = await import('@/lib/messaging/wa-events')
  await waBookingStatus({ bookingId: b.id, from: 'IN_PROGRESS', to: 'COMPLETED', actorRole: 'ADMIN' })
  await notifyBookingStatusChange(b.id, 'COMPLETED')
  return true
}

/** The payment goes to the team once: support case + D11 to the admins. */
async function escalatePayment(b: Row, problem: string, marks: Marks) {
  if (marks.has('paymentEscalated')) return false
  await mark(b, 'paymentEscalated')
  await prisma.adminSupportCase.create({
    data: {
      userId: b.userId, role: 'CLIENT', bookingId: b.id, priority: 'HIGH', status: 'OPEN', queue: 'PAYMENTS',
      subject: `Pago sin resolver · reserva #${b.id.slice(-6)}`,
      description: `${problem}. Servicio: ${b.service?.name ?? '—'} · ${formatBookingWhen(b)} · $${b.totalPrice}. Resuélvelo en la solicitud (Pago → Resolver).`,
      slaDueAt: new Date(Date.now() + DAY),
    },
  }).catch(() => null)
  await sendWaToAdmins((a) => WA.D11({ adminName: a.name, bookingId: b.id, requestId: b.proposal?.serviceRequestId ?? null, service: b.service?.name ?? 'servicio', problem }))
  return true
}

// ─── Cron ───────────────────────────────────────────────────────────────────

/** Every 15 min (request-lifecycle). */
export async function runBookingFollowups(now = new Date()): Promise<Tally> {
  const t: Tally = {}
  const at = now.getTime()
  // Bookings are stored as the Bogotá day at 00:00 UTC: a few days back covers every hour
  const since = (days: number) => new Date(Math.max(at - days * DAY, FOLLOWUP_SINCE.getTime() - DAY))
  const live = (ms: number) => ms >= FOLLOWUP_SINCE.getTime()
  let cancels = 0
  let escalations = 0

  await step(t, 'pending', async () => {
    const rows = (await prisma.booking.findMany({ where: { status: 'PENDING', partnerId: { not: null }, scheduledDate: { gte: since(4) } }, select: bookingSelect, orderBy: { scheduledDate: 'asc' }, take: 200 })) as Row[]
    const marks = await marksFor(rows.map((b) => b.id))
    for (const b of rows) {
      const when = bookingWhen(b).getTime()
      const m = marks.get(b.id) ?? new Map()
      if (at >= when + T.cancelUnconfirmedAfterServiceMs) {
        // Old ones are the team's (flags), and a paid booking is never cancelled by the platform
        if (when < at - 3 * DAY || !live(when) || paid(b) || cancels >= MAX_CANCELS_PER_RUN) continue
        if (await cancelAndOffer(b, 'unconfirmed')) { cancels++; bump(t, 'cancelled_unconfirmed') }
        continue
      }
      const age = at - b.createdAt.getTime()
      const due = live(b.createdAt.getTime()) && age >= T.askClientUnconfirmedAfterMs && (when - at <= T.askClientUnconfirmedBeforeServiceMs || age >= T.askClientUnconfirmedLongMs)
      if (!due || m.has('askedClientRebook') || m.has('clientWaits')) continue
      await mark(b, 'askedClientRebook')
      await sendWaToUser(b.userId, WA.B30(dataOf(b)), now)
      await createNotification({
        userId: b.userId, type: 'BOOKING_REMINDER_24H', title: 'El socio aún no confirma tu reserva',
        message: `${b.partner?.user?.name ?? 'El socio'} todavía no confirma tu reserva de ${b.service?.name ?? 'servicio'} (${formatBookingWhen(b)}). Puedes esperar o pedir otro socio desde tus reservas.`,
        data: { bookingId: b.id, kind: 'UNCONFIRMED_ASK' },
      }).catch(() => null)
      bump(t, 'asked_client_rebook')
    }
  })

  await step(t, 'appointment', async () => {
    const rows = (await prisma.booking.findMany({ where: { status: 'CONFIRMED', scheduledDate: { gte: since(2), lte: new Date(at + 2 * DAY) } }, select: bookingSelect, orderBy: { scheduledDate: 'asc' }, take: 300 })) as Row[]
    const marks = await marksFor(rows.map((b) => b.id))
    for (const b of rows) {
      const when = bookingWhen(b)
      const w = when.getTime()
      if (!live(w) || w < at - 6 * H) continue
      const m = marks.get(b.id) ?? new Map<FollowupMark, Date>()

      // «Voy a salir» without an answer after 10 min: the partner is told not to go
      const departed = openDeparture(m)
      if (departed && at >= departed.getTime() + T.departAnswerMs && !(m.get('departNoAnswer') && m.get('departNoAnswer')! >= departed) && b.partner?.userId) {
        await mark(b, 'departNoAnswer')
        if (clientConfirmed(m)) {
          // They confirmed the appointment already: the partner goes as agreed (no «don't leave» nor release)
          await critical(b.partner.userId, 'BOOKING_STARTING_SOON', 'El cliente no respondió tu aviso', `${b.user?.name ?? 'El cliente'} confirmó la cita pero no respondió tu aviso de salida. Ve según lo acordado o escríbele por el chat de la reserva.`, { bookingId: b.id, kind: 'DEPART_NO_ANSWER_CONFIRMED', url: '/partner?tab=bookings' })
        } else {
          await sendWaToUser(b.partner.userId, WA.C44({ ...dataOf(b), at: departed.toISOString() }), now)
          await critical(b.partner.userId, 'BOOKING_STARTING_SOON', 'El cliente no responde: no salgas', `${b.user?.name ?? 'El cliente'} no respondió a tu aviso de salida para ${b.service?.name ?? 'el servicio'}. Te recomendamos no salir; puedes liberar la reserva en la app sin falta para ti.`, { bookingId: b.id, kind: 'DEPART_NO_ANSWER', url: '/partner?tab=bookings' })
        }
        bump(t, 'depart_no_answer')
      }

      if (clientConfirmed(m)) continue
      const asked = m.get('reconfirmAsked')
      if (!asked) {
        if (at < reconfirmAskAt(when).getTime() || at >= w) continue
        await mark(b, 'reconfirmAsked')
        await sendWaToUser(b.userId, WA.B38(dataOf(b)), now)
        await critical(b.userId, 'BOOKING_REMINDER_24H', 'Confirma tu cita', `Confirma tu servicio de ${b.service?.name ?? 'servicio'} con ${b.partner?.user?.name ?? 'el socio'} ${formatBookingWhen(b)}. El socio solo sale hacia tu dirección cuando confirmes.`, { bookingId: b.id, kind: 'RECONFIRM_ASK', url: '/dashboard?tab=bookings', actionLink: await clientLink(b) }, { quiet: isNight(at) })
        bump(t, 'reconfirm_asked')
        continue
      }
      // Asked less than 45 min before the hour (booked at the last minute): no hold, the «Voy a salir» check covers it
      if (w - asked.getTime() < 45 * MIN) continue
      const holdAt = Math.min(reconfirmHoldAt(when, asked).getTime(), w - 15 * MIN)
      if (!m.has('reconfirmUrged') && at >= w - T.reconfirmUrgeBeforeMs && at >= asked.getTime() + H && at < holdAt && !isNight(at)) {
        await mark(b, 'reconfirmUrged')
        await sendWaToUser(b.userId, WA.B39({ ...dataOf(b), deadline: new Date(holdAt) }), now)
        await critical(b.userId, 'BOOKING_STARTING_SOON', 'Tu cita aún no está confirmada', `Tu servicio de ${b.service?.name ?? 'servicio'} es ${formatBookingWhen(b)} y aún no lo confirmas. Si no confirmas pronto, el socio no saldrá y la cita quedará en espera.`, { bookingId: b.id, kind: 'RECONFIRM_URGE', url: '/dashboard?tab=bookings', actionLink: await clientLink(b) })
        bump(t, 'reconfirm_urged')
      }
      if (!m.has('appointmentOnHold') && at >= holdAt) {
        await mark(b, 'appointmentOnHold')
        if (b.partner?.userId) {
          await sendWaToUser(b.partner.userId, WA.C43(dataOf(b)), now)
          await critical(b.partner.userId, 'BOOKING_STARTING_SOON', 'No salgas todavía', `${b.user?.name ?? 'El cliente'} aún no confirma ${b.service?.name ?? 'el servicio'} de ${formatBookingWhen(b)}. Te avisamos apenas confirme; si no confirma, la cita se cancela sin falta para ti.`, { bookingId: b.id, kind: 'APPOINTMENT_ON_HOLD', url: '/partner?tab=bookings' })
        }
        await critical(b.userId, 'BOOKING_STARTING_SOON', 'Tu cita quedó en espera', `No confirmaste tu servicio de ${b.service?.name ?? 'servicio'} (${formatBookingWhen(b)}), así que el socio no saldrá. Confírmalo ahora si aún lo necesitas.`, { bookingId: b.id, kind: 'APPOINTMENT_ON_HOLD', url: '/dashboard?tab=bookings', actionLink: await clientLink(b) }, { quiet: isNight(at) })
        bump(t, 'appointment_on_hold')
        continue
      }
      if (m.has('appointmentOnHold') && at >= w + T.reconfirmCancelAfterMs) {
        // A «confirmo» may have arrived after the batch was read
        if (clientConfirmed(await marksOf(b.id))) continue
        if (paid(b)) {
          // Never cancelled by the platform: the team decides (once)
          if (!m.has('paymentEscalated')) {
            await escalatePayment(b, 'el cliente no confirmó la cita y la reserva ya está pagada', m)
            bump(t, 'escalated_paid_unconfirmed')
          }
        } else if (cancels < MAX_CANCELS_PER_RUN && (await cancelAndOffer(b, 'client_unconfirmed'))) {
          cancels++
          bump(t, 'cancelled_client_unconfirmed')
        }
      }
    }
  })

  await step(t, 'arrival', async () => {
    const rows = (await prisma.booking.findMany({ where: { status: 'CONFIRMED', scheduledDate: { gte: since(3), lte: now } }, select: bookingSelect, orderBy: { scheduledDate: 'asc' }, take: 200 })) as Row[]
    const marks = await marksFor(rows.map((b) => b.id))
    for (const b of rows) {
      const when = bookingWhen(b).getTime()
      if (at < when + T.askPartnerArrivalMs || when < at - 2 * DAY || !live(when)) continue
      const m = marks.get(b.id) ?? new Map<FollowupMark, Date>()
      const absent = m.get('clientAbsentReported')
      // The client's «no llegó» wins: the partner cannot turn it into a client no-show
      if (absent && !m.has('noShowReported')) {
        const here = m.get('clientHere')
        if ((!here || here < absent) && at >= absent.getTime() + T.clientAbsentGraceMs && !paid(b) && cancels < MAX_CANCELS_PER_RUN && (await cancelAndOffer(b, 'client_absent'))) { cancels++; bump(t, 'cancelled_client_absent') }
        continue
      }
      const noShow = m.get('noShowReported')
      if (noShow) {
        const onWay = m.get('partnerOnWay')
        const from = Math.max(noShow.getTime(), onWay?.getTime() ?? 0)
        if (at >= from + T.noShowGraceMs && !paid(b) && cancels < MAX_CANCELS_PER_RUN && (await cancelAndOffer(b, 'no_show'))) { cancels++; bump(t, 'cancelled_no_show') }
        continue
      }
      // The partner was told not to go (never confirmed, no answer to «Voy a salir», or another time asked):
      // nobody asks about arriving, so no «no llegó» and no strike
      if (toldNotToGo(m)) continue
      if (!m.has('askedPartnerArrival') && b.partner?.userId) {
        await mark(b, 'askedPartnerArrival')
        await sendWaToUser(b.partner.userId, WA.C36(dataOf(b)), now)
        await createNotification({
          userId: b.partner.userId, type: 'BOOKING_STARTING_SOON', title: '¿Ya llegaste al servicio?',
          message: `El servicio de ${b.service?.name ?? 'servicio'} con ${b.user?.name ?? 'el cliente'} era ${formatBookingWhen(b)}. Si ya empezaste, márcalo como iniciado; si no puedes ir, cancélalo.`,
          data: { bookingId: b.id, kind: 'ARRIVAL_ASK' },
        }).catch(() => null)
        bump(t, 'asked_partner_arrival')
      }
      if (at >= when + T.askClientArrivalMs && !m.has('askedClientArrival')) {
        await mark(b, 'askedClientArrival')
        await sendWaToUser(b.userId, WA.B32(dataOf(b)), now)
        await createNotification({
          userId: b.userId, type: 'BOOKING_STARTING_SOON', title: '¿Ya llegó el socio?',
          message: `Tu servicio de ${b.service?.name ?? 'servicio'} era ${formatBookingWhen(b)}. Si el socio no ha llegado, avísanos desde tus reservas («El socio no llegó»).`,
          data: { bookingId: b.id, kind: 'ARRIVAL_ASK_CLIENT' },
        }).catch(() => null)
        bump(t, 'asked_client_arrival')
      }
    }
  })

  await step(t, 'in_progress', async () => {
    const rows = (await prisma.booking.findMany({ where: { status: 'IN_PROGRESS', updatedAt: { gte: since(5) } }, select: bookingSelect, orderBy: { updatedAt: 'asc' }, take: 200 })) as Row[]
    const ids = rows.map((b) => b.id)
    const [marks, started] = await Promise.all([marksFor(ids), enteredAt(ids, 'IN_PROGRESS')])
    for (const b of rows) {
      const since0 = (started.get(b.id) ?? b.updatedAt).getTime()
      if (!live(since0)) continue
      const m = marks.get(b.id) ?? new Map<FollowupMark, Date>()
      const asked = m.get('askedClientDone')
      const notDone = m.get('clientNotDone')
      if (asked && !notDone && at >= since0 + T.autoCompleteMinMs && at >= asked.getTime() + T.autoCompleteAfterAskMs) {
        if (await systemComplete(b, 'Pasaron 24 horas en curso sin que nadie lo cerrara: lo dimos por terminado')) bump(t, 'auto_completed')
        continue
      }
      if (asked || at < since0 + T.askClientDoneMs) continue
      await mark(b, 'askedClientDone')
      await sendWaToUser(b.userId, WA.B34(dataOf(b)), now)
      await createNotification({
        userId: b.userId, type: 'BOOKING_IN_PROGRESS', title: '¿Ya terminó tu servicio?',
        message: `Si el servicio de ${b.service?.name ?? 'servicio'} ya terminó, márcalo en tus reservas para pagar y calificar.`,
        data: { bookingId: b.id, kind: 'DONE_ASK' },
      }).catch(() => null)
      bump(t, 'asked_client_done')
    }
  })

  await step(t, 'payment', async () => {
    const rows = (await prisma.booking.findMany({
      where: { status: 'COMPLETED', updatedAt: { gte: since(12) }, OR: [{ payment: { is: null } }, { payment: { is: { status: { not: 'APPROVED' }, confirmationStatus: { not: 'CONFIRMED' } } } }] },
      select: bookingSelect, orderBy: { updatedAt: 'asc' }, take: 200,
    })) as Row[]
    const ids = rows.map((b) => b.id)
    const [marks, completed] = await Promise.all([marksFor(ids), enteredAt(ids, 'COMPLETED')])
    for (const b of rows) {
      const doneAt = (completed.get(b.id) ?? b.updatedAt).getTime()
      if (doneAt < at - 10 * DAY || !live(doneAt)) continue
      const escalate = async (problem: string) => {
        if (escalations >= MAX_ESCALATIONS_PER_RUN || !(await escalatePayment(b, problem, m))) return
        escalations++
        bump(t, 'escalated')
      }
      const m = marks.get(b.id) ?? new Map<FollowupMark, Date>()
      const age = at - doneAt
      const cs = b.payment?.confirmationStatus ?? 'NONE'
      if (cs === 'DISPUTED') {
        if (age >= T.escalateDisputedMs) await escalate('cliente y socio no coinciden en el medio de pago')
        continue
      }
      if (cs === 'CLIENT_REPORTED') {
        const reported = b.payment?.clientReportedAt?.getTime() ?? doneAt
        if (at >= reported + T.escalateReportedMs) await escalate('el cliente reportó el pago y el socio no lo confirma')
        continue
      }
      if (m.has('partnerNotPaid') || age >= T.escalateUnpaidMs) {
        await escalate(m.has('partnerNotPaid') ? 'el socio dice que el cliente no le ha pagado' : 'pasaron 5 días sin pago ni reporte')
        continue
      }
      if (age >= T.secondPaymentReminderMs) {
        const r = await sendWaToUser(b.userId, WA.B15({ ...dataOf(b), round: 2 }), now)
        if (r && 'ok' in r && r.ok) bump(t, 'B15_r2')
      }
      if (age >= T.askPartnerPaidMs && !m.has('askedPartnerPaid') && b.partner?.userId) {
        await mark(b, 'askedPartnerPaid')
        await sendWaToUser(b.partner.userId, WA.C39(dataOf(b)), now)
        await createNotification({
          userId: b.partner.userId, type: 'PAYMENT_PENDING_REMINDER', title: '¿Ya te pagaron?',
          message: `¿${b.user?.name ?? 'El cliente'} ya te pagó el servicio de ${b.service?.name ?? 'servicio'}? Confírmalo en tus reservas para dejarlo registrado.`,
          data: { bookingId: b.id, kind: 'PAID_ASK' },
        }).catch(() => null)
        bump(t, 'asked_partner_paid')
      }
    }
  })

  await step(t, 'rating', async () => {
    const rows = await prisma.booking.findMany({
      where: { status: 'COMPLETED', updatedAt: { gte: since(8) }, OR: [{ review: { is: null } }, { review: { is: { clientToPartnerRating: null } } }] },
      select: bookingSelect, orderBy: { updatedAt: 'asc' }, take: 200,
    }) as Row[]
    const ids = rows.map((b) => b.id)
    const [marks, completed] = await Promise.all([marksFor(ids), enteredAt(ids, 'COMPLETED')])
    for (const b of rows) {
      const doneAt = (completed.get(b.id) ?? b.updatedAt).getTime()
      const age = at - doneAt
      if (!live(doneAt) || age < T.secondRatingReminderMs || age > 7 * DAY || marks.get(b.id)?.has('askedRatingAgain')) continue
      await mark(b, 'askedRatingAgain')
      await sendWaToUser(b.userId, WA.B18({ ...dataOf(b), round: 2 }), now)
      await createNotification({
        userId: b.userId, type: 'RATING_REMINDER', title: '¿Cómo te fue con el servicio?',
        message: `Califica a ${b.partner?.user?.name ?? 'tu socio'} por ${b.service?.name ?? 'el servicio'}: ayuda a otros clientes a elegir.`,
        data: { bookingId: b.id, kind: 'RATING_REMINDER_2' },
      }).catch(() => null)
      bump(t, 'rating_reminder_2')
    }
  })

  return t
}

// ─── Answers of the client and the partner ──────────────────────────────────

export const CLIENT_FOLLOWUP_ACTIONS = ['rebook', 'decline_rebook', 'wait', 'arrived', 'no_show', 'done', 'not_done', 'reschedule_ok', 'reschedule_no', 'price_ok', 'price_no', 'client_here', 'client_cancel', 'reconfirm_yes', 'reconfirm_change', 'reconfirm_cancel', 'here_yes', 'here_later'] as const
export const PARTNER_FOLLOWUP_ACTIONS = ['partner_started', 'partner_on_way', 'partner_cant_go', 'partner_paid', 'partner_not_paid', 'client_absent', 'propose_price', 'partner_departing', 'partner_release'] as const
export type FollowupAction = (typeof CLIENT_FOLLOWUP_ACTIONS)[number] | (typeof PARTNER_FOLLOWUP_ACTIONS)[number]

export type FollowupResult = { message: string }

/** Whether the client can still ask for another partner on this booking (what the app shows). */
export async function rebookAvailability(b: Pick<Row, 'id' | 'status' | 'proposal'>, now = new Date()): Promise<boolean> {
  if (b.status !== 'CANCELLED' || b.proposal?.serviceRequest.status !== 'ACCEPTED') return false
  const cancelled = (await enteredAt([b.id], 'CANCELLED')).get(b.id)
  if (!cancelled || cancelled.getTime() < now.getTime() - T.rebookWindowMs) return false
  const m = await marksOf(b.id)
  return !m.has('rebooked') && !m.has('rebookDeclined')
}

/**
 * The client or the partner answers a follow-up (a WhatsApp button or the app). Checks the role, ownership
 * and state; returns the sentence to show or send back.
 */
export async function applyFollowup(actor: Actor, bookingId: string, action: FollowupAction, origin: Origin, opts: { method?: OfflineMethod; amount?: number; note?: string; sentAt?: Date; etaMinutes?: number } = {}, now = new Date()): Promise<FollowupResult> {
  const b = await loadRow(bookingId)
  assertBookingAccess(actor, b)
  const isClientAction = (CLIENT_FOLLOWUP_ACTIONS as readonly string[]).includes(action)
  if (isClientAction && actor.role !== 'CLIENT') throw new OpsError('Esta respuesta es del cliente de la reserva', 403)
  if (!isClientAction && actor.role !== 'PARTNER') throw new OpsError('Esta respuesta es del socio de la reserva', 403)
  const m = await marksOf(b.id)
  const when = bookingWhen(b).getTime()
  const service = b.service?.name ?? 'el servicio'

  switch (action) {
    case 'rebook': {
      if (paid(b)) throw new OpsError('Tu reserva tiene un pago registrado: escríbenos y el equipo te asigna otro socio.')
      if (b.status === 'PENDING') {
        // Only after we asked: before that, the client cancels with a reason like any cancellation
        if (!m.has('askedClientRebook')) throw new OpsError('El socio aún tiene tiempo de confirmar. Si ya no quieres esperar, cancela la reserva desde tus reservas.')
        if (!(await systemCancel(b, 'unconfirmed'))) throw new OpsError('La reserva cambió de estado; recarga', 409)
      } else if (b.status === 'CONFIRMED') {
        if (!m.has('noShowReported')) throw new OpsError('Tu reserva sigue confirmada. Si el socio no llegó, primero cuéntanos con «El socio no llegó».')
        if (!(await systemCancel(b, 'no_show'))) throw new OpsError('La reserva cambió de estado; recarga', 409)
      } else if (!(await rebookAvailability(b, now))) {
        if (m.has('rebooked')) return { message: 'Tu solicitud ya está abierta de nuevo: te avisamos apenas lleguen propuestas.' }
        throw new OpsError('Esta reserva ya no se puede reabrir. Crea una solicitud nueva y te ayudamos.')
      }
      const reopened = await reopenRequestAfterPartnerCancel(b, { asap: when < now.getTime() + 2 * H })
      if (!reopened) throw new OpsError('No pudimos abrir tu solicitud de nuevo. Crea una solicitud nueva y te ayudamos.')
      await mark(b, 'rebooked', actor, origin)
      const waiting = b.proposal ? await prisma.proposal.count({ where: { serviceRequestId: b.proposal.serviceRequestId, status: 'PENDING' } }) : 0
      if (waiting > 0) return { message: `Listo: abrimos tu solicitud de ${service} de nuevo. Ya tienes ${waiting === 1 ? 'una propuesta' : `${waiting} propuestas`} de otros socios: elige una en «Mis solicitudes» (${APP_URL}/dashboard?tab=requests) y queda reservado al instante.` }
      return { message: `Listo: abrimos tu solicitud de ${service} de nuevo y les avisamos a los socios. Te llegarán propuestas aquí y en tu panel.` }
    }
    case 'decline_rebook':
      if (b.status !== 'CANCELLED') return { message: 'Tu reserva sigue activa; no hay que hacer nada.' }
      if (!m.has('rebookDeclined')) await mark(b, 'rebookDeclined', actor, origin)
      return { message: 'Entendido, no buscaremos otro socio. Si cambias de opinión, crea una solicitud nueva cuando quieras.' }
    case 'wait':
      if (b.status !== 'PENDING') return { message: b.status === 'CONFIRMED' ? 'El socio ya confirmó tu reserva.' : 'Tu reserva ya no está pendiente.' }
      if (!m.has('clientWaits')) await mark(b, 'clientWaits', actor, origin)
      return { message: 'Perfecto, esperamos. Si el socio no confirma antes de la hora del servicio, cancelamos la reserva sin costo y te ofrecemos otro socio.' }
    case 'arrived': {
      if (b.status === 'IN_PROGRESS') return { message: 'El servicio ya está en curso.' }
      if (b.status !== 'CONFIRMED') throw new OpsError('Tu reserva no está confirmada')
      if (now.getTime() < when - 30 * MIN) throw new OpsError(`Tu servicio es ${formatBookingWhen(b)}: el socio lo inicia al llegar.`)
      if (!(await systemTransition(b.id, 'IN_PROGRESS', 'El cliente confirmó que el socio llegó'))) throw new OpsError('La reserva cambió de estado; recarga', 409)
      broadcast(b)
      if (b.partner?.userId) {
        await createNotification({ userId: b.partner.userId, type: 'BOOKING_IN_PROGRESS', title: 'Servicio en curso', message: `El cliente confirmó que llegaste: marcamos el servicio de ${service} en curso. Al terminar, márcalo como completado.`, data: { bookingId: b.id, kind: 'ARRIVAL_CONFIRMED' } }).catch(() => null)
      }
      return { message: '¡Gracias! Marcamos el servicio en curso. Cuando termine, podrás pagar y calificar.' }
    }
    case 'no_show': {
      if (b.status === 'IN_PROGRESS') return { message: 'El socio ya marcó el servicio como iniciado. Si no está contigo, escríbenos y lo revisamos.' }
      if (b.status !== 'CONFIRMED') throw new OpsError('Tu reserva no está confirmada')
      if (now.getTime() < when) throw new OpsError(`Tu servicio es ${formatBookingWhen(b)}: aún no es la hora.`)
      if (m.has('noShowReported')) return { message: 'Ya le avisamos al socio. Si no inicia el servicio en los próximos minutos, cancelamos la reserva sin costo y te ofrecemos otro socio.' }
      await mark(b, 'noShowReported', actor, origin)
      const { openGuaranteeClaim } = await import('@/lib/guarantee/ops')
      await openGuaranteeClaim(actor, { bookingId: b.id, type: 'NO_SHOW', description: `El cliente reportó que el socio no llegó al servicio programado ${formatBookingWhen(b)} (seguimiento automático).` }, origin, now)
        .catch((err) => logger.info('No-show claim not opened', { bookingId: b.id, err: err instanceof Error ? err.message : err }))
      if (b.partner?.userId) {
        await createNotification({ userId: b.partner.userId, type: 'BOOKING_STARTING_SOON', title: 'El cliente dice que no has llegado', message: `Si vas en camino a ${service}, avísale por el chat; si no puedes ir, cancela la reserva ya. En 30 minutos sin iniciar la cancelamos.`, data: { bookingId: b.id, kind: 'NO_SHOW_REPORTED' } }).catch(() => null)
      }
      return { message: 'Gracias por avisarnos. Le escribimos al socio: si en 30 minutos no inicia el servicio, cancelamos la reserva sin costo y te ofrecemos otro socio.' }
    }
    case 'done':
      if (b.status === 'COMPLETED') return { message: 'El servicio ya está terminado.' }
      if (b.status !== 'IN_PROGRESS') throw new OpsError('El servicio no está en curso')
      if (!(await systemComplete(b, 'El cliente confirmó que el servicio terminó'))) throw new OpsError('La reserva cambió de estado; recarga', 409)
      return { message: 'Gracias. Dimos el servicio por terminado: ya puedes pagar y calificar desde tus reservas.' }
    case 'not_done':
      if (b.status !== 'IN_PROGRESS') return { message: b.status === 'COMPLETED' ? 'El servicio ya figura como terminado.' : 'El servicio no está en curso.' }
      await mark(b, 'clientNotDone', actor, origin)
      return { message: 'Entendido. Cuando termine, el socio lo marca o nos avisas desde tus reservas.' }

    case 'partner_started':
      if (b.status === 'IN_PROGRESS') return { message: 'El servicio ya está en curso.' }
      await transitionBooking(actor, b.id, 'IN_PROGRESS', origin)
      return { message: 'Listo, marcamos el servicio en curso. Cuando termines, márcalo como completado.' }
    case 'partner_on_way':
      if (b.status !== 'CONFIRMED') return { message: b.status === 'IN_PROGRESS' ? 'El servicio ya está en curso.' : 'Esta reserva ya no está confirmada.' }
      await mark(b, 'partnerOnWay', actor, origin)
      await createNotification({ userId: b.userId, type: 'BOOKING_STARTING_SOON', title: 'El socio va en camino', message: `${b.partner?.user?.name ?? 'El socio'} avisó que va en camino a tu servicio de ${service}.`, data: { bookingId: b.id, kind: 'PARTNER_ON_WAY' } }).catch(() => null)
      return { message: 'Le avisamos al cliente que vas en camino. Al llegar, marca el servicio como iniciado.' }
    case 'partner_cant_go':
      if (b.status !== 'CONFIRMED' && b.status !== 'PENDING') return { message: 'Esta reserva ya no está activa.' }
      await transitionBooking(actor, b.id, 'CANCELLED', origin, { reason: 'El socio avisó que no puede llegar' })
      return { message: 'Cancelamos la reserva y abrimos la solicitud a otros socios. Avisa con tiempo la próxima vez para cuidar tu reputación.' }
    case 'partner_paid': {
      if (!opts.method) throw new OpsError('Indica si te pagaron en efectivo o por transferencia')
      if (paid(b)) return { message: 'El pago ya está registrado. ¡Gracias!' }
      const { confirmPartnerPayment } = await import('@/lib/payments/ops')
      const p = await confirmPartnerPayment(actor, b.id, { method: opts.method }, origin)
      return { message: p.confirmationStatus === 'DISPUTED' ? 'Registramos tu respuesta, pero no coincide con lo que reportó el cliente: el equipo lo revisa.' : 'Gracias, dejamos el pago registrado.' }
    }
    case 'reconfirm_yes': {
      if (b.status === 'IN_PROGRESS' || b.status === 'COMPLETED') return { message: 'El servicio ya está en curso.' }
      if (b.status === 'PENDING') return { message: 'El socio aún no acepta tu reserva: te pediremos confirmar la cita cuando la acepte.' }
      if (b.status !== 'CONFIRMED') return { message: 'Esta reserva ya no está activa.' }
      if (clientConfirmed(m)) return { message: `Tu cita ya está confirmada: ${service}, ${formatBookingWhen(b)}.` }
      await mark(b, 'clientReconfirmed', actor, origin)
      await tellPartnerConfirmed(b, false)
      return { message: `¡Listo! Confirmaste tu cita: ${service}, ${formatBookingWhen(b)}. Le avisamos a ${b.partner?.user?.name ?? 'tu socio'}; te escribiremos cuando salga hacia tu dirección.` }
    }
    case 'reconfirm_change':
      return { message: `Para cambiar la hora entra a tus reservas y toca «Reprogramar»: ${APP_URL}/dashboard?tab=bookings. El socio confirma la nueva hora.` }
    case 'reconfirm_cancel':
      if (b.status !== 'CONFIRMED' && b.status !== 'PENDING') return { message: 'Esta reserva ya no está activa.' }
      await transitionBooking(actor, b.id, 'CANCELLED', origin, { reason: 'El cliente canceló al confirmar la cita' })
      return { message: 'Cancelamos tu cita y le avisamos al socio. Si necesitas el servicio otro día, crea una solicitud nueva.' }
    case 'here_yes': {
      if (b.status === 'IN_PROGRESS') return { message: 'El servicio ya está en curso.' }
      if (b.status !== 'CONFIRMED') return { message: 'Esta reserva ya no está activa.' }
      await mark(b, 'clientWaiting', actor, origin)
      await tellPartnerConfirmed(b, true)
      return { message: `¡Gracias! Le avisamos a ${b.partner?.user?.name ?? 'tu socio'} que lo esperas.` }
    }
    case 'here_later': {
      if (b.status !== 'CONFIRMED') return { message: 'Esta reserva ya no está activa.' }
      await mark(b, 'clientNeedsOtherTime', actor, origin)
      if (b.partner?.userId) await critical(b.partner.userId, 'BOOKING_STARTING_SOON', 'No salgas: el cliente pidió otra hora', `${b.user?.name ?? 'El cliente'} no puede recibirte ahora para ${service}. No salgas; te avisamos la nueva hora. Si no llega, puedes liberar la reserva sin falta para ti.`, { bookingId: b.id, kind: 'CLIENT_NEEDS_OTHER_TIME', url: '/partner?tab=bookings' })
      return { message: `Le avisamos al socio que no salga. Elige la nueva hora en tus reservas («Reprogramar»): ${APP_URL}/dashboard?tab=bookings` }
    }
    case 'partner_departing': {
      if (b.status !== 'CONFIRMED') return { message: b.status === 'IN_PROGRESS' ? 'El servicio ya está en curso.' : 'Esta reserva ya no está confirmada.' }
      if (now.getTime() < when - T.departFromMs) throw new OpsError(`El servicio es ${formatBookingWhen(b)}: avisa cuando vayas a salir (hasta 3 horas antes).`)
      if (m.has('appointmentOnHold') && !clientConfirmed(m)) throw new OpsError('El cliente aún no confirma la cita: no salgas todavía. Te avisamos apenas confirme.')
      const eta = Math.max(5, Math.min(120, Math.round(Number(opts.etaMinutes) || 30)))
      const pending = openDeparture(m)
      if (pending && now.getTime() - pending.getTime() < T.departAnswerMs) return { message: 'Ya le avisamos al cliente: espera su respuesta antes de salir (máximo 10 minutos).' }
      const last = m.get('partnerDeparting')
      if (last && now.getTime() - last.getTime() < 30 * MIN) throw new OpsError('Ya le avisaste al cliente hace poco: espera 30 minutos para volver a avisarle o escríbele por el chat de la reserva.')
      const later = m.get('clientNeedsOtherTime')
      if (last && later && later >= last && !(m.get('clientReconfirmed') && m.get('clientReconfirmed')! > later)) throw new OpsError('El cliente pidió otra hora: espera a que reprograme o confirme de nuevo.')
      await mark(b, 'partnerDeparting', actor, origin)
      const at = now.toISOString()
      await sendWaToUser(b.userId, WA.B40({ ...dataOf(b), etaMinutes: eta, at }), now)
      await critical(b.userId, 'BOOKING_STARTING_SOON', `${b.partner?.user?.name ?? 'Tu socio'} va a salir hacia tu dirección`, `${b.partner?.user?.name ?? 'Tu socio'} sale ahora para ${service} y llega en unos ${eta} minutos. ¿Estarás en el lugar? Respóndenos para que salga.`, { bookingId: b.id, kind: 'PARTNER_DEPARTING', url: '/dashboard?tab=bookings', actionLink: await clientLink(b) })
      return { message: 'Le avisamos al cliente. Espera su respuesta antes de salir: te escribimos apenas confirme (o en 10 minutos si no responde).' }
    }
    case 'partner_release': {
      if (b.status !== 'CONFIRMED') return { message: 'Esta reserva ya no está confirmada.' }
      if (paid(b)) throw new OpsError('La reserva tiene un pago: escribe a soporte para liberarla.')
      // Read again right before cancelling: a «confirmo» that just arrived wins
      const fresh = await marksOf(b.id)
      const kind = releaseKind(fresh, when, now.getTime())
      if (!kind) throw new OpsError('Solo puedes liberar la reserva si el cliente no confirmó la cita (desde la hora del servicio), no respondió a tu aviso de salida o pidió otra hora. Si el cliente confirmó, sal a tiempo; si no puedes ir, cancela la reserva.')
      if (!(await cancelAndOffer(b, kind))) throw new OpsError('La reserva cambió de estado; recarga', 409)
      return { message: kind === 'client_unconfirmed' ? 'Liberamos la reserva sin ninguna falta para ti. El cliente quedó registrado por no confirmar.' : 'Liberamos la reserva sin ninguna falta para ti. Le avisamos al cliente.' }
    }
    case 'reschedule_ok':
    case 'reschedule_no': {
      const { answerReschedule } = await import('@/lib/bookings/agreements')
      return answerReschedule(actor, b.id, action === 'reschedule_ok', origin, opts.sentAt)
    }
    case 'price_ok':
    case 'price_no': {
      const { answerPrice } = await import('@/lib/bookings/agreements')
      return answerPrice(actor, b.id, action === 'price_ok', origin, opts.sentAt)
    }
    case 'client_here': {
      if (b.status !== 'CONFIRMED') return { message: b.status === 'IN_PROGRESS' ? 'El servicio ya está en curso.' : 'Esta reserva ya no está activa.' }
      if (!m.has('clientAbsentReported')) return { message: 'Perfecto, el socio te espera a la hora acordada.' }
      await mark(b, 'clientHere', actor, origin)
      if (b.partner?.userId) await createNotification({ userId: b.partner.userId, type: 'BOOKING_STARTING_SOON', title: 'El cliente ya está en el lugar', message: `${b.user?.name ?? 'El cliente'} dice que ya está en ${b.address}. Inicia el servicio al llegar.`, data: { bookingId: b.id, kind: 'CLIENT_HERE' } }).catch(() => null)
      return { message: 'Gracias, le avisamos al socio que ya estás en el lugar.' }
    }
    case 'client_cancel':
      if (b.status !== 'CONFIRMED' && b.status !== 'PENDING') return { message: 'Esta reserva ya no está activa.' }
      await transitionBooking(actor, b.id, 'CANCELLED', origin, { reason: 'El cliente canceló cuando el socio no lo encontró en el lugar' })
      return { message: 'Cancelamos tu reserva. Si necesitas el servicio otro día, crea una solicitud nueva cuando quieras.' }
    case 'client_absent': {
      if (b.status !== 'CONFIRMED') return { message: b.status === 'IN_PROGRESS' ? 'El servicio ya está en curso.' : 'Esta reserva ya no está confirmada.' }
      if (now.getTime() < when) throw new OpsError(`El servicio es ${formatBookingWhen(b)}: aún no es la hora.`)
      if (m.has('clientAbsentReported')) return { message: 'Ya le avisamos al cliente. Si no responde en 30 minutos, cancelamos la reserva y queda registrado.' }
      if (m.has('noShowReported')) throw new OpsError('El cliente reportó que no llegaste: escríbele por el chat de la reserva o inicia el servicio si ya estás ahí.')
      await mark(b, 'clientAbsentReported', actor, origin)
      await sendWaToUser(b.userId, WA.B36(dataOf(b)), now)
      await createNotification({ userId: b.userId, type: 'BOOKING_STARTING_SOON', title: 'El socio llegó y no te encontró', message: `${b.partner?.user?.name ?? 'El socio'} está en ${b.address} para ${service}. Avísale que ya estás o cancela; en 30 minutos sin respuesta la reserva se cancela.`, data: { bookingId: b.id, kind: 'CLIENT_ABSENT' } }).catch(() => null)
      return { message: 'Le avisamos al cliente. Espéralo unos minutos: si no responde en 30 minutos, cancelamos la reserva y queda registrado a tu favor.' }
    }
    case 'propose_price': {
      const { proposePrice } = await import('@/lib/bookings/agreements')
      await proposePrice(actor, b.id, { amount: Number(opts.amount), note: String(opts.note ?? '') }, origin)
      return { message: 'Le enviamos el nuevo precio al cliente. Te avisamos cuando lo acepte.' }
    }
    case 'partner_not_paid': {
      if (b.status !== 'COMPLETED') throw new OpsError('El servicio aún no está terminado')
      if (paid(b)) return { message: 'El pago ya figura como recibido. Si no es así, escríbenos.' }
      if (!m.has('partnerNotPaid')) await mark(b, 'partnerNotPaid', actor, origin)
      await sendWaToUser(b.userId, WA.B15({ ...dataOf(b), round: 3 }), now)
      await escalatePayment(b, 'el socio dice que el cliente no le ha pagado', m)
      return { message: 'Entendido. Le recordamos al cliente y nuestro equipo hace seguimiento.' }
    }
  }
}

export type FollowupInfo = {
  /** Date change waiting for the client (the partner proposed it) */
  reschedule?: { date: string; time: string; when: string }
  /** Final price waiting for the client */
  price?: { amount: number; previous: number; note: string }
  /** The partner reported they did not find the client (waiting for the client's answer) */
  clientAbsent?: boolean
  /**
   * Appointment guarantee of a confirmed booking: «confirmed» (the client re-confirmed), «pending» (asked, no
   * answer yet), «on_hold» (no answer in time: the partner does not leave), «not_asked» (too early to ask).
   * departure: the partner's «Voy a salir» and the client's answer (waiting | later | no_answer | null = pending).
   */
  appointment?: { state: 'confirmed' | 'pending' | 'on_hold' | 'not_asked'; departure?: { at: string; answer: 'waiting' | 'later' | 'no_answer' | null } }
}
export type FollowupView = { actions: FollowupAction[]; info: FollowupInfo }

/** What the app shows on a booking card: the follow-up buttons that apply now and what is waiting for an answer. */
export async function followupViews(actor: Actor, bookingIds: string[], now = new Date()): Promise<Record<string, FollowupView>> {
  const out: Record<string, FollowupView> = {}
  if (!bookingIds.length || actor.role === 'ADMIN') return out
  const rows = (await prisma.booking.findMany({
    where: { id: { in: bookingIds.slice(0, 300) }, ...(actor.role === 'CLIENT' ? { userId: actor.userId } : { partnerId: actor.partnerId ?? '__none__' }) },
    select: bookingSelect,
  })) as Row[]
  const ids = rows.map((b) => b.id)
  const { openAgreements } = await import('@/lib/bookings/agreements')
  const [marks, cancelled, agreements] = await Promise.all([marksFor(ids), enteredAt(ids, 'CANCELLED'), openAgreements(ids)])
  for (const b of rows) {
    const m = marks.get(b.id) ?? new Map<FollowupMark, Date>()
    const when = bookingWhen(b).getTime()
    const open = agreements.get(b.id) ?? {}
    const absent = m.get('clientAbsentReported')
    const here = m.get('clientHere')
    const absentOpen = Boolean(absent && (!here || here < absent) && b.status === 'CONFIRMED')
    const info: FollowupInfo = {}
    if (open.reschedule && (b.status === 'PENDING' || b.status === 'CONFIRMED')) {
      info.reschedule = { date: open.reschedule.date, time: open.reschedule.time, when: formatBookingWhen({ scheduledDate: new Date(`${open.reschedule.date}T00:00:00.000Z`), scheduledTime: open.reschedule.time }) }
    }
    if (open.price && (b.status === 'IN_PROGRESS' || b.status === 'COMPLETED') && !paid(b)) info.price = { amount: open.price.amount, previous: open.price.previous, note: open.price.note }
    if (absentOpen) info.clientAbsent = true
    const confirmedByClient = clientConfirmed(m)
    const departed = m.get('partnerDeparting')
    const departOpen = openDeparture(m)
    if (b.status === 'CONFIRMED' && now.getTime() < when + 6 * H) {
      const state = confirmedByClient ? 'confirmed' : m.has('appointmentOnHold') ? 'on_hold' : m.has('reconfirmAsked') ? 'pending' : 'not_asked'
      const answer = !departed ? null : departOpen ? (now.getTime() >= departed.getTime() + T.departAnswerMs ? 'no_answer' : null) : m.get('clientNeedsOtherTime') && m.get('clientNeedsOtherTime')! >= departed ? 'later' : 'waiting'
      info.appointment = { state, ...(departed ? { departure: { at: departed.toISOString(), answer } } : {}) }
    }
    const canRelease = b.status === 'CONFIRMED' && !paid(b) && Boolean(releaseKind(m, when, now.getTime()))
    const list: FollowupAction[] = []
    if (actor.role === 'CLIENT') {
      if (b.status === 'CONFIRMED' && departOpen) list.push('here_yes', 'here_later')
      if (b.status === 'CONFIRMED' && !confirmedByClient && !departOpen && now.getTime() >= when - 48 * H && now.getTime() < when + T.reconfirmCancelAfterMs) list.push('reconfirm_yes', 'reconfirm_cancel')
      if (info.reschedule) list.push('reschedule_ok', 'reschedule_no')
      if (info.price) list.push('price_ok', 'price_no')
      if (absentOpen) list.push('client_here', 'client_cancel')
      if (b.status === 'PENDING' && m.has('askedClientRebook') && !paid(b)) list.push('rebook')
      if (b.status === 'CONFIRMED' && !absentOpen && !toldNotToGo(m) && now.getTime() >= when + 10 * MIN && !m.has('noShowReported')) list.push('no_show', 'arrived')
      if (b.status === 'CONFIRMED' && m.has('noShowReported') && !paid(b)) list.push('rebook')
      if (b.status === 'IN_PROGRESS' && !info.price) list.push('done')
      if (b.status === 'CANCELLED' && b.proposal?.serviceRequest.status === 'ACCEPTED' && !m.has('rebooked') && !m.has('rebookDeclined') && !m.has('clientNoShow')) {
        const c = cancelled.get(b.id)
        if (c && c.getTime() >= now.getTime() - T.rebookWindowMs) list.push('rebook')
      }
    } else {
      const departWindow = now.getTime() >= when - T.departFromMs && now.getTime() < when + 2 * H
      const departBlocked = m.has('appointmentOnHold') && !confirmedByClient
      const recentDepart = departed && now.getTime() - departed.getTime() < 30 * MIN
      const laterOpen = info.appointment?.departure?.answer === 'later'
      if (b.status === 'CONFIRMED' && departWindow && !departBlocked && !absentOpen && !recentDepart && !laterOpen && info.appointment?.departure?.answer !== 'waiting') list.push('partner_departing')
      if (canRelease) list.push('partner_release')
      if (b.status === 'CONFIRMED' && now.getTime() >= when && !absent) list.push('client_absent')
      if ((b.status === 'IN_PROGRESS' || b.status === 'COMPLETED') && !paid(b) && !info.price && ['NONE', 'REJECTED_BY_PARTNER'].includes(b.payment?.confirmationStatus ?? 'NONE')) list.push('propose_price')
    }
    if (list.length || Object.keys(info).length) out[b.id] = { actions: list, info }
  }
  return out
}

/** Only the buttons (kept for callers that need just them). */
export async function followupOptions(actor: Actor, bookingIds: string[], now = new Date()): Promise<Record<string, FollowupAction[]>> {
  const views = await followupViews(actor, bookingIds, now)
  return Object.fromEntries(Object.entries(views).map(([id, v]) => [id, v.actions]))
}
