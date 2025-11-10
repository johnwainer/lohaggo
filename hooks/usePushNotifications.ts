import { useEffect, useState, useCallback } from 'react'

type PermissionState = 'default' | 'granted' | 'denied'

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false)
  const [subscription, setSubscription] = useState<PushSubscription | null>(null)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [permission, setPermission] = useState<PermissionState>('default')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    setIsSupported(supported)

    if (supported) {
      setPermission(Notification.permission as PermissionState)
      registerServiceWorker()
    }
  }, [])

  const registerServiceWorker = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      })

      await navigator.serviceWorker.ready

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        }
      })

      const sub = await registration.pushManager.getSubscription()
      setSubscription(sub)
      setIsSubscribed(sub !== null)
    } catch (error) {
      console.error('Error registering service worker:', error)
      setError('Error al registrar el service worker')
    }
  }, [])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Las notificaciones push no están soportadas en este navegador')
      return false
    }

    try {
      const result = await Notification.requestPermission()
      setPermission(result as PermissionState)

      if (result === 'denied') {
        setError('Permisos de notificación denegados. Por favor, habilítalos en la configuración del navegador.')
        return false
      }

      return result === 'granted'
    } catch (error) {
      console.error('Error requesting permission:', error)
      setError('Error al solicitar permisos de notificación')
      return false
    }
  }, [isSupported])

  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      setError('Las notificaciones push no están soportadas')
      return false
    }

    setIsLoading(true)
    setError(null)

    try {
      if (permission !== 'granted') {
        const granted = await requestPermission()
        if (!granted) {
          setIsLoading(false)
          return false
        }
      }

      const registration = await navigator.serviceWorker.ready

      const existingSub = await registration.pushManager.getSubscription()
      if (existingSub) {
        await existingSub.unsubscribe()
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        throw new Error('VAPID public key not configured')
      }

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      })

      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subscription: sub })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al guardar la suscripción')
      }

      setSubscription(sub)
      setIsSubscribed(true)
      setIsLoading(false)
      return true
    } catch (error) {
      console.error('Error subscribing to push:', error)
      setError(error instanceof Error ? error.message : 'Error al suscribirse a notificaciones push')
      setIsLoading(false)
      return false
    }
  }, [isSupported, permission, requestPermission])

  const unsubscribeFromPush = useCallback(async (): Promise<boolean> => {
    setIsLoading(true)
    setError(null)

    try {
      if (subscription) {
        await subscription.unsubscribe()

        await fetch('/api/notifications/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        }).catch(err => console.error('Error notifying server:', err))

        setSubscription(null)
        setIsSubscribed(false)
      }
      setIsLoading(false)
      return true
    } catch (error) {
      console.error('Error unsubscribing from push:', error)
      setError('Error al desuscribirse de notificaciones push')
      setIsLoading(false)
      return false
    }
  }, [subscription])

  const checkSubscription = useCallback(async () => {
    if (!isSupported) return

    try {
      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.getSubscription()
      setSubscription(sub)
      setIsSubscribed(sub !== null)
    } catch (error) {
      console.error('Error checking subscription:', error)
    }
  }, [isSupported])

  return {
    isSupported,
    isSubscribed,
    permission,
    isLoading,
    error,
    subscribeToPush,
    unsubscribeFromPush,
    requestPermission,
    checkSubscription
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
