'use client'

import { useEffect, useState } from 'react'

export function useNotificationUnreadCount(enabled = true, intervalMs = 15000) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let mounted = true

    const fetchCount = async () => {
      try {
        const res = await fetch('/api/notifications/unread-count', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (mounted) {
          setCount(typeof data?.count === 'number' ? data.count : 0)
        }
      } catch {
        // silent
      }
    }

    fetchCount()
    const timer = setInterval(fetchCount, intervalMs)

    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [enabled, intervalMs])

  return count
}
