'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Bell, Check, CheckCheck, Home, Package, MapPin, MessageSquare } from 'lucide-react'
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

export default function NotificationsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const { isSupported, isSubscribed, subscribeToPush } = usePushNotifications()
  const [bookingsCount, setBookingsCount] = useState(0)
  const [requestsCount, setRequestsCount] = useState(0)

  const fetchCounts = async () => {
    try {
      const [bookingsRes, requestsRes] = await Promise.all([
        fetch('/api/bookings'),
        fetch('/api/service-requests')
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
    } catch (error) {
      console.error('Error fetching counts:', error)
    }
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
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

  const unreadCount = notifications.filter(n => !n.read).length

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
              <div className="min-w-0 flex-1">
                <div className="flex sm:block items-center gap-2">
                  <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Notificaciones</h1>
                  <p className="text-xs sm:text-sm text-gray-600">({unreadCount} sin leer)</p>
                </div>
              </div>
            </div>
            </div>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition text-xs sm:text-sm flex-shrink-0"
              >
                <CheckCheck size={16} className="sm:w-[18px] sm:h-[18px]" />
                <span className="hidden sm:inline">Marcar todas como leídas</span>
                <span className="sm:hidden">Marcar</span>
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 bg-gray-50">
          <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
            <nav className="flex gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
              >
                <Home size={20} className="sm:w-[22px] sm:h-[22px]" />
                <span className="hidden sm:inline">Resumen</span>
              </button>

              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
              >
                <Package size={20} className="sm:w-[22px] sm:h-[22px]" />
                <span className="hidden sm:inline">Mis Reservas</span>
                {bookingsCount > 0 && (
                  <span className="bg-primary-600 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                    {bookingsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
              >
                <MessageSquare size={20} className="sm:w-[22px] sm:h-[22px]" />
                <span className="hidden sm:inline">Mis Solicitudes</span>
                {requestsCount > 0 && (
                  <span className="bg-orange-500 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                    {requestsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => router.push('/notifications')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-primary-600 text-primary-600 transition whitespace-nowrap"
              >
                <Bell size={20} className="sm:w-[22px] sm:h-[22px]" />
                <span className="hidden sm:inline">Notificaciones</span>
              </button>

              <button
                onClick={() => router.push('/dashboard/addresses')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
              >
                <MapPin size={20} className="sm:w-[22px] sm:h-[22px]" />
                <span className="hidden sm:inline">Mis Direcciones</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg overflow-hidden">
          {isSupported && !isSubscribed && (
            <div className="p-4 sm:p-6 bg-blue-50 border-b border-blue-200">
              <p className="text-xs sm:text-sm text-blue-800 mb-2 sm:mb-3">
                Activa las notificaciones push para recibir alertas en tiempo real
              </p>
              <button
                onClick={handleEnablePushNotifications}
                className="text-xs sm:text-sm bg-blue-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-blue-700 transition font-medium"
              >
                Activar notificaciones push
              </button>
            </div>
          )}

          <div className="p-4 sm:p-6 border-b">
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition font-medium text-xs sm:text-sm ${
                  filter === 'all'
                    ? 'bg-primary-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition font-medium text-xs sm:text-sm ${
                  filter === 'unread'
                    ? 'bg-primary-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="hidden xs:inline">No leídas</span>
                <span className="xs:hidden">Sin leer</span> ({unreadCount})
              </button>
            </div>
          </div>

          <div className="divide-y">
            {notifications.length === 0 ? (
              <div className="p-8 sm:p-12 text-center">
                <Bell className="mx-auto text-gray-300 mb-3 sm:mb-4" size={48} />
                <p className="text-gray-600 text-base sm:text-lg font-medium">
                  {filter === 'unread'
                    ? 'No tienes notificaciones sin leer'
                    : 'No tienes notificaciones'}
                </p>
                <p className="text-gray-500 text-xs sm:text-sm mt-2">
                  Aquí aparecerán las actualizaciones de tus reservas y solicitudes
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 sm:p-6 hover:bg-gray-50 transition ${
                    !notification.read ? 'bg-blue-50 border-l-4 border-primary-600' : ''
                  }`}
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <h3 className="font-semibold text-base sm:text-lg text-gray-900 flex-1">
                          {notification.title}
                        </h3>
                        {!notification.read && (
                          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-primary-600 rounded-full animate-pulse flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-gray-700 mb-2 sm:mb-3 text-sm sm:text-base">{notification.message}</p>
                      <p className="text-xs sm:text-sm text-gray-500">
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
                        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium flex-shrink-0"
                      >
                        <Check size={14} className="sm:w-4 sm:h-4" />
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
