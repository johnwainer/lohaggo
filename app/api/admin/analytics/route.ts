import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { createLogger } from '@/lib/logger'
import { parsePeriod } from '@/lib/analytics/core'
import { business, cleanFilters, filterOptions, funnelTab, peopleTab, searchTab, serviceTab, supplyTab } from '@/lib/analytics/queries'
import { Ga4Error, trafficTab } from '@/lib/analytics/ga4'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const logger = createLogger('admin-analytics')

const TABS = {
  business: business,
  funnel: funnelTab,
  supply: supplyTab,
  people: peopleTab,
  service: serviceTab,
  search: searchTab,
} as const

/** One tab of Analítica for a period (preset or from/to) with optional city and category filters. */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const sp = request.nextUrl.searchParams
  const tab = sp.get('tab') || 'business'
  const period = parsePeriod({ preset: sp.get('preset'), from: sp.get('from'), to: sp.get('to') })
  const filters = cleanFilters(sp.get('city'), sp.get('categoryId'))
  try {
    if (tab === 'options') return NextResponse.json(await filterOptions())
    if (tab === 'traffic') return NextResponse.json({ period, data: await trafficTab(period) })
    const fn = TABS[tab as keyof typeof TABS]
    if (!fn) return NextResponse.json({ error: 'Pestaña no válida' }, { status: 400 })
    return NextResponse.json({ period, data: await fn(period, filters) })
  } catch (err) {
    if (err instanceof Ga4Error) return NextResponse.json({ error: err.message }, { status: 422 })
    logger.error('Analytics failed', { tab, err: err instanceof Error ? err.message : err })
    return NextResponse.json({ error: 'No se pudo calcular esta vista' }, { status: 500 })
  }
}
