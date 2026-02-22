'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import ClientDashboardNav from '@/components/ClientDashboardNav'
import NotificationsInbox from '@/components/shared/NotificationsInbox'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: string
  data?: string
}

export default function NotificationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const { isSupported, isSubscribed, subscribeToPush, permission, isLoading: pushLoading, error: pushError } = usePushNotifications()
  const [bookingsCount, setBookingsCount] = useState(0)
  const [requestsCount, setRequestsCount] = useState(0)
  const [favoritesCount, setFavoritesCount] = useState(0)

  const fetchCounts = async () => {
    try {
      const [bookingsRes, requestsRes, favoritesRes] = await Promise.all([
        fetch('/api/bookings'),
        fetch('/api/service-requests'),
        fetch('/api/favorites')
      ])

      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json()
        setBookingsCount(Array.isArray(bookingsData) ? bookingsData.length : 0)
      }

      if (requestsRes.ok) {
        const requestsData = await requestsRes.json()
        const requests = Array.isArray(requestsData) ? requestsData : Array.isArray(requestsData?.serviceRequests) ? requestsData.serviceRequests : []
        setRequestsCount(requests.length)
      }

      if (favoritesRes.ok) {
        const favoritesData = await favoritesRes.json()
        setFavoritesCount(Array.isArray(favoritesData) ? favoritesData.length : 0)
      }
    } catch (error) {
      console.error('Error fetching counts:', error)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      fetchNotifications()
      fetchCounts()
    }
  }, [status])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchNotifications()
    }
  }, [filter])

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      const url = filter === 'unread'
        ? '/api/notifications?unreadOnly=true'
        : '/api/notifications'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setNotifications(data)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
      setHasLoadedOnce(true)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId })
      })
      fetchNotifications()
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id)
    }

    let parsedData: any = {}
    if (notification.data) {
      try {
        parsedData = JSON.parse(notification.data)
      } catch (error) {
        console.error('Error parsing notification data:', error)
      }
    }

    const isPartner = session?.user?.role === 'PARTNER'
    const explicitTarget = typeof parsedData.targetUrl === 'string' ? parsedData.targetUrl : null

    if (explicitTarget && explicitTarget.startsWith('/')) {
      router.push(explicitTarget)
      return
    }

    if (parsedData.serviceRequestId) {
      router.push(isPartner ? '/partner?tab=my-requests' : '/dashboard?tab=requests')
      return
    }

    if (parsedData.bookingId || parsedData.proposalId || parsedData.paymentId) {
      router.push(isPartner ? '/partner?tab=bookings' : '/dashboard?tab=bookings')
      return
    }

    router.push(isPartner ? '/partner' : '/dashboard')
  }

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllAsRead: true })
      })
      fetchNotifications()
    } catch (error) {
      console.error('Error marking all as read:', error)
    }
  }

  const handleEnablePushNotifications = async () => {
    const success = await subscribeToPush()
    if (!success && pushError) {
      console.error('Error enabling push notifications:', pushError)
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <NotificationsInbox
      notifications={notifications}
      filter={filter}
      unreadCount={unreadCount}
      loading={loading}
      hasLoadedOnce={hasLoadedOnce}
      push={{
        isSupported,
        isSubscribed,
        permission,
        isLoading: pushLoading,
        error: pushError
      }}
      headerSubtitle={`Cliente: ${unreadCount} sin leer`}
      emptySubtitle="Aquí verás novedades de reservas, solicitudes y pagos."
      nav={(
        <ClientDashboardNav
          bookingsCount={bookingsCount}
          requestsCount={requestsCount}
          favoritesCount={favoritesCount}
          notificationsCount={unreadCount}
          activeTab="notifications"
        />
      )}
      onFilterChange={setFilter}
      onNotificationClick={handleNotificationClick}
      onMarkAsRead={markAsRead}
      onMarkAllAsRead={markAllAsRead}
      onEnablePush={handleEnablePushNotifications}
    />
  )
}
