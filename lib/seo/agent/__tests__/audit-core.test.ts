import { describe, expect, it } from 'vitest'
import { detectOpportunities, healthScore, scoreOf, type SeoFacts } from '@/lib/seo/agent/audit-core'
import { DEFAULT_SEO_CONFIG, sanitizeSeoConfig } from '@/lib/seo/agent/settings-core'

const now = new Date('2026-11-13T12:00:00Z')
const base = (): SeoFacts => ({
  now,
  services: [
    { slug: 'plomeria', name: 'Plomería', category: 'Hogar', partners: 5, popular: true, requests90d: 12, reviews: 4, goodReviews: 4 },
    { slug: 'pintura', name: 'Pintura', category: 'Hogar', partners: 0, popular: false, requests90d: 0, reviews: 0, goodReviews: 0 },
  ],
  cities: [{ slug: 'medellin', name: 'Medellín', status: 'ACTIVE' }, { slug: 'bogota', name: 'Bogotá', status: 'COMING_SOON' }],
  supply: [{ serviceSlug: 'plomeria', citySlug: 'medellin', partners: 5, requests90d: 12 }, { serviceSlug: 'plomeria', citySlug: 'bogota', partners: 2, requests90d: 3 }],
  articles: [], zeroSearches: [], gsc: null, pages: [], pricePageSlugs: [], thinPartnerProfiles: 0,
})
const cfg = DEFAULT_SEO_CONFIG
const keys = (f: SeoFacts, c = cfg) => detectOpportunities(f, c).map((o) => o.dedupeKey)

describe('scoreOf', () => {
  it('ranks impact, demand and focus, and stays in 0–100', () => {
    expect(scoreOf({ impact: 'high', effort: 'low' })).toBeGreaterThan(scoreOf({ impact: 'medium', effort: 'low' }))
    expect(scoreOf({ impact: 'medium', effort: 'low', demand: 50 })).toBeGreaterThan(scoreOf({ impact: 'medium', effort: 'low' }))
    expect(scoreOf({ impact: 'high', effort: 'low', demand: 1e9, focus: true })).toBeLessThanOrEqual(100)
    expect(scoreOf({ impact: 'low', effort: 'high' })).toBeGreaterThanOrEqual(0)
  })
})

