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

const logger = createLogger('booking-followups')
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
} as const
export type FollowupMark = keyof typeof FOLLOWUP_MARK
const MARK_BY_TEXT = new Map<string, FollowupMark>(Object.entries(FOLLOWUP_MARK).map(([k, v]) => [v, k as FollowupMark]))

export const CANCEL_REASON = {
  unconfirmed: 'El socio no confirmó la reserva antes de la hora del servicio',
  no_show: 'El socio no llegó al servicio (reportado por el cliente)',
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

/** The latest time of each mark per booking, in one query. */
async function marksFor(ids: string[]): Promise<Map<string, Marks>> {
  const out = new Map<string, Marks>()
  if (!ids.length) return out
  const rows = await prisma.bookingEvent.findMany({ where: { bookingId: { in: ids }, type: 'followup' }, select: { bookingId: true, detail: true, createdAt: true } })
  for (const r of rows) {
    const kind = r.detail ? MARK_BY_TEXT.get(r.detail) : undefined
    if (!kind) continue
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

// ─── System changes with their notices ──────────────────────────────────────

/** Cancels on the platform's behalf and tells the partner why (C35 / C38). Returns false if it already moved. */
async function systemCancel(b: Row, kind: CancelKind) {
  const done = await systemTransition(b.id, 'CANCELLED', CANCEL_REASON[kind])
  if (!done) return false
  broadcast(b)
  const data = dataOf(b)
  if (b.partner?.userId) {
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

  await step(t, 'arrival', async () => {
    const rows = (await prisma.booking.findMany({ where: { status: 'CONFIRMED', scheduledDate: { gte: since(3), lte: now } }, select: bookingSelect, orderBy: { scheduledDate: 'asc' }, take: 200 })) as Row[]
    const marks = await marksFor(rows.map((b) => b.id))
    for (const b of rows) {
      const when = bookingWhen(b).getTime()
      if (at < when + T.askPartnerArrivalMs || when < at - 2 * DAY || !live(when)) continue
      const m = marks.get(b.id) ?? new Map<FollowupMark, Date>()
      const noShow = m.get('noShowReported')
      if (noShow) {
        const onWay = m.get('partnerOnWay')
        const from = Math.max(noShow.getTime(), onWay?.getTime() ?? 0)
        if (at >= from + T.noShowGraceMs && !paid(b) && cancels < MAX_CANCELS_PER_RUN && (await cancelAndOffer(b, 'no_show'))) { cancels++; bump(t, 'cancelled_no_show') }
        continue
      }
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

  return t
}

// ─── Answers of the client and the partner ──────────────────────────────────

export const CLIENT_FOLLOWUP_ACTIONS = ['rebook', 'decline_rebook', 'wait', 'arrived', 'no_show', 'done', 'not_done'] as const
export const PARTNER_FOLLOWUP_ACTIONS = ['partner_started', 'partner_on_way', 'partner_cant_go', 'partner_paid', 'partner_not_paid'] as const
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
export async function applyFollowup(actor: Actor, bookingId: string, action: FollowupAction, origin: Origin, opts: { method?: OfflineMethod } = {}, now = new Date()): Promise<FollowupResult> {
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

/** What the app shows on a booking card: the follow-up buttons that apply now. */
export async function followupOptions(actor: Actor, bookingIds: string[], now = new Date()): Promise<Record<string, FollowupAction[]>> {
  const out: Record<string, FollowupAction[]> = {}
  if (!bookingIds.length || actor.role === 'ADMIN') return out
  const rows = (await prisma.booking.findMany({
    where: { id: { in: bookingIds.slice(0, 100) }, ...(actor.role === 'CLIENT' ? { userId: actor.userId } : { partnerId: actor.partnerId ?? '__none__' }) },
    select: bookingSelect,
  })) as Row[]
  const ids = rows.map((b) => b.id)
  const [marks, cancelled] = await Promise.all([marksFor(ids), enteredAt(ids, 'CANCELLED')])
  for (const b of rows) {
    const m = marks.get(b.id) ?? new Map<FollowupMark, Date>()
    const when = bookingWhen(b).getTime()
    const list: FollowupAction[] = []
    if (actor.role === 'CLIENT') {
      if (b.status === 'PENDING' && m.has('askedClientRebook') && !paid(b)) list.push('rebook')
      if (b.status === 'CONFIRMED' && now.getTime() >= when + 10 * MIN && !m.has('noShowReported')) list.push('no_show', 'arrived')
      if (b.status === 'CONFIRMED' && m.has('noShowReported') && !paid(b)) list.push('rebook')
      if (b.status === 'IN_PROGRESS') list.push('done')
      if (b.status === 'CANCELLED' && b.proposal?.serviceRequest.status === 'ACCEPTED' && !m.has('rebooked') && !m.has('rebookDeclined')) {
        const c = cancelled.get(b.id)
        if (c && c.getTime() >= now.getTime() - T.rebookWindowMs) list.push('rebook')
      }
    }
    if (list.length) out[b.id] = list
  }
  return out
}
