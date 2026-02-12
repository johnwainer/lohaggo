import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { enhancedSearch, normalizeSearchTerm, getSuggestions } from "@/lib/searchSynonyms"
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'


const logger = createLogger('services')

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const popular = searchParams.get("popular")
    const search = searchParams.get("search")

    const where: any = {}

    if (category) {
      where.category = { slug: category }
    }

    if (popular === "true") {
      where.popular = true
    }

    let services = await prisma.service.findMany({
      where,
      include: {
        category: true,
        _count: {
          select: { partners: true, bookings: true }
        }
      },
      orderBy: [
        { popular: "desc" },
        { name: "asc" }
      ]
    })

    if (search) {
      const searchResult = enhancedSearch(services, search)

      if (searchResult.results.length === 0) {
        const allServices = await prisma.service.findMany({
          include: {
            category: true,
            _count: {
              select: { partners: true, bookings: true }
            }
          },
          orderBy: [
            { popular: "desc" },
            { name: "asc" }
          ]
        })

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
