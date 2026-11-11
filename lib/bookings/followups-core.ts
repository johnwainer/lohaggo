/**
 * The pure decisions of the booking follow-up (lib/bookings/followups.ts): what is due for a booking at a
 * given moment, from its hour, its marks and its state. No server imports, so a test can walk a booking
 * from acceptance to payment with a fake clock (lib/bookings/__tests__/followup-timeline.test.ts).
 */

export const MIN = 60_000
export const H = 60 * MIN
export const DAY = 24 * H

/**
 * Every timing of the follow-up (exported for the tests and the admin's explanations).
 *
 * Timeline of a booking at 10:00 (service of 2 h):
 * - the day before: partner reminder (22–25 h, notification-reminders) and the client's re-confirmation at 18:00
 * - 07:00 urge to confirm, 08:30 hold without it · 09:00–09:30 the «starts soon» reminder to both
 * - 10:00 the partner is asked to mark that they started · 10:15 the client «¿Ya llegó el socio?»
 * - 10:45 second notice to the partner if it has not started (and did not say they are on the way)
 * - started at 10:00 → 12:00 the partner «¿Terminaste?» · 12:30 the client «¿Ya terminó?»
 * - completed → at once the client gets how to pay and to rate; the partner to confirm the payment and rate
 * - 24 h + 18 h after asking without an answer it is completed by the platform (never at night)
 */
