'use client'

import { useEffect } from 'react'
import { registerPwaServiceWorker } from '@/lib/pwa/register-service-worker'
import { trackPwaEvent } from '@/lib/pwa/telemetry-client'
import { PWA_EVENTS } from '@/lib/pwa/events'

export default function PWARegister() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      registerPwaServiceWorker()
        .then((registration) => {
          if (!registration) return
          // Check for updates every hour
          setInterval(() => {
            registration.update()
          }, 60 * 60 * 1000)

          // Listen for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                // The worker activates itself (skipWaiting); no blocking confirm() on each deploy
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' })
                }
              })
            }
          })
        })
        .catch(() => undefined)

      // A new worker took over: reload once so the page and the worker match (not on the first install)
      const hadController = Boolean(navigator.serviceWorker.controller)
      let reloaded = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloaded) return
        reloaded = true
        window.location.reload()
      })

      // Handle app install prompt
      let deferredPrompt: any = null

      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault()
        deferredPrompt = e

        // Store the event for later use
        localStorage.setItem('pwa-prompt-available', 'true')
      })

      window.addEventListener('appinstalled', () => {
        localStorage.removeItem('pwa-prompt-available')
        trackPwaEvent({ eventName: PWA_EVENTS.PWA_INSTALLED, source: 'browser_appinstalled' })
        deferredPrompt = null
      })
    }
  }, [])

  return null
}
