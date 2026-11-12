import { cache } from 'react'
import { prisma } from '@/lib/prisma'

export type PublicCity = {
  name: string
  slug: string
  status: string
  latitude: number | null
  longitude: number | null
  launchDate: Date | null
}

/** The city of /ciudad/[slug], or null when it doesn't exist (the page answers 404, not a soft 404). */
export const loadCity = cache(async (slug: string): Promise<PublicCity | null> => {
  try {
    return await prisma.cityConfig.findUnique({
      where: { slug },
      select: { name: true, slug: true, status: true, latitude: true, longitude: true, launchDate: true },
    })
  } catch {
    return null
  }
})

/** Prisma `City` enum value of a city slug («medellin» → MEDELLIN); null when it isn't one. */
export function cityEnumOf(slug: string): 'MEDELLIN' | 'BOGOTA' | 'CALI' | 'BARRANQUILLA' | null {
  const v = slug.toUpperCase()
  return v === 'MEDELLIN' || v === 'BOGOTA' || v === 'CALI' || v === 'BARRANQUILLA' ? v : null
}
