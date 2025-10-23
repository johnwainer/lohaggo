import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { expandSearchTerms, calculateRelevanceScore } from "@/lib/searchSynonyms"

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
      const expandedTerms = expandSearchTerms(search)

      const filteredServices = services.filter(service => {
        const name = service.name.toLowerCase()
        const description = service.description.toLowerCase()
        const categoryName = service.category.name.toLowerCase()
        const searchLower = search.toLowerCase()

        if (name.includes(searchLower) ||
            description.includes(searchLower) ||
            categoryName.includes(searchLower)) {
          return true
        }

        return expandedTerms.some(term =>
          name.includes(term) ||
          description.includes(term) ||
          categoryName.includes(term)
        )
      })

      const servicesWithScore = filteredServices.map(service => ({
        ...service,
        relevanceScore: calculateRelevanceScore(service, search)
      }))

      services = servicesWithScore
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .map(({ relevanceScore, ...service }) => service)
    }

    return NextResponse.json(services)
  } catch (error) {
    console.error("Error fetching services:", error)
    return NextResponse.json(
      { error: "Error al obtener servicios" },
      { status: 500 }
    )
  }
}
