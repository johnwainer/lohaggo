'use client'

import { CountBadge } from '@/components/ui/count-badge'
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

/** Counts come only from /api/partner/nav-counts; the count props are kept for old callsites and ignored. */
export default function PartnerDashboardNav({
  activeTab = null,
  onTabChange,
}: PartnerDashboardNavProps) {
  const router = useRouter()
  const pathname = usePathname()
  const liveCounts = usePartnerNavCounts()

  const bookingsCount = liveCounts.bookings
  const requestsCount = liveCounts.requests
  const messagesCount = liveCounts.messages

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
      label: 'Agenda',
      icon: Package,
      path: '/partner?tab=bookings',
      badge: bookingsCount,
      badgeLabel: 'reservas por atender',
      isTab: true,
    },
    {
      id: 'my-requests' as const,
      label: 'Oportunidades',
      icon: Bell,
      path: '/partner?tab=my-requests',
      badge: requestsCount,
      badgeLabel: 'oportunidades nuevas',
      isTab: true,
    },
    {
      id: 'messages' as const,
      label: 'Chats',
      icon: MessageSquare,
      path: '/partner/messages',
      badge: messagesCount,
      badgeLabel: 'mensajes sin leer',
      isTab: false,
    },
    {
      id: 'payments' as const,
      label: 'Ingresos',
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
          <nav aria-label="Secciones del panel" className="flex gap-1 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = isItemActive(item)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNav(item)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`snap-start flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                    isActive
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                  <CountBadge count={item.badge} label={'badgeLabel' in item ? item.badgeLabel : undefined} />
                </button>
              )
            })}
          </nav>
        </div>
      </div>

    </>
  )
}
