'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Home, Calendar, User } from 'lucide-react'
import { useSession } from 'next-auth/react'

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()

  const isPartner = session?.user?.role === 'PARTNER'

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

  const partnerTabs = [
    { id: 'home', href: '/', icon: Home, label: 'Inicio', requiresAuth: false },
    { id: 'bookings', href: '/partner/requests', icon: Calendar, label: 'Reservas', requiresAuth: true },
    { id: 'profile', href: '/profile', icon: User, label: 'Perfil', requiresAuth: true },
  ]

  const tabs = !session ? loggedOutTabs : isPartner ? partnerTabs : clientTabs

  const isTabActive = (tab: { id: string; href: string }) => {
    if (tab.id === 'bookings' && isPartner) return pathname.startsWith('/partner/requests')
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
