'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Home, Calendar, User, Package, Bell, MessageSquare, Wallet, UserCircle } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { usePartnerNavCounts } from '@/hooks/usePartnerNavCounts'

const PARTNER_ACCOUNT_PATHS = ['/profile', '/partner/services', '/partner/verification', '/partner/bank-accounts', '/partner/achievements']

const partnerNavItems = [
  { id: 'overview', label: 'Inicio', icon: Home, path: '/partner', isTab: true },
  { id: 'bookings', label: 'Reservas', icon: Package, path: '/partner?tab=bookings', isTab: true },
  { id: 'my-requests', label: 'Solicitudes', icon: Bell, path: '/partner?tab=my-requests', isTab: true },
  { id: 'messages', label: 'Mensajes', icon: MessageSquare, path: '/partner/messages', isTab: false },
  { id: 'payments', label: 'Pagos', icon: Wallet, path: '/partner/payments', isTab: false },
  { id: 'account', label: 'Cuenta', icon: UserCircle, path: '/profile', isTab: false },
] as const

function PartnerBar() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const liveCounts = usePartnerNavCounts()

  const tab = searchParams.get('tab')

  const isItemActive = (id: string) => {
    if (id === 'overview') return pathname === '/partner' && (!tab || tab === 'overview')
    if (id === 'bookings') return pathname === '/partner' && tab === 'bookings'
    if (id === 'my-requests') return pathname === '/partner' && tab === 'my-requests'
    if (id === 'messages') return pathname.startsWith('/partner/messages')
    if (id === 'payments') return pathname.startsWith('/partner/payments')
    if (id === 'account') return PARTNER_ACCOUNT_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
    return false
  }

  const getBadge = (id: string) => {
    if (id === 'bookings') return liveCounts.bookings
    if (id === 'messages') return liveCounts.messages
    return 0
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="mx-auto grid max-w-2xl grid-cols-6 gap-1 px-2 py-2">
        {partnerNavItems.map((item) => {
          const Icon = item.icon
          const isActive = isItemActive(item.id)
          const badge = getBadge(item.id)
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => router.push(item.path)}
              className={`relative flex min-h-[52px] flex-col items-center justify-center rounded-xl text-xs font-medium transition ${
                isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 active:scale-95'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] mt-0.5">{item.label}</span>
              {badge > 0 && (
                <span className="absolute right-1 top-1 inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-primary-600 px-1 text-[9px] font-bold text-white">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()

  const isPartner = session?.user?.role === 'PARTNER'

  if (isPartner) {
    return <PartnerBar />
  }

  const handleNavigation = (href: string, requiresAuth: boolean) => {
    if (requiresAuth && !session) {
      router.push(`/login?callbackUrl=${encodeURIComponent(href)}`)
    } else {
      router.push(href)
    }
  }

  const loggedOutTabs = [
    { id: 'home', href: '/', icon: Home, label: 'Inicio', requiresAuth: false },
    { id: 'profile', href: '/profile', icon: User, label: 'Perfil', requiresAuth: true },
  ]

  const clientTabs = [
    { id: 'home', href: '/', icon: Home, label: 'Inicio', requiresAuth: false },
    { id: 'bookings', href: '/dashboard', icon: Calendar, label: 'Reservas', requiresAuth: true },
    { id: 'profile', href: '/profile', icon: User, label: 'Perfil', requiresAuth: true },
  ]

  const tabs = !session ? loggedOutTabs : clientTabs

  const isTabActive = (tab: { id: string; href: string }) => {
    if (tab.href === '/dashboard') return pathname.startsWith('/dashboard')
    if (tab.href === '/') return pathname === '/' || pathname.startsWith('/servicios')
    return pathname === tab.href
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom md:hidden" data-tour="bottom-nav">
      <div
        className="grid h-16"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const isActive = isTabActive(tab)
          const Icon = tab.icon

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleNavigation(tab.href, tab.requiresAuth)}
              className={`w-full h-full touch-manipulation flex flex-col items-center justify-center gap-1 px-2 py-2 transition-colors active:scale-95 ${
                isActive ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'
              }`}
              aria-label={tab.label}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
