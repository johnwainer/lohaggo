'use client'

import { useRouter } from 'next/navigation'
import { Home, Package, MessageSquare, Bell, Settings, User } from 'lucide-react'
import { DESIGN_SYSTEM } from '@/lib/design-system'

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
  path?: string
  badge?: number
  badgeColor?: string
  onClick?: () => void
}

interface ClientHeaderProps {
  title: string
  subtitle?: string
  activeTab?: string
  bookingsCount?: number
  requestsCount?: number
  onTabChange?: (tab: string) => void
  showNavigation?: boolean
}

export default function ClientHeader({
  title,
  subtitle,
  activeTab,
  bookingsCount = 0,
  requestsCount = 0,
  onTabChange,
  showNavigation = true,
}: ClientHeaderProps) {
  const router = useRouter()

  const navItems: NavItem[] = [
    {
      id: 'overview',
      label: 'Resumen',
      icon: <Home size={20} className="sm:w-[22px] sm:h-[22px]" />,
      onClick: () => onTabChange?.('overview'),
    },
    {
      id: 'bookings',
      label: 'Mis Reservas',
      icon: <Package size={20} className="sm:w-[22px] sm:h-[22px]" />,
      badge: bookingsCount,
      badgeColor: 'bg-primary-600',
      onClick: () => onTabChange?.('bookings'),
    },
    {
      id: 'requests',
      label: 'Mis Solicitudes',
      icon: <MessageSquare size={20} className="sm:w-[22px] sm:h-[22px]" />,
      badge: requestsCount,
      badgeColor: 'bg-primary-500',
      onClick: () => onTabChange?.('requests'),
    },
    {
      id: 'notifications',
      label: 'Notificaciones',
      icon: <Bell size={20} className="sm:w-[22px] sm:h-[22px]" />,
      path: '/notifications',
    },
    {
      id: 'profile',
      label: 'Mi Perfil',
      icon: <User size={20} className="sm:w-[22px] sm:h-[22px]" />,
      path: '/dashboard/profile',
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
    <header className={DESIGN_SYSTEM.components.header.base}>
      <div className={DESIGN_SYSTEM.components.header.container}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className={DESIGN_SYSTEM.components.header.title}>{title}</h1>
              {subtitle && (
                <p className={`${DESIGN_SYSTEM.components.header.subtitle} hidden sm:block`}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {showNavigation && (
        <div className={DESIGN_SYSTEM.components.nav.container}>
          <div className={DESIGN_SYSTEM.components.nav.wrapper}>
            <nav className={DESIGN_SYSTEM.components.nav.menu}>
              {navItems.map((item) => {
                const isActive = activeTab === item.id
                const itemClasses = `${DESIGN_SYSTEM.components.nav.item.base} ${
                  isActive
                    ? DESIGN_SYSTEM.components.nav.item.active
                    : DESIGN_SYSTEM.components.nav.item.inactive
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
                        className={`${item.badgeColor} text-white text-[10px] px-2 py-0.5 rounded-full ml-2`}
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
