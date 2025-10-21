'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Bell, Check, CheckCheck, Trash2, Menu, X, Home, Package, ShoppingBag, LogOut, User } from 'lucide-react'
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
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { isSupported, isSubscribed, subscribeToPush } = usePushNotifications()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      fetchNotifications()
    }
  }, [status, filter])

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
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b bg-gradient-to-r from-primary-600 to-primary-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                  <User className="text-primary-600" size={20} />
                </div>
                <div>
                  <h2 className="font-bold text-white">Mi Panel</h2>
                  <p className="text-xs text-primary-100">{session?.user?.name}</p>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white">
                <X size={24} />
              </button>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              <Home size={20} />
              <span>Resumen</span>
            </button>

            <button
              onClick={() => router.push('/dashboard')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              <Package size={20} />
              <span>Mis Reservas</span>
            </button>

            <button
              onClick={() => router.push('/notifications')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-primary-50 text-primary-700 font-semibold"
            >
              <Bell size={20} />
              <span>Notificaciones</span>
              {unreadCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>

            <div className="pt-4 border-t mt-4">
              <button
                onClick={() => router.push('/servicios')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                <ShoppingBag size={20} />
                <span>Explorar Servicios</span>
              </button>
            </div>
          </nav>

          <div className="p-4 border-t">
            <button
              onClick={() => router.push('/api/auth/signout')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition"
            >
              <LogOut size={20} />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:ml-64">
        <header className="bg-white shadow-sm sticky top-0 z-40">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden text-gray-600 hover:text-gray-900"
                >
                  <Menu size={24} />
                </button>
                <div className="flex items-center gap-3">
                  <Bell className="text-primary-600" size={32} />
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
                    <p className="text-sm text-gray-600">{unreadCount} sin leer</p>
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
        </header>

        <main className="p-4 sm:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto">
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
          </div>
        </main>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}
