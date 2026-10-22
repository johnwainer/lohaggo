import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { bogotaHour, isBusinessHour, isWindowOpen, waitingState } from '@/lib/inbox/waiting'
import { csatReplyScore, csatSkipReason, isCsatMessage, parseCsatScore, CSAT_QUESTION, type CsatAskInput } from '@/lib/inbox/csat-core'
import { fillReplyVariables, greetingName, usesVariable } from '@/lib/inbox/saved-replies'
import { aiResolution, firstResponseStats, formatSeconds, median, parsePeriod, percent, topHandoffReasons } from '@/lib/inbox/metrics-core'
import { canCancelAndReopen, isRelevantBooking, paymentState } from '@/lib/inbox/bookings-core'
import { linkRefusal } from '@/lib/inbox/link'
import { needsTranscriptionLabel, TRANSCRIBED_PREFIX } from '@/lib/inbox/audio'
import { readInboxState } from '@/lib/inbox/state'

// 2026-10-22 10:00 in Bogotá = 15:00 UTC
const MORNING = Date.parse('2026-10-22T15:00:00.000Z')
// 2026-10-22 23:00 in Bogotá = 04:00 UTC next day
const NIGHT = Date.parse('2026-10-23T04:00:00.000Z')
const minutesAgo = (now: number, m: number) => new Date(now - m * 60_000).toISOString()

describe('waiting time', () => {
  it('reads the hour in Bogotá', () => {
    expect(bogotaHour(MORNING)).toBe(10)
    expect(bogotaHour(NIGHT)).toBe(23)
    expect(isBusinessHour(MORNING)).toBe(true)
    expect(isBusinessHour(NIGHT)).toBe(false)
    expect(isBusinessHour(Date.parse('2026-10-22T12:00:00.000Z'))).toBe(true) // 7:00
    expect(isBusinessHour(Date.parse('2026-10-23T02:00:00.000Z'))).toBe(false) // 21:00
  })

  it('labels and flags late answers only during business hours', () => {
    expect(waitingState(minutesAgo(MORNING, 5), MORNING)).toEqual({ label: 'espera hace 5 min', minutes: 5, overdue: false })
    expect(waitingState(minutesAgo(MORNING, 16), MORNING)?.overdue).toBe(true)
    expect(waitingState(minutesAgo(MORNING, 15), MORNING)?.overdue).toBe(false)
    expect(waitingState(minutesAgo(MORNING, 130), MORNING)?.label).toBe('espera hace 2 h')
    expect(waitingState(minutesAgo(NIGHT, 90), NIGHT)?.overdue).toBe(false)
    expect(waitingState(null, MORNING)).toBeNull()
    expect(waitingState('garbage', MORNING)).toBeNull()
  })

  it('knows when the 24 h window is open', () => {
    expect(isWindowOpen(minutesAgo(MORNING, 60), MORNING)).toBe(true)
    expect(isWindowOpen(minutesAgo(MORNING, 24 * 60 + 1), MORNING)).toBe(false)
    expect(isWindowOpen(null, MORNING)).toBe(false)
  })
})

