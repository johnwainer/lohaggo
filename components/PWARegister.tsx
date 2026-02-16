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
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New service worker available, show update notification
                  if (confirm('Nueva versión disponible. ¿Actualizar ahora?')) {
                    newWorker.postMessage({ type: 'SKIP_WAITING' })
                    window.location.reload()
                  }
                }
              })
            }
          })
        })
        .catch(() => undefined)

      // Handle service worker controller change
      navigator.serviceWorker.addEventListener('controllerchange', () => {
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
