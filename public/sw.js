self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      vibrate: [100, 50, 100],
      data: data.data,
      actions: [
        {
          action: 'view',
          title: 'Ver'
        },
        {
          action: 'close',
          title: 'Cerrar'
        }
      ]
    }

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    )
  }
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()

  if (event.action === 'view') {
    const data = event.notification.data
    let url = '/'

    if (data.type === 'NEW_SERVICE_REQUEST') {
      url = '/partner'
    } else if (data.type === 'NEW_PROPOSAL') {
      url = '/dashboard'
    } else if (data.type.startsWith('BOOKING_')) {
      url = data.type.includes('PARTNER') ? '/partner' : '/dashboard'
    }

    event.waitUntil(
      clients.openWindow(url)
    )
  }
})

self.addEventListener('pushsubscriptionchange', function(event) {
  event.waitUntil(
    fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subscription: event.newSubscription
      })
    })
  )
})
