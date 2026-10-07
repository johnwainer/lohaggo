/**
 * What a partner sees of an open service request before there is a booking: no client contact
 * (email/phone), only the first name, and an approximate address without house/apartment numbers.
 * The full contact is only exposed once the booking exists (/api/bookings).
 */

const UNIT_WORDS = '(?:apto|apt|apartamento|interior|int|torre|bloque|blq|casa|piso|oficina|of|local|lc|unidad|edificio|edif|conjunto|manzana|mz|lote|etapa|urbanizaci[oó]n)'

/** Removes the house number and apartment/unit details from a Colombian address; keeps street and neighborhood. */
export function approximateAddress(address: string | null | undefined): string {
  if (!address) return ''
  const segments = address
    .split(/[,;\n]/)
    .map((segment) => {
      let s = segment
      // "# 43-25", "No. 43 - 25", "N° 43A-25 sur": everything after the number marker in this segment
      s = s.replace(/\s*(?:#|\bn[oº°]\.?|\bn[uú]mero|\bnro\.?)\s*\d.*$/i, '').replace(/\s*#.*$/, '')
      // "Calle 10 43-25" without a marker: plate number pair
      s = s.replace(/\s+\d+\s*[a-z]?\s*(?:bis\s*)?-\s*\d+[a-z]?(?:\s*(?:sur|este))?\b.*$/i, '')
      // unit words with their identifier, e.g. "apto 502", "torre 3", "casa 12b"
      s = s.replace(new RegExp(`\\b${UNIT_WORDS}\\.?\\s*[\\w-]*\\d[\\w-]*`, 'gi'), '')
      return s.replace(/\s{2,}/g, ' ').trim()
    })
    // drop leftovers that are only digits/punctuation (postal codes, stray numbers) or empty
    .filter((s) => s.length > 0 && /[a-záéíóúñ]{2,}/i.test(s) && !new RegExp(`^${UNIT_WORDS}\\.?$`, 'i').test(s))

  return segments.join(', ')
}

export function firstName(name: string | null | undefined): string {
  const first = (name || '').trim().split(/\s+/)[0]
  return first || 'Cliente'
}

type SourceRequest = {
  id: string
  address: string
  city: string
  notes: string | null
  budget: number | null
  preferredDate: Date | string | null
  preferredTime: string | null
  isUrgent: boolean
  status: string
  expiresAt: Date | string
  createdAt: Date | string
  partnerId: string | null
  origin?: string | null
  originChannel?: string | null
  service: {
    id?: string
    name: string
    slug: string
    icon: string
    basePrice: number
    category: { name: string }
  }
  user?: { name?: string | null } | null
  photos?: Array<{ id: string; url: string; order: number }>
  proposals?: Array<{ id: string; price: number; notes: string | null; status: string; partnerId?: string }>
  _count?: { proposals: number }
}

export type PartnerOpportunity = ReturnType<typeof toPartnerOpportunity>

/** Whitelist serializer: builds the object field by field so nothing sensitive leaks from the query. */
export function toPartnerOpportunity(r: SourceRequest, partnerId: string) {
  const own = (r.proposals || []).filter((p) => !p.partnerId || p.partnerId === partnerId)
  return {
    id: r.id,
    address: approximateAddress(r.address),
    city: r.city,
    notes: r.notes,
    budget: r.budget,
    preferredDate: r.preferredDate,
    preferredTime: r.preferredTime,
    isUrgent: r.isUrgent,
    status: r.status,
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
    partnerId: r.partnerId === partnerId ? partnerId : null,
    origin: r.origin ?? null,
    originChannel: r.originChannel ?? null,
    service: {
      name: r.service.name,
      slug: r.service.slug,
      icon: r.service.icon,
      basePrice: r.service.basePrice,
      category: { name: r.service.category.name },
    },
    user: { name: firstName(r.user?.name) },
    photos: (r.photos || []).map((p) => ({ id: p.id, url: p.url, order: p.order })),
    proposals: own.slice(0, 1).map((p) => ({ id: p.id, price: p.price, notes: p.notes, status: p.status })),
    _count: { proposals: r._count?.proposals ?? own.length },
    /** Other partners' proposals on this request (the partner's own one does not count). */
    competitors: Math.max(0, (r._count?.proposals ?? own.length) - own.length),
  }
}

/** Accepts both the current `{ requests }` shape and the legacy array shape of /api/partner/service-requests. */
export function opportunitiesFromResponse<T = PartnerOpportunity>(data: unknown): { requests: T[]; requiresVerification: boolean } {
  if (Array.isArray(data)) return { requests: data as T[], requiresVerification: false }
  const obj = (data || {}) as { requests?: unknown; requiresVerification?: unknown }
  return {
    requests: Array.isArray(obj.requests) ? (obj.requests as T[]) : [],
    requiresVerification: obj.requiresVerification === true,
  }
}
