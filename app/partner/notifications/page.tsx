'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Bell, Check, CheckCheck, Home, Package, Activity, Settings, MessageSquare, Shield } from 'lucide-react'
import { usePushNotifications } from '@/hooks/usePushNotifications'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: string
  data?: string
}

export default function PartnerNotificationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const { isSupported, isSubscribed, subscribeToPush } = usePushNotifications()
  const [bookingsCount, setBookingsCount] = useState(0)
  const [myRequestsCount, setMyRequestsCount] = useState(0)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      if (session?.user?.role !== 'PARTNER') {
        router.push('/dashboard')
        return
      }
      fetchNotifications()
      fetchCounts()
    }
  }, [status, filter, session])

  const fetchCounts = async () => {
    try {
      const [bookingsRes, requestsRes] = await Promise.all([
        fetch('/api/bookings'),
        fetch('/api/partner/service-requests')
      ])
      
      if (bookingsRes.ok) {
        const bookings = await bookingsRes.json()
        setBookingsCount(bookings.length)
      }
      
      if (requestsRes.ok) {
        const requests = await requestsRes.json()
        setMyRequestsCount(Array.isArray(requests) ? requests.length : 0)
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

  const handleEnablePushNotifications = async () => {
    const success = await subscribeToPush()
    if (success) {
      alert('¡Notificaciones push activadas!')
    } else {
      alert('No se pudieron activar las notificaciones push')
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Cargando notificaciones...</p>
        </div>
      </div>
    )
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex sm:block items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
                  <p className="text-sm text-gray-600">({unreadCount} sin leer)</p>
                </div>
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
              >
                <CheckCheck size={18} />
                <span className="hidden sm:inline">Marcar todas como leídas</span>
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => router.push('/partner')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
              >
                <Home size={20} className="sm:w-[22px] sm:h-[22px]" />
                <span className="hidden sm:inline">Resumen</span>
              </button>

              <button
                onClick={() => router.push('/partner?tab=bookings')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
              >
                <Package size={20} className="sm:w-[22px] sm:h-[22px]" />
                <span className="hidden sm:inline">Mis Reservas</span>
                {bookingsCount > 0 && (
                  <span className="bg-primary-600 text-white text-[10px] px-2 py-0.5 rounded-full ml-2">
                    {bookingsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => router.push('/partner?tab=my-requests')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
              >
                <MessageSquare size={20} className="sm:w-[22px] sm:h-[22px]" />
                <span className="hidden sm:inline">Para Mí</span>
                {myRequestsCount > 0 && (
                  <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full ml-2">
                    {myRequestsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => router.push('/partner?tab=all-requests')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
              >
                <Activity size={20} className="sm:w-[22px] sm:h-[22px]" />
                <span className="hidden sm:inline">Todas</span>
              </button>

              <button
                onClick={() => router.push('/partner/notifications')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-primary-600 text-primary-600 transition whitespace-nowrap"
              >
                <Bell size={20} className="sm:w-[22px] sm:h-[22px]" />
                <span className="hidden sm:inline">Notificaciones</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {isSupported && !isSubscribed && (
            <div className="p-6 bg-blue-50 border-b border-blue-200">
              <p className="text-sm text-blue-800 mb-3">
                Activa las notificaciones push para recibir alertas en tiempo real
              </p>
              <button
                onClick={handleEnablePushNotifications}
                className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Activar notificaciones push
              </button>
            </div>
          )}

          <div className="p-6 border-b">
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg transition font-medium ${
                  filter === 'all'
                    ? 'bg-primary-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-4 py-2 rounded-lg transition font-medium ${
                  filter === 'unread'
                    ? 'bg-primary-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                No leídas ({unreadCount})
              </button>
            </div>
          </div>

          <div className="divide-y">
            {notifications.length === 0 ? (
              <div className="p-12 text-center">
                <Bell className="mx-auto text-gray-300 mb-4" size={64} />
                <p className="text-gray-600 text-lg font-medium">
                  {filter === 'unread' 
                    ? 'No tienes notificaciones sin leer'
                    : 'No tienes notificaciones'}
                </p>
                <p className="text-gray-500 text-sm mt-2">
                  Aquí aparecerán las actualizaciones de tus reservas y solicitudes
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-6 hover:bg-gray-50 transition ${
                    !notification.read ? 'bg-blue-50 border-l-4 border-primary-600' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-lg text-gray-900">
                          {notification.title}
                        </h3>
                        {!notification.read && (
                          <div className="w-3 h-3 bg-primary-600 rounded-full animate-pulse" />
                        )}
                      </div>
                      <p className="text-gray-700 mb-3">{notification.message}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(notification.createdAt).toLocaleString('es-ES', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>

                    {!notification.read && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
                      >
                        <Check size={16} />
                        <span className="hidden sm:inline">Marcar como leída</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
