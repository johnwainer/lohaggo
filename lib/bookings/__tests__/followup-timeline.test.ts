import { describe, expect, it } from 'vitest'
import {
  FOLLOWUP_TIMING, appointmentStep, arrivalAskClientText, arrivalStep, clientReminderText, completionNotices, doneAskAt, inProgressStep,
  lateOptionsClientText, lateOptionsOpen, lateStartMinutes, lowRatingCase, markDetail, onWayClientText, onWayRepeat, parseMarkDetail,
  partnerDayReminderText, partnerLateState, ratingReminderStep, readyHint, reminderPlan, todayStatus,
  type FollowupMark, type Marks,
} from '@/lib/bookings/followups-core'
import { REMINDER_WINDOWS, inReminderWindow } from '@/lib/notifications/reminder-window'

/**
 * Walks one booking from acceptance to payment with a fake clock: every 15 min the follow-up cron
 * (request-lifecycle) and every 30 min the reminders cron (notification-reminders), with the same pure
 * decisions they use, and the answers of the client and the partner at given times. The result is what each
 * person is told, in order (Bogotá clock).
 */

// Booked on Wed 11 Nov at 08:00 for Thu 12 Nov at 10:00 (Bogotá = UTC-5): stored as the day at 00:00 UTC + time
const BOOKING = { scheduledDate: new Date('2026-11-12T00:00:00.000Z'), scheduledTime: '10:00' }
const WHEN = Date.parse('2026-11-12T10:00:00-05:00')
const ACCEPTED = Date.parse('2026-11-11T08:00:00-05:00')
const at = (s: string) => Date.parse(`2026-11-${s.slice(0, 2)}T${s.slice(3)}:00-05:00`)
const clock = (ms: number) => {
  const d = new Date(ms - 5 * 3600_000)
  return `${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

type Answer =
  | 'reconfirm_yes' | 'partner_started' | 'partner_done' | 'client_done' | 'client_not_done' | 'no_show' | 'client_absent'
  | 'partner_on_way' | 'client_rebook'
type Status = 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'


function simulate(answers: Array<[string, Answer, number?]>, opts: { durationMinutes?: number; until?: string } = {}) {
  let status: Status = 'CONFIRMED'
  let startedAt = 0
  const marks: Marks = new Map()
  const log: string[] = []
  const reminded = new Set<string>()
  const say = (t: number, to: 'cliente' | 'socio', what: string) => log.push(`${clock(t)} ${to}: ${what}`)
  const mark = (k: FollowupMark, t: number) => marks.set(k, new Date(t))
  const complete = (t: number) => {
    status = 'COMPLETED'
    const n = completionNotices({ ref: 'ABC123', service: 'Plomería', price: 120000, clientName: 'Ana', partnerName: 'Carlos', methods: { cash: true, transfer: true, mercadoPago: false }, bank: null })
    say(t, 'cliente', n.client.title)
    say(t, 'socio', n.partner.title)
  }
  const pending = answers.map(([s, a, eta]) => ({ t: at(s), a, eta: eta ?? null }))
  const end = opts.until ? at(opts.until) : WHEN + 3 * 24 * 3600_000

  for (let now = ACCEPTED; now <= end; now += 15 * 60_000) {
    // What the people answered since the last run (the app and the WhatsApp buttons act at once)
    for (const p of pending.filter((x) => x.t <= now)) {
      pending.splice(pending.indexOf(p), 1)
      if (p.a === 'reconfirm_yes') { mark('clientReconfirmed', p.t); say(p.t, 'socio', 'el cliente confirmó la cita') }
      if (p.a === 'partner_started' && status === 'CONFIRMED') {
        status = 'IN_PROGRESS'
        startedAt = p.t
        say(p.t, 'cliente', 'el socio inició el servicio')
        // More than 30 min late: registered once (admin mark, no strike) and the client is told
        const late = lateStartMinutes(WHEN, p.t)
        if (late && !marks.has('lateStart')) { mark('lateStart', p.t); say(p.t, 'cliente', `retraso registrado: ${late} min`) }
      }
      if (p.a === 'partner_on_way' && status === 'CONFIRMED' && !onWayRepeat(marks, p.eta, p.t)) {
        mark('partnerOnWay', p.t)
        if (p.eta) (marks.minutes ??= new Map()).set('partnerOnWay', p.eta)
        else marks.minutes?.delete('partnerOnWay')
        say(p.t, 'cliente', onWayClientText({ partnerName: 'Carlos Ruiz', service: 'Plomería', etaMinutes: p.eta, now: p.t }))
      }
      if (p.a === 'client_rebook' && status === 'CONFIRMED' && (marks.has('noShowReported') || lateOptionsOpen(marks, p.t))) {
        status = 'CANCELLED'
        say(p.t, 'socio', 'cancelada: el cliente reportó que no llegaste')
        say(p.t, 'cliente', 'abrimos tu solicitud de nuevo')
      }
      if (p.a === 'partner_done' && status === 'IN_PROGRESS') complete(p.t)
      if (p.a === 'client_done' && status === 'IN_PROGRESS') complete(p.t)
      if (p.a === 'client_not_done' && status === 'IN_PROGRESS') mark('clientNotDone', p.t)
      if (p.a === 'no_show' && status === 'CONFIRMED') { mark('noShowReported', p.t); say(p.t, 'socio', 'el cliente dice que no has llegado') }
      if (p.a === 'client_absent' && status === 'CONFIRMED') { mark('clientAbsentReported', p.t); say(p.t, 'cliente', 'el socio llegó y no te encontró') }
    }

    // request-lifecycle, every 15 min
    if (status === 'CONFIRMED') {
      const { actions } = appointmentStep({ when: WHEN, now, marks })
      for (const a of actions) {
        if (a === 'reconfirm_ask') { mark('reconfirmAsked', now); say(now, 'cliente', 'confirma tu cita') }
        if (a === 'reconfirm_urge') { mark('reconfirmUrged', now); say(now, 'cliente', 'tu cita aún no está confirmada') }
        if (a === 'hold') { mark('appointmentOnHold', now); say(now, 'socio', 'no salgas todavía'); say(now, 'cliente', 'tu cita quedó en espera') }
        if (a === 'cancel_unconfirmed') { status = 'CANCELLED'; say(now, 'socio', 'reserva liberada sin falta'); say(now, 'cliente', 'cancelamos tu cita (no confirmaste)') }
      }
    }
    if (status === 'CONFIRMED') {
      for (const a of arrivalStep({ when: WHEN, now, marks, paid: false })) {
        if (a === 'ask_partner_start') { mark('askedPartnerArrival', now); say(now, 'socio', 'es la hora: marca que empezaste') }
        if (a === 'ask_client_arrival') {
          say(now, 'cliente', `${partnerLateState(marks, now) === 'on_way' ? 'va en camino' : 'estamos confirmando'} · ¿ya llegó el socio?`)
          const text = arrivalAskClientText({ partnerName: 'Carlos', service: 'Plomería', when: WHEN, marks, now })
          expect(text).toContain(partnerLateState(marks, now) === 'on_way' ? 'llegada estimada' : 'Estamos confirmando con Carlos')
          mark('askedClientArrival', now)
        }
        if (a === 'client_late_options') {
          mark('clientToldOptions', now)
          const text = lateOptionsClientText({ partnerName: 'Carlos', service: 'Plomería', when: WHEN, marks, now })
          expect(text).toContain('esperarlo un poco más, pedir otro socio ahora')
          expect(text).toContain('cancelar sin costo')
          say(now, 'cliente', 'tus opciones: esperar, otro socio o cancelar sin costo')
        }
        if (a === 'urge_partner_start') { mark('urgedPartnerStart', now); say(now, 'socio', 'el servicio aún no está iniciado') }
        if (a === 'cancel_no_show') { status = 'CANCELLED'; say(now, 'socio', 'cancelada: el cliente reportó que no llegaste'); say(now, 'cliente', 'cancelada sin costo, ¿buscamos otro socio?') }
        if (a === 'cancel_client_absent') { status = 'CANCELLED'; say(now, 'socio', 'cancelada: el cliente no estaba (sin falta)'); say(now, 'cliente', 'cancelamos tu reserva (no estabas)') }
      }
    }
    if (status === 'IN_PROGRESS') {
      for (const a of inProgressStep({ startedAt, now, marks, durationMinutes: opts.durationMinutes ?? 120 })) {
        if (a === 'ask_partner_done') { mark('askedPartnerDone', now); say(now, 'socio', '¿ya terminaste?') }
        if (a === 'ask_client_done') { mark('askedClientDone', now); say(now, 'cliente', '¿ya terminó tu servicio?') }
        if (a === 'auto_complete') complete(now)
      }
    }

    // notification-reminders, every 30 min
    if (status === 'CONFIRMED' && new Date(now).getUTCMinutes() % 30 === 0) {
      for (const kind of ['day', 'soon'] as const) {
        if (!inReminderWindow(BOOKING, new Date(now), REMINDER_WINDOWS[kind])) continue
        const plan = reminderPlan(kind, { now, when: WHEN, followupLive: true, marks })
        const label = kind === 'day' ? 'recordatorio: mañana' : 'recordatorio: empieza pronto'
        if (plan.client && !reminded.has(`c${kind}`)) { reminded.add(`c${kind}`); say(now, 'cliente', label) }
        if (plan.partner && !reminded.has(`p${kind}`)) { reminded.add(`p${kind}`); say(now, 'socio', label) }
      }
    }
  }
  return { log, status }
}

describe('Seguimiento automático de una reserva · línea de tiempo', () => {
  it('todo bien: recordatorios, «¿empezaste?» a la hora, «¿terminaste?» a las 2 h, pago y calificación', () => {
    const { log, status } = simulate([['11 18:05', 'reconfirm_yes'], ['12 10:02', 'partner_started'], ['12 12:20', 'partner_done']])
    expect(status).toBe('COMPLETED')
    expect(log).toEqual([
      '11 09:00 socio: recordatorio: mañana',
      '11 18:00 cliente: confirma tu cita',
      '11 18:05 socio: el cliente confirmó la cita',
      '12 08:30 cliente: recordatorio: empieza pronto',
      '12 08:30 socio: recordatorio: empieza pronto',
      '12 10:00 socio: es la hora: marca que empezaste',
      '12 10:02 cliente: el socio inició el servicio',
      '12 12:15 socio: ¿ya terminaste?',
      '12 12:20 cliente: Servicio terminado: paga y califica',
      '12 12:20 socio: Servicio completado: confirma el pago y califica',
    ])
  })

  it('el socio nunca llega: segundo aviso al socio y, tras el «no llegó» del cliente, se cancela sin costo', () => {
    const { log, status } = simulate([['11 18:05', 'reconfirm_yes'], ['12 10:50', 'no_show']])
    expect(status).toBe('CANCELLED')
    expect(log.slice(5)).toEqual([
      '12 10:00 socio: es la hora: marca que empezaste',
      '12 10:15 cliente: estamos confirmando · ¿ya llegó el socio?',
      '12 10:45 socio: el servicio aún no está iniciado',
      '12 10:45 cliente: tus opciones: esperar, otro socio o cancelar sin costo',
      '12 10:50 socio: el cliente dice que no has llegado',
      '12 11:30 socio: cancelada: el cliente reportó que no llegaste',
      '12 11:30 cliente: cancelada sin costo, ¿buscamos otro socio?',
    ])
  })

  it('el cliente no está: el socio lo reporta y 30 min sin respuesta se cancela sin falta para el socio', () => {
    const { log, status } = simulate([['11 18:05', 'reconfirm_yes'], ['12 10:10', 'client_absent']])
    expect(status).toBe('CANCELLED')
    expect(log.slice(5)).toEqual([
      '12 10:00 socio: es la hora: marca que empezaste',
      '12 10:10 cliente: el socio llegó y no te encontró',
      '12 10:45 socio: cancelada: el cliente no estaba (sin falta)',
      '12 10:45 cliente: cancelamos tu reserva (no estabas)',
    ])
  })

  it('el cliente nunca confirma la cita: urge, espera (sin «empieza pronto») y se cancela como falta del cliente', () => {
    const { log, status } = simulate([])
    expect(status).toBe('CANCELLED')
    expect(log).toEqual([
      '11 09:00 socio: recordatorio: mañana',
      '11 18:00 cliente: confirma tu cita',
      '12 07:00 cliente: tu cita aún no está confirmada',
      '12 08:30 socio: no salgas todavía',
      '12 08:30 cliente: tu cita quedó en espera',
      '12 11:00 socio: reserva liberada sin falta',
      '12 11:00 cliente: cancelamos tu cita (no confirmaste)',
    ])
  })

  it('el socio empieza tarde: el «¿terminaste?» cuenta desde el inicio real y la duración del servicio', () => {
    const { log, status } = simulate([['11 18:05', 'reconfirm_yes'], ['12 10:50', 'partner_started'], ['12 14:10', 'client_done']], { durationMinutes: 150 })
    expect(status).toBe('COMPLETED')
    expect(log.slice(5)).toEqual([
      '12 10:00 socio: es la hora: marca que empezaste',
      '12 10:15 cliente: estamos confirmando · ¿ya llegó el socio?',
      '12 10:45 socio: el servicio aún no está iniciado',
      '12 10:45 cliente: tus opciones: esperar, otro socio o cancelar sin costo',
      '12 10:50 cliente: el socio inició el servicio',
      '12 10:50 cliente: retraso registrado: 50 min',
      '12 13:30 socio: ¿ya terminaste?',
      '12 14:00 cliente: ¿ya terminó tu servicio?',
      '12 14:10 cliente: Servicio terminado: paga y califica',
      '12 14:10 socio: Servicio completado: confirma el pago y califica',
    ])
  })

  it('el cliente dice que aún no termina: no se cierra solo; se cierra cuando el socio lo marca', () => {
    const { log, status } = simulate([['11 18:05', 'reconfirm_yes'], ['12 10:02', 'partner_started'], ['12 12:50', 'client_not_done'], ['12 15:10', 'partner_done']])
    expect(status).toBe('COMPLETED')
    expect(log.slice(7)).toEqual([
      '12 12:15 socio: ¿ya terminaste?',
      '12 12:45 cliente: ¿ya terminó tu servicio?',
      '12 15:10 cliente: Servicio terminado: paga y califica',
      '12 15:10 socio: Servicio completado: confirma el pago y califica',
    ])
    // Without the partner it stays open (no automatic close after «aún no»)
    const open = simulate([['11 18:05', 'reconfirm_yes'], ['12 10:02', 'partner_started'], ['12 12:50', 'client_not_done']])
    expect(open.status).toBe('IN_PROGRESS')
  })

  it('nadie responde: se da por terminado 24 h después del inicio (de día) y avisa pago y calificación una vez', () => {
    const { log, status } = simulate([['11 18:05', 'reconfirm_yes'], ['12 10:02', 'partner_started']])
    expect(status).toBe('COMPLETED')
    expect(log.slice(7)).toEqual([
      '12 12:15 socio: ¿ya terminaste?',
      '12 12:45 cliente: ¿ya terminó tu servicio?',
      '13 10:15 cliente: Servicio terminado: paga y califica',
      '13 10:15 socio: Servicio completado: confirma el pago y califica',
    ])
  })
})

describe('Seguimiento automático · socio retrasado', () => {
  it('el socio va en camino tarde: el cliente recibe cada actualización con la hora una sola vez y el retraso queda registrado', () => {
    const { log, status } = simulate([
      ['11 18:05', 'reconfirm_yes'],
      ['12 10:10', 'partner_on_way', 20],
      ['12 10:12', 'partner_on_way', 20], // the same update again: no new notice
      ['12 10:40', 'partner_on_way', 15],
      ['12 10:58', 'partner_started'],
    ], { until: '12 11:30' })
    expect(status).toBe('IN_PROGRESS')
    expect(log.slice(5)).toEqual([
      '12 10:00 socio: es la hora: marca que empezaste',
      '12 10:10 cliente: Carlos va en camino a tu servicio de Plomería: llega en ~20 min (hacia las 10:30 a. m.). Te avisamos cuando lo inicie; si necesitas algo, escríbenos.',
      '12 10:40 cliente: Carlos va en camino a tu servicio de Plomería: llega en ~15 min (hacia las 10:55 a. m.). Te avisamos cuando lo inicie; si necesitas algo, escríbenos.',
      '12 10:58 cliente: el socio inició el servicio',
      '12 10:58 cliente: retraso registrado: 58 min',
    ])
  })

  it('el socio dice «voy en camino» sin hora y no llega: sin segundo aviso mientras está en tiempo, luego las opciones al cliente', () => {
    const { log } = simulate([['11 18:05', 'reconfirm_yes'], ['12 10:20', 'partner_on_way']], { until: '12 12:00' })
    expect(log.slice(5)).toEqual([
      '12 10:00 socio: es la hora: marca que empezaste',
      '12 10:15 cliente: estamos confirmando · ¿ya llegó el socio?',
      '12 10:20 cliente: Carlos va en camino a tu servicio de Plomería. Te avisamos cuando lo inicie; si necesitas algo, escríbenos.',
      // Counted as 30 min (10:50) + 15 of margin: from 11:05 it is overdue
      '12 11:15 socio: el servicio aún no está iniciado',
      '12 11:15 cliente: tus opciones: esperar, otro socio o cancelar sin costo',
    ])
  })

  it('el socio no responde hasta +45: el cliente recibe sus opciones y pide otro socio sin esperar más', () => {
    const { log, status } = simulate([['11 18:05', 'reconfirm_yes'], ['12 10:50', 'client_rebook']])
    expect(status).toBe('CANCELLED')
    expect(log.slice(5)).toEqual([
      '12 10:00 socio: es la hora: marca que empezaste',
      '12 10:15 cliente: estamos confirmando · ¿ya llegó el socio?',
      '12 10:45 socio: el servicio aún no está iniciado',
      '12 10:45 cliente: tus opciones: esperar, otro socio o cancelar sin costo',
      '12 10:50 socio: cancelada: el cliente reportó que no llegaste',
      '12 10:50 cliente: abrimos tu solicitud de nuevo',
    ])
  })

  it('antes del aviso de +45 el cliente no puede pedir otro socio sin reportar que no llegó', () => {
    const { status } = simulate([['11 18:05', 'reconfirm_yes'], ['12 10:30', 'client_rebook']], { until: '12 10:40' })
    expect(status).toBe('CONFIRMED')
  })

  it('un «voy en camino» después de las opciones las cierra mientras esté en tiempo', () => {
    const m: Marks = new Map<FollowupMark, Date>([['clientToldOptions', new Date(at('12 10:45'))], ['partnerOnWay', new Date(at('12 10:50'))]])
    m.minutes = new Map([['partnerOnWay', 10]])
    expect(lateOptionsOpen(m, at('12 10:55'))).toBe(false)
    expect(lateOptionsOpen(m, at('12 11:20'))).toBe(true) // 11:00 + 15 min of margin passed
  })
})

describe('Seguimiento automático · después del servicio', () => {
  it('calificación: recordatorios a 72 h y a 5 días; una de 2★ abre un caso para el equipo una vez', () => {
    const doneAt = at('12 12:20')
    const marks: Marks = new Map()
    const log: string[] = []
    let rated: number | null = null
    const tasks: string[] = []
    for (let now = doneAt; now <= doneAt + 8 * 24 * 3600_000; now += 15 * 60_000) {
      if (rated === null) {
        const step = ratingReminderStep({ doneAt, now, marks })
        if (step === 'second') { marks.set('askedRatingAgain', new Date(now)); log.push(`${clock(now)} cliente: segundo recordatorio para calificar`) }
        if (step === 'final') {
          marks.set('askedRatingFinal', new Date(now))
          log.push(`${clock(now)} cliente: último recordatorio para calificar`)
          // The client answers the last reminder with 2 stars
          rated = 2
          const c = lowRatingCase({ rating: rated, comment: 'Dejó la llave goteando', ref: 'ABC123', service: 'Plomería', partnerName: 'Carlos Ruiz', clientName: 'Ana Pérez' })
          if (c && !marks.has('lowRatingFollowup')) { marks.set('lowRatingFollowup', new Date(now)); tasks.push(c.subject); log.push(`${clock(now)} equipo: ${c.subject}`) }
        }
      }
    }
    expect(log).toEqual([
      '15 12:20 cliente: segundo recordatorio para calificar',
      '17 12:20 cliente: último recordatorio para calificar',
      '17 12:20 equipo: Calificación baja (2★) · reserva #ABC123',
    ])
    expect(tasks).toHaveLength(1)
  })

  it('la calificación baja: 1★ prioridad alta, 2★ media, 3★ o más nada', () => {
    const base = { comment: null, ref: 'ABC123', service: 'Plomería', partnerName: 'Carlos', clientName: 'Ana' }
    expect(lowRatingCase({ ...base, rating: 1 })?.priority).toBe('HIGH')
    expect(lowRatingCase({ ...base, rating: 2 })?.priority).toBe('MEDIUM')
    expect(lowRatingCase({ ...base, rating: 3 })).toBeNull()
    expect(lowRatingCase({ ...base, rating: 1 })?.clientMessage).toContain('garantía')
    expect(lowRatingCase({ ...base, rating: 1 })?.description).toContain('Sin comentario')
  })

  it('los recordatorios de calificación nunca salen de noche ni después de 7 días', () => {
    const doneAt = at('12 12:20')
    expect(ratingReminderStep({ doneAt, now: Date.parse('2026-11-15T23:00:00-05:00'), marks: new Map() })).toBeNull()
    expect(ratingReminderStep({ doneAt, now: doneAt + 8 * 24 * 3600_000, marks: new Map() })).toBeNull()
  })
})

describe('Seguimiento automático · reglas puras', () => {
  it('las marcas guardan los minutos (llegada estimada, retraso) sin romper las marcas viejas', () => {
    expect(markDetail('partnerOnWay', 20)).toBe('El socio dijo que va en camino · 20 min')
    expect(parseMarkDetail('El socio dijo que va en camino · 20 min')).toEqual({ kind: 'partnerOnWay', minutes: 20 })
    expect(parseMarkDetail('El socio dijo que va en camino')).toEqual({ kind: 'partnerOnWay', minutes: null })
    expect(parseMarkDetail(markDetail('lateStart', 76))).toEqual({ kind: 'lateStart', minutes: 76 })
    expect(parseMarkDetail('Falta del socio: no confirmó la reserva antes de la hora del servicio')).toBeNull()
  })

  it('recordatorios del día: nombre y calificación del socio, qué tener listo; al socio nombre, dirección exacta y precio', () => {
    expect(clientReminderText({ kind: 'soon', service: 'Plomería', time: '10:00 a. m.', partnerName: 'Carlos Ruiz', rating: 4.83, reviews: 12, proposalNotes: 'Incluye materiales' }))
      .toBe('Tu servicio de Plomería con Carlos (★ 4.8) empieza a las 10:00 a. m. Ten listo el acceso (portería o parqueadero avisados); el socio lleva los materiales acordados.')
    expect(clientReminderText({ kind: 'day', service: 'Pintura', time: '9:00 a. m.', partnerName: 'Laura', rating: 0, reviews: 0, proposalNotes: null })).toBe('Mañana a las 9:00 a. m. tienes Pintura con Laura. Ten listo el acceso (portería o parqueadero avisados).')
    expect(readyHint('Precio sin materiales, el cliente compra la pintura')).toContain('los materiales acordados')
    expect(readyHint('Precio sin materiales, el cliente compra la pintura')).not.toContain('el socio lleva')
    const partner = partnerDayReminderText({ service: 'Plomería', time: '10:00 a. m.', clientName: 'Ana Pérez', address: 'Cra 70 #44-10, apto 301', city: 'Medellín', price: 120000 })
    expect(partner).toContain('con Ana en Cra 70 #44-10, apto 301, Medellín')
    expect(partner).toContain('$120.000')
    expect(partner).not.toContain('Pérez')
  })

  it('servicios de hoy: etapa en vivo y alertas', () => {
    const when = WHEN
    const m = (entries: Array<[FollowupMark, string]>, minutes?: Array<[FollowupMark, number]>) => {
      const x: Marks = new Map(entries.map(([k, s]) => [k, new Date(at(s))]))
      if (minutes) x.minutes = new Map(minutes)
      return x
    }
    expect(todayStatus({ status: 'CONFIRMED', when, now: at('12 09:00'), marks: m([['reconfirmAsked', '11 18:00'], ['clientReconfirmed', '11 18:05']]), paid: false })).toEqual({ stage: 'reconfirmed', flags: [], eta: null })
    expect(todayStatus({ status: 'CONFIRMED', when, now: at('12 08:45'), marks: m([['reconfirmAsked', '11 18:00'], ['appointmentOnHold', '12 08:30']]), paid: false }).flags).toEqual(['on_hold'])
    const onWay = todayStatus({ status: 'CONFIRMED', when, now: at('12 10:20'), marks: m([['clientReconfirmed', '11 18:05'], ['partnerOnWay', '12 10:10']], [['partnerOnWay', 20]]), paid: false })
    expect(onWay.stage).toBe('on_way')
    expect(onWay.flags).toEqual([])
    expect(onWay.eta).toBe(at('12 10:30'))
    expect(todayStatus({ status: 'CONFIRMED', when, now: at('12 10:50'), marks: m([['clientReconfirmed', '11 18:05']]), paid: false }).flags).toEqual(['late', 'partner_silent'])
    expect(todayStatus({ status: 'CONFIRMED', when, now: at('12 10:50'), marks: m([['noShowReported', '12 10:40']]), paid: false }).flags).toContain('no_show_claim')
    expect(todayStatus({ status: 'IN_PROGRESS', when, now: at('12 11:30'), marks: m([['lateStart', '12 11:16']], [['lateStart', 76]]), paid: false })).toEqual({ stage: 'started', flags: ['late_start'], eta: null })
    expect(todayStatus({ status: 'COMPLETED', when, now: at('12 13:00'), marks: new Map(), paid: false })).toEqual({ stage: 'finished', flags: ['unpaid'], eta: null })
    expect(todayStatus({ status: 'COMPLETED', when, now: at('12 13:00'), marks: new Map(), paid: true }).stage).toBe('paid')
  })

  it('el «¿terminaste?» es inicio + duración, entre 2 y 3 horas', () => {
    const start = Date.parse('2026-11-12T15:00:00Z')
    expect(doneAskAt(start, 60) - start).toBe(2 * 3600_000)
    expect(doneAskAt(start, 150) - start).toBe(150 * 60_000)
    expect(doneAskAt(start, 480) - start).toBe(3 * 3600_000)
    expect(doneAskAt(start, null) - start).toBe(FOLLOWUP_TIMING.defaultServiceMinutes * 60_000)
  })
  it('de noche el cliente recibe los recordatorios solo en la app y nunca se cierra solo', () => {
    const night = Date.parse('2026-11-12T05:30:00-05:00')
    expect(reminderPlan('soon', { now: night, when: night + 3600_000, followupLive: true, marks: new Map() })).toEqual({ client: 'app', partner: true })
    const start = Date.parse('2026-11-11T02:00:00-05:00')
    const asked = new Map<FollowupMark, Date>([['askedPartnerDone', new Date(start + 2 * 3600_000)], ['askedClientDone', new Date(start + 2.5 * 3600_000)]])
    expect(inProgressStep({ startedAt: start, now: start + 25 * 3600_000, marks: asked })).toEqual([]) // 3:00 a. m.
    expect(inProgressStep({ startedAt: start, now: Date.parse('2026-11-12T06:00:00-05:00'), marks: asked })).toEqual(['auto_complete'])
  })
  it('el aviso de pago muestra el monto, los medios habilitados y la cuenta enmascarada', () => {
    const n = completionNotices({
      ref: 'ABC123', service: 'Plomería', price: 120000, clientName: 'Ana Pérez', partnerName: 'Carlos Ruiz',
      methods: { cash: true, transfer: true, mercadoPago: true }, bank: { bankName: 'Bancolombia', accountType: 'AHORROS', masked: '•••• 4321' },
    })
    expect(n.client.message).toContain('$120.000')
    expect(n.client.message).toContain('en efectivo a Carlos')
    expect(n.client.message).toContain('Bancolombia (ahorros •••• 4321')
    expect(n.client.message).toContain('MercadoPago')
    expect(n.client.message).toContain('«Reportar pago»')
    expect(n.client.message).toContain('califica a Carlos')
    expect(n.partner.message).toContain('confírmalo')
    const noMp = completionNotices({ ref: 'ABC123', service: 'Plomería', price: 1000, clientName: null, partnerName: null, methods: { cash: true, transfer: true, mercadoPago: false }, bank: null })
    expect(noMp.client.message).not.toContain('MercadoPago')
    expect(noMp.partner.message).toContain('Registra tu cuenta bancaria')
  })
})
