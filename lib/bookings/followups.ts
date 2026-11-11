/**
 * Automatic follow-up of an accepted booking until it is paid. Run every 15 min (request-lifecycle) and
 * answered by the client and the partner from WhatsApp buttons (lib/bookings/followup-buttons.ts) or the app
 * (POST /api/bookings/[id]/followup):
 * - PENDING the partner does not confirm → the client chooses: look for another partner or wait. At the
 *   service hour it is cancelled without cost and the client is offered to reopen the request.
 * - CONFIRMED and the hour came without starting → right at the hour the partner is asked to mark that they
 *   started («Ya empecé»), 15 min later the client «¿Ya llegó el socio?», at 45 min a second notice to the
 *   partner. «No ha llegado» opens a NO_SHOW guarantee claim; 30 min later without starting it is cancelled
 *   and the client is offered another partner. The strike stays the team's decision (the claim).
 *   A late partner keeps the client informed: «Voy en camino» / «llego en 20» (button, app, booking chat or
 *   their own WhatsApp) tells the client at once with the arrival time (once per update), the partner is not
 *   urged while within that time and the client's «¿Ya llegó?» waits for it; without a word, the +15 notice
 *   says we are confirming with the partner, and at +45 (or past the time they gave) the client gets the
 *   options: wait, another partner now, or cancel without cost. A start more than 30 min late is registered
 *   (admin mark, no strike) and the client is told.
 * - IN_PROGRESS → at start + the service's duration (2–3 h) the partner is asked «¿Terminaste?» («Sí,
 *   terminé» completes it), 30 min later the client «¿Ya terminó?»; 24 h without an answer it is completed.
 * - COMPLETED → at once (notifyBookingStatusChange) the client hears how to pay and to rate, the partner to
 *   confirm the payment and rate. Rating reminders at 24 h, 72 h and a last one at 5 days; 1–2 stars open a
 *   follow-up case for the team (openLowRatingFollowup).
 * - COMPLETED unpaid → second reminder to the client, the partner is asked if they got paid, and the team
 *   steps in on what nobody solves (support case + D11).
 * - Appointment guarantee: the client re-confirms the day before (18:00) and again 3 h before; 90 min before
 *   without it the booking is «en espera» and the partner is told not to leave (no strike for them); 1 h after
 *   the hour it is cancelled as the client's fault. Before leaving, the partner taps «Voy a salir»: the client
 *   answers «Sí, aquí estaré» or the partner is told not to go and may release it without a strike.
 *   Every notice goes out on the app, push, email, SMS and WhatsApp (critical notifications).
 * At night (22:00–06:00) the client's automatic notices go only to the app and push.
 * The decisions are pure (lib/bookings/followups-core.ts, with the timings); this file loads, sends and marks.
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
import {
  APPOINTMENT_MARKS, DAY, FOLLOWUP_MARK, FOLLOWUP_TIMING, H, MIN, appointmentStep, arrivalAskClientText, arrivalStep, clientConfirmed,
  inProgressStep, isNight, lateOptionsClientText, lateOptionsOpen, lateStartClientText, lateStartMinutes, lowRatingCase,
  bogotaClock, markDetail, onWay, readyHint, onWayClientText, onWayRepeat, openDeparture, parseMarkDetail, partnerLateState, ratingReminderStep, releaseKind,
  toldNotToGo, type FollowupMark, type Marks,
} from '@/lib/bookings/followups-core'

const logger = createLogger('booking-followups')
const APP_URL = 'https://www.lohaggo.com'

export {
  FOLLOWUP_TIMING, FOLLOWUP_MARK, isNight, reconfirmAskAt, reconfirmHoldAt, releaseKind,
  type FollowupMark,
} from '@/lib/bookings/followups-core'
const T = FOLLOWUP_TIMING

/** The follow-up only acts on what happened after it went live: older bookings stay with the team (Haggo flags). */
export const FOLLOWUP_SINCE = new Date('2026-10-22T03:00:00Z')
/** Per run: a bad day never cancels or escalates dozens at once. */
const MAX_CANCELS_PER_RUN = 20
const MAX_ESCALATIONS_PER_RUN = 10

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
  service: { select: { name: true, duration: true } },
  user: { select: { name: true } },
  partner: { select: { id: true, userId: true, rating: true, totalReviews: true, user: { select: { name: true } } } },
  payment: { select: { status: true, confirmationStatus: true, clientReportedAt: true } },
  proposal: { select: { serviceRequestId: true, notes: true, serviceRequest: { select: { status: true } } } },
} as const
type Row = {
  id: string; userId: string; partnerId: string | null; proposalId: string | null; status: string; scheduledDate: Date; scheduledTime: string
  totalPrice: number; address: string; city: string; createdAt: Date; updatedAt: Date
  service: { name: string; duration?: number | null } | null; user: { name: string } | null
  partner: { id: string; userId: string; rating?: number | null; totalReviews?: number | null; user: { name: string } | null } | null
  payment: { status: string; confirmationStatus: string; clientReportedAt: Date | null } | null
  proposal: { serviceRequestId: string; notes?: string | null; serviceRequest: { status: string } } | null
}
/** «Carlos (★ 4.8)»: the partner's first name and rating, when they have reviews. */
const partnerLabel = (b: Row) => `${b.partner?.user?.name?.trim().split(/\s+/)[0] || 'el socio'}${b.partner?.rating && (b.partner.totalReviews ?? 0) > 0 ? ` (★ ${b.partner.rating.toFixed(1)})` : ''}`
const dataOf = (b: Row) => ({ id: b.id, when: bookingWhen(b), service: b.service?.name ?? 'servicio', price: b.totalPrice, clientName: b.user?.name ?? null, partnerName: b.partner?.user?.name ?? null, address: b.address, city: b.city })

