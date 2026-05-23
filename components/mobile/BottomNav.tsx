'use client'

import { Suspense } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Home, User, Package, Bell, MessageSquare, Wallet, UserCircle, Heart } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { usePartnerNavCounts } from '@/hooks/usePartnerNavCounts'
import { useClientNavCounts } from '@/hooks/useClientNavCounts'

const PARTNER_ACCOUNT_PATHS = ['/profile', '/partner/services', '/partner/verification', '/partner/bank-accounts', '/partner/achievements']

const partnerNavItems = [
  { id: 'overview', label: 'Inicio', icon: Home, path: '/partner' },
  { id: 'bookings', label: 'Reservas', icon: Package, path: '/partner?tab=bookings' },
  { id: 'my-requests', label: 'Solicitudes', icon: Bell, path: '/partner?tab=my-requests' },
  { id: 'messages', label: 'Mensajes', icon: MessageSquare, path: '/partner/messages' },
  { id: 'payments', label: 'Pagos', icon: Wallet, path: '/partner/payments' },
  { id: 'account', label: 'Cuenta', icon: UserCircle, path: '/profile' },
] as const

const clientNavItems = [
  { id: 'home', label: 'Inicio', icon: Home, path: '/' },
  { id: 'bookings', label: 'Reservas', icon: Package, path: '/dashboard?tab=bookings' },
  { id: 'requests', label: 'Solicitudes', icon: Bell, path: '/dashboard?tab=requests' },
  { id: 'favorites', label: 'Favoritos', icon: Heart, path: '/dashboard?tab=favorites' },
  { id: 'profile', label: 'Perfil', icon: UserCircle, path: '/profile' },
] as const

function NavButton({ icon: Icon, label, isActive, badge, onClick }: {
  icon: React.ElementType
  label: string
  isActive: boolean
  badge?: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={() => { window.dispatchEvent(new Event('bottom-nav-navigate')); onClick() }}
      className={`relative flex min-h-[52px] flex-col items-center justify-center rounded-xl text-xs font-medium transition ${
        isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 active:scale-95'
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="text-[10px] mt-0.5">{label}</span>
      {!!badge && badge > 0 && (
        <span className="absolute right-1 top-1 inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-primary-600 px-1 text-[9px] font-bold text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}

function PartnerBarInner() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const counts = usePartnerNavCounts()
  const tab = searchParams.get('tab')

  const isActive = (id: string) => {
    if (id === 'overview') return pathname === '/partner' && (!tab || tab === 'overview')
    if (id === 'bookings') return pathname === '/partner' && tab === 'bookings'
    if (id === 'my-requests') return pathname === '/partner' && tab === 'my-requests'
    if (id === 'messages') return pathname.startsWith('/partner/messages')
    if (id === 'payments') return pathname.startsWith('/partner/payments')
    if (id === 'account') return PARTNER_ACCOUNT_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
    return false
  }

  const badge = (id: string) => {
    if (id === 'bookings') return counts.bookings
    if (id === 'messages') return counts.messages
    return 0
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="mx-auto grid max-w-2xl grid-cols-6 gap-1 px-2 py-2">
        {partnerNavItems.map((item) => (
          <NavButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            isActive={isActive(item.id)}
            badge={badge(item.id)}
            onClick={() => router.push(item.path)}
          />
        ))}
      </div>
    </nav>
  )
}

function ClientBarInner() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const counts = useClientNavCounts()
  const tab = searchParams.get('tab')

  const isActive = (id: string) => {
    if (id === 'home') {
      if (pathname === '/') return true
      if (pathname.startsWith('/servicios')) return true
      if (pathname.startsWith('/socios')) return true
      if (pathname.startsWith('/reservar')) return true
      return false
    }
    if (id === 'bookings') return pathname === '/dashboard' && tab === 'bookings'
    if (id === 'requests') return pathname === '/dashboard' && tab === 'requests'
    if (id === 'favorites') return pathname === '/dashboard' && tab === 'favorites'
    if (id === 'profile') return pathname === '/profile' || pathname.startsWith('/profile/')
    return false
  }

  const badge = (id: string) => {
    if (id === 'bookings') return counts.bookings
    if (id === 'requests') return counts.requests
    if (id === 'favorites') return counts.favorites
    return 0
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="mx-auto grid max-w-2xl grid-cols-5 gap-1 px-2 py-2">
        {clientNavItems.map((item) => (
          <NavButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            isActive={isActive(item.id)}
            badge={badge(item.id)}
            onClick={() => router.push(item.path)}
          />
        ))}
      </div>
    </nav>
  )
}

export function BottomNav() {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  const isPartner = session?.user?.role === 'PARTNER'
  const isClient = !!session && !isPartner

  if (isPartner) {
    return (
      <Suspense fallback={null}>
        <PartnerBarInner />
      </Suspense>
    )
  }

  if (isClient) {
    return (
      <Suspense fallback={null}>
        <ClientBarInner />
      </Suspense>
    )
  }

  // Logged-out visitors
  const isHomeActive = pathname === '/' || pathname.startsWith('/servicios')

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom md:hidden" data-tour="bottom-nav">
      <div className="grid h-16 grid-cols-2">
        <button
          type="button"
          onClick={() => { window.dispatchEvent(new Event('bottom-nav-navigate')); router.push('/') }}
          className={`touch-manipulation flex flex-col items-center justify-center gap-1 px-2 py-2 transition-colors active:scale-95 ${isHomeActive ? 'text-primary-600' : 'text-gray-500'}`}
        >
          <Home className="w-6 h-6" />
          <span className="text-xs font-medium">Inicio</span>
        </button>
        <button
          type="button"
          onClick={() => { window.dispatchEvent(new Event('bottom-nav-navigate')); router.push('/login') }}
          className="touch-manipulation flex flex-col items-center justify-center gap-1 px-2 py-2 transition-colors active:scale-95 text-gray-500"
        >
          <User className="w-6 h-6" />
          <span className="text-xs font-medium">Entrar</span>
        </button>
      </div>
    </nav>
  )
}
