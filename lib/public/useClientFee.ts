'use client'

import { useEffect, useState } from 'react'
import type { FeeInfo } from '@/lib/public/price-from'

let cache: FeeInfo | null = null
let inflight: Promise<FeeInfo | null> | null = null

function load(): Promise<FeeInfo | null> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = fetch('/api/payment-config/public')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { commissionEnabled?: boolean; clientCommissionRate?: number } | null) => {
        if (!d) return null
        cache = { enabled: Boolean(d.commissionEnabled), rate: Number(d.clientCommissionRate) || 0 }
        return cache
      })
      .catch(() => null)
      .finally(() => { inflight = null })
  }
  return inflight
}

/** The client service fee that applies today (from the public payment config); null until it loads. */
export function useClientFee(): FeeInfo | null {
  const [fee, setFee] = useState<FeeInfo | null>(cache)
  useEffect(() => {
    let alive = true
    load().then((f) => { if (alive) setFee(f) })
    return () => { alive = false }
  }, [])
  return fee
}
