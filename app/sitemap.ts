import { MetadataRoute } from 'next'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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
  const [services, cities, partners] = await Promise.all([
    prisma.service.findMany({
      select: {
        slug: true,
        updatedAt: true,
        partners: { where: { active: true }, select: { id: true }, take: 1 },
      },
    }),
    prisma.cityConfig.findMany({ select: { slug: true, updatedAt: true } }),
    prisma.partnerProfile.findMany({
        where: { isPublicProfile: true, isActive: true, slug: { not: null } },
        select: { slug: true, updatedAt: true, totalReviews: true, services: { where: { active: true }, select: { id: true }, take: 1 } },    }),
    ])

  const servicePages: MetadataRoute.Sitemap = services
  .filter((s) => s.partners.length > 0)
  .map((s) => ({
    url: `${baseUrl}/servicios/${s.slug}`,
    lastModified: s.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.85,
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

  await prisma.$disconnect()

  return [...staticPages, ...servicePages, ...cityPages, ...partnerPages]
} catch (error) {
  console.error('Error generating sitemap:', error)
  await prisma.$disconnect()
  return staticPages
}
}
