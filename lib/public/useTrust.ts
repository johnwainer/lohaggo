'use client'

import { useEffect, useState } from 'react'
import { defaultClaimState } from '@/lib/public/claims'
import type { PublicTrust } from '@/lib/public/trust'

export type PublicTestimonial = { rating: number; comment: string; author: string; service: string; city: string | null; at: string | null }

export type PublicTrustPayload = PublicTrust & {
  testimonials: PublicTestimonial[]
  whatsappPhone: string | null
  launchBenefits: string[]
}

/** Until the real data arrives nothing is claimed beyond the defaults, and no number is shown. */
export const EMPTY_TRUST: PublicTrustPayload = {
  claims: defaultClaimState(),
  stats: { verifiedPartners: null, completedServices: null, clients: null, rating: null, activeCities: [] },
  commissionEnabled: false,
  testimonials: [],
  whatsappPhone: null,
  launchBenefits: [],
}

let cache: PublicTrustPayload | null = null
let inflight: Promise<PublicTrustPayload> | null = null

function load(): Promise<PublicTrustPayload> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = fetch('/api/public/trust')
      .then((r) => (r.ok ? r.json() : EMPTY_TRUST))
      .then((d: PublicTrustPayload) => (cache = { ...EMPTY_TRUST, ...d }))
      .catch(() => EMPTY_TRUST)
      .finally(() => { inflight = null })
  }
  return inflight
}

/** Public claims and real numbers for client components. `ready` is false until loaded. */
export function useTrust(initial?: PublicTrustPayload | null) {
  const [data, setData] = useState<PublicTrustPayload>(initial ?? cache ?? EMPTY_TRUST)
  const [ready, setReady] = useState(Boolean(initial ?? cache))
  useEffect(() => {
    if (initial) return
    let alive = true
    load().then((d) => { if (alive) { setData(d); setReady(true) } })
    return () => { alive = false }
  }, [initial])
  return { ...data, ready }
}
