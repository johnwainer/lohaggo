'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Home, Package, MessageSquare, Bell, Globe } from 'lucide-react'
import { useNotificationUnreadCount } from '@/hooks/useNotificationUnreadCount'

interface PartnerDashboardNavProps {
  bookingsCount?: number
  requestsCount?: number
  notificationsCount?: number
  activeTab?: string | null
  onTabChange?: (tab: 'overview' | 'bookings' | 'my-requests' | 'notifications' | 'public-profile') => void
}

export default function PartnerDashboardNav({
  bookingsCount = 0,
  requestsCount = 0,
  notificationsCount,
  activeTab = null,
  onTabChange
}: PartnerDashboardNavProps) {
  const router = useRouter()
  const liveNotificationsCount = useNotificationUnreadCount(true)
  const unreadNotifications = notificationsCount ?? liveNotificationsCount

  const navItems = useMemo(() => ([
    { id: 'overview' as const, label: 'Resumen', icon: Home, path: '/partner', badge: 0 },
    { id: 'bookings' as const, label: 'Reservas', icon: Package, path: '/partner?tab=bookings', badge: bookingsCount },
    { id: 'my-requests' as const, label: 'Para Mí', icon: MessageSquare, path: '/partner?tab=my-requests', badge: requestsCount },
    { id: 'notifications' as const, label: 'Notifs', icon: Bell, path: '/partner/notifications', badge: unreadNotifications },
    { id: 'public-profile' as const, label: 'Mi perfil', icon: Globe, path: '/partner/public-profile', badge: 0 },
  ]), [bookingsCount, requestsCount, unreadNotifications])

  const handleNav = (item: (typeof navItems)[number]) => {
    if (onTabChange && item.id !== 'notifications' && item.id !== 'public-profile') {
      onTabChange(item.id)
      return
    }
    router.push(item.path)
  }

  return (
    <>
      <div className="hidden md:block border-t border-gray-200 bg-gray-50">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          <nav className="flex gap-1 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item)}
                data-testid={`partner-tab-${item.id}`}
                className={`snap-start flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                    isActive
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                  {item.badge > 0 && (
                    <span className="bg-primary-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      <div className="md:hidden border-t border-gray-200 bg-white/95 backdrop-blur-md">
        <nav className="mx-auto grid max-w-2xl grid-cols-5 gap-1 px-2 py-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item)}
                data-testid={`partner-tab-${item.id}`}
                className={`relative flex min-h-[56px] flex-col items-center justify-center rounded-xl text-xs font-medium transition ${
                  isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 active:scale-95'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
                {item.badge > 0 && (
                  <span className="absolute right-3 top-1 inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-bold text-white">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>
    </>
  )
}
