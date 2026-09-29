import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { sitemapArticles } from '@/lib/marketing/blog'
import { focusPairs, serviceZonePath } from '@/lib/public/serviceZones'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.lohaggo.com'

const staticPages: MetadataRoute.Sitemap = [
  {
    url: baseUrl,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 1,
  },
  {
    url: `${baseUrl}/servicios`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.9,
  },
  {
    url: `${baseUrl}/about`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.7,
  },
  {
    url: `${baseUrl}/how-it-works`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.8,
  },
  {
    url: `${baseUrl}/garantia`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.7,
  },
  {
    url: `${baseUrl}/unete`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.8,
  },
  {
    url: `${baseUrl}/contact`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.6,
  },
  {
    url: `${baseUrl}/faq`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.6,
  },
  {
    url: `${baseUrl}/privacy`,
    lastModified: new Date(),
    changeFrequency: 'yearly',
    priority: 0.3,
  },
  {
    url: `${baseUrl}/terms`,
    lastModified: new Date(),
    changeFrequency: 'yearly',
    priority: 0.3,
  },
  {
    url: `${baseUrl}/cookies`,
    lastModified: new Date(),
    changeFrequency: 'yearly',
    priority: 0.3,
  },
  {
    url: `${baseUrl}/download/android`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.7,
  },
  {
    url: `${baseUrl}/download/ios`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.7,
  },
  ]

try {
  const [services, cities, partners, articles] = await Promise.all([
    prisma.service.findMany({
      select: {
        slug: true,
        updatedAt: true,
        partners: { where: { active: true, partner: { verified: true, isActive: true } }, select: { id: true }, take: 1 },
      },
    }),
    prisma.cityConfig.findMany({ where: { status: { in: ['ACTIVE', 'COMING_SOON'] } }, select: { slug: true, updatedAt: true } }),
    prisma.partnerProfile.findMany({
        where: { isPublicProfile: true, isActive: true, verified: true, slug: { not: null } },
        select: { slug: true, updatedAt: true, totalReviews: true, services: { where: { active: true }, select: { id: true }, take: 1 } },    }),
    sitemapArticles().catch(() => []),
    ])

  const servicePages: MetadataRoute.Sitemap = services
  .filter((s) => s.partners.length > 0)
  .map((s) => ({
    url: `${baseUrl}/servicios/${s.slug}`,
    lastModified: s.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.85,
  }))

  // Service × zone landings, only for services with verified partners (same rule as the service pages)
  const withPartners = new Map(services.filter((s) => s.partners.length > 0).map((s) => [s.slug, s.updatedAt]))
  const zonePages: MetadataRoute.Sitemap = focusPairs()
    .filter((p) => withPartners.has(p.slug))
    .map((p) => ({
      url: `${baseUrl}${serviceZonePath(p.slug, p.zona)}`,
      lastModified: withPartners.get(p.slug),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))

  const cityPages: MetadataRoute.Sitemap = cities.map((c) => ({
    url: `${baseUrl}/ciudad/${c.slug}`,
    lastModified: c.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.75,
  }))

  const partnerPages: MetadataRoute.Sitemap = partners
      .filter((p) => p.slug && (p.totalReviews > 0 || p.services.length > 0))
    .map((p) => ({
    url: `${baseUrl}/pro/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  // Blog: the index plus every published, indexable article
  const blogPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/blog`, lastModified: articles[0]?.updatedAt ?? new Date(), changeFrequency: 'daily', priority: 0.7 },
    ...articles.filter((a) => a.slug).map((a) => ({ url: `${baseUrl}/blog/${a.slug}`, lastModified: a.updatedAt, changeFrequency: 'monthly' as const, priority: 0.65 })),
  ]

  // One entry per URL (a /pro slug or a blog slug can't repeat, but never let the sitemap list one twice)
  const seen = new Set<string>()
  return [...staticPages, ...servicePages, ...zonePages, ...cityPages, ...partnerPages, ...blogPages].filter((e) => !seen.has(e.url) && seen.add(e.url))
} catch (error) {
  console.error('Error generating sitemap:', error)
  return staticPages
}
}
