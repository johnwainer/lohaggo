import type { City } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { evaluateLaunch } from '@/lib/cities/launch-core'

const CITY_ENUMS: City[] = ['MEDELLIN', 'BOGOTA', 'CALI', 'BARRANQUILLA']

/** The City enum of a CityConfig slug (bogota → BOGOTA); null for cities the enum does not have yet. */
export function cityEnumOfSlug(slug: string): City | null {
  const up = slug.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/-/g, '_').toUpperCase()
  return CITY_ENUMS.includes(up as City) ? (up as City) : null
}

/** Readiness of a city to open (see launch-core). */
export async function cityLaunchStatus(slug: string) {
  const config = await prisma.cityConfig.findUnique({ where: { slug }, select: { name: true, status: true } })
  if (!config) return null
  const city = cityEnumOfSlug(slug)
  const [services, verifiedPartners, waitlist] = await Promise.all([
    city
      ? prisma.service.findMany({
          select: { slug: true, name: true, partners: { where: { active: true, city, partner: { verified: true, isActive: true } }, select: { id: true } } },
        })
      : Promise.resolve([] as Array<{ slug: string; name: string; partners: Array<{ id: string }> }>),
    city ? prisma.partnerProfile.count({ where: { city, verified: true, isActive: true } }) : Promise.resolve(0),
    prisma.cityWaitlist.groupBy({ by: ['role'], where: { citySlug: slug, notifiedAt: null }, _count: { _all: true } }).catch(() => []),
  ])
  const withWhatsapp = await prisma.cityWaitlist.count({ where: { citySlug: slug, notifiedAt: null, phone: { not: null } } }).catch(() => 0)
  const evaluation = evaluateLaunch({
    city: config.name,
    partnersByService: services.map((s) => ({ slug: s.slug, name: s.name, verified: s.partners.length })),
    totalVerified: verifiedPartners,
    waitlist: {
      clients: waitlist.find((w) => w.role === 'client')?._count._all ?? 0,
      partners: waitlist.find((w) => w.role === 'partner')?._count._all ?? 0,
      withWhatsapp,
    },
  })
  return { slug, status: config.status, supported: Boolean(city), ...evaluation }
}
