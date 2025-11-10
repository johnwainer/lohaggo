const CACHE_NAME = 'lohaggo-v1'
const urlsToCache = [
  '/',
  '/dashboard',
  '/notifications',
  '/partner',
  '/partner/notifications'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })
        }
        return response
      })
      .catch(() => {
        return caches.match(event.request)
      })
  )
})

self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('Push event but no data')
    return
  }

  let data
  try {
    data = event.data.json()
  } catch (error) {
    console.error('Error parsing push data:', error)
    data = {
      title: 'Nueva notificación',
      body: event.data.text()
    }
  }

  const title = data.title || 'LoHaggo'
  const options = {
    body: data.body || 'Tienes una nueva notificación',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'notification',
    requireInteraction: false,
    data: {
      url: data.data?.url || '/notifications',
      notificationId: data.data?.notificationId,
      bookingId: data.data?.bookingId,
      serviceRequestId: data.data?.serviceRequestId,
      proposalId: data.data?.proposalId,
      type: data.data?.type
    },
    actions: [
      {
        action: 'open',
        title: 'Ver',
        icon: '/icon-192.png'
      },
      {
        action: 'close',
        title: 'Cerrar'
      }
    ]
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'close') {
    return
  }

  const data = event.notification.data || {}
  let targetUrl = '/notifications'

  if (data.bookingId || data.serviceRequestId || data.proposalId) {
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (let client of clientList) {
          if (client.url.includes('/dashboard') || client.url.includes('/partner')) {
            return client.focus()
          }
        }
        return self.clients.openWindow(data.url || targetUrl)
      })
  } else {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          for (let client of clientList) {
            if (client.url === self.registration.scope && 'focus' in client) {
              return client.focus()
            }
          }
          if (self.clients.openWindow) {
            return self.clients.openWindow(data.url || targetUrl)
          }
        })
    )
  }
})

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: self.registration.pushManager.applicationServerKey
    })
    .then((subscription) => {
      return fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subscription })
      })
    })
  )
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
