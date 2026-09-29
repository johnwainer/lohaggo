import { describe, expect, it, vi } from 'vitest'

// Every raw query answers with one empty row: enough for the shape, no database involved
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: vi.fn(async () => [{}]) } }))
import { cityCode, cleanFilters, funnelTab, originBreakdown } from '@/lib/analytics/queries'
import { parsePeriod } from '@/lib/analytics/core'

describe('embudo por origen (app, chat, admin)', () => {
  it('siempre las tres filas en orden, con ceros donde no hubo nada', () => {
    const rows = originBreakdown(
      [{ origin: 'chat', requests: 4 }, { origin: 'app', requests: '12' }],
      [{ origin: 'chat', booked: 2, completed: 1, gmv: 130000 }, { origin: 'otro', booked: 9 }],
    )
    expect(rows).toEqual([
      { origin: 'app', requests: 12, booked: 0, completed: 0, gmv: 0 },
      { origin: 'chat', requests: 4, booked: 2, completed: 1, gmv: 130000 },
      { origin: 'admin', requests: 0, booked: 0, completed: 0, gmv: 0 },
    ])
  })

  it('funnelTab trae byOrigin junto al resto del embudo', async () => {
    const d = await funnelTab(parsePeriod({ preset: '7d' }, new Date('2026-09-25T15:00:00Z')), cleanFilters())
    expect(d.byOrigin.map((r) => r.origin)).toEqual(['app', 'chat', 'admin'])
    for (const r of d.byOrigin) expect(r).toEqual({ origin: r.origin, requests: 0, booked: 0, completed: 0, gmv: 0 })
    expect(d.stages).toHaveLength(5)
    expect(d.daily).toHaveLength(7)
  })
})

describe('ciudades del filtro desde la configuración de ciudades', () => {
  it('traduce slug o nombre al código que usan las reservas', () => {
    expect(cityCode({ slug: 'medellin', name: 'Medellín' })).toBe('MEDELLIN')
    expect(cityCode({ slug: 'bogota-dc', name: 'Bogotá D.C.' })).toBe('BOGOTA')
    expect(cityCode({ slug: null, name: 'Barranquilla' })).toBe('BARRANQUILLA')
    expect(cityCode({ slug: 'pereira', name: 'Pereira' })).toBeNull()
  })
})
