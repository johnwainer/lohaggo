'use client'

import { useRouter } from 'next/navigation'
import { Home, Package, MessageSquare } from 'lucide-react'

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  path?: string
  badge?: number
  badgeColor?: string
  onClick?: () => void
}

interface PartnerHeaderProps {
  title: string
  subtitle?: string
  activeTab?: string
  bookingsCount?: number
  requestsCount?: number
  onTabChange?: (tab: string) => void
  showNavigation?: boolean
}

export default function PartnerHeader({
  title,
  subtitle,
  activeTab,
  bookingsCount = 0,
  requestsCount = 0,
  onTabChange,
  showNavigation = true,
}: PartnerHeaderProps) {
  const router = useRouter()

  const navItems: NavItem[] = [
    {
      id: 'overview',
      label: 'Resumen',
      icon: <Home className="w-7 h-7 sm:w-6 sm:h-6" />,
      onClick: () => onTabChange?.('overview'),
    },
    {
      id: 'bookings',
      label: 'Mis Reservas',
      icon: <Package className="w-7 h-7 sm:w-6 sm:h-6" />,
      badge: bookingsCount,
      badgeColor: 'bg-primary-600',
      onClick: () => onTabChange?.('bookings'),
    },
    {
      id: 'my-requests',
      label: 'Para Mí',
      icon: <MessageSquare className="w-7 h-7 sm:w-6 sm:h-6" />,
      badge: requestsCount,
      badgeColor: 'bg-primary-500',
      onClick: () => onTabChange?.('my-requests'),
    },
  ]

  const handleNavClick = (item: NavItem) => {
    if (item.path) {
      router.push(item.path)
    } else if (item.onClick) {
      item.onClick()
    }
  }

  return (
    <header className="bg-white shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{title}</h1>
              {subtitle && (
                <p className="text-xs sm:text-sm text-gray-600 truncate hidden sm:block">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {showNavigation && (
        <div className="border-t border-gray-200 bg-gray-50">
          <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
            <nav className="flex gap-1 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
              {navItems.map((item) => {
                const isActive = activeTab === item.id
                const itemClasses = `snap-start flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                  isActive
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`

                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item)}
                    className={itemClasses}
                  >
                    {item.icon}
                    <span className="hidden sm:inline">{item.label}</span>
                    {item.badge && item.badge > 0 && (
                      <span
                        className={`${item.badgeColor} inline-flex items-center justify-center min-w-6 h-6 px-1.5 text-white text-[10px] sm:text-xs rounded-full`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
          </div>
        </div>
      )}
    </header>
  )
}
