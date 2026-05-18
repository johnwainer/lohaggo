'use client'

import { useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Home, Package, Bell, MessageSquare, Wallet, UserCircle } from 'lucide-react'
import { usePartnerNavCounts } from '@/hooks/usePartnerNavCounts'

interface PartnerDashboardNavProps {
  bookingsCount?: number
  requestsCount?: number
  messagesCount?: number
  notificationsCount?: number
  activeTab?: string | null
  onTabChange?: (tab: 'overview' | 'bookings' | 'my-requests') => void
}

export default function PartnerDashboardNav({
  bookingsCount: bookingsCountProp = 0,
  requestsCount = 0,
  messagesCount: messagesCountProp = 0,
  activeTab = null,
  onTabChange,
}: PartnerDashboardNavProps) {
  const router = useRouter()
  const pathname = usePathname()
  const liveCounts = usePartnerNavCounts()

  // Prefer live counts fetched internally; fall back to props passed by the page
  const bookingsCount = liveCounts.bookings || bookingsCountProp
  const messagesCount = liveCounts.messages || messagesCountProp

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
    {
      id: 'account' as const,
      label: 'Cuenta',
      icon: UserCircle,
      path: '/profile',
      badge: 0,
      isTab: false,
    },
  ]), [bookingsCount, requestsCount, messagesCount])

  const ACCOUNT_PATHS = ['/profile', '/partner/services', '/partner/verification', '/partner/bank-accounts', '/partner/achievements']

  const isItemActive = (item: (typeof navItems)[number]) => {
    if (item.id === 'account') return ACCOUNT_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
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
    <div className="border-t border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
      <nav className="flex overflow-x-auto scrollbar-hide snap-x snap-mandatory">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = isItemActive(item)
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNav(item)}
              className={`snap-start flex-shrink-0 flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition whitespace-nowrap ${
                isActive
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
              {item.badge > 0 && (
                <span className="bg-primary-600 text-white text-[9px] px-1.5 py-0.5 rounded-full leading-none">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>
      </div>
    </div>
  )
}
