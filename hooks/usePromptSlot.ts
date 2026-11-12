'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { EMPTY_SLOT, promptBlocked, reduceSlot, type PromptId, type SlotState } from '@/lib/pwa/prompt-slot'

let state: SlotState = EMPTY_SLOT
const listeners = new Set<() => void>()

function dispatch(action: { type: 'want' | 'unwant'; id: PromptId }) {
  const next = reduceSlot(state, action)
  if (next === state) return
  state = next
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
const getHolder = () => state.holder
const getServerHolder = () => null

/** True when a page's own sticky call to action is on screen (StickyRequestBar flags <body>). */
function useStickyCta(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const observer = new MutationObserver(notify)
      observer.observe(document.body, { attributes: true, attributeFilter: ['data-sticky-cta'] })
      return () => observer.disconnect()
    },
    () => document.body.dataset.stickyCta === '1',
    () => false,
  )
}

/**
 * Asks for the single floating-prompt slot. `wants` says this prompt has something to show; the return value
 * says it may show it now (nobody else is showing, and the page allows prompts at all).
 */
export function usePromptSlot(id: PromptId, wants: boolean): boolean {
  const pathname = usePathname()
  const sticky = useStickyCta()
  const blocked = promptBlocked(pathname, sticky)
  const active = wants && !blocked
  useEffect(() => {
    if (!active) return
    dispatch({ type: 'want', id })
    return () => dispatch({ type: 'unwant', id })
  }, [active, id])
  const holder = useSyncExternalStore(subscribe, getHolder, getServerHolder)
  return active && holder === id
}
