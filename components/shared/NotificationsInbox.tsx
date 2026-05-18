'use client'

import { Bell, Check, CheckCheck, Dot, Rocket, ShieldAlert } from 'lucide-react'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: string
  data?: string
}

interface NotificationsInboxProps {
  notifications: Notification[]
  filter: 'all' | 'unread'
  unreadCount: number
  loading: boolean
  hasLoadedOnce: boolean
  push: {
    isSupported: boolean
    isSubscribed: boolean
    permission?: NotificationPermission
    isLoading: boolean
    error?: string | null
  }
  headerSubtitle: string
  emptySubtitle: string
  nav: React.ReactNode
  onFilterChange: (filter: 'all' | 'unread') => void
  onNotificationClick: (notification: Notification) => void
  onMarkAsRead: (notificationId: string) => void
  onMarkAllAsRead: () => void
  onEnablePush: () => void
}

function relativeTime(dateValue: string) {
  const date = new Date(dateValue)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const minutes = Math.floor(diffMs / 60000)

  if (minutes < 1) return 'Ahora mismo'
  if (minutes < 60) return `Hace ${minutes} min`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${hours} h`

  const days = Math.floor(hours / 24)
  if (days < 7) return `Hace ${days} d`

  return date.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

export default function NotificationsInbox({
  notifications,
  filter,
  unreadCount,
  loading,
  hasLoadedOnce,
  push,
  headerSubtitle,
  emptySubtitle,
  nav,
  onFilterChange,
  onNotificationClick,
  onMarkAsRead,
  onMarkAllAsRead,
  onEnablePush
}: NotificationsInboxProps) {
  if (loading && !hasLoadedOnce) {
    return (
      <div className="panel-page min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Cargando notificaciones...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="account-shell">
      <header className="account-header">
        <div className="hidden sm:block max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="min-w-0">
            <h1 className="panel-title">Notificaciones</h1>
            <p className="panel-subtitle mt-1">{headerSubtitle}</p>
          </div>
        </div>

        {nav}
      </header>

      <main className="account-main pb-24 md:pb-8">
        {unreadCount > 0 && (
          <div className="flex justify-end mb-4">
            <button
              onClick={onMarkAllAsRead}
              className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-primary-600 px-3 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition"
            >
              <CheckCheck className="h-4 w-4" />
              Marcar todas como leídas
            </button>
          </div>
        )}
        <div className="surface-card overflow-hidden border border-gray-200/80 shadow-sm">
          {push.isSupported && !push.isSubscribed && push.permission !== 'denied' && (
            <div className="border-b border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-cyan-50 p-4 sm:p-5">
              <div className="flex gap-3">
                <div className="mt-0.5 rounded-xl bg-blue-100 p-2 text-blue-700">
                  <Rocket className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm sm:text-base font-semibold text-gray-900">Activa notificaciones push</p>
                  <p className="mt-1 text-xs sm:text-sm text-gray-700">
                    Recibe alertas en tiempo real de reservas, solicitudes y cambios importantes.
                  </p>

                  {push.error && (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {push.error}
                    </div>
                  )}

                  <button
                    onClick={onEnablePush}
                    disabled={push.isLoading}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Bell className="h-4 w-4" />
                    {push.isLoading ? 'Activando...' : 'Activar push'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {push.permission === 'denied' && (
            <div className="border-b border-amber-200 bg-amber-50 p-4 sm:p-5">
              <div className="flex gap-3">
                <div className="mt-0.5 rounded-xl bg-amber-100 p-2 text-amber-700">
                  <ShieldAlert className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <p className="text-sm sm:text-base font-semibold text-gray-900">Notificaciones bloqueadas</p>
                  <p className="mt-1 text-xs sm:text-sm text-gray-700">
                    Debes permitir notificaciones en tu navegador para recibir alertas instantáneas.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="border-b border-gray-200 bg-white p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => onFilterChange('all')}
                className={`rounded-full px-3 py-1.5 text-xs sm:text-sm font-semibold transition ${
                  filter === 'all'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Todas ({notifications.length})
              </button>
              <button
                onClick={() => onFilterChange('unread')}
                className={`rounded-full px-3 py-1.5 text-xs sm:text-sm font-semibold transition ${
                  filter === 'unread'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Sin leer ({unreadCount})
              </button>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {notifications.length === 0 ? (
              <div className="px-4 py-12 sm:px-8 sm:py-16 text-center">
                <div className="mx-auto mb-4 inline-flex rounded-2xl bg-gray-100 p-3 text-gray-400">
                  <Bell className="h-7 w-7" />
                </div>
                <p className="text-base sm:text-lg font-semibold text-gray-800">
                  {filter === 'unread' ? 'No tienes notificaciones sin leer' : 'Sin notificaciones por ahora'}
                </p>
                <p className="mt-1 text-xs sm:text-sm text-gray-500">{emptySubtitle}</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <article
                  key={notification.id}
                  onClick={() => onNotificationClick(notification)}
                  className={`group cursor-pointer px-4 py-4 sm:px-6 sm:py-5 transition ${
                    !notification.read ? 'bg-blue-50/40' : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className={`mt-0.5 rounded-xl p-2 ${!notification.read ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'}`}>
                      <Bell className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="truncate text-sm sm:text-base font-semibold text-gray-900">{notification.title}</h3>
                        {!notification.read && <Dot className="h-6 w-6 text-primary-600" />}
                      </div>

                      <p className="mt-1 line-clamp-2 text-xs sm:text-sm text-gray-700">{notification.message}</p>

                      <div className="mt-2 flex items-center gap-2 text-[11px] sm:text-xs text-gray-500">
                        <span>{relativeTime(notification.createdAt)}</span>
                        <span aria-hidden="true">•</span>
                        <span>{new Date(notification.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    {!notification.read && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation()
                          onMarkAsRead(notification.id)
                        }}
                        className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-primary-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Leída
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
