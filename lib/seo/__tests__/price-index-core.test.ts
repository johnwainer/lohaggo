import { describe, expect, it } from 'vitest'
import { buildPriceIndex, changeLabel, indexCsv, trendOf, type IndexProposal } from '@/lib/seo/price-index-core'

const now = new Date('2026-11-16T12:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400_000)
const svc = [{ id: 's1', name: 'Plomería', slug: 'plomeria', category: 'Hogar' }, { id: 's2', name: 'Pintura', slug: 'pintura', category: 'Hogar' }]
const many = (serviceId: string, price: number, n: number, ago: number, partners = 4): IndexProposal[] =>
  Array.from({ length: n }, (_, i) => ({ price: price + i * 1000, partnerId: `p${i % partners}`, serviceId, createdAt: daysAgo(ago + (i % 20)) }))

describe('índice de precios', () => {
  it('calcula la mediana y la variación frente a los 90 días anteriores', () => {
    const idx = buildPriceIndex([...many('s1', 100_000, 8, 10), ...many('s1', 80_000, 8, 100)], svc, now)
    const r = idx.rows[0]
    expect(r.slug).toBe('plomeria')
    expect(r.sample).toBe(8)
    expect(r.changePct).toBeGreaterThan(20)
    expect(r.trend).toBe('up')
  })

  it('sin muestra suficiente no afirma una cifra', () => {
    expect(buildPriceIndex(many('s1', 100_000, 4, 10), svc, now).rows).toHaveLength(0)
  })

  it('exige varios socios distintos: uno solo con muchas propuestas no es el precio típico', () => {
    expect(buildPriceIndex(many('s1', 100_000, 10, 10, 1), svc, now).rows).toHaveLength(0)
  })

  it('sin periodo anterior comparable muestra el precio sin variación', () => {
    const r = buildPriceIndex(many('s1', 100_000, 8, 10), svc, now).rows[0]
    expect(r.changePct).toBeNull()
    expect(r.trend).toBeNull()
  })

  it('el índice general necesita al menos 3 servicios comparables y no cuenta los cambios de mezcla extremos', () => {
    const two = buildPriceIndex([...many('s1', 100_000, 8, 10), ...many('s1', 90_000, 8, 100), ...many('s2', 50_000, 8, 10), ...many('s2', 45_000, 8, 100)], svc, now)
    expect(two.overallChangePct).toBeNull()
    const jump = buildPriceIndex([...many('s1', 300_000, 8, 10), ...many('s1', 80_000, 8, 100)], svc, now)
    expect(jump.comparable).toBe(0)
  })

  it('ignora propuestas fuera de la ventana y precios inválidos', () => {
    const idx = buildPriceIndex([...many('s1', 100_000, 8, 400), { price: 0, partnerId: 'x', serviceId: 's1', createdAt: daysAgo(5) }], svc, now)
    expect(idx.rows).toHaveLength(0)
  })

  it('trend y etiquetas', () => {
    expect(trendOf(1)).toBe('stable')
    expect(trendOf(-8)).toBe('down')
    expect(changeLabel(12.34)).toBe('subió 12,3 %')
    expect(changeLabel(null)).toBe('sin comparación')
  })

  it('el CSV escapa comas y trae encabezado', () => {
    const idx = buildPriceIndex(many('s1', 100_000, 8, 10), [{ ...svc[0], name: 'Plomería, gas' }], now)
    const csv = indexCsv(idx)
    expect(csv.split('\n')[0]).toContain('servicio,categoria')
    expect(csv).toContain('"Plomería, gas"')
  })
})
