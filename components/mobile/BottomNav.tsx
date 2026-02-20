'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, Search, Calendar, User } from 'lucide-react'
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
    { id: 'services', href: '/servicios', icon: Search, label: 'Servicios', requiresAuth: false },
    { id: 'profile', href: '/profile', icon: User, label: 'Perfil', requiresAuth: true },
  ]

  const clientTabs = [
    { id: 'home', href: '/', icon: Home, label: 'Inicio', requiresAuth: false },
    { id: 'services', href: '/servicios', icon: Search, label: 'Servicios', requiresAuth: false },
    { id: 'bookings', href: '/dashboard', icon: Calendar, label: 'Reservas', requiresAuth: true },
    { id: 'profile', href: '/profile', icon: User, label: 'Perfil', requiresAuth: true },
  ]

  const partnerTabs = [
    { id: 'home', href: '/', icon: Home, label: 'Inicio', requiresAuth: false },
    { id: 'services', href: '/servicios', icon: Search, label: 'Servicios', requiresAuth: false },
    { id: 'bookings', href: '/partner/requests', icon: Calendar, label: 'Reservas', requiresAuth: true },
    { id: 'profile', href: '/profile', icon: User, label: 'Perfil', requiresAuth: true },
  ]

  const tabs = !session ? loggedOutTabs : isPartner ? partnerTabs : clientTabs

  const isTabActive = (tab: { id: string; href: string }) => {
    if (tab.id === 'bookings' && isPartner) return pathname.startsWith('/partner/requests')
    if (tab.href === '/servicios') return pathname.startsWith('/servicios')
    if (tab.href === '/dashboard') return pathname.startsWith('/dashboard')
    return pathname === tab.href
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom md:hidden" data-tour="bottom-nav">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const isActive = isTabActive(tab)
          const Icon = tab.icon

          if (tab.requiresAuth && !session) {
            return (
              <button
                key={tab.id}
                onClick={() => handleNavigation(tab.href, tab.requiresAuth)}
                className={`flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-colors ${
                  isActive ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            )
          }

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-colors ${
                isActive ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs font-medium">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
