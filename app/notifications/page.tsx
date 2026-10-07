'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import ClientDashboardNav from '@/components/ClientDashboardNav'
import NotificationsInbox from '@/components/shared/NotificationsInbox'
import { notificationTarget, parseNotificationData } from '@/components/NotificationBell'
import { refreshClientNavCounts, useClientNavCounts } from '@/hooks/useClientNavCounts'

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
  const navCounts = useClientNavCounts()

  useEffect(() => {
    if (status === 'authenticated') {
      fetchNotifications()
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
      refreshClientNavCounts()
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id)
    }

    router.push(notificationTarget(notification.type, session?.user?.role, parseNotificationData(notification.data)))
  }

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllAsRead: true })
      })
      fetchNotifications()
      refreshClientNavCounts()
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
      headerSubtitle={unreadCount === 1 ? '1 sin leer' : `${unreadCount} sin leer`}
      emptySubtitle="Aquí verás novedades de reservas, solicitudes y pagos."
      nav={(
        <ClientDashboardNav
          bookingsCount={navCounts.bookings}
          requestsCount={navCounts.action}
          favoritesCount={navCounts.favorites}
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
