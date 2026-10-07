'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import PartnerDashboardNav from '@/components/PartnerDashboardNav'
import NotificationsInbox from '@/components/shared/NotificationsInbox'
import { opportunitiesFromResponse } from '@/lib/partners/opportunities'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: string
  data?: string
}

const isInternalPath = (v: unknown): v is string => typeof v === 'string' && /^\/(?![/\\])/.test(v) && !v.includes('\\')

/** Where a notification takes the partner: its own link when it brings one, else the concrete place for its type. */
function partnerNotificationTarget(type: string, data: Record<string, unknown>): string {
  for (const key of ['targetUrl', 'actionUrl', 'url']) {
    if (isInternalPath(data[key])) return data[key] as string
  }
  if (type === 'NEW_MESSAGE' || data.chatId) return '/partner/messages'
  if (type === 'DOCUMENT_APPROVED' || type === 'DOCUMENT_REJECTED') return '/partner/verification'
  if (type === 'ACHIEVEMENT_UNLOCKED') return '/partner/achievements'
  if (data.bookingId || data.paymentId || type.startsWith('BOOKING_') || type.startsWith('PAYMENT_') || type.startsWith('RATING_') || type === 'PROPOSAL_ACCEPTED') {
    return typeof data.bookingId === 'string' ? `/partner?tab=bookings&booking=${encodeURIComponent(data.bookingId)}` : '/partner?tab=bookings'
  }
  if (data.serviceRequestId || data.proposalId || type === 'NEW_SERVICE_REQUEST' || type === 'PROPOSAL_REJECTED') {
    return '/partner?tab=my-requests'
  }
  return '/partner'
}

export default function PartnerNotificationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const { isSupported, isSubscribed, subscribeToPush, permission, isLoading: pushLoading, error: pushError } = usePushNotifications()
  const [bookingsCount, setBookingsCount] = useState(0)
  const [myRequestsCount, setMyRequestsCount] = useState(0)

  useEffect(() => {
    if (status === 'authenticated') {
      if (session?.user?.role !== 'PARTNER') {
        router.push('/dashboard')
        return
      }
      fetchNotifications()
      fetchCounts()
    }
  }, [status, session, router])

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'PARTNER') {
      fetchNotifications()
    }
  }, [filter, status, session?.user?.role])

  const fetchCounts = async () => {
    try {
      const [bookingsRes, requestsRes] = await Promise.all([
        fetch('/api/bookings'),
        fetch('/api/partner/service-requests')
      ])

      if (bookingsRes.ok) {
        const bookings = await bookingsRes.json()
        setBookingsCount(Array.isArray(bookings) ? bookings.length : 0)
      }

      if (requestsRes.ok) {
        const requests = await requestsRes.json()
        setMyRequestsCount(opportunitiesFromResponse(requests).requests.length)
      }
    } catch (error) {
      console.error('Error fetching counts:', error)
    }
  }

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

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id)
    }

    let parsedData: Record<string, unknown> = {}
    if (notification.data) {
      try {
        const parsed = JSON.parse(notification.data)
        if (parsed && typeof parsed === 'object') parsedData = parsed
      } catch (error) {
        console.error('Error parsing notification data:', error)
      }
    }

    router.push(partnerNotificationTarget(notification.type, parsedData))
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
      headerSubtitle={`${unreadCount} sin leer`}
      emptySubtitle="Aquí verás novedades de reservas, solicitudes y actividad de clientes."
      nav={(
        <PartnerDashboardNav
          bookingsCount={bookingsCount}
          requestsCount={myRequestsCount}
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
