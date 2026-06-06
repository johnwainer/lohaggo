import { NextResponse } from "next/server"
import { queryServices } from "@/lib/services/queryServices"
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const logger = createLogger('services')

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const popular = searchParams.get("popular")
    const search = searchParams.get("search")
    const citySlug = searchParams.get('city') || 'medellin'

    const result = await queryServices({ category, popular, search, citySlug })

    const response = NextResponse.json(result)

    // The default (no search/category) listing is identical for all anonymous
    // visitors of a city → let the CDN serve it for a few seconds and revalidate
    // in the background. This collapses the repeated cold fetches that were
    // making the home spinner linger.
    if (!search && !category) {
      response.headers.set('Cache-Control', 's-maxage=30, stale-while-revalidate=120')
    }

    return response
  } catch (error) {
    logger.error('Error fetching services:', error)
    return NextResponse.json(
      { error: "Error al cargar los servicios" },
      { status: 500 }
    )
  }
}
