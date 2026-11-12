/**
 * Datos de servidor para las páginas públicas de SEO: catálogo agrupado por categoría y precios de
 * referencia calculados con las propuestas reales de los socios (cache de un día).
 */
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { resolvePriceInfo, type PriceInfo } from '@/lib/seo/prices'

const VERIFIED = { active: true, partner: { verified: true, isActive: true } }

export type CatalogService = {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  from: number
  partners: number
  popular: boolean
  category: { name: string; slug: string; order: number }
}

async function loadCatalog(): Promise<CatalogService[]> {
  const rows = await prisma.service.findMany({
    where: { slug: { not: 'lohaggo-ya' } },
    select: {
      id: true, name: true, slug: true, description: true, icon: true, basePrice: true, popular: true,
      category: { select: { name: true, slug: true, order: true } },
      _count: { select: { partners: { where: VERIFIED } } },
    },
    orderBy: { name: 'asc' },
  })
  return rows.map((r) => ({
    id: r.id, name: r.name, slug: r.slug, description: r.description, icon: r.icon,
    from: r.basePrice, partners: r._count.partners, popular: r.popular, category: r.category,
  }))
}

/** Todo el catálogo (con y sin socios hoy); cache de una hora. */
export const getCatalog = unstable_cache(loadCatalog, ['seo-catalog-v1'], { revalidate: 3600 })

export async function getCatalogSafe(): Promise<CatalogService[]> {
  try {
    return await getCatalog()
  } catch {
    return []
  }
}

export type CategoryGroup = { name: string; slug: string; services: CatalogService[] }

/** Agrupa por categoría respetando el orden de la categoría y luego el alfabético. */
export function groupByCategory(services: CatalogService[]): CategoryGroup[] {
  const map = new Map<string, CategoryGroup & { order: number }>()
  for (const s of services) {
    const g = map.get(s.category.slug) ?? { name: s.category.name, slug: s.category.slug, order: s.category.order, services: [] }
    g.services.push(s)
    map.set(s.category.slug, g)
  }
  return Array.from(map.values())
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es'))
    .map(({ order: _o, ...g }) => ({ ...g, services: g.services.sort((a, b) => a.name.localeCompare(b.name, 'es')) }))
}

/** Cuántos servicios tienen página propia en /precios/[servicio] (los principales primero). */
export const PRICE_PAGE_LIMIT = 12

export type ServicePrice = CatalogService & { info: PriceInfo }

async function loadPrices(): Promise<{ items: ServicePrice[]; updatedAt: string }> {
  const since = new Date(Date.now() - 365 * 24 * 3600 * 1000)
  const [catalog, proposals] = await Promise.all([
    loadCatalog(),
    prisma.proposal.findMany({
      where: { price: { gt: 0 }, createdAt: { gte: since } },
      select: { price: true, serviceRequest: { select: { serviceId: true } } },
      take: 50000,
    }),
  ])
  const byService = new Map<string, number[]>()
  for (const p of proposals) {
    const id = p.serviceRequest.serviceId
    const arr = byService.get(id)
    if (arr) arr.push(p.price)
    else byService.set(id, [p.price])
  }
  const items = catalog
    .filter((s) => s.partners > 0)
    .map((s) => ({ ...s, info: resolvePriceInfo(byService.get(s.id) ?? [], s.from) }))
    .sort((a, b) => Number(b.popular) - Number(a.popular) || b.partners - a.partners || a.name.localeCompare(b.name, 'es'))
  return { items, updatedAt: new Date().toISOString() }
}

/** Precios de referencia de los servicios con socios; cache de un día. */
export const getPrices = unstable_cache(loadPrices, ['seo-prices-v1'], { revalidate: 86400 })

export async function getPricesSafe(): Promise<{ items: ServicePrice[]; updatedAt: Date } | null> {
  try {
    const r = await getPrices()
    return { items: r.items, updatedAt: new Date(r.updatedAt) }
  } catch {
    return null
  }
}

/** Socios verificados con al menos una reseña de un servicio (para enlazar a /pro). */
export async function reviewedPartnersOfService(serviceId: string, take = 6) {
  return prisma.partnerProfile.findMany({
    where: {
      isPublicProfile: true, isActive: true, verified: true, slug: { not: null }, totalReviews: { gte: 1 },
      services: { some: { serviceId, active: true } },
    },
    orderBy: [{ rating: 'desc' }, { totalReviews: 'desc' }],
    take,
    select: {
      slug: true, rating: true, totalReviews: true, profileHeadline: true, companyName: true, isCompany: true,
      user: { select: { name: true, image: true } },
    },
  })
}
