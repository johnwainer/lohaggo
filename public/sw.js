const CACHE_NAME = 'lohaggo-v5';
const RUNTIME_CACHE = 'lohaggo-runtime-v5';
const IMAGE_CACHE = 'lohaggo-images-v5';

const PRECACHE_URLS = [
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-icon.png',
  '/apple-touch-icon.png',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/grid.svg',
  '/offline.html'
];

const CACHE_STRATEGIES = {
  images: IMAGE_CACHE,
  api: RUNTIME_CACHE,
  static: CACHE_NAME
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_URLS).catch((error) => {
          console.error('Failed to cache resources during install:', error);
          return Promise.resolve();
        });
      })
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error('Service Worker installation failed:', error);
      })
  );
});

self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_NAME, RUNTIME_CACHE, IMAGE_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return cacheNames.filter((cacheName) => !currentCaches.includes(cacheName));
    }).then((cachesToDelete) => {
      return Promise.all(cachesToDelete.map((cacheToDelete) => {
        return caches.delete(cacheToDelete);
      }));
    }).then(() => self.clients.claim())
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE));
    return;
  }

  // Always fetch fresh HTML for navigation — stale HTML causes ChunkLoadErrors after deploys
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, CACHE_NAME));
    return;
  }

  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  if (url.origin === location.origin) {
    event.respondWith(staleWhileRevalidate(request, CACHE_NAME));
    return;
  }

  event.respondWith(fetch(request));
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const offlinePage = await cache.match('/offline.html');
    return offlinePage || new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    const offlinePage = await cache.match('/offline.html');
    return offlinePage || new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(async () => {
      // If network request fails, return cached version or offline page
      return cached || (await cache.match('/offline.html')) || new Response('Offline', { status: 503 });
    });

  return cached || fetchPromise;
}

self.addEventListener('push', (event) => {
  let notificationData = {
    title: 'LoHaggo',
    body: 'Nueva notificación',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: {}
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = {
        title: payload.title || 'LoHaggo',
        body: payload.body || 'Nueva notificación',
        icon: payload.icon || '/icon-192.png',
        badge: payload.badge || '/icon-192.png',
        data: payload.data || {}
      };
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    vibrate: [200, 100, 200],
    tag:
      notificationData.data.notificationId ||
      notificationData.data.campaignId ||
      `lohaggo-notification-${Date.now()}`,
    requireInteraction: true,
    data: notificationData.data,
    actions: [
      {
        action: 'open',
        title: 'Abrir',
        icon: '/icon-192.png'
      },
      {
        action: 'close',
        title: 'Cerrar'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = new URL('/', self.location.origin).href;
  const notificationData = event.notification.data;

  let targetUrl = urlToOpen;

  if (notificationData) {
    if (notificationData.targetUrl) {
      targetUrl = new URL(notificationData.targetUrl, self.location.origin).href;
    } else if (notificationData.type === 'NEW_PROPOSAL' || notificationData.type === 'PROPOSAL_ACCEPTED') {
      targetUrl = new URL('/dashboard', self.location.origin).href;
    } else if (notificationData.type === 'NEW_SERVICE_REQUEST') {
      targetUrl = new URL('/partner', self.location.origin).href;
    } else if (notificationData.type === 'BOOKING_CONFIRMED' || notificationData.type === 'BOOKING_IN_PROGRESS' || notificationData.type === 'BOOKING_COMPLETED' || notificationData.type === 'BOOKING_CANCELLED') {
      targetUrl = new URL('/dashboard', self.location.origin).href;
    } else if (notificationData.type === 'NEW_MESSAGE') {
      targetUrl = new URL('/notifications', self.location.origin).href;
    } else if (notificationData.type === 'CAMPAIGN_PUSH') {
      targetUrl = new URL('/notifications', self.location.origin).href;
    } else if (notificationData.proposalId) {
      targetUrl = new URL('/dashboard', self.location.origin).href;
    }
  }

  if (event.action === 'close') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-bookings') {
    event.waitUntil(syncBookings());
  }
});

async function syncBookings() {
  try {
    const response = await fetch('/api/bookings/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}
