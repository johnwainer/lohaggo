import { describe, expect, it } from 'vitest'
import { ANGLES, anglesFor, focusLines, queryMatches, searchTerm, tradeTitle, trackKeywords, trackedKeywords } from '@/lib/seo/agent/keywords-core'

describe('trade terms', () => {
  it('uses who does the job when people search for them, else the service name', () => {
    expect(searchTerm('plomeria', 'Plomería')).toBe('plomero')
    expect(searchTerm('yoga', 'Yoga')).toBe('yoga')
    expect(tradeTitle('cerrajeria')).toBe('Cerrajero')
    expect(tradeTitle('yoga')).toBeNull()
  })
  it('urgency angle only for emergency trades', () => {
    expect(anglesFor('plomeria').some((a) => a.id === 'urgente')).toBe(true)
    expect(anglesFor('pintura').some((a) => a.id === 'urgente')).toBe(false)
  })
  it('angles are ordered best first and produce real searches', () => {
    for (let i = 1; i < ANGLES.length; i++) expect(ANGLES[i - 1].weight).toBeGreaterThanOrEqual(ANGLES[i].weight)
    expect(ANGLES[0].keyword('plomero', 'Medellín')).toBe('cuánto cuesta un plomero en Medellín')
    expect(trackedKeywords('plomeria', 'Plomería', 'Medellín')).toContain('plomero urgente en Medellín')
  })
})

describe('queryMatches', () => {
  it('matches the trade or the service name with the city or «near me»', () => {
    expect(queryMatches('plomero medellin', 'plomeria', 'Plomería', 'Medellín')).toBe(true)
    expect(queryMatches('plomeros en medellín', 'plomeria', 'Plomería', 'Medellín')).toBe(true)
    expect(queryMatches('plomería cerca de mí', 'plomeria', 'Plomería', 'Medellín')).toBe(true)
    expect(queryMatches('plomero bogota', 'plomeria', 'Plomería', 'Medellín')).toBe(false)
    expect(queryMatches('cerrajero medellin', 'plomeria', 'Plomería', 'Medellín')).toBe(false)
  })
})

describe('trackKeywords', () => {
  const rows = [
    { query: 'plomero medellin', page: 'https://www.lohaggo.com/servicios/plomeria', clicks: 2, impressions: 40, ctr: 0.05, position: 6 },
    { query: 'plomero urgente medellin', page: 'https://www.lohaggo.com/blog/x', clicks: 0, impressions: 10, ctr: 0, position: 20 },
  ]
  it('weights the position by impressions and reports the page that shows', () => {
    const [r] = trackKeywords([{ slug: 'plomeria', name: 'Plomería' }], [{ name: 'Medellín' }], rows)
    expect(r.impressions).toBe(50)
    expect(r.position).toBeCloseTo(8.8, 1)
    expect(r.page).toBe('/servicios/plomeria')
    expect(r.onServicePage).toBe(true)
  })
  it('a service without data has null position', () => {
    const [r] = trackKeywords([{ slug: 'cerrajeria', name: 'Cerrajería' }], [{ name: 'Medellín' }], rows)
    expect(r.position).toBeNull()
    expect(r.impressions).toBe(0)
  })
  it('the weekly focus puts the invisible ones first and names the exact words', () => {
    const t = trackKeywords([{ slug: 'plomeria', name: 'Plomería' }, { slug: 'cerrajeria', name: 'Cerrajería' }], [{ name: 'Medellín' }], rows)
    const lines = focusLines(t, 2)
    expect(lines[0]).toContain('cerrajero en Medellín')
    expect(lines[0]).toContain('todavía no aparece')
    expect(lines[0]).toContain('/servicios/cerrajeria')
  })
})
