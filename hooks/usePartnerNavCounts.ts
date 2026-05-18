'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

interface NavCounts {
  bookings: number
  messages: number
}

export function usePartnerNavCounts(intervalMs = 20000) {
  const { data: session } = useSession()
  const [counts, setCounts] = useState<NavCounts>({ bookings: 0, messages: 0 })

  useEffect(() => {
    if (session?.user?.role !== 'PARTNER') return
    let mounted = true

    const fetch_ = async () => {
      try {
        const res = await fetch('/api/partner/nav-counts', { cache: 'no-store' })
        if (!res.ok || !mounted) return
        const data = await res.json()
        setCounts({ bookings: data.bookings ?? 0, messages: data.messages ?? 0 })
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
