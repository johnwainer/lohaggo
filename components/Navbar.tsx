'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, X, LogOut, LayoutDashboard, Sparkles, ChevronDown, MapPin, Star, Settings, Shield, Bell, User, CreditCard } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useCity } from '@/lib/city-context'
import NotificationBell from './NotificationBell'
import CityModal from './CityModal'

export function Navbar() {
  const router = useRouter()
  const { data: session } = useSession()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileCityDropdownOpen, setMobileCityDropdownOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const { selectedCity, setSelectedCity, setShowCityModal, cities, isGeolocating, getActiveCities } = useCity()
  const currentCity = cities.find((city) => city.slug === selectedCity)

  const getDashboardLink = () => {
    if (!session?.user) return null

    switch (session.user.role) {
      case 'ADMIN':
        return '/admin'
      case 'PARTNER':
        return '/partner'
      case 'CLIENT':
        return '/dashboard'
      default:
        return '/dashboard'
    }
  }

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    if (userMenuOpen) {
      document.addEventListener('mousedown', handler)
    }
    return () => {
      document.removeEventListener('mousedown', handler)
    }
  }, [userMenuOpen])

  function CitySelector() {
    const [open, setOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      const handler = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setOpen(false)
        }
      }
      if (open) {
        document.addEventListener('mousedown', handler)
      }
      return () => {
        document.removeEventListener('mousedown', handler)
      }
    }, [open])

    const activeCities = cities.filter(c => c.status === 'ACTIVE')
    const comingSoonCities = cities.filter(c => c.status === 'COMING_SOON')

    return (
      <div className="hidden md:block relative" ref={dropdownRef} data-tour="city-selector">
        <button
          onClick={() => setOpen((prev) => !prev)}
          disabled={isGeolocating}
          className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 px-4 py-2 rounded-xl border-2 border-gray-200 hover:border-primary-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <MapPin size={16} className="text-primary-600" />
          <div className="flex flex-col text-left">
            <span className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Ciudad</span>
            <span className="text-sm font-bold text-gray-800">
              {isGeolocating ? 'Detectando...' : currentCity?.name ?? 'Selecciona'}
            </span>
          </div>
          <ChevronDown size={16} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute left-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-50">
            {activeCities.length > 0 && (
              <>
                <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Ciudades disponibles
                </p>
                <div className="space-y-1 px-2">
                  {activeCities.map((city) => (
                    <button
                      key={city.slug}
                      onClick={() => {
                        setSelectedCity(city.slug)
                        setOpen(false)
                      }}
                      className={`w-full flex items-center justify-between px-3 py-3 text-sm font-medium transition-all rounded-lg ${
                        city.slug === selectedCity
                          ? 'text-primary-600 bg-primary-500/10 border-l-4 border-primary-500'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span>{city.name}</span>
                      {city.slug === selectedCity && (
                        <div className="w-2 h-2 rounded-full bg-primary-500" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}

            {comingSoonCities.length > 0 && (
              <>
                <div className="border-t border-gray-100 my-2" />
                <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Próximamente
                </p>
                <div className="space-y-1 px-2">
                  {comingSoonCities.map((city) => (
                    <button
                      key={city.slug}
                      onClick={() => {
                        setOpen(false)
                        router.push(`/ciudad/${city.slug}`)
                      }}
                      className="w-full flex items-center justify-between px-3 py-3 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-all cursor-pointer"
                    >
                      <span>{city.name}</span>
                      <span className="text-xs bg-primary-200 px-2 py-1 rounded-full">Pronto</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="border-t border-gray-100 mt-2 pt-2 px-2">
              <button
                onClick={() => {
                  setShowCityModal(true)
                  setOpen(false)
                }}
                className="w-full text-left px-3 py-2 text-sm font-semibold text-primary-600 hover:bg-primary-500/5 rounded-lg transition-all"
              >
                Ver todas las opciones
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <CityModal />
      <nav className="bg-white shadow-md sticky top-0 z-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center space-x-3 group">
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

            {/* City selector */}
            <CitySelector />
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-2">
            <Link
              href="/"
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                pathname === '/'
                  ? 'text-primary-600 bg-primary-500/5'
                  : 'text-gray-700 hover:text-primary-600 hover:bg-primary-500/5'
              }`}
            >
              Inicio
            </Link>
            <Link
              href="/servicios"
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                pathname?.startsWith('/servicios')
                  ? 'text-primary-600 bg-primary-500/5'
                  : 'text-gray-700 hover:text-primary-600 hover:bg-primary-500/5'
              }`}
            >
              Servicios
            </Link>
            <Link
              href="/faq"
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                pathname === '/faq'
                  ? 'text-primary-600 bg-primary-500/5'
                  : 'text-gray-700 hover:text-primary-600 hover:bg-primary-500/5'
              }`}
            >
              FAQ
            </Link>

            {session ? (
              <>
                <Link
                  href={getDashboardLink() || '/dashboard'}
                  className="flex items-center space-x-2 text-gray-700 hover:text-primary-600 hover:bg-primary-500/5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
                >
                  <LayoutDashboard size={18} />
                  <span>Panel</span>
                </Link>

                <NotificationBell />

                <div className="relative ml-4" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center space-x-3 bg-gray-50 hover:bg-gray-100 px-4 py-2.5 rounded-xl transition-all border-2 border-gray-200 hover:border-primary-500/30"
                  >
                    {session.user.image ? (
                      <img
                        src={session.user.image}
                        alt="Profile"
                        className="w-9 h-9 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-white font-black text-sm">
                        {session.user.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-bold text-gray-700">{session.user.name}</span>
                    <ChevronDown size={16} className={`text-gray-500 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border-2 border-gray-100 py-2 animate-scale-in">
                      <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-sm font-bold text-gray-900">{session.user.name}</p>
                        <p className="text-xs text-gray-500 font-medium">{session.user.email}</p>
                        <span className="inline-block mt-2 text-xs font-bold text-primary-600 bg-primary-500/10 px-3 py-1 rounded-full border border-primary-500/20">
                          {session.user.role}
                        </span>
                      </div>
                      {session.user.role !== 'ADMIN' && (
                        <>
                          <Link
                            href="/profile"
                            className="w-full flex items-center space-x-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors font-bold"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <User size={16} />
                            <span>Mi Perfil</span>
                          </Link>
                          <Link
                            href="/my-ratings"
                            className="w-full flex items-center space-x-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors font-bold"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <Star size={16} />
                            <span>Mis Calificaciones</span>
                          </Link>
                        </>
                      )}
                      {session.user.role === 'PARTNER' && (
                        <>
                          <Link
                            href="/partner/services"
                            className="w-full flex items-center space-x-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors font-bold"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <Settings size={16} />
                            <span>Mis Servicios</span>
                          </Link>
                          <Link
                            href="/partner/verification"
                            className="w-full flex items-center space-x-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors font-bold"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <Shield size={16} />
                            <span>Verificación</span>
                          </Link>
                        </>
                      )}
                      {session.user.role === 'CLIENT' && (
                        <>
                          <Link
                            href="/dashboard/addresses"
                            className="w-full flex items-center space-x-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors font-bold"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <MapPin size={16} />
                            <span>Mis Direcciones</span>
                          </Link>
                          <Link
                            href="/dashboard/payment-methods"
                            className="w-full flex items-center space-x-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors font-bold"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <CreditCard size={16} />
                            <span>Mis Métodos de Pago</span>
                          </Link>
                        </>
                      )}
                      {session.user.role !== 'ADMIN' && (
                        <Link
                          href={session.user.role === 'PARTNER' ? '/partner/notifications' : '/notifications'}
                          className="w-full flex items-center space-x-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors font-bold"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <Bell size={16} />
                          <span>Notificaciones</span>
                        </Link>
                      )}
                      <button
                        onClick={() => signOut({ callbackUrl: '/' })}
                        className="w-full flex items-center space-x-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors font-bold"
                      >
                        <LogOut size={16} />
                        <span>Cerrar sesión</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-3 ml-4">
                <Link
                  href="/login"
                  className="text-gray-700 hover:text-primary-600 hover:bg-primary-500/5 px-6 py-2.5 rounded-xl font-bold transition-all"
                >
                  Iniciar sesión
                </Link>
                <Link
                  href="/register"
                  className="bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-6 py-2.5 rounded-xl hover:from-primary-600 hover:to-secondary-600 transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  Registrarse
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-700 hover:text-primary-600 p-2 rounded-lg hover:bg-primary-500/5 transition-all"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200 animate-slide-down shadow-lg">
          <div className="px-4 pt-2 pb-4 space-y-2">
            {/* City Selector - Mobile */}
            <div className="mb-2">
              <button
                onClick={() => setMobileCityDropdownOpen(!mobileCityDropdownOpen)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold text-gray-700 hover:text-primary-600 hover:bg-primary-500/5 transition-all"
              >
                <div className="flex items-center space-x-2">
                  <MapPin size={18} className="text-primary-600" />
                  <span>
                    {isGeolocating ? 'Detectando...' : currentCity ? currentCity.name : 'Seleccionar ciudad'}
                  </span>
                </div>
                <ChevronDown size={16} className={`transition-transform ${mobileCityDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Collapsible city list for mobile */}
              {mobileCityDropdownOpen && (
                <div className="mt-2 bg-white rounded-xl shadow-lg border border-gray-100 py-2 animate-slide-down">
                  {cities.filter(c => c.status === 'ACTIVE').length > 0 && (
                    <>
                      <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Ciudades disponibles
                      </p>
                      <div className="space-y-1 px-2">
                        {cities.filter(c => c.status === 'ACTIVE').map((city) => (
                          <button
                            key={city.slug}
                            onClick={() => {
                              setSelectedCity(city.slug)
                              setMobileCityDropdownOpen(false)
                            }}
                            className={`w-full flex items-center justify-between px-3 py-3 text-sm font-medium transition-all rounded-lg ${
                              city.slug === selectedCity
                                ? 'text-primary-600 bg-primary-500/10 border-l-4 border-primary-500'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <span>{city.name}</span>
                            {city.slug === selectedCity && (
                              <div className="w-2 h-2 rounded-full bg-primary-500" />
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {cities.filter(c => c.status === 'COMING_SOON').length > 0 && (
                    <>
                      <div className="border-t border-gray-100 my-2" />
                      <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Próximamente
                      </p>
                      <div className="space-y-1 px-2">
                        {cities.filter(c => c.status === 'COMING_SOON').map((city) => (
                          <button
                            key={city.slug}
                            onClick={() => {
                              setMobileCityDropdownOpen(false)
                              setMobileMenuOpen(false)
                              router.push(`/ciudad/${city.slug}`)
                            }}
                            className="w-full flex items-center justify-between px-3 py-3 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-all cursor-pointer"
                          >
                            <span>{city.name}</span>
                            <span className="text-xs bg-primary-200 px-2 py-1 rounded-full">Pronto</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  <div className="border-t border-gray-100 mt-2 pt-2 px-2">
                    <button
                      onClick={() => {
                        setShowCityModal(true)
                        setMobileCityDropdownOpen(false)
                        setMobileMenuOpen(false)
                      }}
                      className="w-full text-left px-3 py-2 text-sm font-semibold text-primary-600 hover:bg-primary-500/5 rounded-lg transition-all"
                    >
                      Ver todas las opciones
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 pt-2"></div>

            {!session && (
              <>
                <Link
                  href="/"
                  className={`block px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                    pathname === '/'
                      ? 'text-primary-600 bg-primary-500/5'
                      : 'text-gray-700 hover:text-primary-600 hover:bg-primary-500/5'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Inicio
                </Link>
                <Link
                  href="/servicios"
                  className={`block px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                    pathname?.startsWith('/servicios')
                      ? 'text-primary-600 bg-primary-500/5'
                      : 'text-gray-700 hover:text-primary-600 hover:bg-primary-500/5'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Servicios
                </Link>
                <Link
                  href="/faq"
                  className={`block px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                    pathname === '/faq'
                      ? 'text-primary-600 bg-primary-500/5'
                      : 'text-gray-700 hover:text-primary-600 hover:bg-primary-500/5'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  FAQ
                </Link>
              </>
            )}

            {session ? (
              <>
                <Link
                  href={getDashboardLink() || '/dashboard'}
                  className="flex items-center space-x-2 text-gray-700 hover:text-primary-600 hover:bg-primary-500/5 px-4 py-3 rounded-xl text-sm font-bold transition-all"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <LayoutDashboard size={18} />
                  <span>Panel</span>
                </Link>
                <Link
                  href="/faq"
                  className={`block px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                    pathname === '/faq'
                      ? 'text-primary-600 bg-primary-500/5'
                      : 'text-gray-700 hover:text-primary-600 hover:bg-primary-500/5'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  FAQ
                </Link>
                <div className="border-t border-gray-200 pt-2 mt-2 space-y-2">
                  <div className="flex items-center space-x-3 px-4 py-2 mb-1">
                    {session.user.image ? (
                      <img
                        src={session.user.image}
                        alt="Profile"
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-white font-black">
                        {session.user.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-bold text-gray-900">{session.user.name}</p>
                      <p className="text-xs text-gray-500 font-medium">{session.user.email}</p>
                      <span className="inline-block mt-1 text-xs font-bold text-primary-600 bg-primary-500/10 px-2 py-0.5 rounded-full border border-primary-500/20">
                        {session.user.role}
                      </span>
                    </div>
                  </div>
                  {session.user.role !== 'ADMIN' && (
                    <>
                      <Link
                        href="/my-ratings"
                        className="flex items-center space-x-2 text-gray-700 hover:text-primary-600 hover:bg-primary-500/5 px-4 py-3 rounded-xl text-sm font-bold transition-all"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Star size={18} />
                        <span>Mis Calificaciones</span>
                      </Link>
                    </>
                  )}
                  {session.user.role === 'PARTNER' && (
                    <>
                      <Link
                        href="/partner/services"
                        className="flex items-center space-x-2 text-gray-700 hover:text-primary-600 hover:bg-primary-500/5 px-4 py-3 rounded-xl text-sm font-bold transition-all"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Settings size={18} />
                        <span>Mis Servicios</span>
                      </Link>
                      <Link
                        href="/partner/verification"
                        className="flex items-center space-x-2 text-gray-700 hover:text-primary-600 hover:bg-primary-500/5 px-4 py-3 rounded-xl text-sm font-bold transition-all"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Shield size={18} />
                        <span>Verificación</span>
                      </Link>
                    </>
                  )}
                  {session.user.role === 'CLIENT' && (
                    <>
                      <Link
                        href="/dashboard/addresses"
                        className="flex items-center space-x-2 text-gray-700 hover:text-primary-600 hover:bg-primary-500/5 px-4 py-3 rounded-xl text-sm font-bold transition-all"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <MapPin size={18} />
                        <span>Mis Direcciones</span>
                      </Link>
                      <Link
                        href="/dashboard/payment-methods"
                        className="flex items-center space-x-2 text-gray-700 hover:text-primary-600 hover:bg-primary-500/5 px-4 py-3 rounded-xl text-sm font-bold transition-all"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <CreditCard size={18} />
                        <span>Mis Métodos de Pago</span>
                      </Link>
                    </>
                  )}
                  {session.user.role !== 'ADMIN' && (
                    <Link
                      href={session.user.role === 'PARTNER' ? '/partner/notifications' : '/notifications'}
                      className="flex items-center space-x-2 text-gray-700 hover:text-primary-600 hover:bg-primary-500/5 px-4 py-3 rounded-xl text-sm font-bold transition-all"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Bell size={18} />
                      <span>Notificaciones</span>
                    </Link>
                  )}
                  <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="w-full flex items-center space-x-2 text-red-600 hover:text-red-700 hover:bg-red-50 px-4 py-3 rounded-xl text-sm font-bold transition-all"
                  >
                    <LogOut size={18} />
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-2 border-t border-gray-200 pt-4 mt-4">
                <Link
                  href="/login"
                  className="block text-center text-gray-700 hover:text-primary-600 hover:bg-primary-500/5 px-4 py-3 rounded-xl font-bold transition-all"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Iniciar sesión
                </Link>
                <Link
                  href="/register"
                  className="block text-center bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-4 py-3 rounded-xl hover:from-primary-600 hover:to-secondary-600 transition-all font-bold shadow-lg"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Registrarse
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
    </>
  )
}
