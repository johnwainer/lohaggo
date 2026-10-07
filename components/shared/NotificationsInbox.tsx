'use client'

import { Bell, Check, CheckCheck, Rocket, ShieldAlert } from 'lucide-react'
import { relativeTime } from '@/components/NotificationBell'

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
        <div className="text-center" role="status">
          <div aria-hidden="true" className="animate-spin motion-reduce:animate-none rounded-full h-16 w-16 border-b-4 border-primary-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Cargando notificaciones...</p>
        </div>
      </div>
    )
  }

  const chipClass = (active: boolean) =>
    `inline-flex min-h-[44px] items-center rounded-full px-4 text-sm font-semibold transition ${
      active ? 'bg-primary-600 text-white shadow-sm' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
    }`

  return (
    <div className="account-shell">
      <header className="account-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="min-w-0">
            <h1 className="panel-title">Notificaciones</h1>
            <p className="panel-subtitle mt-0.5">{headerSubtitle}</p>
          </div>
        </div>

        {nav}
      </header>

      <div className="account-main">
        {unreadCount > 0 && (
          <div className="flex justify-end mb-4">
            <button
              type="button"
              onClick={onMarkAllAsRead}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition"
            >
              <CheckCheck className="h-4 w-4" aria-hidden="true" />
              Marcar todas como leídas
            </button>
          </div>
        )}
        <div className="surface-card overflow-hidden border border-gray-200/80 shadow-sm">
          {push.isSupported && !push.isSubscribed && push.permission !== 'denied' && (
            <div className="border-b border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-cyan-50 p-4 sm:p-5">
              <div className="flex gap-3">
                <div className="mt-0.5 h-fit rounded-xl bg-blue-100 p-2 text-blue-700" aria-hidden="true">
                  <Rocket className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm sm:text-base font-semibold text-gray-900">Activa notificaciones push</h2>
                  <p className="mt-1 text-xs sm:text-sm text-gray-700">
                    Recibe alertas en tiempo real de reservas, solicitudes y cambios importantes.
                  </p>

                  {push.error && (
                    <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {push.error}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={onEnablePush}
                    disabled={push.isLoading}
                    className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Bell className="h-4 w-4" aria-hidden="true" />
                    {push.isLoading ? 'Activando...' : 'Activar push'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {push.permission === 'denied' && (
            <div className="border-b border-amber-200 bg-amber-50 p-4 sm:p-5">
              <div className="flex gap-3">
                <div className="mt-0.5 h-fit rounded-xl bg-amber-100 p-2 text-amber-800" aria-hidden="true">
                  <ShieldAlert className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-semibold text-gray-900">Notificaciones bloqueadas</h2>
                  <p className="mt-1 text-xs sm:text-sm text-gray-700">
                    Debes permitir notificaciones en tu navegador para recibir alertas instantáneas.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="border-b border-gray-200 bg-white p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar notificaciones">
              <button
                type="button"
                onClick={() => onFilterChange('all')}
                aria-pressed={filter === 'all'}
                className={chipClass(filter === 'all')}
              >
                Todas ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => onFilterChange('unread')}
                aria-pressed={filter === 'unread'}
                className={chipClass(filter === 'unread')}
              >
                Sin leer ({unreadCount})
              </button>
            </div>
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-12 sm:px-8 sm:py-16 text-center">
              <div className="mx-auto mb-4 inline-flex rounded-2xl bg-gray-100 p-3 text-gray-500" aria-hidden="true">
                <Bell className="h-7 w-7" />
              </div>
              <p className="text-base sm:text-lg font-semibold text-gray-800">
                {filter === 'unread' ? 'No tienes notificaciones sin leer' : 'Sin notificaciones por ahora'}
              </p>
              <p className="mt-1 text-xs sm:text-sm text-gray-600">{emptySubtitle}</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {notifications.map((notification) => {
                const created = new Date(notification.createdAt)
                return (
                  <li
                    key={notification.id}
                    className={`flex items-start gap-1 pr-2 sm:pr-4 transition ${
                      !notification.read ? 'bg-primary-50/60' : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onNotificationClick(notification)}
                      className="flex min-w-0 flex-1 items-start gap-3 px-4 py-4 text-left sm:gap-4 sm:px-6 sm:py-5 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 rounded-xl p-2 ${!notification.read ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'}`}
                      >
                        <Bell className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          {!notification.read && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-primary-600">
                              <span className="sr-only">Sin leer: </span>
                            </span>
                          )}
                          <span className="truncate text-sm sm:text-base font-semibold text-gray-900">{notification.title}</span>
                        </span>

                        <span className="mt-1 block line-clamp-2 text-xs sm:text-sm text-gray-700">{notification.message}</span>

                        <span className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                          <time dateTime={notification.createdAt} title={created.toLocaleString('es-CO')}>
                            {relativeTime(notification.createdAt)}
                          </time>
                          <span aria-hidden="true">•</span>
                          <span>{created.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                        </span>
                      </span>
                    </button>

                    {!notification.read && (
                      <button
                        type="button"
                        onClick={() => onMarkAsRead(notification.id)}
                        aria-label={`Marcar como leída: ${notification.title}`}
                        className="mt-3 inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1 rounded-full border border-primary-200 bg-white px-3 text-xs font-semibold text-primary-700 hover:bg-primary-50 sm:mt-4"
                      >
                        <Check className="h-4 w-4" aria-hidden="true" />
                        <span>Leída</span>
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
