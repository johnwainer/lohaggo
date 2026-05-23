'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useNotificationRealtime } from './useNotificationRealtime'

export function useNotificationUnreadCount(enabled = true, intervalMs = 60000) {
  const { data: session } = useSession()
  const userId = session?.user?.id
  const [count, setCount] = useState(0)
  const mountedRef = useRef(true)

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/unread-count', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      if (mountedRef.current) {
        setCount(typeof data?.count === 'number' ? data.count : 0)
      }
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    if (!enabled) return

    fetchCount()
    const timer = setInterval(fetchCount, intervalMs)

    return () => {
      mountedRef.current = false
      clearInterval(timer)
    }
  }, [enabled, intervalMs, fetchCount])

  useNotificationRealtime(enabled ? userId : null, fetchCount)

  return count
}
