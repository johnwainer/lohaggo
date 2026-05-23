'use client'

import { useEffect, useRef } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase-browser'

export function useChatRealtime(proposalIds: string[], onMessage: () => void) {
  const onMessageRef = useRef(onMessage)
  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  const key = proposalIds.slice().sort().join(',')

  useEffect(() => {
    if (proposalIds.length === 0) return
    const supabase = getSupabaseBrowser()
    if (!supabase) return

    const channels = proposalIds.map((proposalId) =>
      supabase
        .channel(`proposal:${proposalId}`, { config: { broadcast: { self: false } } })
        .on('broadcast', { event: 'message' }, () => {
          onMessageRef.current()
        })
        .subscribe()
    )

    return () => {
      channels.forEach((ch) => {
        try {
          supabase.removeChannel(ch)
        } catch {
          // silent
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
