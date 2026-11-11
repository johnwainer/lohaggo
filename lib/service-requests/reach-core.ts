import { listsZone, nearbyZones } from '@/lib/geo/zones'

/**
 * Who else hears about a request nobody answered, pure: first the partners of its zone who were left out
 * (their schedule did not fit), then those of the bordering zones, and on the second wave the whole city.
 * Inside each ring, partners who quoted the same service (then the same category) recently go first.
 */

export type ReachScope = 'nearby' | 'city'

export type ReachCandidate = {
  partnerId: string
  userId: string
  name: string
  coverageZones: string[]
  rating: number
  completed: number
  quotedService: number
  quotedCategory: number
}

/** 0 = covers the zone, 1 = covers a bordering zone, 2 = elsewhere in the city; null = out of this scope. */
export function reachRing(coverage: string[], zone: string | null | undefined, scope: ReachScope): 0 | 1 | 2 | null {
  if (listsZone(coverage, zone)) return 0
  if (nearbyZones(zone).some((z) => coverage.includes(z))) return 1
  return scope === 'city' ? 2 : null
}

export function pickReachBatch(candidates: ReachCandidate[], opts: { zone: string | null | undefined; scope: ReachScope; limit: number }) {
  return candidates
    .map((c) => ({ c, ring: reachRing(c.coverageZones, opts.zone, opts.scope) }))
    .filter((x): x is { c: ReachCandidate; ring: 0 | 1 | 2 } => x.ring !== null)
    .sort((a, b) => a.ring - b.ring || b.c.quotedService - a.c.quotedService || b.c.quotedCategory - a.c.quotedCategory || b.c.rating - a.c.rating || b.c.completed - a.c.completed || a.c.name.localeCompare(b.c.name))
    .slice(0, Math.max(0, opts.limit))
    .map((x) => x.c)
}

/** The serviceRequestId of a widened notice (Notification.data, a JSON string), or null. */
export function widenedRequestId(data: string | null | undefined): string | null {
  if (!data) return null
  try {
    const d = JSON.parse(data) as { serviceRequestId?: unknown; reach?: unknown }
    return typeof d.reach === 'string' && typeof d.serviceRequestId === 'string' ? d.serviceRequestId : null
  } catch {
    return null
  }
}
