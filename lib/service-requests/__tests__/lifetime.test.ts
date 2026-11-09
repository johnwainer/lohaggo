import { describe, expect, it } from 'vitest'
import { MAX_AUTO_EXTENSIONS, eveOfPreferredDay, nextAutoExtension, requestExpiresAt } from '@/lib/service-requests/lifetime'

const created = new Date('2026-10-28T15:00:00.000Z') // 10:00 en Bogotá
const day = (d: string) => new Date(`${d}T00:00:00.000Z`)

describe('vida de una solicitud', () => {
  it('sin fecha, o «lo antes posible», 48 h', () => {
    expect(requestExpiresAt({ preferredDate: null }, created).toISOString()).toBe('2026-10-30T15:00:00.000Z')
    expect(requestExpiresAt({ preferredDate: day('2026-11-03'), isUrgent: true }, created).toISOString()).toBe('2026-10-30T15:00:00.000Z')
  })

  it('con fecha: la víspera a las 20:00 de Bogotá', () => {
    expect(eveOfPreferredDay(day('2026-11-01')).toISOString()).toBe('2026-11-01T01:00:00.000Z')
    expect(requestExpiresAt({ preferredDate: day('2026-11-01') }, created).toISOString()).toBe('2026-11-01T01:00:00.000Z')
  })

  it('nunca menos de 48 h (fecha mañana) ni más de 7 días (fecha lejana: el caso del 15-dic)', () => {
    expect(requestExpiresAt({ preferredDate: day('2026-10-29') }, created).toISOString()).toBe('2026-10-30T15:00:00.000Z')
    expect(requestExpiresAt({ preferredDate: day('2026-12-15') }, created).toISOString()).toBe('2026-11-04T15:00:00.000Z')
  })

  it('una fecha guardada como instante (filas viejas) usa su día en Bogotá', () => {
    // 2-nov 00:30 UTC = 1-nov 19:30 en Bogotá → día 1-nov
    expect(requestExpiresAt({ preferredDate: new Date('2026-11-02T00:30:00.000Z') }, created).toISOString()).toBe('2026-11-01T01:00:00.000Z')
  })
})

describe('extensión automática', () => {
  it('fecha lejana: otros 7 días, sin pasar de 2 h antes del servicio', () => {
    const now = new Date('2026-11-04T13:00:00.000Z')
    const r = { preferredDate: day('2026-12-15'), preferredTime: '09:00', isUrgent: false, expiresAt: new Date('2026-11-04T15:00:00.000Z') }
    expect(nextAutoExtension(r, 0, now)?.toISOString()).toBe('2026-11-11T13:00:00.000Z')
  })

  it('en la víspera: hasta 2 h antes de la hora del servicio', () => {
    const now = new Date('2026-10-31T23:00:00.000Z')
    const r = { preferredDate: day('2026-11-01'), preferredTime: '09:00', isUrgent: false, expiresAt: new Date('2026-11-01T01:00:00.000Z') }
    expect(nextAutoExtension(r, 0, now)?.toISOString()).toBe('2026-11-01T12:00:00.000Z')
  })

  it('sin fecha, urgente, con el servicio encima o tras el tope de extensiones: vence', () => {
    const now = new Date('2026-11-04T13:00:00.000Z')
    const base = { preferredDate: day('2026-12-15'), preferredTime: '09:00', isUrgent: false, expiresAt: new Date('2026-11-04T15:00:00.000Z') }
    expect(nextAutoExtension({ ...base, preferredDate: null }, 0, now)).toBeNull()
    expect(nextAutoExtension({ ...base, isUrgent: true }, 0, now)).toBeNull()
    expect(nextAutoExtension(base, MAX_AUTO_EXTENSIONS, now)).toBeNull()
    expect(nextAutoExtension({ ...base, preferredDate: day('2026-11-04'), preferredTime: '11:00' }, 0, now)).toBeNull()
  })

  it('nunca acorta: si ya vence después, no hay extensión', () => {
    const now = new Date('2026-11-04T13:00:00.000Z')
    const r = { preferredDate: day('2026-11-06'), preferredTime: '09:00', isUrgent: false, expiresAt: new Date('2026-11-06T13:00:00.000Z') }
    expect(nextAutoExtension(r, 0, now)).toBeNull()
  })
})
