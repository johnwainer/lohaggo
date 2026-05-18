'use client'

import { useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Home, Package, Bell, MessageSquare, Wallet } from 'lucide-react'
import { useNotificationUnreadCount } from '@/hooks/useNotificationUnreadCount'

interface PartnerDashboardNavProps {
  bookingsCount?: number
  requestsCount?: number
  messagesCount?: number
  notificationsCount?: number
  activeTab?: string | null
  onTabChange?: (tab: 'overview' | 'bookings' | 'my-requests') => void
}

export default function PartnerDashboardNav({
  bookingsCount = 0,
  requestsCount = 0,
  messagesCount = 0,
  notificationsCount,
  activeTab = null,
  onTabChange,
}: PartnerDashboardNavProps) {
  const router = useRouter()
  const pathname = usePathname()
  const liveNotificationsCount = useNotificationUnreadCount(true)
  const unreadNotifications = notificationsCount ?? liveNotificationsCount

  const navItems = useMemo(() => ([
    {
      id: 'overview' as const,
      label: 'Inicio',
      icon: Home,
      path: '/partner',
      badge: 0,
      isTab: true,
    },
    {
      id: 'bookings' as const,
      label: 'Reservas',
      icon: Package,
      path: '/partner?tab=bookings',
      badge: bookingsCount,
      isTab: true,
    },
    {
      id: 'my-requests' as const,
      label: 'Solicitudes',
      icon: Bell,
      path: '/partner?tab=my-requests',
      badge: requestsCount,
      isTab: true,
    },
    {
      id: 'messages' as const,
      label: 'Mensajes',
      icon: MessageSquare,
      path: '/partner/messages',
      badge: messagesCount,
      isTab: false,
    },
    {
      id: 'payments' as const,
      label: 'Pagos',
      icon: Wallet,
      path: '/partner/payments',
      badge: 0,
      isTab: false,
    },
  ]), [bookingsCount, requestsCount, messagesCount])

  const isItemActive = (item: (typeof navItems)[number]) => {
    if (item.isTab) return activeTab === item.id
    return pathname === item.path
  }

  const handleNav = (item: (typeof navItems)[number]) => {
    if (item.isTab && onTabChange) {
      onTabChange(item.id as 'overview' | 'bookings' | 'my-requests')
      return
    }
    router.push(item.path)
  }

  return (
    <>
      {/* Desktop: horizontal tab bar */}
      <div className="hidden md:block border-t border-gray-200 bg-gray-50">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          <nav className="flex gap-1 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = isItemActive(item)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNav(item)}
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

      {/* Mobile: sticky bottom bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
        <nav className="mx-auto grid max-w-lg grid-cols-5 gap-0 px-1 py-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = isItemActive(item)
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item)}
                className={`relative flex min-h-[52px] flex-col items-center justify-center rounded-xl text-[10px] font-medium transition gap-0.5 ${
                  isActive ? 'text-primary-700' : 'text-gray-500 active:scale-95'
                }`}
              >
                <div className={`relative flex items-center justify-center w-8 h-8 rounded-xl transition ${isActive ? 'bg-primary-100' : ''}`}>
                  <Icon className={`h-5 w-5 ${isActive ? 'text-primary-700' : 'text-gray-500'}`} />
                  {item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </>
  )
}
