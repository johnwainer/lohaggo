import { describe, expect, it } from 'vitest'
import { alertsFrom, bogotaDayStart, bogotaKey, bogotaMonthStart, delta, fillSeries, lastDays, windows } from '@/lib/admin/overview-core'

describe('ventanas en hora de Bogotá', () => {
  it('el día empieza a medianoche de Bogotá (05:00 UTC)', () => {
    expect(bogotaDayStart(new Date('2026-09-25T03:00:00Z')).toISOString()).toBe('2026-09-24T05:00:00.000Z')
    expect(bogotaDayStart(new Date('2026-09-25T05:00:00Z')).toISOString()).toBe('2026-09-25T05:00:00.000Z')
    expect(bogotaKey(new Date('2026-09-25T03:00:00Z'))).toBe('2026-09-24')
  })
  it('mes en curso frente al anterior hasta el mismo día y hora', () => {
    const w = windows(new Date('2026-10-10T17:00:00Z'))
    expect(w.month.toISOString()).toBe('2026-10-01T05:00:00.000Z')
    expect(w.prevMonth.toISOString()).toBe('2026-09-01T05:00:00.000Z')
    expect(w.prevMonthEnd.toISOString()).toBe('2026-09-10T17:00:00.000Z')
    expect(w.yesterdaySameTime.toISOString()).toBe('2026-10-09T17:00:00.000Z')
    expect(bogotaMonthStart(new Date('2026-10-01T02:00:00Z')).toISOString()).toBe('2026-09-01T05:00:00.000Z')
  })
  it('un mes más corto no pasa del fin del mes anterior', () => {
    const w = windows(new Date('2026-03-31T20:00:00Z'))
    expect(w.prevMonthEnd.getTime()).toBeLessThanOrEqual(w.month.getTime())
  })
})

describe('series y variaciones', () => {
  it('rellena con ceros los días sin datos y convierte bigint', () => {
    const keys = lastDays(new Date('2026-09-25T15:00:00Z'), 3)
    expect(keys).toEqual(['2026-09-23', '2026-09-24', '2026-09-25'])
    expect(fillSeries(keys, [{ d: '2026-09-24', n: BigInt(4), gmv: 1000 }], ['n', 'gmv'])).toEqual([
      { d: '2026-09-23', n: 0, gmv: 0 }, { d: '2026-09-24', n: 4, gmv: 1000 }, { d: '2026-09-25', n: 0, gmv: 0 },
    ])
  })
  it('variación porcentual; sin base no hay comparación', () => {
    expect(delta(150, 100)).toBe(50)
    expect(delta(5, 0)).toBeNull()
    expect(delta(0, 0)).toBe(0)
  })
})

describe('alertas', () => {
  it('ordenadas por urgencia y solo lo que existe', () => {
    const a = alertsFrom({ waitingCustomers: 2, slaBreached: 0, channelProblems: 1, payoutsFailed: 0, postsFailed: 1, agentsDegraded: 0, requestsWithoutProposals: 0, paymentsToConfirm: 0 })
    expect(a.map((x) => x.level)).toEqual(['critical', 'critical', 'warning'])
    expect(a[0].text).toBe('2 clientes esperan respuesta hace más de 15 min')
    expect(a[1].text).toBe('1 canal con problemas de conexión')
  })
})
