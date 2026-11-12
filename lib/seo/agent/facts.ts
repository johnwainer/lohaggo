/**
 * Gathers the facts the SEO rules read, from the platform's own data: catalog, supply and demand by city,
 * published articles, searches without results, partner profiles, Search Console and a technical read of
 * the public pages. Each source has its own fallback: one failing query leaves its part empty and is named
 * in `unavailable`, it never kills the cycle.
 */
import { prisma } from '@/lib/prisma'
import { getPricesSafe, PRICE_PAGE_LIMIT } from '@/lib/seo/data'
import { partnerIsIndexable } from '@/lib/seo/indexing'
import { stripMarkdown } from '@/lib/marketing/seo'
import type { SeoFacts } from '@/lib/seo/agent/audit-core'
import { fetchSearchConsole, type GscResult } from '@/lib/seo/agent/gsc'
import { auditPages } from '@/lib/seo/agent/page-audit'
import type { SeoConfig } from '@/lib/seo/agent/settings-core'

const DAY = 86_400_000

/** City enum value («MEDELLIN») from a CityConfig name («Medellín»), as the registration does. */
const cityEnum = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, '_')

const liveWhere = { channel: 'WEB' as const, webPublishedAt: { not: null, lte: new Date() }, slug: { not: null }, noindex: false, post: { status: { not: 'archived' } } }

