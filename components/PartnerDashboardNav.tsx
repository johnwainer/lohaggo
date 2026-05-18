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
    <>
      {/* Desktop — same look as ClientDashboardNav */}
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

    </>
  )
}