describe('detectOpportunities', () => {
  it('finds a service+city gap only for active cities with supply', () => {
    const k = keys(base())
    expect(k).toContain('gap:plomeria:medellin')
    expect(k).not.toContain('gap:plomeria:bogota')
  })

  it('does not report a gap an article already covers', () => {
    const f = base()
    f.articles = [{ slug: 'a', title: 'Plomero en Medellín: guía', publishedAt: now, updatedAt: now, words: 900, seoTitle: 'x'.repeat(40), seoDescription: 'x'.repeat(100), category: null, tags: [], links: ['/servicios/plomeria'], haystack: 'Plomero en Medellín plomería guía', bodyText: 'plomería en Medellín', views: 3 }]
    expect(keys(f)).not.toContain('gap:plomeria:medellin')
  })

  it('turns zero-result searches over the threshold into demand gaps', () => {
    const f = base()
    f.zeroSearches = [{ term: 'impermeabilizar terraza', count: 7 }, { term: 'abc', count: 1 }]
    const k = keys(f)
    expect(k).toContain('demand:impermeabilizar-terraza')
    expect(k.filter((x) => x.startsWith('demand:'))).toHaveLength(1)
  })

  it('reads Search Console: striking distance, low CTR and cannibalization', () => {
    const f = base()
    f.gsc = {
      days: 28,
      rows: [
        { query: 'plomero medellin', page: 'https://www.lohaggo.com/servicios/plomeria', clicks: 1, impressions: 120, ctr: 0.008, position: 12 },
        { query: 'plomero medellin', page: 'https://www.lohaggo.com/blog/plomero', clicks: 0, impressions: 60, ctr: 0, position: 14 },
        { query: 'destapar cañería', page: 'https://www.lohaggo.com/servicios/plomeria', clicks: 2, impressions: 200, ctr: 0.01, position: 4 },
      ],
    }
    const k = keys(f)
    expect(k).toContain('strike:plomero-medellin')
    expect(k).toContain('cannibal:plomero-medellin')
    expect(k).toContain('ctr:/servicios/plomeria')
  })

  it('ignores queries below the impressions threshold', () => {
    const f = base()
    f.gsc = { days: 28, rows: [{ query: 'rara', page: 'https://www.lohaggo.com/x', clicks: 0, impressions: 3, ctr: 0, position: 12 }] }
    expect(keys(f).some((x) => x.startsWith('strike:'))).toBe(false)
  })

  it('flags weak article metadata, thin and stale articles and missing links', () => {
    const f = base()
    f.articles = [{ slug: 'viejo', title: 'Guía vieja', publishedAt: new Date('2025-01-01'), updatedAt: new Date('2025-01-01'), words: 200, seoTitle: null, seoDescription: 'corta', category: null, tags: [], links: [], haystack: 'Guía vieja', bodyText: 'habla de plomería sin enlazar', views: 10 }]
    const k = keys(f)
    expect(k).toEqual(expect.arrayContaining(['stale:viejo', 'thin:viejo', 'meta:viejo', 'links:viejo']))
  })

  it('turns page-audit issues into technical findings (critical = high impact)', () => {
    const f = base()
    f.pages = [{ url: 'u', path: '/servicios/plomeria', status: 200, title: 'T', description: null, h1Count: 1, canonical: 'c', robots: 'noindex', jsonLd: [], imagesWithoutAlt: 0, words: 500, issues: [{ code: 'noindex_unexpected', severity: 'critical', message: 'Marcada noindex' }] }]
    const o = detectOpportunities(f, cfg).find((x) => x.dedupeKey === 'tech:/servicios/plomeria')
    expect(o?.impact).toBe('high')
  })

  it('suggests price pages for services with partners and demand but no page, and only those', () => {
    const f = base()
    expect(keys(f)).toContain('price:plomeria')
    f.pricePageSlugs = ['plomeria']
    expect(keys(f)).not.toContain('price:plomeria')
    expect(keys(f)).not.toContain('price:pintura')
  })

  it('suggests a real case when a service has enough good reviews and no case article', () => {
    expect(keys(base())).toContain('ugc:plomeria')
  })

  it('always offers the evergreen items, once, and sorts best first', () => {
    const list = detectOpportunities(base(), cfg)
    expect(list.filter((o) => o.dedupeKey === 'evergreen:gbp')).toHaveLength(1)
    for (let i = 1; i < list.length; i++) expect(list[i - 1].score).toBeGreaterThanOrEqual(list[i].score)
    expect(new Set(list.map((o) => o.dedupeKey)).size).toBe(list.length)
  })

  it('the team focus raises the score', () => {
    const plain = detectOpportunities(base(), cfg).find((o) => o.dedupeKey === 'gap:plomeria:medellin')!
    const focused = detectOpportunities(base(), sanitizeSeoConfig({ focus: { services: ['plomeria'] } })).find((o) => o.dedupeKey === 'gap:plomeria:medellin')!
    expect(focused.score).toBeGreaterThan(plain.score)
  })
})

describe('healthScore', () => {
  it('is 0–100 and drops with technical problems', () => {
    const f = base()
    const good = healthScore(f, []).score
    f.pages = [{ url: 'u', path: '/', status: 500, title: null, description: null, h1Count: 0, canonical: null, robots: null, jsonLd: [], imagesWithoutAlt: 0, words: 0, issues: [{ code: 'status', severity: 'critical', message: 'x' }] }]
    const bad = healthScore(f, []).score
    expect(bad).toBeLessThan(good)
    expect(bad).toBeGreaterThanOrEqual(0)
    expect(good).toBeLessThanOrEqual(100)
  })
})
