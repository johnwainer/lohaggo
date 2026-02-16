let swRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null

export async function registerPwaServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }

  if (swRegistrationPromise) {
    return swRegistrationPromise
  }

  swRegistrationPromise = navigator.serviceWorker
    .register('/sw.js', { scope: '/', updateViaCache: 'none' })
    .then(async (registration) => {
      await navigator.serviceWorker.ready
      return registration
    })
    .catch(() => null)

  return swRegistrationPromise
}
