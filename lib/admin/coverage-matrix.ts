/** «Cobertura»: demand vs supply per service × city × zone over 30 and 90 days. Pure (the loader is in coverage-matrix-data.ts). */

export type CoverageRequest = { serviceId: string; serviceName: string; city: string; zone: string | null; createdAt: Date; proposals: number; status: string }
/** A verified, active partner offering the service in the city; `zones` empty = covers the whole city */
export type CoveragePartner = { serviceId: string; serviceName: string; city: string; zones: string[] }

export type GapKind = 'no_supply' | 'low_response' | 'no_demand' | 'balanced'

export type CoverageZoneRow = { zone: string; requests90: number; requests30: number; partners: number }
export type CoverageRow = {
  serviceId: string
  serviceName: string
  city: string
  requests30: number
  requests90: number
  /** Share (0-100) of the last 30 days' requests that got at least one proposal; null without requests */
  proposalPct30: number | null
  expired30: number
  expired90: number
  partners: number
  gap: GapKind
  zones: CoverageZoneRow[]
}

const DAY = 86_400_000
export const GAP_RULES = {
  /** 90-day requests with nobody offering the service in the city */
  noSupplyMinRequests: 1,
  /** Fewer than this share of requests get proposals (30 d), with at least minRequests */
  lowResponsePct: 40,
  lowResponseMinRequests: 3,
  /** Partners offering it with not one request in 90 days */
  noDemandMinPartners: 3,
} as const

export function classifyGap(p: { requests30: number; requests90: number; proposalPct30: number | null; partners: number }): GapKind {
  if (p.requests90 >= GAP_RULES.noSupplyMinRequests && p.partners === 0) return 'no_supply'
  if (p.requests30 >= GAP_RULES.lowResponseMinRequests && p.proposalPct30 !== null && p.proposalPct30 < GAP_RULES.lowResponsePct) return 'low_response'
  if (p.requests90 === 0 && p.partners >= GAP_RULES.noDemandMinPartners) return 'no_demand'
  return 'balanced'
}

const GAP_ORDER: Record<GapKind, number> = { no_supply: 0, low_response: 1, no_demand: 2, balanced: 3 }

export function buildCoverageMatrix(requests: CoverageRequest[], partners: CoveragePartner[], now = new Date()): CoverageRow[] {
  const t30 = now.getTime() - 30 * DAY
  const t90 = now.getTime() - 90 * DAY
  const rows = new Map<string, CoverageRow & { zoneMap: Map<string, CoverageZoneRow> }>()
  const row = (serviceId: string, serviceName: string, city: string) => {
    const key = `${serviceId}|${city}`
    let r = rows.get(key)
    if (!r) {
      r = { serviceId, serviceName, city, requests30: 0, requests90: 0, proposalPct30: null, expired30: 0, expired90: 0, partners: 0, gap: 'balanced', zones: [], zoneMap: new Map() }
      rows.set(key, r)
    }
    return r
  }
  const withProposals30 = new Map<string, number>()

  for (const q of requests) {
    const at = q.createdAt.getTime()
    if (at < t90) continue
    const r = row(q.serviceId, q.serviceName, q.city)
    const zoneKey = q.zone || 'sin zona'
    const z = r.zoneMap.get(zoneKey) ?? { zone: zoneKey, requests90: 0, requests30: 0, partners: 0 }
    r.zoneMap.set(zoneKey, z)
    r.requests90++
    z.requests90++
    if (q.status === 'EXPIRED') r.expired90++
    if (at >= t30) {
      r.requests30++
      z.requests30++
      if (q.status === 'EXPIRED') r.expired30++
      if (q.proposals > 0) withProposals30.set(`${q.serviceId}|${q.city}`, (withProposals30.get(`${q.serviceId}|${q.city}`) ?? 0) + 1)
    }
  }

  for (const p of partners) {
    const r = row(p.serviceId, p.serviceName, p.city)
    r.partners++
  }
  for (const r of Array.from(rows.values())) {
    for (const z of Array.from(r.zoneMap.values())) {
      z.partners = partners.filter((p) => p.serviceId === r.serviceId && p.city === r.city && (p.zones.length === 0 || (z.zone !== 'sin zona' && p.zones.includes(z.zone)) || z.zone === 'sin zona')).length
    }
  }

  return Array.from(rows.values())
    .map(({ zoneMap, ...r }) => {
      const proposalPct30 = r.requests30 ? Math.round(((withProposals30.get(`${r.serviceId}|${r.city}`) ?? 0) / r.requests30) * 100) : null
      const zones = Array.from(zoneMap.values()).sort((a, b) => b.requests90 - a.requests90).slice(0, 8)
      return { ...r, proposalPct30, zones, gap: classifyGap({ requests30: r.requests30, requests90: r.requests90, proposalPct30, partners: r.partners }) }
    })
    .sort((a, b) => GAP_ORDER[a.gap] - GAP_ORDER[b.gap] || b.requests90 - a.requests90 || a.serviceName.localeCompare(b.serviceName, 'es'))
}

/** WhatsApp text to recruit partners for a service in a city; the link is the /unete landing with the service prefilled-by-tag. */
export function recruitText(service: string, city: string, link = 'https://www.lohaggo.com/unete') {
  const cityName = city.charAt(0) + city.slice(1).toLowerCase().replace(/_/g, ' ')
  return `¿Eres ${service.toLowerCase()} en ${cityName}? En LoHaggo hay clientes pidiendo este servicio y faltan profesionales. Únete gratis, sin mensualidad: ${link}?utm_source=reclutamiento&utm_medium=whatsapp&utm_campaign=${encodeURIComponent(service.toLowerCase().replace(/\s+/g, '_'))}`
}
