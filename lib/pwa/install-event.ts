'use client'

import { useSyncExternalStore } from 'react'

/**
 * The ONE `beforeinstallprompt` handler of the app. Every screen that offers the install (the global
 * banner, the adoption prompt, the partner home banner, the download pages) reads the saved event from
 * here instead of registering its own listener.
 */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let saved: InstallEvent | null = null
let attached = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function ensureInstallListener() {
  if (attached || typeof window === 'undefined') return
  attached = true
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    saved = e as InstallEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    saved = null
    emit()
  })
}

export const getInstallEvent = () => saved

/** Used once the browser's prompt was shown: the event cannot be reused. */
export function clearInstallEvent() {
  saved = null
  emit()
}

const subscribe = (l: () => void) => {
  ensureInstallListener()
  listeners.add(l)
  return () => { listeners.delete(l) }
}

export function useInstallEvent(): InstallEvent | null {
  return useSyncExternalStore(subscribe, () => saved, () => null)
}

// Attach as soon as the client bundle loads so an early event is not missed
ensureInstallListener()
