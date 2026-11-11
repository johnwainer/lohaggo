import { describe, expect, it } from 'vitest'
import {
  FOLLOWUP_TIMING, appointmentStep, arrivalStep, completionNotices, doneAskAt, inProgressStep, reminderPlan,
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
type Status = 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

function simulate(answers: Array<[string, Answer]>, opts: { durationMinutes?: number; until?: string } = {}) {
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
  const pending = answers.map(([s, a]) => ({ t: at(s), a }))
  const end = opts.until ? at(opts.until) : WHEN + 3 * 24 * 3600_000

  for (let now = ACCEPTED; now <= end; now += 15 * 60_000) {
    // What the people answered since the last run (the app and the WhatsApp buttons act at once)
    for (const p of pending.filter((x) => x.t <= now)) {
      pending.splice(pending.indexOf(p), 1)
      if (p.a === 'reconfirm_yes') { mark('clientReconfirmed', p.t); say(p.t, 'socio', 'el cliente confirmó la cita') }
      if (p.a === 'partner_started' && status === 'CONFIRMED') { status = 'IN_PROGRESS'; startedAt = p.t; say(p.t, 'cliente', 'el socio inició el servicio') }
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
        if (a === 'ask_client_arrival') { mark('askedClientArrival', now); say(now, 'cliente', '¿ya llegó el socio?') }
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
      '12 10:15 cliente: ¿ya llegó el socio?',
      '12 10:45 socio: el servicio aún no está iniciado',
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
      '12 10:15 cliente: ¿ya llegó el socio?',
      '12 10:45 socio: el servicio aún no está iniciado',
      '12 10:50 cliente: el socio inició el servicio',
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

describe('Seguimiento automático · reglas puras', () => {
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
