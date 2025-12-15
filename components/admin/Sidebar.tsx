'use client'

import { LayoutDashboard, Calendar, Users, UserCheck, Package, BarChart3, Bell, Settings, LogOut, Menu, X, Shield, DollarSign, Wallet, MapPin, CreditCard, ChevronDown, ChevronRight, Percent, Megaphone } from 'lucide-react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useState, useEffect } from 'react'

interface SidebarProps {
  activeSection: string
  onSectionChange: (section: string) => void
}

interface MenuGroup {
  label: string
  items: MenuItem[]
}

interface MenuItem {
  id: string
  label: string
  icon: any
  isLink?: boolean
  href?: string
}

export default function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<string[]>([])
  const router = useRouter()
  const pathname = usePathname()

  const menuGroups: MenuGroup[] = [
    {
      label: 'General',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'bookings', label: 'Reservas', icon: Calendar },
        { id: 'analytics', label: 'Analíticas', icon: BarChart3 },
      ]
    },
    {
      label: 'Usuarios y Socios',
      items: [
        { id: 'users', label: 'Usuarios', icon: Users },
        { id: 'partners', label: 'Socios', icon: UserCheck },
        { id: 'documents', label: 'Verificación', icon: Shield },
      ]
    },
    {
      label: 'Servicios y Ubicaciones',
      items: [
        { id: 'services', label: 'Servicios', icon: Package },
        { id: 'cities', label: 'Ciudades', icon: MapPin },
      ]
    },
    {
      label: 'Marketing',
      items: [
        { id: 'ads', label: 'Publicidad', icon: Megaphone, isLink: true, href: '/admin/ads' },
      ]
    },
    {
      label: 'Finanzas',
      items: [
        { id: 'payments', label: 'Pagos', icon: DollarSign },
        { id: 'commissions', label: 'Comisiones', icon: Percent },
        { id: 'payouts', label: 'Pagos a Socios', icon: Wallet },
      ]
    },
    {
      label: 'Configuración',
      items: [
        { id: 'payment-config', label: 'Config. Pagos', icon: CreditCard, isLink: true, href: '/admin/payment-config' },
        { id: 'notifications', label: 'Notificaciones', icon: Bell },
        { id: 'settings', label: 'Configuración', icon: Settings },
      ]
    }
  ]

  useEffect(() => {
    const groupsToExpand: string[] = []
    menuGroups.forEach((group) => {
      const hasActiveItem = group.items.some(item => item.id === activeSection)
      if (hasActiveItem) {
        groupsToExpand.push(group.label.toLowerCase().replace(/\s+/g, '-'))
      }
    })
    setExpandedGroups(groupsToExpand.length > 0 ? groupsToExpand : ['general'])
  }, [activeSection])

  const handleSectionChange = (section: string) => {
    // If we're on the main admin page, use the callback
    if (pathname === '/admin') {
      onSectionChange(section)
    } else {
      // If we're on a subpage, navigate to /admin first
      router.push('/admin')
    }
    setIsOpen(false)
  }

  const toggleGroup = (groupLabel: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupLabel)
        ? prev.filter(g => g !== groupLabel)
        : [...prev, groupLabel]
    )
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-gradient-to-r from-primary-500 to-secondary-500 text-white p-2.5 rounded-xl shadow-lg"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`w-64 bg-gradient-to-b from-primary-500 to-secondary-500 text-white h-screen fixed left-0 top-0 flex flex-col shadow-2xl z-40 transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="p-4 sm:p-6 border-b border-white/20">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">LoHaggo Admin</h1>
          <p className="text-white/80 text-xs sm:text-sm mt-1 font-medium">Panel de Control</p>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 sm:py-6 px-2 sm:px-3">
          {menuGroups.map((group) => {
            const groupKey = group.label.toLowerCase().replace(/\s+/g, '-')
            const isExpanded = expandedGroups.includes(groupKey)

            return (
              <div key={group.label} className="mb-4">
                <button
                  onClick={() => toggleGroup(groupKey)}
                  className="w-full flex items-center justify-between px-3 sm:px-4 py-2 text-white/60 hover:text-white/90 transition-colors text-xs sm:text-sm font-bold uppercase tracking-wider"
                >
                  <span>{group.label}</span>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {isExpanded && (
                  <div className="mt-1">
                    {group.items.map((item) => {
                      const Icon = item.icon
                      const isActive = activeSection === item.id

                      if (item.isLink && item.href) {
                        return (
                          <Link
                            key={item.id}
                            href={item.href}
                            onClick={() => setIsOpen(false)}
                            className={`w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 sm:py-3.5 rounded-lg sm:rounded-xl mb-1.5 sm:mb-2 transition-all font-semibold text-sm sm:text-base ${
                              isActive
                                ? 'bg-white text-primary-600 shadow-lg scale-105'
                                : 'text-white/90 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <Icon size={18} className="sm:w-5 sm:h-5 flex-shrink-0" />
                            <span>{item.label}</span>
                          </Link>
                        )
                      }

                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSectionChange(item.id)}
                          className={`w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 sm:py-3.5 rounded-lg sm:rounded-xl mb-1.5 sm:mb-2 transition-all font-semibold text-sm sm:text-base ${
                            isActive
                              ? 'bg-white text-primary-600 shadow-lg scale-105'
                              : 'text-white/90 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <Icon size={18} className="sm:w-5 sm:h-5 flex-shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="p-3 sm:p-4 border-t border-white/20">
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 sm:py-3.5 rounded-lg sm:rounded-xl text-white/90 hover:bg-white/10 hover:text-white transition-all font-semibold text-sm sm:text-base"
          >
            <LogOut size={18} className="sm:w-5 sm:h-5 flex-shrink-0" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </>
  )
}
