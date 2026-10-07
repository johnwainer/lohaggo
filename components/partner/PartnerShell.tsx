'use client'

import { CountBadge } from '@/components/ui/count-badge'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Suspense, useEffect, useRef, useState } from 'react'
import { Sparkles, ChevronDown, MapPin, LogOut, Home, Package, Zap, MessageSquare, UserCircle, Shield, Settings, Landmark, Wallet, Award, Globe, Menu, X } from 'lucide-react'
import NotificationBell from '@/components/NotificationBell'
import { useCity } from '@/lib/city-context'
import { usePartnerNavCounts } from '@/hooks/usePartnerNavCounts'

type SidebarLink = {
  id: string
  label: string
  icon: typeof Home
  href: string
  highlight?: boolean
  badgeLabel?: string
}

const SIDEBAR_LINKS: readonly SidebarLink[] = [
  { id: 'overview', label: 'Inicio', icon: Home, href: '/partner' },
  { id: 'bookings', label: 'Agenda', icon: Package, href: '/partner?tab=bookings', badgeLabel: 'reservas por atender' },
  { id: 'solicitudes', label: 'Oportunidades', icon: Zap, href: '/partner?tab=my-requests', highlight: true, badgeLabel: 'oportunidades nuevas' },
  { id: 'messages', label: 'Chats', icon: MessageSquare, href: '/partner/messages', badgeLabel: 'mensajes sin leer' },
  { id: 'payments', label: 'Ingresos', icon: Wallet, href: '/partner/payments' },
]

const BUSINESS_LINKS = [
  { id: 'services', label: 'Mis Servicios', icon: Settings, href: '/partner/services' },
  { id: 'verification', label: 'Verificación', icon: Shield, href: '/partner/verification' },
  { id: 'profile', label: 'Mi Perfil', icon: Globe, href: '/profile' },
  { id: 'bank-accounts', label: 'Datos Bancarios', icon: Landmark, href: '/partner/bank-accounts' },
  { id: 'achievements', label: 'Logros', icon: Award, href: '/partner/achievements' },
] as const

/** useSearchParams needs a Suspense boundary; the fallback reads the tab as empty (Inicio) until it resolves. */
export default function PartnerShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PartnerShellInner tab={null}>{children}</PartnerShellInner>}>
      <PartnerShellWithParams>{children}</PartnerShellWithParams>
    </Suspense>
  )
}

