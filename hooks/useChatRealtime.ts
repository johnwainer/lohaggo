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

type ProposalEvent = 'message' | 'read'

export function useProposalRealtime(
  proposalId: string | null | undefined,
  onEvent: (event: ProposalEvent) => void
) {
  const onEventRef = useRef(onEvent)
  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    if (!proposalId) return
    const supabase = getSupabaseBrowser()
    if (!supabase) return

    const channel = supabase
      .channel(`proposal:${proposalId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'message' }, () => {
        onEventRef.current('message')
      })
      .on('broadcast', { event: 'read' }, () => {
        onEventRef.current('read')
      })
      .subscribe()

    return () => {
      try {
        supabase.removeChannel(channel)
      } catch {
        // silent
      }
    }
  }, [proposalId])
}
