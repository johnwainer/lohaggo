'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

interface ClientNavCounts {
  bookings: number
  requests: number
  favorites: number
  notifications: number
}

export function useClientNavCounts(intervalMs = 20000) {
  const { data: session } = useSession()
  const [counts, setCounts] = useState<ClientNavCounts>({ bookings: 0, requests: 0, favorites: 0, notifications: 0 })

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
        })
      } catch {
        // silent
      }
    }

    fetch_()
    const timer = setInterval(fetch_, intervalMs)
    return () => { mounted = false; clearInterval(timer) }
  }, [session?.user?.role, intervalMs])

  return counts
}
