import { prisma } from "@/lib/prisma"
import { enhancedSearch, getSuggestions } from "@/lib/searchSynonyms"
import type { City } from '@prisma/client'

/**
 * Shared services-listing logic used by both the public API route
 * (`/api/services`) and the server-rendered home page so the first
 * paint can include real cards (SSR) with no spinner / layout shift.
 */

function normalizeCityEnum(cityName: string): City {
  return cityName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '_') as City
}

function enrichPartnerStats<T extends {
  partners: Array<{
    partner: {
      rating: number
      documents: Array<{ type: string; status: string }>
    }
  }>
}>(services: T[]) {
  return services.map((service) => {
    const availableCount = service.partners.length
    const avgRating = availableCount > 0
      ? Number(
          (
            service.partners.reduce((acc, item) => acc + (item.partner.rating || 0), 0) / availableCount
          ).toFixed(1)
        )
      : 0

    return {
      ...service,
      partnerStats: {
        availableCount,
        avgRating,
      },
      _count: {
        ...((('_count' in service ? (service as any)._count : {}) as Record<string, unknown>)),
        partners: availableCount,
      },
    }
  })
}

export interface ServicesQuery {
  category?: string | null
  popular?: string | null
  search?: string | null
  citySlug?: string | null
}

export interface ServicesResult {
  services: any[]
  relatedByCategory: any[]
  topMatch: any | null
  suggestions: {
    didYouMean: string[]
    popularServices: any[]
    similarServices: any[]
  } | null
}

export async function queryServices({
  category,
  popular,
  search,
  citySlug = 'medellin',
}: ServicesQuery): Promise<ServicesResult> {
  // Global visibility flags + city config resolved in parallel (one round-trip).
  const [flagPartnerCount, flagAvgRating, cityRecord] = await Promise.all([
    prisma.featureFlag.findUnique({ where: { key: 'show_partner_count' } }),
    prisma.featureFlag.findUnique({ where: { key: 'show_avg_rating' } }),
    prisma.cityConfig.findUnique({ where: { slug: citySlug || 'medellin' } }),
  ])
  const globalShowPartnerCount = flagPartnerCount ? flagPartnerCount.enabled : true
  const globalShowAvgRating = flagAvgRating ? flagAvgRating.enabled : true

  const where: any = {}
  if (category) where.category = { slug: category }
  if (popular === "true") where.popular = true

  const cityEnum = cityRecord ? normalizeCityEnum(cityRecord.name) : null

  const serviceQueryInclude = {
    category: true,
    _count: {
      select: { partners: true, bookings: true },
    },
    partners: {
      where: {
        active: true,
        partner: {
          isActive: true,
          verified: true,
          ...(cityEnum ? { city: cityEnum } : {}),
        },
      },
      include: {
        partner: {
          select: {
            rating: true,
            documents: {
              where: { status: 'APPROVED' },
              select: { type: true, status: true },
            },
          },
        },
      },
    },
  } as const

  const applyGlobalFlags = <T extends { showPartnerCount?: boolean; showAvgRating?: boolean }>(items: T[]): T[] =>
    items.map(s => ({
      ...s,
      showPartnerCount: globalShowPartnerCount ? (s.showPartnerCount ?? true) : false,
      showAvgRating: globalShowAvgRating ? (s.showAvgRating ?? true) : false,
    }))

  const servicesRaw = await prisma.service.findMany({
    where,
    include: serviceQueryInclude,
    orderBy: [
      { popular: "desc" },
      { name: "asc" },
    ],
  })
  const services = applyGlobalFlags(enrichPartnerStats(servicesRaw))

  if (search) {
    const searchResult = enhancedSearch(services, search)

    if (searchResult.results.length === 0) {
      const allServicesRaw = await prisma.service.findMany({
        include: serviceQueryInclude,
        orderBy: [
          { popular: "desc" },
          { name: "asc" },
        ],
      })
      const allServices = applyGlobalFlags(enrichPartnerStats(allServicesRaw))
      const suggestions = getSuggestions(search, allServices)

      return {
        services: [],
        relatedByCategory: [],
        topMatch: null,
        suggestions: {
          didYouMean: suggestions.didYouMean,
          popularServices: suggestions.popularServices,
          similarServices: suggestions.similarServices,
        },
      }
    }

    return {
      services: searchResult.results,
      relatedByCategory: searchResult.relatedByCategory,
      topMatch: searchResult.topMatch,
      suggestions: null,
    }
  }

  return {
    services,
    relatedByCategory: [],
    topMatch: null,
    suggestions: null,
  }
}
