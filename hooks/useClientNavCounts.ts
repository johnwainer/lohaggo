'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

export interface ClientNavCounts {
  /** Bookings in progress (pending, confirmed, in progress) */
  bookings: number
  /** Open service requests */
  requests: number
  favorites: number
  /** Unread notifications */
  notifications: number
  /** Unread chat messages */
  messages: number
  /** Things waiting on the client: proposals to answer, services to pay, services to rate */
  action: number
}

const REFRESH_EVENT = 'client-nav-counts:refresh'

/** Asks every mounted client counter (bottom nav, tabs) to refetch now, e.g. right after reading notifications. */
export function refreshClientNavCounts() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(REFRESH_EVENT))
}

const EMPTY: ClientNavCounts = { bookings: 0, requests: 0, favorites: 0, notifications: 0, messages: 0, action: 0 }

export function useClientNavCounts(intervalMs = 20000) {
  const { data: session } = useSession()
  const [counts, setCounts] = useState<ClientNavCounts>(EMPTY)

  useEffect(() => {
    if (session?.user?.role !== 'CLIENT') return
    let mounted = true

    const fetch_ = async () => {
      try {
        const res = await fetch('/api/client/nav-counts', { cache: 'no-store' })
        if (!res.ok || !mounted) return
        const data = await res.json()
        setCounts({
          bookings: data.bookings ?? 0,
          requests: data.requests ?? 0,
          favorites: data.favorites ?? 0,
          notifications: data.notifications ?? 0,
          messages: data.messages ?? 0,
          action: data.action ?? 0,
        })
      } catch {
        // silent
      }
    }

    fetch_()
    const timer = setInterval(fetch_, intervalMs)
    const onFocus = () => { if (document.visibilityState === 'visible') fetch_() }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener(REFRESH_EVENT, fetch_)
    return () => {
      mounted = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener(REFRESH_EVENT, fetch_)
    }
  }, [session?.user?.role, intervalMs])

  return counts
}
