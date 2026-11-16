import { describe, expect, it } from 'vitest'
import { cleanReviewUrl, sanitizeSeoConfig } from '@/lib/seo/agent/settings-core'
import { WA_CATALOG } from '@/lib/messaging/wa-catalog'
import { WA } from '@/lib/messaging/wa-specs'

describe('cleanReviewUrl: only Google links', () => {
  it('accepts the usual Google review links', () => {
    expect(cleanReviewUrl('https://g.page/r/CabcDEF/review')).toContain('g.page')
    expect(cleanReviewUrl('https://search.google.com/local/writereview?placeid=ChIJ123')).toContain('writereview')
    expect(cleanReviewUrl('https://maps.app.goo.gl/abc123')).toContain('goo.gl')
  })
  it('refuses anything else: other hosts, http, javascript, lookalikes, junk', () => {
    for (const u of ['https://malo.example/r', 'http://g.page/r/x', 'javascript:alert(1)', 'https://g.page.evil.io/x', 'https://evil.io/?u=https://g.page/r/x', 'texto', '', null, 5]) expect(cleanReviewUrl(u as never)).toBe('')
  })
  it('goes through the SEO settings sanitizer and defaults to off', () => {
    expect(sanitizeSeoConfig(null).googleReviewUrl).toBe('')
    expect(sanitizeSeoConfig({ googleReviewUrl: 'https://g.page/r/x/review' }).googleReviewUrl).toContain('g.page')
    expect(sanitizeSeoConfig({ googleReviewUrl: 'https://evil.io' }).googleReviewUrl).toBe('')
  })
})

describe('B41 template', () => {
  it('exists in the catalog with a link button on our own domain and neutral wording', () => {
    const t = WA_CATALOG.find((x) => x.code === 'B41')!
    expect(t.name).toBe('lh_cliente_resena_google')
    expect(t.url?.url.startsWith('https://www.lohaggo.com/')).toBe(true)
    expect(t.body).toContain('sea bueno o malo')
  })
  it('its spec sends the booking id in the link and dedupes per booking', () => {
    const s = WA.B41({ id: 'clx1abc', clientName: 'Ana', partnerName: 'Carlos', service: 'Plomería' } as never)
    expect(JSON.stringify(s)).toContain('resena/clx1abc')
    expect(JSON.stringify(s)).toContain('B41:Booking:clx1abc')
  })
})