async function loadRow(bookingId: string): Promise<Row> {
  const b = await prisma.booking.findUnique({ where: { id: bookingId }, select: bookingSelect })
  if (!b) throw new OpsError('Reserva no encontrada', 404)
  return b as Row
}

// ─── Marks ──────────────────────────────────────────────────────────────────

/** The latest time of each mark per booking, in one query (appointment marks only after the last reschedule). */
export async function marksFor(ids: string[]): Promise<Map<string, Marks>> {
  const out = new Map<string, Marks>()
  if (!ids.length) return out
  const rows = await prisma.bookingEvent.findMany({ where: { bookingId: { in: ids }, type: { in: ['followup', 'reschedule'] } }, select: { bookingId: true, type: true, detail: true, createdAt: true } })
  const moved = new Map<string, Date>()
  for (const r of rows) if (r.type === 'reschedule' && (!moved.get(r.bookingId) || moved.get(r.bookingId)! < r.createdAt)) moved.set(r.bookingId, r.createdAt)
  for (const r of rows) {
    if (r.type !== 'followup') continue
    const parsed = parseMarkDetail(r.detail)
    if (!parsed) continue
    const { kind, minutes } = parsed
    const since = moved.get(r.bookingId)
    if (since && r.createdAt < since && APPOINTMENT_MARKS.includes(kind)) continue
    const m: Marks = out.get(r.bookingId) ?? new Map<FollowupMark, Date>()
    const prev = m.get(kind)
    if (!prev || prev < r.createdAt) {
      m.set(kind, r.createdAt)
      // The minutes of the latest one of its kind (an update without minutes clears them)
      if (minutes != null) (m.minutes ??= new Map()).set(kind, minutes)
      else m.minutes?.delete(kind)
    }
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
async function mark(b: Row, kind: FollowupMark, actor?: Actor, origin: Origin = APP_ORIGIN, minutes?: number | null) {
  const detail = markDetail(kind, minutes)
  if (actor) {
    await addBookingEvent({ bookingId: b.id, type: 'followup', actor, origin, detail })
    return
  }
  await prisma.bookingEvent.create({ data: { bookingId: b.id, type: 'followup', actorType: 'system', ...originColumns(APP_ORIGIN), detail } })
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

export { enteredAt as enteredAtOf }

const paid = (b: Row) => b.payment?.status === 'APPROVED' || b.payment?.confirmationStatus === 'CONFIRMED'

// ─── Appointment guarantee ─────────────────────────────────────────────────

/** Every channel the person has (app, push, email, SMS, WhatsApp text in the window), with this exact text. */
async function critical(userId: string, type: 'BOOKING_REMINDER_24H' | 'BOOKING_STARTING_SOON' | 'BOOKING_CONFIRMED' | 'BOOKING_CANCELLED', title: string, message: string, data: Record<string, unknown>, opts: { quiet?: boolean; noWhatsApp?: boolean } = {}) {
  // The reminder types are how the reminders cron dedupes B11/B12: these notices use their own types
  const own = type === 'BOOKING_CANCELLED' ? type : 'BOOKING_CONFIRMED'
  // At night (22:00–06:00 Bogotá) a client is told only in the app and by push: no SMS, email or WhatsApp at 4 a. m.
  await createNotification({ userId, type: own, title, message, data, critical: true, ...(opts.quiet ? { channels: ['PUSH'] } : opts.noWhatsApp ? { channels: ['PUSH', 'EMAIL', 'SMS'] } : {}) }).catch((err) => logger.warn('Critical notice not sent', { userId, err: err instanceof Error ? err.message : err }))
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
      const { actions, holdAt, departedAt } = appointmentStep({ when: w, now: at, marks: m })
      for (const action of actions) {
        if (action === 'depart_no_answer' && departedAt && b.partner?.userId) {
          // «Voy a salir» without an answer after 10 min: the partner is told not to go
          await mark(b, 'departNoAnswer')
          if (clientConfirmed(m)) {
            // They confirmed the appointment already: the partner goes as agreed (no «don't leave» nor release)
            await critical(b.partner.userId, 'BOOKING_STARTING_SOON', 'El cliente no respondió tu aviso', `${b.user?.name ?? 'El cliente'} confirmó la cita pero no respondió tu aviso de salida. Ve según lo acordado o escríbele por el chat de la reserva.`, { bookingId: b.id, kind: 'DEPART_NO_ANSWER_CONFIRMED', url: '/partner?tab=bookings' })
          } else {
            await sendWaToUser(b.partner.userId, WA.C44({ ...dataOf(b), at: departedAt.toISOString() }), now)
            await critical(b.partner.userId, 'BOOKING_STARTING_SOON', 'El cliente no responde: no salgas', `${b.user?.name ?? 'El cliente'} no respondió a tu aviso de salida para ${b.service?.name ?? 'el servicio'}. Te recomendamos no salir; puedes liberar la reserva en la app sin falta para ti.`, { bookingId: b.id, kind: 'DEPART_NO_ANSWER', url: '/partner?tab=bookings' })
          }
          bump(t, 'depart_no_answer')
        } else if (action === 'reconfirm_ask') {
          await mark(b, 'reconfirmAsked')
          await sendWaToUser(b.userId, WA.B38(dataOf(b)), now)
          await critical(b.userId, 'BOOKING_REMINDER_24H', 'Confirma tu cita', `Confirma tu servicio de ${b.service?.name ?? 'servicio'} con ${partnerLabel(b)} ${formatBookingWhen(b)}. El socio solo sale hacia tu dirección cuando confirmes. ${readyHint(b.proposal?.notes)}`, { bookingId: b.id, kind: 'RECONFIRM_ASK', url: '/dashboard?tab=bookings', actionLink: await clientLink(b) }, { quiet: isNight(at) })
          bump(t, 'reconfirm_asked')
        } else if (action === 'reconfirm_urge' && holdAt) {
          await mark(b, 'reconfirmUrged')
          await sendWaToUser(b.userId, WA.B39({ ...dataOf(b), deadline: new Date(holdAt) }), now)
          await critical(b.userId, 'BOOKING_STARTING_SOON', 'Tu cita aún no está confirmada', `Tu servicio de ${b.service?.name ?? 'servicio'} es ${formatBookingWhen(b)} y aún no lo confirmas. Si no confirmas pronto, el socio no saldrá y la cita quedará en espera.`, { bookingId: b.id, kind: 'RECONFIRM_URGE', url: '/dashboard?tab=bookings', actionLink: await clientLink(b) })
          bump(t, 'reconfirm_urged')
        } else if (action === 'hold') {
          await mark(b, 'appointmentOnHold')
          if (b.partner?.userId) {
            await sendWaToUser(b.partner.userId, WA.C43(dataOf(b)), now)
            await critical(b.partner.userId, 'BOOKING_STARTING_SOON', 'No salgas todavía', `${b.user?.name ?? 'El cliente'} aún no confirma ${b.service?.name ?? 'el servicio'} de ${formatBookingWhen(b)}. Te avisamos apenas confirme; si no confirma, la cita se cancela sin falta para ti.`, { bookingId: b.id, kind: 'APPOINTMENT_ON_HOLD', url: '/partner?tab=bookings' })
          }
          await critical(b.userId, 'BOOKING_STARTING_SOON', 'Tu cita quedó en espera', `No confirmaste tu servicio de ${b.service?.name ?? 'servicio'} (${formatBookingWhen(b)}), así que el socio no saldrá. Confírmalo ahora si aún lo necesitas.`, { bookingId: b.id, kind: 'APPOINTMENT_ON_HOLD', url: '/dashboard?tab=bookings', actionLink: await clientLink(b) }, { quiet: isNight(at) })
          bump(t, 'appointment_on_hold')
        } else if (action === 'cancel_unconfirmed') {
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
    }
  })

  await step(t, 'arrival', async () => {
    const rows = (await prisma.booking.findMany({ where: { status: 'CONFIRMED', scheduledDate: { gte: since(3), lte: now } }, select: bookingSelect, orderBy: { scheduledDate: 'asc' }, take: 200 })) as Row[]
    const marks = await marksFor(rows.map((b) => b.id))
    const night = isNight(at)
    for (const b of rows) {
      const when = bookingWhen(b).getTime()
      if (when < at - 2 * DAY || !live(when)) continue
      const m = marks.get(b.id) ?? new Map<FollowupMark, Date>()
      for (const action of arrivalStep({ when, now: at, marks: m, paid: paid(b) })) {
        if (action === 'cancel_client_absent') {
          if (cancels < MAX_CANCELS_PER_RUN && (await cancelAndOffer(b, 'client_absent'))) { cancels++; bump(t, 'cancelled_client_absent') }
        } else if (action === 'cancel_no_show') {
          if (cancels < MAX_CANCELS_PER_RUN && (await cancelAndOffer(b, 'no_show'))) { cancels++; bump(t, 'cancelled_no_show') }
        } else if (action === 'ask_partner_start' && b.partner?.userId) {
          // Right at the hour: «Ya empecé» (WhatsApp button) or the app's «Iniciar servicio»
          await mark(b, 'askedPartnerArrival')
          await sendWaToUser(b.partner.userId, WA.C36(dataOf(b)), now)
          await createNotification({
            userId: b.partner.userId, type: 'BOOKING_STARTING_SOON', title: 'Es la hora: marca que empezaste',
            message: `Tu servicio de ${b.service?.name ?? 'servicio'} con ${b.user?.name ?? 'el cliente'} es ahora (${formatBookingWhen(b)}, ${b.address}). Al llegar, márcalo como iniciado; si vas en camino o no puedes ir, avísanos.`,
            data: { bookingId: b.id, kind: 'ARRIVAL_ASK', url: '/partner?tab=bookings' },
          }).catch(() => null)
          bump(t, 'asked_partner_arrival')
        } else if (action === 'ask_client_arrival') {
          // What we know first (on the way and when, or that we are confirming with the partner), then the B32
          // question with its buttons. At night only in the app (and push).
          await mark(b, 'askedClientArrival')
          const onTheWay = partnerLateState(m, at) === 'on_way'
          await critical(b.userId, 'BOOKING_STARTING_SOON', onTheWay ? `${b.partner?.user?.name?.split(' ')[0] ?? 'Tu socio'} va en camino` : 'Estamos confirmando con el socio',
            arrivalAskClientText({ partnerName: b.partner?.user?.name ?? null, service: b.service?.name ?? 'servicio', when, marks: m, now: at }),
            { bookingId: b.id, kind: 'ARRIVAL_ASK_CLIENT', url: '/dashboard?tab=bookings' }, { quiet: night })
          if (!night) await sendWaToUser(b.userId, WA.B32(dataOf(b)), now)
          bump(t, 'asked_client_arrival')
        } else if (action === 'client_late_options') {
          // +45 min without starting nor a word from the partner (or past the time they gave): the client's options, once
          await mark(b, 'clientToldOptions')
          await critical(b.userId, 'BOOKING_STARTING_SOON', 'Tu socio está retrasado: tus opciones',
            lateOptionsClientText({ partnerName: b.partner?.user?.name ?? null, service: b.service?.name ?? 'servicio', when, marks: m, now: at }),
            { bookingId: b.id, kind: 'LATE_OPTIONS', url: '/dashboard?tab=bookings' }, { quiet: night })
          const { notifyAdminsInApp } = await import('@/lib/inbox/escalation')
          const admins = (await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true }, take: 50 })).map((u) => u.id)
          await notifyAdminsInApp(admins, { title: 'Socio retrasado sin respuesta', message: `Reserva #${b.id.slice(-6)} de ${b.service?.name ?? 'servicio'} (${formatBookingWhen(b)}): ${b.partner?.user?.name ?? 'el socio'} no inicia ni responde. Le dimos al cliente sus opciones.`, url: '/admin/operations', kind: 'booking:partner-late' })
          bump(t, 'client_late_options')
        } else if (action === 'urge_partner_start' && b.partner?.userId) {
          await mark(b, 'urgedPartnerStart')
          await createNotification({
            userId: b.partner.userId, type: 'BOOKING_STARTING_SOON', title: 'El servicio aún no está iniciado',
            message: `${b.user?.name ?? 'El cliente'} te espera para ${b.service?.name ?? 'el servicio'} desde ${formatBookingWhen(b)}. Si ya estás ahí, márcalo como iniciado; si vas en camino, avísale por el chat; si no puedes ir, cancela la reserva ya.`,
            data: { bookingId: b.id, kind: 'ARRIVAL_URGE', url: '/partner?tab=bookings' },
          }).catch(() => null)
          bump(t, 'urged_partner_start')
        }
      }
    }
  })

  await step(t, 'in_progress', async () => {
    const rows = (await prisma.booking.findMany({ where: { status: 'IN_PROGRESS', updatedAt: { gte: since(5) } }, select: bookingSelect, orderBy: { updatedAt: 'asc' }, take: 200 })) as Row[]
    const ids = rows.map((b) => b.id)
    const [marks, started] = await Promise.all([marksFor(ids), enteredAt(ids, 'IN_PROGRESS')])
    const night = isNight(at)
    for (const b of rows) {
      const startedAt = (started.get(b.id) ?? b.updatedAt).getTime()
      if (!live(startedAt)) continue
      const m = marks.get(b.id) ?? new Map<FollowupMark, Date>()
      for (const action of inProgressStep({ startedAt, now: at, marks: m, durationMinutes: b.service?.duration })) {
        if (action === 'auto_complete') {
          if (await systemComplete(b, 'Pasaron 24 horas en curso sin que nadie lo cerrara: lo dimos por terminado')) bump(t, 'auto_completed')
        } else if (action === 'ask_partner_done') {
          // «Sí, terminé» on WhatsApp (C19) completes it like the app's «Marcar completado»
          await mark(b, 'askedPartnerDone')
          if (b.partner?.userId) {
            await sendWaToUser(b.partner.userId, WA.C19(dataOf(b)), now)
            await createNotification({
              userId: b.partner.userId, type: 'BOOKING_IN_PROGRESS', title: '¿Ya terminaste el servicio?',
              message: `Si ya terminaste ${b.service?.name ?? 'el servicio'} con ${b.user?.name ?? 'el cliente'}, márcalo como completado en tus reservas: así el cliente recibe cómo pagarte y puede calificarte.`,
              data: { bookingId: b.id, kind: 'DONE_ASK_PARTNER', url: '/partner?tab=bookings' },
            }).catch(() => null)
          }
          bump(t, 'asked_partner_done')
        } else if (action === 'ask_client_done') {
          // At night only in the app (and push)
          await mark(b, 'askedClientDone')
          if (!night) await sendWaToUser(b.userId, WA.B34(dataOf(b)), now)
          await createNotification({
            userId: b.userId, type: 'BOOKING_IN_PROGRESS', title: '¿Ya terminó tu servicio?',
            message: `Si el servicio de ${b.service?.name ?? 'servicio'} ya terminó, márcalo en tus reservas para pagar y calificar.`,
            data: { bookingId: b.id, kind: 'DONE_ASK', url: '/dashboard?tab=bookings' },
            ...(night ? { channels: ['PUSH' as const] } : {}),
          }).catch(() => null)
          bump(t, 'asked_client_done')
        }
      }
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
      // Never to the client at night: it waits for the morning
      if (age >= T.secondPaymentReminderMs && !isNight(at)) {
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
      if (!live(doneAt)) continue
      const due = ratingReminderStep({ doneAt, now: at, marks: marks.get(b.id) ?? new Map() })
      if (!due) continue
      const final = due === 'final'
      await mark(b, final ? 'askedRatingFinal' : 'askedRatingAgain')
      await sendWaToUser(b.userId, WA.B18({ ...dataOf(b), round: final ? 3 : 2 }), now)
      await createNotification({
        userId: b.userId, type: 'RATING_REMINDER', title: final ? 'Último recordatorio: califica tu servicio' : '¿Cómo te fue con el servicio?',
        message: final
          ? `¿Cómo te fue con ${b.partner?.user?.name?.split(' ')[0] ?? 'tu socio'} en ${b.service?.name ?? 'el servicio'}? Califícalo en tus reservas; si algo salió mal, cuéntanos y el equipo te ayuda.`
          : `Califica a ${b.partner?.user?.name ?? 'tu socio'} por ${b.service?.name ?? 'el servicio'}: ayuda a otros clientes a elegir.`,
        data: { bookingId: b.id, kind: final ? 'RATING_REMINDER_3' : 'RATING_REMINDER_2' },
      }).catch(() => null)
      bump(t, final ? 'rating_reminder_final' : 'rating_reminder_2')
    }
  })

  return t
}

