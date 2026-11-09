import { randomUUID } from 'crypto'
import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { queryServices } from "@/lib/services/queryServices"
import { createLogger } from '@/lib/logger'
import { VISITOR_COOKIE } from '@/lib/analytics/acquisition'
import { recordSearch, searchAllowed } from '@/lib/analytics/search-log'

export const dynamic = 'force-dynamic'

const logger = createLogger('services')

export async function GET(request: NextRequest) {
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

    // A finished search of the catalogue (track=1; autocomplete does not send it) is recorded here, where
    // the results are known, for Analítica: visitors included, zero results included
    const ip = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (search && searchParams.get('track') === '1' && searchAllowed(`svc:${ip}`)) {
      let visitorId = request.cookies.get(VISITOR_COOKIE)?.value
      const newVisitor = !visitorId || !/^[a-f0-9-]{36}$/.test(visitorId)
      if (newVisitor) visitorId = randomUUID()
      const session = await getServerSession(authOptions).catch(() => null)
      const source = searchParams.get('source') === 'home' ? 'home' : 'servicios'
      await recordSearch({ query: search, resultCount: result.services.length, source, userId: session?.user?.id ?? null, visitorId, role: session?.user?.role ?? null, city: citySlug })
      if (newVisitor) response.cookies.set(VISITOR_COOKIE, visitorId!, { maxAge: 365 * 86400, path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production', httpOnly: true })
      response.headers.set('Cache-Control', 'private, no-store')
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