export const FOLLOWUP_TIMING = {
  /** PENDING: the client is asked whether to look for another partner this long after booking… */
  askClientUnconfirmedAfterMs: 3 * H,
  /** …once the service is this close, or the booking is this old */
  askClientUnconfirmedBeforeServiceMs: 4 * H,
  askClientUnconfirmedLongMs: 12 * H,
  /** PENDING at the hour: cancelled without cost this long after it */
  cancelUnconfirmedAfterServiceMs: 15 * MIN,
  /** CONFIRMED: the partner is asked to mark that they started right at the hour (WhatsApp «Ya empecé» + app) */
  askPartnerArrivalMs: 0,
  /** …the client is asked «¿Ya llegó el socio?» this long after the hour */
  askClientArrivalMs: 15 * MIN,
  /** …and the partner gets a second notice this long after the hour if it is still not started */
  urgePartnerStartMs: 45 * MIN,
  /** The client said «no llegó»: cancelled this long after it (or after «voy en camino») without starting */
  noShowGraceMs: 30 * MIN,
  /** IN_PROGRESS: the partner is asked «¿Terminaste?» at start + the service's duration, between these bounds */
  askPartnerDoneMinMs: 2 * H,
  askPartnerDoneMaxMs: 3 * H,
  /** Duration of a service without one (minutes) */
  defaultServiceMinutes: 120,
  /** …and the client «¿Ya terminó?» this long after the partner was asked (if it is still in progress) */
  askClientDoneAfterPartnerMs: 30 * MIN,
  /** Safety net: completed by the platform this long after the client was asked and after it started */
  autoCompleteAfterAskMs: 18 * H,
  autoCompleteMinMs: 24 * H,
  /** COMPLETED unpaid: the partner is asked whether they got paid */
  askPartnerPaidMs: 48 * H,
  secondPaymentReminderMs: 72 * H,
  escalateUnpaidMs: 5 * DAY,
  escalateReportedMs: 6 * DAY,
  escalateDisputedMs: 24 * H,
  rebookWindowMs: 7 * DAY,
  /** The partner did not find the client: cancelled as the client's no-show this long after without an answer */
  clientAbsentGraceMs: 30 * MIN,
  /** Second rating reminder to the client (the first one is at 24 h, notification-reminders) */
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

/** The text of each mark: how it is found again and what the admin's history shows. */
export const FOLLOWUP_MARK = {
  askedClientRebook: 'Seguimiento: le preguntamos al cliente si busca otro socio (el socio no confirma)',
  clientWaits: 'El cliente prefiere esperar a que el socio confirme',
  askedPartnerArrival: 'Seguimiento: le preguntamos al socio si ya llegó',
  urgedPartnerStart: 'Seguimiento: segundo aviso al socio para iniciar el servicio',
  askedClientArrival: 'Seguimiento: le preguntamos al cliente si el socio llegó',
  noShowReported: 'El cliente reportó que el socio no ha llegado',
  partnerOnWay: 'El socio dijo que va en camino',
  askedPartnerDone: 'Seguimiento: le preguntamos al socio si ya terminó el servicio',
  askedClientDone: 'Seguimiento: le preguntamos al cliente si el servicio terminó',
  clientNotDone: 'El cliente dijo que el servicio aún no termina',
  completionNotices: 'Seguimiento: le enviamos al cliente cómo pagar y calificar, y al socio cómo confirmar el pago',
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
export const MARK_BY_TEXT = new Map<string, FollowupMark>(Object.entries(FOLLOWUP_MARK).map(([k, v]) => [v, k as FollowupMark]))

/** The latest time of each mark of one booking. */
export type Marks = Map<FollowupMark, Date>

/** Marks about one date of the service: a reschedule starts them over (a «confirmo» is for the old date). */
export const APPOINTMENT_MARKS: FollowupMark[] = ['reconfirmAsked', 'reconfirmUrged', 'clientReconfirmed', 'appointmentOnHold', 'partnerDeparting', 'clientWaiting', 'clientNeedsOtherTime', 'departNoAnswer', 'askedPartnerArrival', 'urgedPartnerStart', 'askedClientArrival']

// ─── Appointment guarantee ─────────────────────────────────────────────────

/** 22:00–06:00 in Bogotá: clients are told only in the app (and by push). */
export const isNight = (ms: number) => { const h = new Date(ms - 5 * H).getUTCHours(); return h >= 22 || h < 6 }

/** The client said the appointment stands (re-confirmation or «aquí estaré»). */
export const clientConfirmed = (m: Marks) => m.has('clientReconfirmed') || m.has('clientWaiting')

/** When the re-confirmation is asked: the day before at T.reconfirmAskHour (Bogotá). */
export function reconfirmAskAt(when: Date) {
  const day = new Date(when.getTime() - 5 * H).toISOString().slice(0, 10)
  return new Date(Date.parse(`${day}T00:00:00-05:00`) - (24 - T.reconfirmAskHour) * H)
}

/** When the booking goes on hold without the client's word: 90 min before, and never sooner than 30 min after asking. */
export function reconfirmHoldAt(when: Date, askedAt: Date) {
  return new Date(Math.max(when.getTime() - T.reconfirmHoldBeforeMs, askedAt.getTime() + T.reconfirmMinAnswerMs))
}

/** The pending «Voy a salir»: departed and the client has not answered since. */
export function openDeparture(m: Marks) {
  const d = m.get('partnerDeparting')
  if (!d) return null
  const answered = [m.get('clientWaiting'), m.get('clientNeedsOtherTime')].some((x) => x && x >= d)
  return answered ? null : d
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
export function toldNotToGo(m: Marks) {
  if (clientConfirmed(m) && !(m.get('clientNeedsOtherTime') && m.get('partnerDeparting') && m.get('clientNeedsOtherTime')! >= m.get('partnerDeparting')!)) return false
  const departed = m.get('partnerDeparting')
  const later = m.get('clientNeedsOtherTime')
  return m.has('appointmentOnHold') || m.has('departNoAnswer') || Boolean(departed && later && later >= departed)
}

export type AppointmentAction = 'depart_no_answer' | 'reconfirm_ask' | 'reconfirm_urge' | 'hold' | 'cancel_unconfirmed'

/** CONFIRMED, before and around the hour: re-confirmation, urge, hold, cancel, and the unanswered «Voy a salir». */
export function appointmentStep(p: { when: number; now: number; marks: Marks }): { actions: AppointmentAction[]; holdAt: number | null; departedAt: Date | null } {
  const { when: w, now, marks: m } = p
  const actions: AppointmentAction[] = []
  const departed = openDeparture(m)
  if (departed && now >= departed.getTime() + T.departAnswerMs && !(m.get('departNoAnswer') && m.get('departNoAnswer')! >= departed)) actions.push('depart_no_answer')
  if (clientConfirmed(m)) return { actions, holdAt: null, departedAt: departed }
  const asked = m.get('reconfirmAsked')
  if (!asked) {
    if (now >= reconfirmAskAt(new Date(w)).getTime() && now < w) actions.push('reconfirm_ask')
    return { actions, holdAt: null, departedAt: departed }
  }
  // Asked less than 45 min before the hour (booked at the last minute): no hold, the «Voy a salir» check covers it
  if (w - asked.getTime() < 45 * MIN) return { actions, holdAt: null, departedAt: departed }
  const holdAt = Math.min(reconfirmHoldAt(new Date(w), asked).getTime(), w - 15 * MIN)
  if (!m.has('reconfirmUrged') && now >= w - T.reconfirmUrgeBeforeMs && now >= asked.getTime() + H && now < holdAt && !isNight(now)) actions.push('reconfirm_urge')
  if (!m.has('appointmentOnHold') && now >= holdAt) actions.push('hold')
  else if (m.has('appointmentOnHold') && now >= w + T.reconfirmCancelAfterMs) actions.push('cancel_unconfirmed')
  return { actions, holdAt, departedAt: departed }
}

// ─── At the hour ────────────────────────────────────────────────────────────

export type ArrivalAction = 'cancel_client_absent' | 'cancel_no_show' | 'ask_partner_start' | 'ask_client_arrival' | 'urge_partner_start'

/**
 * CONFIRMED and the hour came without starting. The client's «no llegó» wins over the partner's «no estaba».
 * A partner told not to go is never asked about arriving (no «no llegó», no strike).
 */
export function arrivalStep(p: { when: number; now: number; marks: Marks; paid: boolean }): ArrivalAction[] {
  const { when, now, marks: m } = p
  if (now < when + T.askPartnerArrivalMs) return []
  const absent = m.get('clientAbsentReported')
  if (absent && !m.has('noShowReported')) {
    const here = m.get('clientHere')
    return (!here || here < absent) && now >= absent.getTime() + T.clientAbsentGraceMs && !p.paid ? ['cancel_client_absent'] : []
  }
  const noShow = m.get('noShowReported')
  if (noShow) {
    const from = Math.max(noShow.getTime(), m.get('partnerOnWay')?.getTime() ?? 0)
    return now >= from + T.noShowGraceMs && !p.paid ? ['cancel_no_show'] : []
  }
  if (toldNotToGo(m)) return []
  const out: ArrivalAction[] = []
  if (!m.has('askedPartnerArrival')) out.push('ask_partner_start')
  if (now >= when + T.askClientArrivalMs && !m.has('askedClientArrival')) out.push('ask_client_arrival')
  // Only around the hour: a booking from before this step existed never gets a late second notice
  if (now >= when + T.urgePartnerStartMs && now < when + 2 * 60 * MIN && m.has('askedPartnerArrival') && !m.has('urgedPartnerStart') && !m.has('partnerOnWay')) out.push('urge_partner_start')
  return out
}

// ─── In progress ────────────────────────────────────────────────────────────

/** When the partner is asked «¿Terminaste?»: start + the service's duration, between 2 and 3 hours. */
export function doneAskAt(startedAt: number, durationMinutes?: number | null) {
  const d = durationMinutes && durationMinutes > 0 ? durationMinutes * MIN : T.defaultServiceMinutes * MIN
  return startedAt + Math.min(T.askPartnerDoneMaxMs, Math.max(T.askPartnerDoneMinMs, d))
}

export type InProgressAction = 'ask_partner_done' | 'ask_client_done' | 'auto_complete'

/** IN_PROGRESS: «¿Terminaste?» to the partner, then «¿Ya terminó?» to the client, then the safety net. */
export function inProgressStep(p: { startedAt: number; now: number; marks: Marks; durationMinutes?: number | null }): InProgressAction[] {
  const { startedAt, now, marks: m } = p
  const askedClient = m.get('askedClientDone')
  // Never at night: it tells the client how to pay
  if (askedClient && !m.has('clientNotDone') && now >= startedAt + T.autoCompleteMinMs && now >= askedClient.getTime() + T.autoCompleteAfterAskMs) return isNight(now) ? [] : ['auto_complete']
  const at = doneAskAt(startedAt, p.durationMinutes)
  const out: InProgressAction[] = []
  const askedPartner = m.get('askedPartnerDone')
  if (now >= at && !askedPartner) out.push('ask_partner_done')
  if (!askedClient && askedPartner && now >= Math.max(at, askedPartner.getTime()) + T.askClientDoneAfterPartnerMs) out.push('ask_client_done')
  return out
}

// ─── Reminders (notification-reminders) ─────────────────────────────────────

/**
 * Who gets the day-before / «starts soon» reminder: the day before the client gets the re-confirmation
 * instead (from FOLLOWUP_SINCE on); at night the client only in the app. No «starts soon» to anyone when the
 * partner was told not to go, or the client was asked to confirm and has not by the hold time (the hold
 * notices say what to do instead).
 */
export function reminderPlan(kind: 'day' | 'soon', p: { now: number; when: number; followupLive: boolean; marks: Marks }): { client: 'all' | 'app' | null; partner: boolean } {
  const m = p.marks
  const held = kind === 'soon' && (toldNotToGo(m) || (m.has('reconfirmAsked') && !clientConfirmed(m) && p.now >= p.when - T.reconfirmHoldBeforeMs))
  const client = held || (kind === 'day' && p.followupLive) ? null : isNight(p.now) ? 'app' : 'all'
  return { client, partner: !held }
}

// ─── Completion ─────────────────────────────────────────────────────────────

const cop = (n: number) => `$${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n)}`

export type CompletionInput = {
  ref: string
  service: string
  price: number
  clientName: string | null
  partnerName: string | null
  methods: { cash: boolean; transfer: boolean; mercadoPago: boolean }
  /** The partner's default account, masked («•••• 1234»): the full one is on the booking card while unpaid */
  bank: { bankName: string; accountType: string; masked: string } | null
}

/** What the client and the partner are told once, when the booking is completed. */
export function completionNotices(p: CompletionInput) {
  const partner = p.partnerName?.split(' ')[0] || 'el socio'
  const client = p.clientName?.split(' ')[0] || 'el cliente'
  const ways: string[] = []
  if (p.methods.cash) ways.push(`en efectivo a ${partner}`)
  if (p.methods.transfer) ways.push(p.bank ? `por transferencia a ${p.bank.bankName} (${p.bank.accountType.toLowerCase()} ${p.bank.masked}; los datos completos están en tu reserva)` : 'por transferencia (los datos de la cuenta están en tu reserva)')
  if (p.methods.mercadoPago) ways.push('en línea con MercadoPago desde tu reserva')
  const how = ways.length ? ` Puedes pagar ${ways.length === 1 ? ways[0] : `${ways.slice(0, -1).join(', ')} o ${ways[ways.length - 1]}`}.` : ''
  return {
    client: {
      title: 'Servicio terminado: paga y califica',
      message: `${partner} terminó tu servicio de ${p.service} (reserva #${p.ref}). Total: ${cop(p.price)}.${how} Cuando pagues, toca «Reportar pago» en tus reservas y califica a ${partner}: ayuda a otros clientes a elegir.`,
    },
    partner: {
      title: 'Servicio completado: confirma el pago y califica',
      message: `Completaste ${p.service} con ${client} (reserva #${p.ref}) por ${cop(p.price)}. Cuando ${client} reporte el pago, confírmalo en tus reservas («Confirmar pago»), y califica al cliente.${p.methods.transfer && !p.bank ? ' Registra tu cuenta bancaria para recibir transferencias.' : ''}`,
    },
  }
}
