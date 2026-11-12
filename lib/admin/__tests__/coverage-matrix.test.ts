import { describe, expect, it } from 'vitest'
import { buildCoverageMatrix, classifyGap, recruitText, type CoveragePartner, type CoverageRequest } from '@/lib/admin/coverage-matrix'
import { catalogGaps } from '@/lib/admin/catalog-gaps'

const now = new Date('2026-11-12T12:00:00Z')
const ago = (d: number) => new Date(now.getTime() - d * 86_400_000)
const req = (over: Partial<CoverageRequest>): CoverageRequest => ({ serviceId: 's1', serviceName: 'Plomería', city: 'MEDELLIN', zone: null, createdAt: ago(5), proposals: 1, status: 'ACTIVE', ...over })
const partner = (over: Partial<CoveragePartner> = {}): CoveragePartner => ({ serviceId: 's1', serviceName: 'Plomería', city: 'MEDELLIN', zones: [], ...over })

describe('classifyGap', () => {
  it('demand without supply', () => expect(classifyGap({ requests30: 0, requests90: 2, proposalPct30: null, partners: 0 })).toBe('no_supply'))
  it('low response rate with enough requests', () => expect(classifyGap({ requests30: 5, requests90: 8, proposalPct30: 20, partners: 4 })).toBe('low_response'))
  it('supply without demand', () => expect(classifyGap({ requests30: 0, requests90: 0, proposalPct30: null, partners: 3 })).toBe('no_demand'))
  it('balanced otherwise', () => expect(classifyGap({ requests30: 5, requests90: 8, proposalPct30: 80, partners: 4 })).toBe('balanced'))
})

describe('buildCoverageMatrix', () => {
  it('counts 30 and 90 day windows, proposals % and expired', () => {
    const rows = buildCoverageMatrix(
      [req({}), req({ proposals: 0, status: 'EXPIRED' }), req({ createdAt: ago(60), proposals: 0, status: 'EXPIRED' }), req({ createdAt: ago(120) })],
      [partner(), partner()],
      now,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ requests30: 2, requests90: 3, proposalPct30: 50, expired30: 1, expired90: 2, partners: 2 })
  })
  it('puts demand without supply first and includes supply without demand', () => {
    const rows = buildCoverageMatrix(
      [req({ serviceId: 's2', serviceName: 'Piscinas', proposals: 0 })],
      [partner(), partner(), partner()],
      now,
    )
    expect(rows.map((r) => [r.serviceName, r.gap])).toEqual([['Piscinas', 'no_supply'], ['Plomería', 'no_demand']])
  })
  it('splits by zone and counts partners covering it (empty coverage = whole city)', () => {
    const rows = buildCoverageMatrix(
      [req({ zone: 'laureles' }), req({ zone: 'laureles' }), req({ zone: 'poblado' })],
      [partner({ zones: ['laureles'] }), partner({ zones: [] }), partner({ zones: ['poblado'] })],
      now,
    )
    const z = Object.fromEntries(rows[0].zones.map((x) => [x.zone, x.partners]))
    expect(z).toEqual({ laureles: 2, poblado: 2 })
    expect(rows[0].zones[0].zone).toBe('laureles')
  })
})

describe('recruitText', () => {
  it('names the service and city', () => {
    expect(recruitText('Plomería', 'MEDELLIN')).toContain('plomería en Medellin')
  })
})

describe('catalogGaps', () => {
  const found = (q: string) => (q.includes('plomero') ? 1 : 0)
  it('groups variants and drops searches that now return results', () => {
    const g = catalogGaps([{ q: 'fuga agua', n: 3 }, { q: 'agua fuga', n: 2 }, { q: 'plomero', n: 9 }, { q: 'a', n: 4 }, { q: '123', n: 1 }], found)
    expect(g).toHaveLength(1)
    expect(g[0]).toMatchObject({ searches: 5, variants: ['fuga agua', 'agua fuga'] })
  })
})
