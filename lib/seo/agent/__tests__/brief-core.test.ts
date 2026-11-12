import { describe, expect, it } from 'vitest'
import { fit, sanitizeBrief, sanitizeReport } from '@/lib/seo/agent/brief-core'

const raw = (over: Record<string, unknown> = {}) => ({
  keyword: 'plomero en Medellín', secondary: ['plomero cerca'], intent: 'local', title: 'Cómo elegir un plomero en Medellín',
  seoTitle: 'Cómo elegir un plomero en Medellín: guía completa con precios y garantía real', seoDescription: 'Aprende a elegir un plomero verificado en Medellín, qué preguntar y cuánto cuesta, con garantía LoHaggo.',
  outline: [{ h2: 'A', points: ['x'] }, { h2: 'B', points: ['y'] }, { h2: 'C', points: ['z'] }],
  faqs: [{ q: '¿Cuánto cuesta?', a: 'Depende.' }, { q: '¿Hay garantía?', a: 'Sí.' }],
  internalLinks: [{ url: '/servicios/plomeria', anchor: 'plomería' }, { url: '/inventada/x', anchor: 'nada' }],
  facts: ['5 socios'], cta: 'Pide tu plomero', schema: 'FAQPage', format: 'guía', notes: 'n', ...over,
})
const allowed = ['/servicios/plomeria', '/blog']

describe('sanitizeBrief', () => {
  it('accepts a good brief, trims the SEO title and drops invented links', () => {
    const r = sanitizeBrief(raw(), allowed)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.seoTitle.length).toBeLessThanOrEqual(60)
    expect(r.value.internalLinks).toEqual([{ url: '/servicios/plomeria', anchor: 'plomería' }])
    expect(r.dropped.some((d) => d.includes('/inventada/x'))).toBe(true)
  })
  it('rejects an incomplete brief with readable errors', () => {
    const r = sanitizeBrief(raw({ outline: [], faqs: [], keyword: '' }), allowed)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.length).toBeGreaterThanOrEqual(3)
  })
  it('falls back on unknown enums', () => {
    const r = sanitizeBrief(raw({ intent: 'otra', schema: 'X', format: 'y' }), allowed)
    expect(r.ok && r.value.intent).toBe('informacional')
    expect(r.ok && r.value.format).toBe('guía')
  })
  it('refuses non-objects', () => {
    expect(sanitizeBrief(null, allowed).ok).toBe(false)
    expect(sanitizeBrief('x', allowed).ok).toBe(false)
  })
})

describe('fit', () => {
  it('cuts at a word boundary and leaves short text alone', () => {
    expect(fit('hola mundo', 60)).toBe('hola mundo')
    const t = fit('palabra '.repeat(20), 30)
    expect(t.length).toBeLessThanOrEqual(30)
    expect(t.endsWith(' ')).toBe(false)
  })
})

describe('sanitizeReport', () => {
  it('keeps valid proposals and caps them', () => {
    const r = sanitizeReport({ resumen: 'Todo bien', hallazgos: ['a'], propuestas: Array.from({ length: 8 }, (_, i) => ({ titulo: `P${i}`, detalle: 'hacer', tipo: 'growth', impacto: 'high', esfuerzo: 'low' })).concat([{ titulo: '', detalle: 'x', tipo: 'growth', impacto: 'high', esfuerzo: 'low' }]), para_marketing: ['usa X'] })
    expect(r?.proposals).toHaveLength(5)
    expect(r?.forMarketing).toEqual(['usa X'])
  })
  it('needs a summary', () => {
    expect(sanitizeReport({ hallazgos: [] })).toBeNull()
    expect(sanitizeReport(null)).toBeNull()
  })
  it('turns unknown kinds and levels into safe defaults', () => {
    const r = sanitizeReport({ resumen: 'x', hallazgos: [], propuestas: [{ titulo: 'T', detalle: 'D', tipo: 'inventado', impacto: 'enorme', esfuerzo: '?' }], para_marketing: [] })
    expect(r?.proposals[0]).toMatchObject({ kind: 'growth', impact: 'medium', effort: 'medium' })
  })
})
