import { describe, expect, it } from 'vitest'
import { parsePsi, speedCandidates, speedSummary, type SpeedResult } from '@/lib/seo/agent/speed-core'

const psi = (o: { score?: number; lcp?: number; cls?: number; field?: unknown } = {}) => ({
  id: 'https://www.lohaggo.com/servicios/plomeria',
  lighthouseResult: {
    categories: { performance: { score: o.score ?? 0.42 } },
    audits: {
      'largest-contentful-paint': { numericValue: o.lcp ?? 4800 },
      'cumulative-layout-shift': { numericValue: o.cls ?? 0.05 },
      'total-blocking-time': { numericValue: 350 },
      'first-contentful-paint': { numericValue: 2100 },
      'uses-optimized-images': { title: 'Codificar imágenes de forma eficiente', details: { type: 'opportunity', overallSavingsMs: 1200 } },
      'unused-javascript': { title: 'Reducir el JavaScript sin usar', details: { type: 'opportunity', overallSavingsMs: 600 } },
      'render-blocking-resources': { title: 'Eliminar recursos que bloquean el renderizado', details: { type: 'opportunity', overallSavingsMs: 0 } },
    },
  },
  loadingExperience: o.field,
})

const res = (p: Partial<SpeedResult>): SpeedResult => ({ path: '/x', url: 'u', strategy: 'mobile', score: 90, lcpMs: 1800, cls: 0.02, tbtMs: 50, fcpMs: 900, field: null, error: null, ...p })

describe('parsePsi', () => {
  it('reads lab metrics, score and top opportunities', () => {
    const r = parsePsi(psi(), '/servicios/plomeria')
    expect(r).toMatchObject({ path: '/servicios/plomeria', score: 42, lcpMs: 4800, cls: 0.05, tbtMs: 350, fcpMs: 900 + 1200, field: null, error: null })
    expect(r.opportunities?.map((o) => o.id)).toEqual(['uses-optimized-images', 'unused-javascript'])
  })
  it('reads field data (CLS percentile / 100)', () => {
    const r = parsePsi(psi({ field: { overall_category: 'SLOW', metrics: { LARGEST_CONTENTFUL_PAINT_MS: { percentile: 5200 }, CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 12 }, INTERACTION_TO_NEXT_PAINT: { percentile: 310 } } } }), '/')
    expect(r.field).toEqual({ lcpMs: 5200, cls: 0.12, inpMs: 310, category: 'SLOW' })
  })
  it('turns an API error into an error result', () => {
    expect(parsePsi({ error: { message: 'Quota exceeded' } }, '/').error).toContain('Quota')
    expect(parsePsi(null, '/').error).toBeTruthy()
  })
})

describe('speedCandidates', () => {
  it('flags a poor lab LCP as critical with a Spanish title and opportunities', () => {
    const [c] = speedCandidates([parsePsi(psi(), '/servicios/plomeria')])
    expect(c.severity).toBe('critical')
    expect(c.impact).toBe('high')
    expect(c.dedupeKey).toBe('speed:/servicios/plomeria')
    expect(c.title).toContain('/servicios/plomeria carga lento en el celular')
    expect(c.title).toContain('4,8 s')
    expect(c.detail).toContain('Codificar imágenes')
  })
  it('uses field data when present, ignoring a bad lab score', () => {
    const fast = res({ score: 30, lcpMs: 6000, field: { lcpMs: 1900, cls: 0.01, inpMs: 120, category: 'FAST' } })
    expect(speedCandidates([fast])).toEqual([])
    const slow = res({ score: 95, lcpMs: 1000, field: { lcpMs: 4500, cls: 0.01, inpMs: null, category: 'SLOW' } })
    const [c] = speedCandidates([slow])
    expect(c.severity).toBe('critical')
    expect(c.detail).toContain('visitantes reales')
  })
  it('warns on needs-improvement metrics and mid scores', () => {
    expect(speedCandidates([res({ lcpMs: 3000 })])[0].severity).toBe('warning')
    expect(speedCandidates([res({ score: 60 })])[0].severity).toBe('warning')
    expect(speedCandidates([res({ score: 40 })])[0].severity).toBe('critical')
    expect(speedCandidates([res({ cls: 0.3 })])[0].severity).toBe('critical')
  })
  it('gives nothing for healthy pages or results with an error', () => {
    expect(speedCandidates([res({})])).toEqual([])
    expect(speedCandidates([res({ score: null, lcpMs: null, cls: null, error: 'x' })])).toEqual([])
    expect(speedCandidates([res({ score: 10, lcpMs: 9000, error: '429' })])).toEqual([])
  })
})

describe('speedSummary', () => {
  it('summarizes measured, slow, average and worst', () => {
    const s = speedSummary([res({ path: '/a', score: 90 }), res({ path: '/b', score: 40, lcpMs: 5000 }), res({ path: '/c', score: null, error: 'e' })])
    expect(s).toEqual({ measured: 2, slow: 1, avgScore: 65, worstPath: '/b' })
    expect(speedSummary([])).toEqual({ measured: 0, slow: 0, avgScore: null, worstPath: null })
  })
})