// ─── Answers of the client and the partner ──────────────────────────────────

export const CLIENT_FOLLOWUP_ACTIONS = ['rebook', 'decline_rebook', 'wait', 'arrived', 'no_show', 'cancel_free', 'done', 'not_done', 'reschedule_ok', 'reschedule_no', 'price_ok', 'price_no', 'client_here', 'client_cancel', 'reconfirm_yes', 'reconfirm_change', 'reconfirm_cancel', 'here_yes', 'here_later'] as const
export const PARTNER_FOLLOWUP_ACTIONS = ['partner_started', 'partner_done', 'partner_on_way', 'partner_cant_go', 'partner_paid', 'partner_not_paid', 'client_absent', 'propose_price', 'partner_departing', 'partner_release'] as const
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
/**
 * The client's «el socio no llegó» on their behalf when they pick an option of the late notice: the mark and
 * the NO_SHOW claim (the strike stays the team's decision), like the «No ha llegado» button.
 */
async function reportNoShow(b: Row, m: Marks, actor: Actor, origin: Origin, now: Date) {
  if (m.has('noShowReported')) return
  await mark(b, 'noShowReported', actor, origin)
  const { openGuaranteeClaim } = await import('@/lib/guarantee/ops')
  await openGuaranteeClaim(actor, { bookingId: b.id, type: 'NO_SHOW', description: `El cliente reportó que el socio no llegó al servicio programado ${formatBookingWhen(b)} (seguimiento automático).` }, origin, now)
    .catch((err) => logger.info('No-show claim not opened', { bookingId: b.id, err: err instanceof Error ? err.message : err }))
}

