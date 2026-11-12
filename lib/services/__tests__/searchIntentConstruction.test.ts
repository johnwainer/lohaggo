import { describe, expect, it } from 'vitest'
import { detectIntentTargets, rankByIntent } from '@/lib/services/searchIntent'

const svc = (name: string, category = 'Hogar') => ({ name, category: { name: category }, _count: { partners: 1 } })
const catalog = [svc('Plomería'), svc('Albañilería y construcción'), svc('Mantenimiento de piscinas'), svc('Pintura'), svc('Electricidad')]

describe('construction and pool synonyms', () => {
  it('«plancha aligerada» points to construction', () => {
    expect(rankByIntent(catalog, 'plancha aligerada')?.[0].name).toBe('Albañilería y construcción')
  })
  it('«losa» and «maestro de obra» too', () => {
    expect(rankByIntent(catalog, 'necesito hacer una losa')?.[0].name).toBe('Albañilería y construcción')
    expect(rankByIntent(catalog, 'maestro de obra')?.[0].name).toBe('Albañilería y construcción')
  })
  it('«piscina» and «alberca» point to pool maintenance', () => {
    expect(rankByIntent(catalog, 'limpiar piscina')?.[0].name).toBe('Mantenimiento de piscinas')
    expect(detectIntentTargets('alberca')[0]).toContain('piscina')
  })
  it('«fuga de agua» still gives plumbing', () => {
    expect(rankByIntent(catalog, 'fuga de agua')?.[0].name).toBe('Plomería')
  })
})