function PartnerShellWithParams({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams()
  return <PartnerShellInner tab={searchParams.get('tab')}>{children}</PartnerShellInner>
}

function PartnerShellInner({ children, tab }: { children: React.ReactNode; tab: string | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const { selectedCity, cities, setShowCityModal, isGeolocating } = useCity()
  const counts = usePartnerNavCounts()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  const currentCity = cities.find(c => c.slug === selectedCity)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      // Si el click cae dentro del dropdown desktop o del panel mobile, no cerrar.
      if (menuRef.current?.contains(target)) return
      if (mobileMenuRef.current?.contains(target)) return
      setMenuOpen(false)
    }
    if (menuOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  useEffect(() => { setMenuOpen(false) }, [pathname, tab])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const isLinkActive = (href: string) => {
    const [base, query] = href.split('?')
    if (base !== pathname) return false
    const want = query ? new URLSearchParams(query).get('tab') : null
    if (base !== '/partner') return true
    // /partner sin tab (o tab desconocido) → Inicio
    const has = tab === 'bookings' || tab === 'my-requests' ? tab : null
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

              {/* Mobile: hamburguesa (toggle full-width slide-down panel) */}
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
                aria-expanded={menuOpen}
                aria-controls="partner-mobile-menu"
                className="md:hidden inline-flex h-11 w-11 items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 text-gray-700 hover:text-primary-600 hover:bg-primary-500/5 transition"
              >
                {menuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>

              {/* Desktop: avatar + nombre + dropdown */}
              <div ref={menuRef} className="relative hidden md:block">
                <button
                  type="button"
                  onClick={() => setMenuOpen(!menuOpen)}
                  aria-label="Menú de cuenta"
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  className="flex items-center space-x-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 bg-gray-50 hover:bg-gray-100 px-4 py-2.5 rounded-xl transition-all border-2 border-gray-200 hover:border-primary-500/30"
                >
                  {session?.user?.image ? (
                    <img src={session.user.image} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-white font-black text-sm">
                      {initial}
                    </div>
                  )}
                  <span className="text-sm font-bold text-gray-700">{session?.user?.name}</span>
                  <ChevronDown size={16} className={`text-gray-500 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                </button>

                {menuOpen && (
                  <div role="menu" aria-label="Cuenta" className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border-2 border-gray-100 py-2 animate-scale-in">
                    <div role="presentation" className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-bold text-gray-900">{session?.user?.name}</p>
                      <p className="text-xs text-gray-600 font-medium truncate">{session?.user?.email}</p>
                      <span className="inline-block mt-2 text-xs font-bold text-primary-600 bg-primary-500/10 px-3 py-1 rounded-full border border-primary-500/20">
                        SOCIO
                      </span>
                    </div>
                    <Link href="/profile" role="menuitem" className="w-full flex items-center space-x-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors font-bold">
                      <UserCircle size={16} />
                      <span>Mi Perfil</span>
                    </Link>
                    <Link href="/partner/services" role="menuitem" className="w-full flex items-center space-x-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors font-bold">
                      <Settings size={16} />
                      <span>Mis Servicios</span>
                    </Link>
                    <Link href="/partner/verification" role="menuitem" className="w-full flex items-center space-x-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors font-bold">
                      <Shield size={16} />
                      <span>Verificación</span>
                    </Link>
                    <Link href="/partner/bank-accounts" role="menuitem" className="w-full flex items-center space-x-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors font-bold">
                      <Landmark size={16} />
                      <span>Datos Bancarios</span>
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => signOut({ callbackUrl: '/' })}
                      className="w-full flex items-center space-x-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors font-bold"
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

        {/* Mobile slide-down menu — mismo patrón visual que Navbar.tsx público.
            No incluye Inicio/Agenda/Solicitudes/Chats/Ingresos porque ya están
            en el bottom nav: aquí solo van enlaces a Mi Negocio + sesión. */}
        {menuOpen && (
          <>
            <div
              className="md:hidden fixed inset-0 z-40 bg-black/20"
              aria-hidden="true"
              onClick={() => setMenuOpen(false)}
            />
            <div
              ref={mobileMenuRef}
              id="partner-mobile-menu"
              className="md:hidden relative z-50 bg-white border-t border-gray-200 animate-slide-down shadow-lg max-h-[calc(100vh-5rem)] overflow-y-auto"
            >
              <div className="px-4 pt-2 pb-4 space-y-2">
                <div className="flex items-center space-x-3 px-4 py-2">
                  {session?.user?.image ? (
                    <img src={session.user.image} alt={session.user.name || ''} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-white font-black">
                      {initial}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{session?.user?.name}</p>
                    <p className="text-xs text-gray-600 font-medium truncate">{session?.user?.email}</p>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-2" />

                <button
                  onClick={() => { setShowCityModal(true); setMenuOpen(false) }}
                  className="w-full flex items-center px-4 py-3 rounded-xl text-sm font-bold text-gray-700 hover:text-primary-600 hover:bg-primary-500/5 transition-all"
                >
                  <MapPin size={18} className="text-primary-600 mr-2" />
                  <span>{isGeolocating ? 'Detectando...' : currentCity?.name ?? 'Seleccionar ciudad'}</span>
                </button>

                <div className="border-t border-gray-200 pt-2" />

                {BUSINESS_LINKS.map(link => {
                  const Icon = link.icon
                  return (
                    <Link
                      key={link.id}
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center space-x-2 text-gray-700 hover:text-primary-600 hover:bg-primary-500/5 px-4 py-3 rounded-xl text-sm font-bold transition-all"
                    >
                      <Icon size={18} />
                      <span>{link.label}</span>
                    </Link>
                  )
                })}

                <div className="border-t border-gray-200 pt-2 mt-2">
                  <button
                    onClick={() => { setMenuOpen(false); signOut({ callbackUrl: '/' }) }}
                    className="w-full flex items-center space-x-2 text-red-600 hover:text-red-700 hover:bg-red-50 px-4 py-3 rounded-xl text-sm font-bold transition-all"
                  >
                    <LogOut size={18} />
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </header>

      {/* Body: sidebar (desktop) + content. Mobile: solo content, bottom nav lo maneja PublicLayout */}
      <div className="max-w-7xl mx-auto px-0 md:px-6 lg:px-8 md:py-6">
        <div className="md:grid md:grid-cols-[220px_1fr] md:gap-6">
          {/* Sidebar desktop */}
          <aside className="hidden md:block">
            <nav aria-label="Panel del socio" className="space-y-1 sticky top-24">
              <div className="px-3 pb-1 text-[11px] uppercase tracking-wide font-bold text-gray-600">Trabajo</div>
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
                    aria-current={active ? 'page' : undefined}
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
                    <CountBadge count={badge} tone={link.highlight ? 'secondary' : 'primary'} label={link.badgeLabel} />
                  </Link>
                )
              })}

              <div className="px-3 pt-4 pb-1 text-[11px] uppercase tracking-wide font-bold text-gray-600">Mi Negocio</div>
              {BUSINESS_LINKS.map(link => {
                const Icon = link.icon
                const active = pathname === link.href
                return (
                  <Link
                    key={link.id}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
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
