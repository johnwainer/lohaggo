'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Home, Search, Calendar, User } from 'lucide-react'
import { useSession } from 'next-auth/react'

export function BottomNav() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const isPartner = session?.user?.role === 'PARTNER'
  const isClient = session?.user?.role === 'CLIENT'

  const loggedOutTabs = [
    { href: '/', icon: Home, label: 'Inicio', requiresAuth: false },
    { href: '/servicios', icon: Search, label: 'Servicios', requiresAuth: false },
    { href: '/profile', icon: User, label: 'Perfil', requiresAuth: true },
  ]

  const clientTabs = [
    { href: '/', icon: Home, label: 'Inicio', requiresAuth: false },
    { href: '/servicios', icon: Search, label: 'Servicios', requiresAuth: false },
    { href: '/dashboard', icon: Calendar, label: 'Reservas', requiresAuth: true },
    { href: '/profile', icon: User, label: 'Perfil', requiresAuth: true },
  ]

  const partnerTabs = [
    { href: '/partner', icon: Home, label: 'Inicio', requiresAuth: false },
    { href: '/partner/services', icon: Search, label: 'Servicios', requiresAuth: true },
    { href: '/partner', icon: Calendar, label: 'Reservas', requiresAuth: true },
    { href: '/profile', icon: User, label: 'Perfil', requiresAuth: true },
  ]

  const tabs = !session ? loggedOutTabs : isPartner ? partnerTabs : clientTabs

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom md:hidden" data-tour="bottom-nav">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href
          const Icon = tab.icon
          const href = tab.requiresAuth && !session ? `/login?callbackUrl=${encodeURIComponent(tab.href)}` : tab.href

          return (
            <Link
              key={tab.href}
              href={href}
              className={`flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-colors ${
                isActive
                  ? 'text-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
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
