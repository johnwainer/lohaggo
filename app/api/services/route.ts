import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { expandSearchTerms, calculateRelevanceScore, normalizeSearchTerm, getSuggestions } from "@/lib/searchSynonyms"
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
          select: { partners: true }
        }
      },
      orderBy: [
        { popular: "desc" },
        { name: "asc" }
      ]
    })

    if (search) {
      const normalizedSearch = normalizeSearchTerm(search)
      const expandedTerms = expandSearchTerms(search)

      const filteredServices = services.filter(service => {
        const name = normalizeSearchTerm(service.name)
        const description = normalizeSearchTerm(service.description)
        const categoryName = normalizeSearchTerm(service.category.name)

        if (name.includes(normalizedSearch) ||
            description.includes(normalizedSearch) ||
            categoryName.includes(normalizedSearch)) {
          return true
        }

        if (normalizedSearch.length >= 3) {
          if (name.startsWith(normalizedSearch) ||
              categoryName.startsWith(normalizedSearch)) {
            return true
          }
        }

        return expandedTerms.some(term => {
          const normalizedTerm = normalizeSearchTerm(term)
          return name.includes(normalizedTerm) ||
                 description.includes(normalizedTerm) ||
                 categoryName.includes(normalizedTerm)
        })
      })

      const servicesWithScore = filteredServices.map(service => ({
        ...service,
        relevanceScore: calculateRelevanceScore(service, search)
      }))

      services = servicesWithScore
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .map(({ relevanceScore, ...service }) => service)

      if (services.length === 0) {
        const allServices = await prisma.service.findMany({
          include: {
            category: true,
            _count: {
              select: { partners: true }
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
          suggestions: {
            didYouMean: suggestions.didYouMean,
            popularServices: suggestions.popularServices,
            similarServices: suggestions.similarServices
          }
        })
      }
    }

    return NextResponse.json({ services, suggestions: null })
  } catch (error) {
    logger.error('Error fetching services:', error || undefined)
    return NextResponse.json(
      { error: "Error al obtener servicios" },
      { status: 500 }
    )
  }
}
