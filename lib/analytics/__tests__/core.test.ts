import { describe, expect, it } from 'vitest'
import { change, funnel, lastMonths, normalizeQuery, parseAcquisition, parsePeriod, percentile, periodDays, sourceLabel } from '@/lib/analytics/core'

const now = new Date('2026-09-25T15:00:00Z') // 10:00 in Bogotá

describe('periodos', () => {
  it('30 días completos que terminan hoy, y el periodo anterior de igual largo', () => {
    const p = parsePeriod({ preset: '30d' }, now)
    expect(p.to.toISOString()).toBe('2026-09-26T05:00:00.000Z')
    expect(p.from.toISOString()).toBe('2026-08-27T05:00:00.000Z')
    expect(p.prevTo.toISOString()).toBe(p.from.toISOString())
    expect(p.prevFrom.toISOString()).toBe('2026-07-28T05:00:00.000Z')
    expect(p.days).toBe(30)
    expect(periodDays(p)).toHaveLength(30)
    expect(periodDays(p)[29]).toBe('2026-09-25')
  })
  it('fechas propias; no pasa de hoy; preset desconocido = 30 días', () => {
    const p = parsePeriod({ from: '2026-09-01', to: '2026-12-31' }, now)
    expect(p.from.toISOString()).toBe('2026-09-01T05:00:00.000Z')
    expect(p.to.toISOString()).toBe('2026-09-26T05:00:00.000Z')
    expect(parsePeriod({ preset: 'x' }, now).days).toBe(30)
    expect(parsePeriod({ from: '2026-09-10', to: '2026-09-01' }, now).days).toBe(30)
  })
  it('últimos meses del calendario', () => {
    expect(lastMonths(new Date('2026-09-26T05:00:00Z'), 3)).toEqual(['2026-07', '2026-08', '2026-09'])
    expect(lastMonths(new Date('2026-01-01T05:00:00Z'), 2)).toEqual(['2025-11', '2025-12'])
  })
})

describe('cálculos', () => {
  it('variación, percentiles y embudo', () => {
    expect(change(120, 100)).toBe(20)
    expect(change(3, 0)).toBeNull()
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5)
    expect(percentile([], 0.5)).toBeNull()
    const f = funnel([{ key: 'a', label: 'A', count: 100 }, { key: 'b', label: 'B', count: 40 }, { key: 'c', label: 'C', count: 10 }])
    expect(f.map((x) => [x.fromPrevious, x.fromStart])).toEqual([[100, 100], [40, 40], [25, 10]])
  })
  it('agrupa la misma búsqueda escrita distinto', () => {
    expect(normalizeQuery('  Plomería URGENTE!! ')).toBe('plomeria urgente')
    expect(normalizeQuery('Cerrajero—24h')).toBe('cerrajero 24h')
  })
})

describe('origen de la visita (first touch)', () => {
  it('UTM gana; sin UTM el sitio que refiere es la fuente; sin nada es directo', () => {
    const utm = parseAcquisition(encodeURIComponent(JSON.stringify({ source: 'facebook', medium: 'social', campaign: 'lluvias', landing: '/servicios' })))
    expect(utm).toMatchObject({ source: 'facebook', medium: 'social', campaign: 'lluvias', landing: '/servicios' })
    expect(parseAcquisition(JSON.stringify({ referrer: 'https://l.instagram.com/?u=x' }))).toMatchObject({ source: 'instagram.com', medium: 'referral' })
    expect(parseAcquisition(JSON.stringify({ landing: '/' }))).toMatchObject({ source: 'direct', medium: 'none' })
    expect(parseAcquisition('no-json')).toBeNull()
  })
  it('nombres de fuente como los piensa la gente', () => {
    expect(sourceLabel('m.facebook.com')).toBe('Facebook')
    expect(sourceLabel('ig')).toBe('Instagram')
    expect(sourceLabel('google.com')).toBe('Google')
    expect(sourceLabel(null)).toBe('Directo')
    expect(sourceLabel('mailchimp')).toBe('mailchimp')
  })
})
