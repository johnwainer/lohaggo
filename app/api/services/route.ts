import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { enhancedSearch, normalizeSearchTerm, getSuggestions } from "@/lib/searchSynonyms"
import { createLogger } from '@/lib/logger'
import type { City } from '@prisma/client'

export const dynamic = 'force-dynamic'


const logger = createLogger('services')

const IDENTITY_TYPES = ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE']

function normalizeCityEnum(cityName: string): City {
  return cityName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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
    const qualifiedPartners = service.partners.filter((partnerService) => {
      const documents = partnerService.partner.documents || []
      const hasIdentityDoc = documents.some((doc) => IDENTITY_TYPES.includes(doc.type))
      const hasBackgroundCheck = documents.some((doc) => doc.type === 'ANTECEDENTES')
      return hasIdentityDoc && hasBackgroundCheck
    })

    const availableCount = qualifiedPartners.length
    const avgRating = availableCount > 0
      ? Number(
          (
            qualifiedPartners.reduce((acc, item) => acc + (item.partner.rating || 0), 0) / availableCount
          ).toFixed(1)
        )
      : 0

    return {
      ...service,
      useCategories: ((service as any).useCategories || []).map((entry: any) => entry.useCategory),
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const useCategory = searchParams.get("useCategory")
    const popular = searchParams.get("popular")
    const search = searchParams.get("search")
    const citySlug = searchParams.get('city') || 'medellin'

    const where: any = {}

    if (category) {
      where.category = { slug: category }
    }

    if (useCategory) {
      where.useCategories = {
        some: {
          useCategory: {
            slug: useCategory,
            isActive: true,
          },
        },
      }
    }

    if (popular === "true") {
      where.popular = true
    }

    const cityRecord = await prisma.cityConfig.findUnique({
      where: { slug: citySlug }
    })

    const cityEnum = cityRecord ? normalizeCityEnum(cityRecord.name) : null

    const serviceQueryInclude = {
      category: true,
      _count: {
        select: { partners: true, bookings: true }
      },
      partners: {
        where: {
          active: true,
          ...(cityEnum
            ? {
                partner: {
                  city: cityEnum,
                  isActive: true,
                },
              }
            : {
                partner: {
                  isActive: true,
                },
              }),
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
      useCategories: {
        where: {
          useCategory: {
            isActive: true,
          },
        },
        select: {
          useCategory: {
            select: {
              id: true,
              name: true,
              slug: true,
              icon: true,
            },
          },
        },
      },
    } as const

    let servicesRaw = await prisma.service.findMany({
      where,
      include: serviceQueryInclude,
      orderBy: [
        { popular: "desc" },
        { name: "asc" }
      ]
    })
    let services = enrichPartnerStats(servicesRaw)

    if (search) {
      const searchResult = enhancedSearch(services, search)

      if (searchResult.results.length === 0) {
        const allServicesRaw = await prisma.service.findMany({
          include: serviceQueryInclude,
          orderBy: [
            { popular: "desc" },
            { name: "asc" }
          ]
        })
        const allServices = enrichPartnerStats(allServicesRaw)

        const suggestions = getSuggestions(search, allServices)

        return NextResponse.json({
          services: [],
          relatedByCategory: [],
          topMatch: null,
          suggestions: {
            didYouMean: suggestions.didYouMean,
            popularServices: suggestions.popularServices,
            similarServices: suggestions.similarServices
          }
        })
      }

      return NextResponse.json({
        services: searchResult.results,
        relatedByCategory: searchResult.relatedByCategory,
        topMatch: searchResult.topMatch,
        suggestions: null
      })
    }

    return NextResponse.json({
      services,
      relatedByCategory: [],
      topMatch: null,
      suggestions: null
    })
  } catch (error) {
    logger.error('Error fetching services:', error)
    return NextResponse.json(
      { error: "Error al cargar los servicios" },
      { status: 500 }
    )
  }
}
