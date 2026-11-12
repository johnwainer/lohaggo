import { describe, expect, it } from 'vitest'
import { auditHtml, pageKindOf } from '@/lib/seo/agent/page-audit-core'

const page = (head: string, body = '<h1>Hola</h1><p>' + 'palabra '.repeat(200) + '</p>') => `<html><head>${head}</head><body>${body}</body></html>`
const GOOD = '<title>Plomero en Medellín | LoHaggo</title><meta name="description" content="Encuentra plomeros verificados en Medellín, con garantía y precios claros en un solo lugar."><link rel="canonical" href="https://www.lohaggo.com/servicios/plomeria"><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Service"},{"@type":"FAQPage"}]}</script>'

describe('pageKindOf', () => {
  it('classifies paths', () => {
    expect(pageKindOf('/')).toBe('home')
    expect(pageKindOf('/servicios/plomeria')).toBe('service')
    expect(pageKindOf('/blog/x')).toBe('article')
    expect(pageKindOf('/blog')).toBe('index')
    expect(pageKindOf('/login')).toBe('other')
  })
})

describe('auditHtml', () => {
  it('passes a healthy service page with no serious issues', () => {
    const a = auditHtml(page(GOOD), { url: 'u', path: '/servicios/plomeria', status: 200 })
    expect(a.issues.filter((i) => i.severity !== 'info')).toEqual([])
    expect(a.jsonLd).toEqual(expect.arrayContaining(['Service', 'FAQPage']))
  })
  it('flags missing title, description, h1, canonical and structured data', () => {
    const a = auditHtml('<html><body><p>hola</p></body></html>', { url: 'u', path: '/servicios/x', status: 200 })
    const codes = a.issues.map((i) => i.code)
    expect(codes).toEqual(expect.arrayContaining(['title_missing', 'description_missing', 'h1_missing', 'canonical_missing', 'structured_data']))
  })
  it('flags a non-200 and an unexpected noindex as critical', () => {
    expect(auditHtml('', { url: 'u', path: '/', status: 500 }).issues.some((i) => i.code === 'status' && i.severity === 'critical')).toBe(true)
    const n = auditHtml(page(`${GOOD}<meta name="robots" content="noindex,follow">`), { url: 'u', path: '/servicios/plomeria', status: 200 })
    expect(n.issues.some((i) => i.code === 'noindex_unexpected' && i.severity === 'critical')).toBe(true)
  })
  it('does not complain about noindex when the page is meant to be noindex', () => {
    const n = auditHtml(page(`${GOOD}<meta name="robots" content="noindex">`), { url: 'u', path: '/ciudad/bogota', status: 200, expectIndex: false })
    expect(n.issues.some((i) => i.code === 'noindex_unexpected')).toBe(false)
  })
  it('counts images without alt and invalid JSON-LD', () => {
    const a = auditHtml(page(`${GOOD}<script type="application/ld+json">{nope</script>`, '<h1>x</h1><img src="a"><img src="b" alt="ok">'), { url: 'u', path: '/servicios/plomeria', status: 200 })
    expect(a.imagesWithoutAlt).toBe(1)
    expect(a.issues.some((i) => i.code === 'structured_data_invalid')).toBe(true)
  })
  it('warns about long titles', () => {
    const a = auditHtml(page(GOOD.replace('Plomero en Medellín | LoHaggo', 'T'.repeat(80))), { url: 'u', path: '/servicios/plomeria', status: 200 })
    expect(a.issues.some((i) => i.code === 'title_long')).toBe(true)
  })
})
