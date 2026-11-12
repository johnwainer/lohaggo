import { describe, expect, it } from 'vitest'
import { NEXT_BOOKING_KEY, pickNextBooking, saveNextBooking } from '@/lib/pwa/next-booking'

const b = (day: string, time: string, status = 'CONFIRMED', name = 'Plomería') => ({ status, scheduledDate: `${day}T00:00:00.000Z`, scheduledTime: time, service: { name } })
// 12 Nov 2026, 10:00 Bogotá
const now = new Date('2026-11-12T15:00:00.000Z').getTime()

describe('pickNextBooking', () => {
  it('la más próxima entre las vivas, ignorando canceladas y pasadas', () => {
    const next = pickNextBooking([b('2026-11-20', '10:00'), b('2026-11-13', '08:00', 'CANCELLED'), b('2026-11-14', '09:00', 'PENDING', 'Pintura'), b('2026-11-01', '09:00')], now)
    expect(next?.service.name).toBe('Pintura')
  })

  it('el servicio en curso (hasta 3 h después de su hora) todavía cuenta', () => {
    expect(pickNextBooking([b('2026-11-12', '08:00', 'IN_PROGRESS')], now)).not.toBeNull()
    expect(pickNextBooking([b('2026-11-12', '05:00', 'IN_PROGRESS')], now)).toBeNull()
  })
})

describe('saveNextBooking', () => {
  function memory() {
    const data = new Map<string, string>()
    return { data, setItem: (k: string, v: string) => { data.set(k, v) }, removeItem: (k: string) => { data.delete(k) } }
  }

  it('guarda solo servicio, día y hora (nunca dirección, nombre ni teléfono)', () => {
    const s = memory()
    saveNextBooking(s, [{ ...b('2026-11-14', '09:00'), address: 'Calle 1', user: { name: 'Ana', phone: '300' } } as never], 'PARTNER', now)
    const saved = JSON.parse(s.data.get(NEXT_BOOKING_KEY)!)
    expect(Object.keys(saved).sort()).toEqual(['at', 'role', 'savedAt', 'service', 'v', 'when'])
    expect(saved.service).toBe('Plomería')
    expect(saved.when).toContain('09:00')
    expect(JSON.stringify(saved)).not.toMatch(/Calle|Ana|300/)
  })

  it('sin reservas vivas borra lo guardado', () => {
    const s = memory()
    saveNextBooking(s, [b('2026-11-14', '09:00')], 'CLIENT', now)
    saveNextBooking(s, [], 'CLIENT', now)
    expect(s.data.has(NEXT_BOOKING_KEY)).toBe(false)
  })
})