/**
 * The booking just started (the partner, the client's «ya llegó» or the team): more than 30 min after the hour
 * the delay is registered once (an admin-visible mark, no strike: lateness is not an operational strike) and
 * the client and the partner are told so in the app. Never throws.
 */
export async function noteLateStart(bookingId: string, now = new Date()) {
  try {
    const b = await loadRow(bookingId)
    const when = bookingWhen(b).getTime()
    const late = lateStartMinutes(when, now.getTime())
    if (!late || when < FOLLOWUP_SINCE.getTime() || late > 12 * 60) return false
    const m = await marksOf(b.id)
    if (m.has('lateStart')) return false
    await mark(b, 'lateStart', undefined, APP_ORIGIN, late)
    const service = b.service?.name ?? 'servicio'
    // B13 (the template) already told the client it started: this is the app's word on the delay
    await createNotification({ userId: b.userId, type: 'BOOKING_IN_PROGRESS', title: 'Tu servicio ya empezó', message: lateStartClientText({ partnerName: b.partner?.user?.name ?? null, service, minutesLate: late }), data: { bookingId: b.id, kind: 'LATE_START', url: '/dashboard?tab=bookings' }, channels: ['PUSH'] }).catch(() => null)
    if (b.partner?.userId) await createNotification({ userId: b.partner.userId, type: 'BOOKING_IN_PROGRESS', title: 'Iniciaste con retraso', message: `Iniciaste ${service} ${late} min después de la hora acordada y quedó registrado. Si vas tarde, avisa «Voy en camino» con el tiempo de llegada: así el cliente sabe cuándo llegas.`, data: { bookingId: b.id, kind: 'LATE_START', url: '/partner?tab=bookings' }, channels: ['PUSH'] }).catch(() => null)
    return true
  } catch (err) {
    logger.warn('Late start not noted', { bookingId, err: err instanceof Error ? err.message : err })
    return false
  }
}