describe('CSAT survey', () => {
  it('parses only a lone digit 1–5', () => {
    expect(parseCsatScore('5')).toBe(5)
    expect(parseCsatScore(' 4. ')).toBe(4)
    expect(parseCsatScore('3!')).toBe(3)
    expect(parseCsatScore('1️⃣')).toBe(1)
    expect(parseCsatScore('0')).toBeNull()
    expect(parseCsatScore('6')).toBeNull()
    expect(parseCsatScore('45')).toBeNull()
    expect(parseCsatScore('5 estrellas')).toBeNull()
    expect(parseCsatScore('')).toBeNull()
  })

  it('takes the answer only within 24 h of the question and once', () => {
    const asked = minutesAgo(MORNING, 30)
    expect(csatReplyScore({ csatAskedAt: asked, csat: null }, '5', MORNING)).toBe(5)
    expect(csatReplyScore({ csatAskedAt: null, csat: null }, '5', MORNING)).toBeNull()
    expect(csatReplyScore({ csatAskedAt: minutesAgo(MORNING, 25 * 60), csat: null }, '5', MORNING)).toBeNull()
    expect(csatReplyScore({ csatAskedAt: asked, csat: { score: 4, at: minutesAgo(MORNING, 10) } }, '5', MORNING)).toBeNull()
    // An answer to an older survey does not block the new one
    expect(csatReplyScore({ csatAskedAt: asked, csat: { score: 2, at: minutesAgo(MORNING, 8 * 24 * 60) } }, '5', MORNING)).toBe(5)
    expect(csatReplyScore({ csatAskedAt: asked, csat: null }, 'gracias', MORNING)).toBeNull()
  })

  it('asks only for handled closes with the window open, at most once a week', () => {
    const base: CsatAskInput = {
      channel: 'WHATSAPP', status: 'RESOLVED', reason: 'gestionada', automatedOnly: false, aiSpam: false, isTest: false, optedOut: false,
      csatAskedAt: null, lastInboundAt: minutesAgo(MORNING, 60),
    }
    expect(csatSkipReason(base, MORNING)).toBeNull()
    expect(csatSkipReason({ ...base, channel: 'INSTAGRAM' }, MORNING)).toBeNull()
    expect(csatSkipReason({ ...base, reason: 'spam' }, MORNING)).toBe('reason')
    expect(csatSkipReason({ ...base, reason: 'otra_marca' }, MORNING)).toBe('reason')
    expect(csatSkipReason({ ...base, channel: 'SMS' }, MORNING)).toBe('channel')
    expect(csatSkipReason({ ...base, status: 'OPEN' }, MORNING)).toBe('open')
    expect(csatSkipReason({ ...base, automatedOnly: true }, MORNING)).toBe('automated_only')
    expect(csatSkipReason({ ...base, aiSpam: true }, MORNING)).toBe('spam')
    expect(csatSkipReason({ ...base, optedOut: true }, MORNING)).toBe('opted_out')
    expect(csatSkipReason({ ...base, csatAskedAt: minutesAgo(MORNING, 3 * 24 * 60) }, MORNING)).toBe('recent')
    expect(csatSkipReason({ ...base, csatAskedAt: minutesAgo(MORNING, 8 * 24 * 60) }, MORNING)).toBeNull()
    expect(csatSkipReason({ ...base, lastInboundAt: minutesAgo(MORNING, 25 * 60) }, MORNING)).toBe('window_closed')
  })

  it('recognises its own messages and reads the stored answer', () => {
    expect(isCsatMessage(` ${CSAT_QUESTION} `)).toBe(true)
    expect(isCsatMessage('Hola')).toBe(false)
    expect(readInboxState({ inbox: { csatAskedAt: 'x', csat: { score: 5, at: 'y' } } })).toMatchObject({ csatAskedAt: 'x', csat: { score: 5, at: 'y' } })
    expect(readInboxState({ inbox: { csat: { score: 9, at: 'y' } } }).csat).toBeNull()
  })
})

describe('saved replies', () => {
  it('fills {nombre} and {ref}', () => {
    expect(fillReplyVariables('Hola {nombre}, tu reserva {ref} está lista', { nombre: 'maría pérez', ref: 'ab12cd' })).toBe('Hola María, tu reserva #ab12cd está lista')
    expect(fillReplyVariables('Hola { Nombre }', { nombre: 'Ana' })).toBe('Hola Ana')
  })

  it('keeps the placeholder when the value is unknown or a channel placeholder', () => {
    expect(fillReplyVariables('Hola {nombre}, {ref}', { nombre: '+57 300 123 4567', ref: null })).toBe('Hola {nombre}, {ref}')
    expect(greetingName('Instagram · …1234')).toBeNull()
    expect(greetingName('@usuario')).toBeNull()
    expect(usesVariable('Tu reserva {ref}', 'ref')).toBe(true)
    expect(usesVariable('Hola', 'ref')).toBe(false)
  })
})

