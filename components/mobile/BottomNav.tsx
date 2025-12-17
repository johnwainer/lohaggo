'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Home, FileText, Calendar, User } from 'lucide-react'
import { useSession } from 'next-auth/react'

export function BottomNav() {
  const pathname = usePathname()
  const { data: session } = useSession()

  if (!session) return null

  const isPartner = session.user?.role === 'PARTNER'

  const clientTabs = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/dashboard', icon: FileText, label: 'Requests' },
    { href: '/dashboard', icon: Calendar, label: 'Bookings' },
    { href: '/profile', icon: User, label: 'Profile' },
  ]

  const partnerTabs = [
    { href: '/partner', icon: Home, label: 'Home' },
    { href: '/partner/requests', icon: FileText, label: 'Requests' },
    { href: '/partner/services', icon: Calendar, label: 'Services' },
    { href: '/profile', icon: User, label: 'Profile' },
  ]

  const tabs = isPartner ? partnerTabs : clientTabs

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom md:hidden">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href
          const Icon = tab.icon

          return (
            <Link
              key={tab.href}
              href={tab.href}
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