/**
 * The client rated the partner with 1–2 stars: once per booking a support case for the team (guarantee
 * queue) and the client hears that someone will contact them. Not when a guarantee claim is already open. Never throws.
 */
export async function openLowRatingFollowup(bookingId: string, rating: number, comment: string | null) {
  try {
    const b = await loadRow(bookingId)
    const c = lowRatingCase({ rating, comment, ref: b.id.slice(-6), service: b.service?.name ?? 'servicio', partnerName: b.partner?.user?.name ?? null, clientName: b.user?.name ?? null })
    if (!c) return false
    const m = await marksOf(b.id)
    if (m.has('lowRatingFollowup')) return false
    const claim = await prisma.guaranteeClaim.findFirst({ where: { bookingId: b.id, status: { in: ['OPEN', 'REDO_SCHEDULED', 'REFUND_REVIEW'] } }, select: { id: true } })
    if (claim) return false
    await mark(b, 'lowRatingFollowup')
    await prisma.adminSupportCase.create({
      data: { userId: b.userId, role: 'CLIENT', bookingId: b.id, priority: c.priority, status: 'OPEN', queue: 'GUARANTEE', subject: c.subject, description: c.description, slaDueAt: new Date(Date.now() + DAY) },
    }).catch((err) => logger.warn('Low rating case not created', { bookingId, err: err instanceof Error ? err.message : err }))
    await createNotification({ userId: b.userId, type: 'NEW_MESSAGE', title: 'Sentimos que no saliera bien', message: c.clientMessage, data: { bookingId: b.id, kind: 'LOW_RATING_FOLLOWUP', url: '/dashboard?tab=bookings' }, channels: ['PUSH'] }).catch(() => null)
    const { notifyAdminsInApp } = await import('@/lib/inbox/escalation')
    const admins = (await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true }, take: 50 })).map((u) => u.id)
    await notifyAdminsInApp(admins, { title: c.subject, message: c.description.slice(0, 300), url: '/admin/operations', kind: 'booking:low-rating' })
    return true
  } catch (err) {
    logger.warn('Low rating follow-up failed', { bookingId, err: err instanceof Error ? err.message : err })
    return false
  }
}

