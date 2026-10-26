import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({ env: { NEXTAUTH_SECRET: 'x'.repeat(40) } }))

import { appointmentToken, readAppointmentToken } from '@/lib/bookings/appointment-token'
import { isPlainYes } from '@/lib/bookings/followup-buttons'
import { reconfirmAskAt, reconfirmHoldAt } from '@/lib/bookings/followups'

const SECRET = 'y'.repeat(40)

describe('Garantía de cita', () => {
  it('pide confirmar el día anterior a las 6 p. m. (hora de Bogotá)', () => {
    // Servicio el sábado 25 a las 10:00 a. m. Bogotá = 15:00 UTC → pregunta el viernes 24 a las 18:00 Bogotá = 23:00 UTC
    expect(reconfirmAskAt(new Date('2026-10-25T15:00:00Z')).toISOString()).toBe('2026-10-24T23:00:00.000Z')
    // Servicio a las 7:00 a. m. Bogotá: igual el día anterior a las 6 p. m.
    expect(reconfirmAskAt(new Date('2026-10-25T12:00:00Z')).toISOString()).toBe('2026-10-24T23:00:00.000Z')
  })
  it('la espera es 90 min antes y nunca antes de 30 min de haber preguntado', () => {
    const when = new Date('2026-10-25T15:00:00Z')
    expect(reconfirmHoldAt(when, new Date('2026-10-24T23:00:00Z')).toISOString()).toBe('2026-10-25T13:30:00.000Z')
    expect(reconfirmHoldAt(when, new Date('2026-10-25T13:20:00Z')).toISOString()).toBe('2026-10-25T13:50:00.000Z')
  })
  it('entiende un «sí» escrito y nada más', () => {
    for (const y of ['Si', 'sí!', 'SI CONFIRMO', 'Confirmo', 'aquí estaré', ' sí 👍 ']) expect(isPlainYes(y), y).toBe(true)
    for (const n of ['si pero a las 3', 'no', 'sí, cambien la hora', '5', '', 'ok', 'listo']) expect(isPlainYes(n), n).toBe(false)
  })
  it('el enlace de un toque es solo de esa reserva y vence', () => {
    const now = Date.parse('2026-10-24T23:00:00Z')
    const t = appointmentToken('bk1', 'u1', now, SECRET)
    expect(readAppointmentToken(t, now + 3600_000, SECRET)).toEqual({ bookingId: 'bk1', userId: 'u1' })
    expect(readAppointmentToken(t, now + 49 * 3600_000, SECRET)).toBeNull()
    expect(readAppointmentToken(t, now, 'z'.repeat(40))).toBeNull()
    const [payload] = t.split('.')
    const forged = `${Buffer.from(JSON.stringify({ b: 'bk2', u: 'u1', e: now + 9e9 })).toString('base64url')}.${t.split('.')[1]}`
    expect(readAppointmentToken(forged, now, SECRET)).toBeNull()
    expect(payload.length).toBeGreaterThan(10)
  })
})

describe('Garantía de cita · quién puede liberar', () => {
  it('nunca libera a un cliente que confirmó; sí al que no confirmó desde la hora o pidió otra hora', async () => {
    const { releaseKind } = await import('@/lib/bookings/followups')
    const when = Date.parse('2026-10-25T15:00:00Z')
    const d = (iso: string) => new Date(iso)
    const confirmedNoAnswer = new Map<any, Date>([['clientReconfirmed', d('2026-10-24T23:10:00Z')], ['partnerDeparting', d('2026-10-25T14:00:00Z')]])
    expect(releaseKind(confirmedNoAnswer as any, when, Date.parse('2026-10-25T14:30:00Z'))).toBeNull()
    const onHold = new Map<any, Date>([['reconfirmAsked', d('2026-10-24T23:00:00Z')], ['appointmentOnHold', d('2026-10-25T13:30:00Z')]])
    expect(releaseKind(onHold as any, when, Date.parse('2026-10-25T14:00:00Z'))).toBeNull()
    expect(releaseKind(onHold as any, when, Date.parse('2026-10-25T15:05:00Z'))).toBe('client_unconfirmed')
    const later = new Map<any, Date>([['clientReconfirmed', d('2026-10-24T23:10:00Z')], ['partnerDeparting', d('2026-10-25T14:00:00Z')], ['clientNeedsOtherTime', d('2026-10-25T14:03:00Z')]])
    expect(releaseKind(later as any, when, Date.parse('2026-10-25T14:05:00Z'))).toBe('client_other_time')
    const silent = new Map<any, Date>([['reconfirmAsked', d('2026-10-24T23:00:00Z')], ['partnerDeparting', d('2026-10-25T13:00:00Z')]])
    expect(releaseKind(silent as any, when, Date.parse('2026-10-25T13:05:00Z'))).toBeNull()
    expect(releaseKind(silent as any, when, Date.parse('2026-10-25T13:11:00Z'))).toBe('client_unconfirmed')
  })
  it('de noche solo avisa por la app', async () => {
    const { isNight } = await import('@/lib/bookings/followups')
    expect(isNight(Date.parse('2026-10-25T09:00:00Z'))).toBe(true) // 4:00 a. m. Bogotá
    expect(isNight(Date.parse('2026-10-25T23:00:00Z'))).toBe(false) // 6:00 p. m.
    expect(isNight(Date.parse('2026-10-26T03:30:00Z'))).toBe(true) // 10:30 p. m.
  })
})
