import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'

export type TopService = { name: string; slug: string; partners: number }

/** Services with the most verified, active partners (only those with at least one), cached 1 hour. */
async function loadTopServices(limit: number): Promise<TopService[]> {
  const rows = await prisma.service.findMany({
    where: { partners: { some: { active: true, partner: { verified: true, isActive: true } } } },
    select: {
      name: true,
      slug: true,
      _count: { select: { partners: { where: { active: true, partner: { verified: true, isActive: true } } } } },
    },
  })
  return rows
    .map((r) => ({ name: r.name, slug: r.slug, partners: r._count.partners }))
    .filter((r) => r.slug !== 'lohaggo-ya')
    .sort((a, b) => b.partners - a.partners || a.name.localeCompare(b.name, 'es'))
    .slice(0, limit)
}

const cached = unstable_cache(loadTopServices, ['public-top-services-v1'], { revalidate: 3600 })

/** Never throws: an empty list just hides the links. */
export async function getTopServicesSafe(limit = 6): Promise<TopService[]> {
  try {
    return await cached(limit)
  } catch {
    return []
  }
}