export async function applyFollowup(actor: Actor, bookingId: string, action: FollowupAction, origin: Origin, opts: { method?: OfflineMethod; amount?: number; note?: string; sentAt?: Date; etaMinutes?: number | null; viaChat?: boolean } = {}, now = new Date()): Promise<FollowupResult> {
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
        // After the late notice (+45 min without a word from the partner) the client may ask for another one at once
        if (!m.has('noShowReported') && !lateOptionsOpen(m, now.getTime())) throw new OpsError('Tu reserva sigue confirmada. Si el socio no llegó, primero cuéntanos con «El socio no llegó».')
        await reportNoShow(b, m, actor, origin, now)
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
      await noteLateStart(b.id, now)
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
    case 'cancel_free': {
      // One of the options of the late notice: cancelled without cost for the client (the claim goes to the team)
      if (b.status === 'IN_PROGRESS') return { message: 'El socio ya marcó el servicio como iniciado. Si no está contigo, escríbenos y lo revisamos.' }
      if (b.status !== 'CONFIRMED') return { message: 'Esta reserva ya no está activa.' }
      if (paid(b)) throw new OpsError('Tu reserva tiene un pago registrado: escríbenos y el equipo la cancela con el reembolso.')
      if (!m.has('noShowReported') && !lateOptionsOpen(m, now.getTime())) throw new OpsError('Aún no hay retraso del socio. Si quieres cancelar, hazlo desde tus reservas con el motivo.')
      await reportNoShow(b, m, actor, origin, now)
      if (!(await systemCancel(b, 'no_show'))) throw new OpsError('La reserva cambió de estado; recarga', 409)
      if (!m.has('rebookDeclined')) await mark(b, 'rebookDeclined', actor, origin)
      return { message: `Cancelamos tu reserva de ${service} sin costo y reportamos el retraso al equipo. Si aún necesitas el servicio, crea una solicitud nueva cuando quieras.` }
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
      // transitionBooking tells the client it started (B13 + notification) and registers a late start
      return { message: 'Listo, marcamos el servicio en curso y le avisamos al cliente. Cuando termines, márcalo como completado (te lo recordamos).' }
    case 'partner_done':
      // The same as the app's «Marcar completado»: the client then gets how to pay and to rate
      if (b.status === 'COMPLETED') return { message: 'El servicio ya figura como terminado. Cuando el cliente reporte el pago, confírmalo en tus reservas.' }
      if (b.status !== 'IN_PROGRESS') throw new OpsError(b.status === 'CONFIRMED' ? 'El servicio aún no está iniciado: primero márcalo como iniciado.' : 'El servicio no está en curso')
      await transitionBooking(actor, b.id, 'COMPLETED', origin)
      return { message: `¡Gracias! Marcamos ${service} como terminado y le enviamos al cliente cómo pagarte y calificarte. Cuando reporte el pago, confírmalo en tus reservas y califica al cliente: ${APP_URL}/partner?tab=bookings` }
    case 'partner_on_way': {
      if (b.status !== 'CONFIRMED') return { message: b.status === 'IN_PROGRESS' ? 'El servicio ya está en curso.' : 'Esta reserva ya no está confirmada.' }
      const eta = opts.etaMinutes ? Math.max(5, Math.min(120, Math.round(Number(opts.etaMinutes)))) : null
      const after = eta ? ` Llegas hacia las ${bogotaClock(now.getTime() + eta * MIN)}.` : ' Si puedes, dinos en cuánto llegas («llego en 20»).'
      // The same update again (a double tap, the button and the text): the client is not told twice
      if (onWayRepeat(m, eta, now.getTime())) return { message: `Ya le avisamos al cliente que vas en camino.${after}` }
      await mark(b, 'partnerOnWay', actor, origin, eta)
      const quietOnWay = Boolean(opts.viaChat) || isNight(now.getTime())
      // With a time, the approved B40 («sale ahora… llega en unos N minutos», «Sí, aquí estaré») reaches WhatsApp even
      // outside the 24 h window; then the notice skips its free-text WhatsApp
      const viaTemplate = !quietOnWay && eta ? Boolean((await sendWaToUser(b.userId, WA.B40({ ...dataOf(b), etaMinutes: eta, at: `onway-${now.getTime()}` }), now).catch(() => null))?.ok) : false
      // Once per update, on every channel (at night only in the app); from the booking chat the client already read the partner's words
      await critical(b.userId, 'BOOKING_STARTING_SOON', `${b.partner?.user?.name?.split(' ')[0] ?? 'Tu socio'} va en camino`, onWayClientText({ partnerName: b.partner?.user?.name ?? null, service, etaMinutes: eta, now: now.getTime() }), { bookingId: b.id, kind: 'PARTNER_ON_WAY', url: '/dashboard?tab=bookings' }, { quiet: quietOnWay, noWhatsApp: viaTemplate })
      return { message: `Le avisamos al cliente que vas en camino.${after} Al llegar, marca el servicio como iniciado.` }
    }
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
      await mark(b, 'partnerDeparting', actor, origin, eta)
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
  /**
   * Confirmed and the hour passed without starting: whether the partner said they are on the way (and the
   * estimated arrival), is past it, or said nothing; options = the client was given wait / another partner / cancel.
   */
  arrival?: { state: 'on_way' | 'overdue' | 'silent'; expectedAt: string | null; options: boolean }
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
    if (b.status === 'CONFIRMED' && now.getTime() >= when && now.getTime() < when + 6 * H && !toldNotToGo(m) && !absentOpen) {
      const way = onWay(m)
      info.arrival = { state: partnerLateState(m, now.getTime()), expectedAt: way ? new Date(way.expectedAt).toISOString() : null, options: lateOptionsOpen(m, now.getTime()) && !m.has('noShowReported') }
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
      if (b.status === 'CONFIRMED' && info.arrival?.options && !paid(b)) list.push('arrived', 'rebook', 'cancel_free')
      else if (b.status === 'CONFIRMED' && !absentOpen && !toldNotToGo(m) && now.getTime() >= when + 10 * MIN && !m.has('noShowReported')) list.push('no_show', 'arrived')
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
