import { describe, expect, it } from 'vitest'
import { medianResponseMinutes, netEarnings, periodStarts, proposalWinRate, responseLabel } from '@/lib/partners/performance'

// Thursday 12 Nov 2026, 10:00 in Bogotá
const now = new Date('2026-11-12T15:00:00.000Z')

describe('periodStarts', () => {
  it('la semana empieza el lunes y el mes el día 1 (hora de Bogotá)', () => {
    expect(periodStarts(now)).toEqual({ week: '2026-11-09', month: '2026-11-01' })
  })

  it('el domingo todavía es de la semana que empezó el lunes anterior', () => {
    expect(periodStarts(new Date('2026-11-15T20:00:00.000Z')).week).toBe('2026-11-09')
  })

  it('las 10 p. m. de Bogotá del 30 siguen siendo del mes aunque en UTC ya sea 1', () => {
    expect(periodStarts(new Date('2026-12-01T03:00:00.000Z')).month).toBe('2026-11-01')
  })
})

describe('netEarnings', () => {
  const b = (day: string, price: number, rate: number | null = 10, status = 'COMPLETED') => ({ status, scheduledDate: `${day}T00:00:00.000Z`, totalPrice: price, partnerCommissionRate: rate })

  it('suma el neto de lo completado en la semana y en el mes', () => {
    const r = netEarnings([b('2026-11-10', 100000), b('2026-11-03', 200000), b('2026-10-30', 500000)], 10, now)
    expect(r).toEqual({ week: 90000, month: 90000 + 180000 })
  })

  it('ignora lo no completado y los días futuros', () => {
    expect(netEarnings([b('2026-11-11', 100000, 10, 'CONFIRMED'), b('2026-11-20', 100000)], 10, now)).toEqual({ week: 0, month: 0 })
  })

  it('usa la comisión guardada en la reserva y, si falta, la actual', () => {
    expect(netEarnings([b('2026-11-10', 100000, 0)], 10, now).week).toBe(100000)
    expect(netEarnings([b('2026-11-10', 100000, null)], 20, now).week).toBe(80000)
  })

  it('sin ninguna comisión conocida el neto es desconocido, no un número inventado', () => {
    expect(netEarnings([b('2026-11-10', 100000, null)], null, now)).toEqual({ week: null, month: null })
  })
})

describe('proposalWinRate', () => {
  it('cuenta aceptadas sobre decididas e ignora pendientes', () => {
    expect(proposalWinRate(['ACCEPTED', 'REJECTED', 'REJECTED', 'PENDING'])).toEqual({ rate: 33, won: 1, decided: 3 })
  })

  it('con menos de 3 decididas no hay tasa que mostrar', () => {
    expect(proposalWinRate(['ACCEPTED', 'REJECTED'])).toBeNull()
  })
})

describe('tiempo de respuesta', () => {
  it('mediana en minutos y etiqueta legible', () => {
    const t = (min: number) => new Date(Date.UTC(2026, 10, 12, 12, min))
    expect(medianResponseMinutes([{ requestAt: t(0), proposalAt: t(5) }, { requestAt: t(0), proposalAt: t(15) }, { requestAt: t(0), proposalAt: t(300) }])).toBe(15)
    expect(medianResponseMinutes([])).toBeNull()
    expect(responseLabel(15)).toBe('15 min')
    expect(responseLabel(180)).toBe('3 h')
    expect(responseLabel(60 * 72)).toBe('3 d')
  })
})
