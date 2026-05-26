'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { useEffect, useRef, useState } from 'react'
import { Sparkles, ChevronDown, MapPin, LogOut, Home, Package, Zap, MessageSquare, UserCircle, Shield, Settings, Landmark, Wallet, Award, Globe, Menu } from 'lucide-react'
import NotificationBell from '@/components/NotificationBell'
import { useCity } from '@/lib/city-context'
import { usePartnerNavCounts } from '@/hooks/usePartnerNavCounts'

type SidebarLink = {
  id: string
  label: string
  icon: typeof Home
  href: string
  highlight?: boolean
}

const SIDEBAR_LINKS: readonly SidebarLink[] = [
  { id: 'overview', label: 'Inicio', icon: Home, href: '/partner' },
  { id: 'bookings', label: 'Agenda', icon: Package, href: '/partner?tab=bookings' },
  { id: 'solicitudes', label: 'Solicitudes', icon: Zap, href: '/partner?tab=my-requests', highlight: true },
  { id: 'messages', label: 'Chats', icon: MessageSquare, href: '/partner/messages' },
  { id: 'payments', label: 'Ingresos', icon: Wallet, href: '/partner/payments' },
]

const BUSINESS_LINKS = [
  { id: 'services', label: 'Mis Servicios', icon: Settings, href: '/partner/services' },
  { id: 'verification', label: 'Verificación', icon: Shield, href: '/partner/verification' },
  { id: 'profile', label: 'Mi Perfil', icon: Globe, href: '/profile' },
  { id: 'bank-accounts', label: 'Datos Bancarios', icon: Landmark, href: '/partner/bank-accounts' },
  { id: 'achievements', label: 'Logros', icon: Award, href: '/partner/achievements' },
] as const

export default function PartnerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const { selectedCity, cities, setShowCityModal, isGeolocating } = useCity()
  const counts = usePartnerNavCounts()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const currentCity = cities.find(c => c.slug === selectedCity)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    if (menuOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  useEffect(() => { setMenuOpen(false) }, [pathname])

  const isLinkActive = (href: string) => {
    const [base, query] = href.split('?')
    if (base !== pathname) return false
    if (!query) {
      // /partner exacto sin tab → overview
      return new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('tab') === null
        || base !== '/partner'
    }
    const want = new URLSearchParams(query).get('tab')
    const has = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('tab')
    return want === has
  }

  const initial = session?.user?.name?.charAt(0).toUpperCase() ?? 'S'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar — mismo logo que la versión pública (Navbar.tsx) */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-4 min-w-0">
              <Link href="/partner" className="flex items-center space-x-3 group shrink-0">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-2xl blur opacity-50 group-hover:opacity-75 transition"></div>
                  <div className="relative bg-gradient-to-r from-primary-500 to-secondary-500 p-2.5 rounded-2xl">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div>
                  <span className="text-2xl font-black bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
                    LoHaggo
                  </span>
                  <div className="text-xs text-gray-500 font-semibold -mt-1">Lo necesitas</div>
                </div>
              </Link>

              <button
                onClick={() => setShowCityModal(true)}
                disabled={isGeolocating}
                className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-primary-600 px-2 py-1 rounded-lg hover:bg-gray-100 transition"
              >
                <MapPin size={14} className="text-primary-600" />
                <span className="truncate max-w-[120px]">{isGeolocating ? '...' : currentCity?.name ?? 'Ciudad'}</span>
              </button>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              {/* Mismo NotificationBell en mobile y desktop para que el badge
                  de no-leídos sea consistente. */}
              <NotificationBell />

              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  aria-label="Menú"
                  className="flex items-center gap-2 p-2 sm:px-2 sm:py-1.5 rounded-lg hover:bg-gray-100 transition"
                >
                  {/* Mobile: hamburguesa */}
                  <Menu className="w-6 h-6 text-gray-700 sm:hidden" />
                  {/* Desktop: avatar + nombre */}
                  {session?.user?.image ? (
                    <img src={session.user.image} alt="" className="hidden sm:block w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <div className="hidden sm:flex w-7 h-7 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full items-center justify-center text-white font-bold text-xs">
                      {initial}
                    </div>
                  )}
                  <span className="hidden sm:block text-sm font-semibold text-gray-700 truncate max-w-[120px]">{session?.user?.name}</span>
                  <ChevronDown size={14} className={`hidden sm:block text-gray-500 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 py-1.5 z-50">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-bold text-gray-900 truncate">{session?.user?.name}</p>
                      <p className="text-xs text-gray-500 font-medium truncate">{session?.user?.email}</p>
                    </div>
                    <Link href="/profile" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <UserCircle size={16} />
                      <span>Mi Perfil</span>
                    </Link>
                    <Link href="/partner/services" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <Settings size={16} />
                      <span>Mis Servicios</span>
                    </Link>
                    <Link href="/partner/verification" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <Shield size={16} />
                      <span>Verificación</span>
                    </Link>
                    <Link href="/partner/bank-accounts" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <Landmark size={16} />
                      <span>Datos Bancarios</span>
                    </Link>
                    <button
                      onClick={() => signOut({ callbackUrl: '/' })}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut size={16} />
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Body: sidebar (desktop) + content. Mobile: solo content, bottom nav lo maneja PublicLayout */}
      <div className="max-w-7xl mx-auto px-0 md:px-6 lg:px-8 md:py-6">
        <div className="md:grid md:grid-cols-[220px_1fr] md:gap-6">
          {/* Sidebar desktop */}
          <aside className="hidden md:block">
            <nav className="space-y-1 sticky top-20">
              <div className="px-3 pb-1 text-[11px] uppercase tracking-wide font-bold text-gray-400">Trabajo</div>
              {SIDEBAR_LINKS.map(link => {
                const Icon = link.icon
                const active = isLinkActive(link.href)
                const badge = link.id === 'bookings' ? counts.bookings
                  : link.id === 'solicitudes' ? counts.requests
                  : link.id === 'messages' ? counts.messages
                  : 0
                return (
                  <Link
                    key={link.id}
                    href={link.href}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                      active
                        ? 'bg-primary-50 text-primary-700'
                        : link.highlight
                          ? 'text-secondary-700 hover:bg-secondary-50'
                          : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${link.highlight && !active ? 'text-secondary-600' : ''}`} />
                    <span className="flex-1">{link.label}</span>
                    {badge > 0 && (
                      <span className={`inline-flex min-w-5 h-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white ${
                        link.highlight ? 'bg-secondary-600' : 'bg-primary-600'
                      }`}>
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </Link>
                )
              })}

              <div className="px-3 pt-4 pb-1 text-[11px] uppercase tracking-wide font-bold text-gray-400">Mi Negocio</div>
              {BUSINESS_LINKS.map(link => {
                const Icon = link.icon
                const active = pathname === link.href
                return (
                  <Link
                    key={link.id}
                    href={link.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                      active ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{link.label}</span>
                  </Link>
                )
              })}
            </nav>
          </aside>

          {/* Content */}
          <main className="pb-24 md:pb-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
