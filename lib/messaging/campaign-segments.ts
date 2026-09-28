/**
 * Client segments of a messaging campaign (`metadata.clientSegment`): everyone, clients who never booked,
 * inactive ones (had a request or booking, none in the last N days), by service and by zone. Pure: the
 * Prisma `where` is built here and run by campaign-recipients.
 */
import type { Prisma } from '@prisma/client'
import { isZoneKey, zoneFromText } from '@/lib/geo/zones'

export type ClientSegmentType = 'all' | 'no_booking' | 'inactive' | 'service' | 'zone'

export type ClientSegment = {
  type: ClientSegmentType
  inactiveDays: 30 | 60
  serviceIds: string[]
  zoneKeys: string[]
}

export const DEFAULT_CLIENT_SEGMENT: ClientSegment = { type: 'all', inactiveDays: 30, serviceIds: [], zoneKeys: [] }

const TYPES: ClientSegmentType[] = ['all', 'no_booking', 'inactive', 'service', 'zone']
const DAY_MS = 24 * 60 * 60 * 1000

const ids = (raw: unknown) =>
  Array.isArray(raw) ? Array.from(new Set(raw.map((v) => String(v ?? '').trim()).filter(Boolean))).slice(0, 200) : []

/** A segment from untrusted input (metadata, request body, query string); unknown values fall back to «all». */
export function normalizeClientSegment(raw: unknown): ClientSegment {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_CLIENT_SEGMENT }
  const o = raw as Record<string, unknown>
  const typeRaw = String(o.type ?? 'all').toLowerCase()
  const type = (TYPES as string[]).includes(typeRaw) ? (typeRaw as ClientSegmentType) : 'all'
  const inactiveDays = Number(o.inactiveDays) === 60 ? 60 : 30
  return {
    type,
    inactiveDays,
    serviceIds: ids(o.serviceIds),
    zoneKeys: ids(o.zoneKeys).filter(isZoneKey),
  }
}

export function parseClientSegment(metadata: string | null | undefined): ClientSegment {
  if (!metadata) return { ...DEFAULT_CLIENT_SEGMENT }
  try {
    return normalizeClientSegment((JSON.parse(metadata) as { clientSegment?: unknown })?.clientSegment)
  } catch {
    return { ...DEFAULT_CLIENT_SEGMENT }
  }
}

export function mergeClientSegmentMetadata(metadata: string | null | undefined, segment: ClientSegment) {
  let parsed: Record<string, unknown> = {}
  try {
    parsed = metadata ? (JSON.parse(metadata) as Record<string, unknown>) : {}
  } catch {
    parsed = {}
  }
  parsed.clientSegment = normalizeClientSegment(segment)
  return JSON.stringify(parsed)
}

/** Why a segment cannot be saved (service or zone with nothing picked), or null. */
export function clientSegmentError(segment: ClientSegment): string | null {
  if (segment.type === 'service' && segment.serviceIds.length === 0) return 'Selecciona al menos un servicio para el segmento.'
  if (segment.type === 'zone' && segment.zoneKeys.length === 0) return 'Selecciona al menos una zona para el segmento.'
  return null
}

/**
 * The User `where` of a segment. `zone` needs the user ids matched in code (address text → zone), passed as
 * `zoneUserIds`; without them the zone segment is empty.
 */
export function clientSegmentWhere(segment: ClientSegment, opts: { now?: Date; zoneUserIds?: string[] } = {}): Prisma.UserWhereInput | null {
  const now = opts.now ?? new Date()
  switch (segment.type) {
    case 'no_booking':
      return { bookings: { none: {} } }
    case 'inactive': {
      const cutoff = new Date(now.getTime() - segment.inactiveDays * DAY_MS)
      return {
        AND: [
          { OR: [{ bookings: { some: {} } }, { serviceRequests: { some: {} } }] },
          { bookings: { none: { createdAt: { gte: cutoff } } } },
          { serviceRequests: { none: { createdAt: { gte: cutoff } } } },
        ],
      }
    }
    case 'service':
      if (!segment.serviceIds.length) return { id: { in: [] } }
      return {
        OR: [
          { serviceRequests: { some: { serviceId: { in: segment.serviceIds } } } },
          { bookings: { some: { serviceId: { in: segment.serviceIds } } } },
        ],
      }
    case 'zone':
      return { id: { in: opts.zoneUserIds ?? [] } }
    default:
      return null
  }
}

/**
 * Users in the picked zones: any of their requests has one of the zones, or their main active address
 * (primary first, else the newest) reads as one of them. Pure.
 */
export function zoneUserIds(
  zoneKeys: string[],
  requests: Array<{ userId: string; zone: string | null }>,
  addresses: Array<{ userId: string; neighborhood: string | null; isPrimary: boolean; createdAt: Date }>,
): string[] {
  const wanted = new Set(zoneKeys)
  if (!wanted.size) return []
  const out = new Set<string>()
  for (const r of requests) if (r.zone && wanted.has(r.zone)) out.add(r.userId)
  const main = new Map<string, (typeof addresses)[number]>()
  for (const a of addresses) {
    const cur = main.get(a.userId)
    if (!cur || (a.isPrimary && !cur.isPrimary) || (a.isPrimary === cur.isPrimary && a.createdAt > cur.createdAt)) main.set(a.userId, a)
  }
  main.forEach((a, userId) => {
    const z = zoneFromText(a.neighborhood)
    if (z && wanted.has(z)) out.add(userId)
  })
  return Array.from(out)
}
