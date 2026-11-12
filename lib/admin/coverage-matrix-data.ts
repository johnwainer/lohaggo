import { prisma } from '@/lib/prisma'
import { buildCoverageMatrix, type CoveragePartner, type CoverageRequest } from '@/lib/admin/coverage-matrix'
import { zoneName } from '@/lib/geo/zones'
import { enhancedSearch } from '@/lib/searchSynonyms'
import { catalogGaps } from '@/lib/admin/catalog-gaps'

const DAY = 86_400_000

export async function loadCoverage(now = new Date()) {
  const since = new Date(now.getTime() - 90 * DAY)
  const [reqs, offers] = await Promise.all([
    prisma.serviceRequest.findMany({
      where: { createdAt: { gte: since } },
      select: { serviceId: true, city: true, zone: true, createdAt: true, status: true, service: { select: { name: true } }, _count: { select: { proposals: true } } },
      take: 20000,
    }),
    prisma.partnerService.findMany({
      where: { active: true, partner: { verified: true, isActive: true, user: { isActive: true } } },
      select: { serviceId: true, city: true, service: { select: { name: true } }, partner: { select: { coverageZones: true } } },
      take: 30000,
    }),
  ])
  const requests: CoverageRequest[] = reqs.map((r) => ({ serviceId: r.serviceId, serviceName: r.service.name, city: r.city, zone: r.zone, createdAt: r.createdAt, proposals: r._count.proposals, status: r.status }))
  const partners: CoveragePartner[] = offers.map((o) => ({ serviceId: o.serviceId, serviceName: o.service.name, city: o.city, zones: o.partner.coverageZones }))
  const rows = buildCoverageMatrix(requests, partners, now).map((r) => ({ ...r, zones: r.zones.map((z) => ({ ...z, label: z.zone === 'sin zona' ? 'Sin zona' : zoneName(z.zone) ?? z.zone })) }))

  // Searches that found nothing and the catalogue could not interpret either: services that may be missing
  const [zero, services] = await Promise.all([
    prisma.searchEvent.groupBy({ by: ['normalized'], where: { resultCount: 0, createdAt: { gte: since } }, _count: { _all: true }, orderBy: { _count: { normalized: 'desc' } }, take: 80 }),
    prisma.service.findMany({ select: { id: true, name: true, slug: true, description: true, category: { select: { name: true, slug: true } } }, take: 500 }),
  ])
  const catalog = services.map((s) => ({ ...s, partnerStats: { availableCount: 1, avgRating: 0 }, _count: { partners: 1 } }))
  const missing = catalogGaps(zero.map((z) => ({ q: z.normalized, n: z._count._all })), (q) => enhancedSearch(catalog as never, q).results.length)

  return { rows, missing, generatedAt: now.toISOString() }
}