function internalLinks(md: string): string[] {
  const out = new Set<string>()
  for (const m of Array.from(md.matchAll(/\]\((https?:\/\/(?:www\.)?lohaggo\.com)?(\/[^)\s#?]*)/gi))) out.add(m[2].replace(/\/$/, '') || '/')
  for (const m of Array.from(md.matchAll(/href=["'](?:https?:\/\/(?:www\.)?lohaggo\.com)?(\/[^"'#?]*)/gi))) out.add(m[1].replace(/\/$/, '') || '/')
  return Array.from(out)
}

export type GatheredFacts = { facts: SeoFacts; gsc: GscResult | null; unavailable: string[] }

export async function gatherFacts(config: SeoConfig, opts: { now?: Date; deadline?: number; withPages?: boolean } = {}): Promise<GatheredFacts> {
  const now = opts.now ?? new Date()
  const unavailable: string[] = []
  const safe = async <T,>(name: string, p: PromiseLike<T>, fallback: T): Promise<T> => {
    try { return await p } catch { unavailable.push(name); return fallback }
  }
  const since90 = new Date(now.getTime() - 90 * DAY)

  const [services, cities, requestsByService, requestsByCity, supplyRows, variants, zero, partners, prices, gscResult] = await Promise.all([
    safe('services', prisma.service.findMany({
      where: { slug: { not: 'lohaggo-ya' } },
      select: { id: true, slug: true, name: true, popular: true, category: { select: { name: true } }, _count: { select: { partners: { where: { active: true, partner: { verified: true, isActive: true } } } } } },
    }), []),
    safe('cities', prisma.cityConfig.findMany({ select: { slug: true, name: true, status: true } }), []),
    safe('requests', prisma.serviceRequest.groupBy({ by: ['serviceId'], where: { createdAt: { gte: since90 } }, _count: { _all: true } }), []),
    safe('requestsByCity', prisma.serviceRequest.groupBy({ by: ['serviceId', 'city'], where: { createdAt: { gte: since90 } }, _count: { _all: true } }), []),
    safe('supply', prisma.partnerService.groupBy({ by: ['serviceId', 'city'], where: { active: true, partner: { verified: true, isActive: true } }, _count: { _all: true } }), []),
    safe('articles', prisma.marketingPostVariant.findMany({
      where: { ...liveWhere, webPublishedAt: { not: null, lte: now } },
      orderBy: { webPublishedAt: 'desc' }, take: 150,
      select: { id: true, slug: true, body: true, seoTitle: true, seoDescription: true, category: true, tags: true, webPublishedAt: true, updatedAt: true, post: { select: { title: true, updatedAt: true } } },
    }), []),
    safe('zeroSearches', prisma.searchEvent.groupBy({ by: ['normalized'], where: { resultCount: 0, createdAt: { gte: since90 } }, _count: { _all: true }, orderBy: { _count: { normalized: 'desc' } }, take: 30 }), []),
    safe('partnerProfiles', prisma.partnerProfile.findMany({ where: { verified: true, isActive: true }, select: { totalReviews: true, bio: true, user: { select: { image: true } } }, take: 2000 }), []),
    safe('prices', getPricesSafe(), null),
    config.gsc.enabled ? fetchSearchConsole(config.gsc.siteUrl, 28, now).catch(() => null) : Promise.resolve(null),
  ])

  const views = variants.length
    ? await safe('views', prisma.webPageView.groupBy({ by: ['variantId'], where: { variantId: { in: variants.map((v) => v.id) } }, _sum: { views: true } }), [])
    : []
  const viewsBy = new Map(views.map((v) => [v.variantId, v._sum.views ?? 0]))

  const reviews = await safe('reviews', prisma.review.findMany({
    where: { clientToPartnerRating: { gte: 4 }, clientToPartnerComment: { not: null } },
    select: { clientToPartnerComment: true, booking: { select: { serviceId: true } } }, take: 3000,
  }), [])
  const goodBy = new Map<string, number>()
  const anyBy = new Map<string, number>()
  for (const r of reviews) {
    const id = r.booking?.serviceId
    if (!id) continue
    anyBy.set(id, (anyBy.get(id) ?? 0) + 1)
    if ((r.clientToPartnerComment ?? '').trim().length >= 20) goodBy.set(id, (goodBy.get(id) ?? 0) + 1)
  }

  const demandBy = new Map(requestsByService.map((r) => [r.serviceId, r._count._all]))
  const slugByService = new Map(services.map((s) => [s.id, s.slug]))
  const citySlugByEnum = new Map(cities.map((c) => [cityEnum(c.name), c.slug]))
  const demandByPair = new Map(requestsByCity.map((r) => [`${r.serviceId}:${r.city}`, r._count._all]))

  const facts: SeoFacts = {
    now,
    services: services.map((s) => ({ slug: s.slug, name: s.name.trim(), category: s.category?.name ?? '', partners: s._count.partners, popular: s.popular, requests90d: demandBy.get(s.id) ?? 0, reviews: anyBy.get(s.id) ?? 0, goodReviews: goodBy.get(s.id) ?? 0 })),
    cities: cities.map((c) => ({ slug: c.slug, name: c.name, status: String(c.status) })),
    supply: supplyRows.flatMap((r) => {
      const serviceSlug = slugByService.get(r.serviceId)
      const citySlug = citySlugByEnum.get(String(r.city))
      return serviceSlug && citySlug ? [{ serviceSlug, citySlug, partners: r._count._all, requests90d: demandByPair.get(`${r.serviceId}:${r.city}`) ?? 0 }] : []
    }),
    articles: variants.map((v) => {
      const text = stripMarkdown(v.body)
      return {
        slug: v.slug!, title: v.post.title, publishedAt: v.webPublishedAt!, updatedAt: new Date(Math.max(v.updatedAt.getTime(), v.post.updatedAt.getTime())),
        words: text ? text.split(' ').length : 0, seoTitle: v.seoTitle, seoDescription: v.seoDescription, category: v.category, tags: v.tags,
        links: internalLinks(v.body), haystack: [v.post.title, v.tags.join(' '), v.category ?? '', v.slug ?? '', v.seoTitle ?? ''].join(' '), bodyText: text, views: viewsBy.get(v.id) ?? 0,
      }
    }),
    zeroSearches: zero.map((z) => ({ term: z.normalized, count: z._count._all })),
    gsc: gscResult && gscResult.ok ? { rows: gscResult.rows, days: gscResult.days } : null,
    pages: [],
    pricePageSlugs: prices ? prices.items.slice(0, PRICE_PAGE_LIMIT).map((s) => s.slug) : [],
    thinPartnerProfiles: partners.filter((p) => !partnerIsIndexable({ totalReviews: p.totalReviews, bio: p.bio, image: p.user?.image })).length,
  }

  if (config.pageAudit.enabled && opts.withPages !== false) {
    const active = facts.cities.filter((c) => c.status === 'ACTIVE').map((c) => `/ciudad/${c.slug}`)
    const top = [...facts.services].filter((s) => s.partners > 0).sort((a, b) => b.requests90d - a.requests90d || Number(b.popular) - Number(a.popular)).map((s) => `/servicios/${s.slug}`)
    const paths = Array.from(new Set(['/', '/servicios', '/precios', '/blog', ...active, ...top.slice(0, 12), ...facts.pricePageSlugs.slice(0, 6).map((s) => `/precios/${s}`), ...facts.articles.slice(0, 10).map((a) => `/blog/${a.slug}`)])).slice(0, config.pageAudit.maxPages)
    facts.pages = await safe('pageAudit', auditPages(paths, opts.deadline), [])
  }
  return { facts, gsc: gscResult, unavailable }
}