describe('inbox metrics', () => {
  it('computes the median', () => {
    expect(median([])).toBeNull()
    expect(median([5, 1, 3])).toBe(3)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })

  it('measures the first response and the AI resolution', () => {
    const rows = [
      { status: 'RESOLVED', firstIn: '2026-10-22T10:00:00Z', firstOut: '2026-10-22T10:02:00Z', human: false, ai: true },
      { status: 'CLOSED', firstIn: '2026-10-22T10:00:00Z', firstOut: '2026-10-22T10:10:00Z', human: true, ai: true },
      { status: 'OPEN', firstIn: '2026-10-22T10:00:00Z', firstOut: null, human: false, ai: false },
      { status: 'RESOLVED', firstIn: null, firstOut: null, human: false, ai: false },
    ]
    expect(firstResponseStats(rows)).toEqual({ medianSeconds: 360, answered: 2, unanswered: 1 })
    expect(aiResolution(rows)).toEqual({ closed: 2, byAi: 1, rate: 0.5 })
    expect(aiResolution([])).toEqual({ closed: 0, byAi: 0, rate: null })
  })

  it('groups handoff reasons', () => {
    expect(topHandoffReasons(['Pidió una persona: quiere hablar', 'Pidió una persona', 'Fuera de horario', null], 2)).toEqual([
      { reason: 'Pidió una persona', count: 2 },
      { reason: 'Fuera de horario', count: 1 },
    ])
  })

  it('formats numbers', () => {
    expect(formatSeconds(45)).toBe('45 s')
    expect(formatSeconds(240)).toBe('4 min')
    expect(formatSeconds(4800)).toBe('1 h 20 min')
    expect(formatSeconds(null)).toBe('—')
    expect(percent(0.456)).toBe('46 %')
    expect(parsePeriod('30')).toBe(30)
    expect(parsePeriod('x')).toBe(7)
  })
})

describe('bookings next to the chat', () => {
  const now = new Date('2026-10-22T15:00:00.000Z')
  it('labels the payment', () => {
    expect(paymentState('COMPLETED', { status: 'APPROVED' }).label).toBe('Pagado')
    expect(paymentState('COMPLETED', { status: 'PENDING', confirmationStatus: 'CONFIRMED' }).settled).toBe(true)
    expect(paymentState('COMPLETED', { status: 'PENDING', confirmationStatus: 'CLIENT_REPORTED' }).label).toBe('Pago reportado')
    expect(paymentState('COMPLETED', null).label).toBe('Sin pagar')
    expect(paymentState('CONFIRMED', null).label).toBe('Se paga al terminar')
  })

  it('keeps active bookings and unpaid completed ones from the last 14 days', () => {
    expect(isRelevantBooking({ status: 'CONFIRMED', scheduledDate: '2026-01-01' }, now)).toBe(true)
    expect(isRelevantBooking({ status: 'COMPLETED', scheduledDate: '2026-10-15', payment: null }, now)).toBe(true)
    expect(isRelevantBooking({ status: 'COMPLETED', scheduledDate: '2026-10-15', payment: { status: 'APPROVED' } }, now)).toBe(false)
    expect(isRelevantBooking({ status: 'COMPLETED', scheduledDate: '2026-09-01', payment: null }, now)).toBe(false)
    expect(isRelevantBooking({ status: 'CANCELLED', scheduledDate: '2026-10-20' }, now)).toBe(false)
  })

  it('offers cancel and reopen only when a request exists and the state allows it', () => {
    expect(canCancelAndReopen('CONFIRMED', 'req1')).toBe(true)
    expect(canCancelAndReopen('CONFIRMED', null)).toBe(false)
    expect(canCancelAndReopen('COMPLETED', 'req1')).toBe(false)
  })
})

describe('manual linking', () => {
  it('refuses admins and shared phones', () => {
    expect(linkRefusal({ role: 'CLIENT' }, [{ phone: '+573001234567', accounts: 1 }])).toBeNull()
    expect(linkRefusal({ role: 'PARTNER' }, [])).toBeNull()
    expect(linkRefusal({ role: 'ADMIN' }, [])).toMatch(/cliente o de socio/)
    expect(linkRefusal(null, [])).toBe('Usuario no encontrado')
    expect(linkRefusal({ role: 'CLIENT' }, [{ phone: '+573001234567', accounts: 2 }])).toMatch(/2 cuentas activas/)
  })
})

describe('voice notes', () => {
  it('labels inbound audio without text', () => {
    const audio = { direction: 'INBOUND', mediaUrl: 'https://x', mediaType: 'audio/ogg', body: '🎤 Nota de voz' }
    expect(needsTranscriptionLabel(audio)).toBe(true)
    expect(needsTranscriptionLabel({ ...audio, body: `${TRANSCRIBED_PREFIX} hola` })).toBe(false)
    expect(needsTranscriptionLabel({ ...audio, direction: 'OUTBOUND' })).toBe(false)
    expect(needsTranscriptionLabel({ ...audio, mediaType: 'image/jpeg' })).toBe(false)
  })
})
