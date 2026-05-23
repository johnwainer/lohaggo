'use client'

import { useEffect, useRef } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'

export function useNotificationRealtime(
  userId: string | null | undefined,
  onNotification: () => void
) {
  const onNotificationRef = useRef(onNotification)
  useEffect(() => {
    onNotificationRef.current = onNotification
  }, [onNotification])

  useEffect(() => {
    if (!userId) return
    const supabase = getSupabaseBrowser()
    if (!supabase) return

    const channel = supabase
      .channel(`user:${userId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'notification' }, () => {
        onNotificationRef.current()
      })
      .subscribe()

    return () => {
      try {
        supabase.removeChannel(channel)
      } catch {
        // silent
      }
    }
  }, [userId])
}
