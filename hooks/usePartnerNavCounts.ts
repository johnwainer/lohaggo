'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

interface NavCounts {
  bookings: number
  messages: number
  requests: number
}

const REFRESH_EVENT = 'partner-nav-counts:refresh'

// The sidebar, the bottom nav and the tabs all mount this hook: they share one request and a few seconds of cache
let shared: { at: number; data: Promise<NavCounts | null> } | null = null
const SHARED_MS = 5000

function loadCounts(force: boolean): Promise<NavCounts | null> {
  if (!force && shared && Date.now() - shared.at < SHARED_MS) return shared.data
  const data = fetch('/api/partner/nav-counts', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (d ? { bookings: d.bookings ?? 0, messages: d.messages ?? 0, requests: d.requests ?? 0 } : null))
    .catch(() => null)
  shared = { at: Date.now(), data }
  return data
}

/** Asks every mounted counter (sidebar, tabs) to refetch now, e.g. right after confirming a booking or sending a proposal. */
export function refreshPartnerNavCounts() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(REFRESH_EVENT))
}

export function usePartnerNavCounts(intervalMs = 20000) {
  const { data: session } = useSession()
  const [counts, setCounts] = useState<NavCounts>({ bookings: 0, messages: 0, requests: 0 })

  useEffect(() => {
    if (session?.user?.role !== 'PARTNER') return
    let mounted = true

    const apply = (data: NavCounts | null) => { if (mounted && data) setCounts(data) }
    const poll = () => { void loadCounts(false).then(apply) }
    const refresh = () => {
      // Only the first listener of a refresh burst forces a new request; the rest reuse it
      void loadCounts(!shared || Date.now() - shared.at > 300).then(apply)
    }

    poll()
    const timer = setInterval(poll, intervalMs)
    window.addEventListener(REFRESH_EVENT, refresh)
    return () => {
      mounted = false
      clearInterval(timer)
      window.removeEventListener(REFRESH_EVENT, refresh)
    }
  }, [session?.user?.role, intervalMs])

  return counts
}
