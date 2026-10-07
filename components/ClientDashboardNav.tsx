'use client'

import { CountBadge } from '@/components/ui/count-badge'
import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Home, Calendar, Heart, Bell, Send } from 'lucide-react'
import { useNotificationUnreadCount } from '@/hooks/useNotificationUnreadCount'
import { useClientNavCounts } from '@/hooks/useClientNavCounts'

export type ClientDashboardTab = 'overview' | 'bookings' | 'requests' | 'favorites'

interface ClientDashboardNavProps {
  /** Overrides of the live counts (0 or absent uses the live count) */
  bookingsCount?: number
  requestsCount?: number
  favoritesCount?: number
  notificationsCount?: number
  activeTab?: ClientDashboardTab | 'notifications' | null
  onTabChange?: (tab: ClientDashboardTab) => void
}

export default function ClientDashboardNav({
  bookingsCount,
  requestsCount,
  favoritesCount,
  notificationsCount,
  activeTab = null,
  onTabChange
}: ClientDashboardNavProps) {
  const router = useRouter()
  const live = useClientNavCounts()
  const liveNotificationsCount = useNotificationUnreadCount(true)
  const unreadNotifications = notificationsCount ?? liveNotificationsCount

  const tabs = useMemo(() => ([
    { id: 'overview' as const, label: 'Resumen', icon: Home, path: '/dashboard', badge: 0, badgeLabel: '' },
    { id: 'bookings' as const, label: 'Reservas', icon: Calendar, path: '/dashboard?tab=bookings', badge: bookingsCount || live.bookings || 0, badgeLabel: 'reservas en curso' },
    { id: 'requests' as const, label: 'Solicitudes', icon: Send, path: '/dashboard?tab=requests', badge: requestsCount || live.action || 0, badgeLabel: 'pendientes de ti' },
    { id: 'favorites' as const, label: 'Favoritos', icon: Heart, path: '/dashboard?tab=favorites', badge: favoritesCount || live.favorites || 0, badgeLabel: 'favoritos' },
  ]), [bookingsCount, requestsCount, favoritesCount, live.bookings, live.action, live.favorites])

  const isTabs = Boolean(onTabChange)

  const handleNav = (item: (typeof tabs)[number]) => {
    if (onTabChange) {
      onTabChange(item.id)
      return
    }
    router.push(item.path)
  }

  const itemClass = (isActive: boolean) =>
    `snap-start flex min-h-[44px] items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
      isActive
        ? 'border-primary-600 text-primary-700'
        : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
    }`

  return (
    <div className="hidden md:block border-t border-gray-200 bg-gray-50">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <nav aria-label="Secciones de tu panel" className="flex items-center gap-1 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
          <div role={isTabs ? 'tablist' : undefined} aria-label={isTabs ? 'Secciones de tu panel' : undefined} className="flex gap-1">
            {tabs.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  role={isTabs ? 'tab' : undefined}
                  aria-selected={isTabs ? isActive : undefined}
                  aria-current={!isTabs && isActive ? 'page' : undefined}
                  onClick={() => handleNav(item)}
                  data-testid={`dashboard-tab-${item.id}`}
                  className={itemClass(isActive)}
                >
                  <Icon className="w-5 h-5" aria-hidden="true" />
                  <span>{item.label}</span>
                  <CountBadge count={item.badge} label={item.badgeLabel} />
                </button>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => router.push('/notifications')}
            data-testid="dashboard-tab-notifications"
            aria-current={activeTab === 'notifications' ? 'page' : undefined}
            className={itemClass(activeTab === 'notifications')}
          >
            <Bell className="w-5 h-5" aria-hidden="true" />
            <span>Notificaciones</span>
            <CountBadge count={unreadNotifications} label="notificaciones sin leer" />
          </button>
        </nav>
      </div>
    </div>
  )
}
