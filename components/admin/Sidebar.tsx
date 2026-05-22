'use client'

import { LayoutDashboard, Calendar, Users, UserCheck, Package, BarChart3, Bell, Settings, LogOut, Menu, X, Shield, DollarSign, Wallet, MapPin, CreditCard, ChevronDown, ChevronRight, Percent, Megaphone, Activity, Building2, BookOpen, Smartphone, MessageSquare, Inbox, Link2, Zap, Palette } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { useEffect, useState } from 'react'

function useInboxUnread() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let active = true
    async function fetch_() {
      try {
        const res = await fetch('/api/admin/inbox/unread-count')
        if (res.ok && active) {
          const data = await res.json()
          setCount(data.count ?? 0)
        }
      } catch { /* ignore */ }
    }
    fetch_()
    const id = setInterval(fetch_, 30000)
    return () => { active = false; clearInterval(id) }
  }, [])
  return count
}

interface SidebarProps {
  activeSection: string
  onSectionChange?: (section: string) => void
}

interface MenuGroup {
  label: string
  hint: string
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
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const pathname = usePathname()
  const router = useRouter()
  const inboxUnread = useInboxUnread()

  const menuGroups: MenuGroup[] = [
    {
      label: 'Panel General',
      hint: 'Vista global y salud del sistema',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'analytics', label: 'Analíticas', icon: BarChart3 },
        { id: 'monitoring', label: 'Monitoreo', icon: Activity, isLink: true, href: '/admin/monitoring' },
      ]
    },
    {
      label: 'Operación Diaria',
      hint: 'Reservas, pagos y operaciones',
      items: [
        { id: 'bookings', label: 'Reservas', icon: Calendar },
        { id: 'workflow', label: 'Workflow', icon: Calendar, isLink: true, href: '/admin/workflow' },
        { id: 'payments', label: 'Pagos', icon: DollarSign },
        { id: 'payouts', label: 'Pagos a Socios', icon: Wallet },
        { id: 'finance-ops', label: 'Finanzas', icon: CreditCard, isLink: true, href: '/admin/finance-ops' },
        { id: 'operations', label: 'Centro Ops', icon: Activity, isLink: true, href: '/admin/operations' },
      ]
    },
    {
      label: 'Usuarios y Verificación',
      hint: 'Cuentas, socios y cumplimiento',
      items: [
        { id: 'users', label: 'Usuarios', icon: Users },
        { id: 'partners', label: 'Socios', icon: UserCheck },
        { id: 'compliance', label: 'KYC / KYB', icon: Shield, isLink: true, href: '/admin/compliance' },
        { id: 'documents', label: 'Documentos', icon: BookOpen, isLink: true, href: '/admin/documents' },
      ]
    },
    {
      label: 'Servicios y Ubicaciones',
      hint: 'Catálogo y cobertura geográfica',
      items: [
        { id: 'services', label: 'Servicios', icon: Package },
        { id: 'cities', label: 'Ciudades', icon: MapPin },
      ]
    },
    {
      label: 'Marketing y Canales',
      hint: 'Adquisición, comunicación y alcance',
      items: [
        { id: 'ads', label: 'Publicidad', icon: Megaphone, isLink: true, href: '/admin/ads' },
        { id: 'communications', label: 'Comunicaciones', icon: Bell, isLink: true, href: '/admin/communications' },
        { id: 'inbox', label: 'Bandeja de entrada', icon: Inbox, isLink: true, href: '/admin/inbox' },
        { id: 'messaging', label: 'Mensajería', icon: MessageSquare, isLink: true, href: '/admin/messaging' },
        { id: 'search-analytics', label: 'Búsquedas', icon: BarChart3, isLink: true, href: '/admin/search-analytics' },
        { id: 'pwa-adoption', label: 'Adopción PWA', icon: Smartphone, isLink: true, href: '/admin/pwa-adoption' },
      ]
    },
    {
      label: 'Configuración',
      hint: 'Integraciones, ajustes y plataforma',
      items: [
        { id: 'connections', label: 'Conexiones', icon: Link2, isLink: true, href: '/admin/connections' },
        { id: 'automations', label: 'Automatizaciones', icon: Zap, isLink: true, href: '/admin/automations' },
        { id: 'commissions', label: 'Comisiones', icon: Percent },
        { id: 'banks', label: 'Bancos', icon: Building2, isLink: true, href: '/admin/banks' },
        { id: 'notifications', label: 'Notificaciones', icon: Bell },
        { id: 'security', label: 'Seguridad', icon: Shield, isLink: true, href: '/admin/security' },
        { id: 'risk-control', label: 'Riesgo y Cohortes', icon: Shield, isLink: true, href: '/admin/risk-control' },
        { id: 'platform-control', label: 'Control Plataforma', icon: Settings, isLink: true, href: '/admin/platform-control' },
        { id: 'appearance', label: 'Apariencia', icon: Palette, isLink: true, href: '/admin/appearance' },
        { id: 'training', label: 'Entrenamiento', icon: BookOpen, isLink: true, href: '/admin/training' },
        { id: 'settings', label: 'Ajustes', icon: Settings },
      ]
    }
  ]

  const getGroupKey = (label: string) =>
    label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
  const getItemTestId = (id: string) => `admin-nav-${id}`
  const getItemHref = (item: MenuItem) => item.href ?? `/admin?section=${item.id}`

  useEffect(() => {
    const activeGroup = menuGroups.find((group) =>
      group.items.some((item) => item.id === activeSection)
    )
    setExpandedGroup(activeGroup ? getGroupKey(activeGroup.label) : null)
  }, [activeSection])

  const toggleGroup = (groupKey: string) => {
    setExpandedGroup((prev) => (prev === groupKey ? null : groupKey))
  }

  const handleItemNavigation = (item: MenuItem) => {
    onSectionChange?.(item.id)
    const href = getItemHref(item)

    if (item.isLink && item.href) {
      window.location.assign(item.href)
      setIsOpen(false)
      return
    }

    if (pathname === '/admin') {
      router.replace(href, { scroll: false })
    } else {
      router.push(href)
    }

    setIsOpen(false)
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
            const groupKey = getGroupKey(group.label)
            const hasActiveItem = group.items.some((item) => item.id === activeSection)
            const isExpanded = expandedGroup === groupKey

            return (
              <div
                key={group.label}
                className={`mb-3 rounded-xl border transition-all ${
                  hasActiveItem
                    ? 'border-white/35 bg-white/10'
                    : 'border-transparent bg-white/5 hover:bg-white/10'
                }`}
              >
                <button
                  onClick={() => toggleGroup(groupKey)}
                  aria-expanded={isExpanded}
                  aria-controls={`admin-group-${groupKey}`}
                  data-testid={`admin-group-${groupKey}`}
                  className={`w-full flex items-center justify-between px-3 sm:px-4 py-3 transition-colors ${
                    hasActiveItem ? 'text-white' : 'text-white/80 hover:text-white'
                  }`}
                >
                  <div className="min-w-0 text-left">
                    <p className="text-xs sm:text-sm font-bold uppercase tracking-wider">{group.label}</p>
                    <p className="text-[11px] text-white/70 truncate">{group.hint}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
                      {group.items.length}
                    </span>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                </button>

                <div
                  id={`admin-group-${groupKey}`}
                  aria-hidden={!isExpanded}
                  className={isExpanded ? 'block' : 'hidden'}
                >
                  <div className="mt-1 px-2 pb-2">
                    {group.items.map((item) => {
                      const Icon = item.icon
                      const isActive = activeSection === item.id

                      return (
                        <button
                          key={item.id}
                          onClick={() => handleItemNavigation(item)}
                          data-testid={getItemTestId(item.id)}
                          className={`w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 sm:py-3.5 rounded-lg sm:rounded-xl mb-1.5 sm:mb-2 transition-all font-semibold text-sm sm:text-base text-left ${
                            isActive
                              ? 'bg-white text-primary-600 shadow-lg scale-105'
                              : 'text-white/90 hover:bg-white/15 hover:text-white'
                          }`}
                        >
                          <Icon size={18} className="sm:w-5 sm:h-5 flex-shrink-0" />
                          <span className="flex-1">{item.label}</span>
                          {item.id === 'inbox' && inboxUnread > 0 && (
                            <span className="rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">
                              {inboxUnread > 99 ? '99+' : inboxUnread}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
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
