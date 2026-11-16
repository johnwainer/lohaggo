import { getPricesSafe, getCatalogSafe } from '@/lib/seo/data'
import { buildLlmsFullTxt, type LlmsService } from '@/lib/seo/llms'
import { getPublicTrustSafe, publicWhatsappPhone } from '@/lib/public/trust'
import { clientPayment, guarantee, verificationLong } from '@/lib/public/copy'
import { listArticles } from '@/lib/marketing/blog'
import { prisma } from '@/lib/prisma'
import { FOCUS_SERVICE_SLUGS, FOCUS_ZONE_KEYS, serviceFaq, serviceZonePath, typicalJobs } from '@/lib/public/serviceZones'
import { ZONES, zoneByKey } from '@/lib/geo/zones'
import { makeExcerpt } from '@/lib/marketing/seo'

export const revalidate = 86400

/** The long version of /llms.txt for AI assistants: services with jobs and prices, zones with neighborhoods, every guide with its summary, and the questions people ask. */
export async function GET() {
  const [trust, whatsappPhone, prices, catalog, articles, cities] = await Promise.all([
    getPublicTrustSafe(),
    publicWhatsappPhone().catch(() => null),
    getPricesSafe(),
    getCatalogSafe(),
    listArticles({ page: 1 }).then((r) => r.items).catch(() => []),
    prisma.cityConfig.findMany({ where: { status: 'ACTIVE' }, select: { slug: true, name: true } }).catch(() => []),
  ])
  const typical = new Map(prices?.items.map((p) => [p.slug, p.info.source === 'proposals' ? { low: p.info.low, high: p.info.high } : null]))
  const services: LlmsService[] = catalog
    .filter((s) => s.partners > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .map((s) => ({ name: s.name, slug: s.slug, category: s.category.name, from: s.from, range: typical.get(s.slug) ?? null }))
  const jobs = Object.fromEntries(FOCUS_SERVICE_SLUGS.map((s) => [s, typicalJobs(s)]).filter(([, j]) => (j as string[]).length))
  const first = catalog.find((s) => s.partners > 0 && s.slug === 'plomeria') ?? catalog.find((s) => s.partners > 0)
  const faq = first
    ? serviceFaq({ serviceName: first.name, basePrice: first.from, medellinPartners: first.partners, trust, hasWhatsapp: Boolean(whatsappPhone), zone: null }).map((f) => ({ q: f.q, a: f.a }))
    : []

  const body = buildLlmsFullTxt({
    services,
    cities: trust.stats.activeCities,
    verifiedPartners: trust.stats.verifiedPartners,
    whatsappPhone,
    guarantee: guarantee(trust),
    clientPayment: clientPayment(trust),
    verification: verificationLong(trust),
    articles: articles.filter((a) => a.slug).map((a) => ({ title: a.post.title, slug: a.slug as string, excerpt: (a.excerpt || a.seoDescription || makeExcerpt(a.body, 180)) })),
    zonePages: FOCUS_SERVICE_SLUGS.filter((slug) => services.some((s) => s.slug === slug)).flatMap((slug) => FOCUS_ZONE_KEYS.map((z) => ({ service: services.find((s) => s.slug === slug)!.name, zone: zoneByKey(z)?.name ?? z, path: serviceZonePath(slug, z) }))),
    cityPages: cities,
    jobs,
    zones: ZONES.map((z) => ({ name: z.name, kind: z.kind, barrios: z.barrios })),
    faq,
    updatedAt: new Date(),
  })

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
  })
}
