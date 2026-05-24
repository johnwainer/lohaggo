'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Home, User, Package, Bell, MessageSquare, Wallet, UserCircle, Heart, Sparkles } from 'lucide-react'
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
  { id: 'bookings', label: 'Pedidos', icon: Package, path: '/dashboard?tab=bookings' },
  { id: 'notifications', label: 'Notif.', icon: Bell, path: '/notifications' },
  { id: 'messages', label: 'Chats', icon: MessageSquare, path: '/dashboard/messages' },
  { id: 'profile', label: 'Perfil', icon: UserCircle, path: '/profile' },
] as const

function NavLink({ icon: Icon, label, isActive, badge, href }: {
  icon: React.ElementType
  label: string
  isActive: boolean
  badge?: number
  href: string
}) {
  return (
    <Link
      href={href}
      onClick={() => window.dispatchEvent(new Event('bottom-nav-navigate'))}
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
    </Link>
  )
}

function BottomNavSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-gray-200 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden"
    />
  )
}

function PartnerBarInner() {
  const pathname = usePathname()
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
          <NavLink
            key={item.id}
            icon={item.icon}
            label={item.label}
            isActive={isActive(item.id)}
            badge={badge(item.id)}
            href={item.path}
          />
        ))}
      </div>
    </nav>
  )
}

function ClientBarInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const counts = useClientNavCounts()
  const tab = searchParams.get('tab')

  const isActive = (id: string) => {
    if (id === 'solicitar') {
      if (pathname === '/') return true
      if (pathname.startsWith('/servicios')) return true
      if (pathname.startsWith('/socios')) return true
      if (pathname.startsWith('/reservar')) return true
      return false
    }
    if (id === 'bookings') return pathname === '/dashboard' && (tab === 'bookings' || tab === 'requests')
    if (id === 'notifications') return pathname.startsWith('/notifications')
    if (id === 'messages') return pathname.startsWith('/dashboard/messages')
    if (id === 'profile') return pathname === '/profile' || pathname.startsWith('/profile/')
    return false
  }

  const badge = (id: string) => {
    if (id === 'bookings') return counts.bookings + counts.requests
    if (id === 'notifications') return counts.notifications
    return 0
  }

  const solicitarActive = isActive('solicitar')
  const leftItems = clientNavItems.slice(0, 2)
  const rightItems = clientNavItems.slice(2)

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden"
      data-tour="bottom-nav"
    >
      <div className="relative mx-auto grid max-w-2xl grid-cols-5 gap-1 px-2 py-2">
        {leftItems.map((item) => (
          <NavLink
            key={item.id}
            icon={item.icon}
            label={item.label}
            isActive={isActive(item.id)}
            badge={badge(item.id)}
            href={item.path}
          />
        ))}

        <div className="flex min-h-[52px] flex-col items-center justify-end">
          <span className="mt-1 text-[10px] font-semibold text-secondary-600">Solicitar</span>
        </div>

        {rightItems.map((item) => (
          <NavLink
            key={item.id}
            icon={item.icon}
            label={item.label}
            isActive={isActive(item.id)}
            badge={badge(item.id)}
            href={item.path}
          />
        ))}

        <Link
          href="/"
          aria-label="Solicitar servicio"
          onClick={() => window.dispatchEvent(new Event('bottom-nav-navigate'))}
          className={`absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 transition active:scale-95 ${
            solicitarActive ? 'scale-105' : ''
          }`}
        >
          <span
            className={`flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-secondary-500 to-secondary-600 shadow-[0_8px_24px_-4px_rgba(234,88,12,0.55)] ${
              solicitarActive ? 'ring-4 ring-secondary-200' : ''
            }`}
          >
            <Sparkles className="h-7 w-7 text-white" strokeWidth={2.5} />
          </span>
        </Link>
      </div>
    </nav>
  )
}

export function BottomNav() {
  const { data: session } = useSession()
  const pathname = usePathname()

  const isPartner = session?.user?.role === 'PARTNER'
  const isClient = !!session && !isPartner

  if (isPartner) {
    return (
      <Suspense fallback={<BottomNavSkeleton />}>
        <PartnerBarInner />
      </Suspense>
    )
  }

  if (isClient) {
    return (
      <Suspense fallback={<BottomNavSkeleton />}>
        <ClientBarInner />
      </Suspense>
    )
  }

  // Logged-out visitors
  const isHomeActive = pathname === '/' || pathname.startsWith('/servicios')

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom md:hidden" data-tour="bottom-nav">
      <div className="grid h-16 grid-cols-2">
        <Link
          href="/"
          onClick={() => window.dispatchEvent(new Event('bottom-nav-navigate'))}
          className={`touch-manipulation flex flex-col items-center justify-center gap-1 px-2 py-2 transition-colors active:scale-95 ${isHomeActive ? 'text-primary-600' : 'text-gray-500'}`}
        >
          <Home className="w-6 h-6" />
          <span className="text-xs font-medium">Inicio</span>
        </Link>
        <Link
          href="/login"
          onClick={() => window.dispatchEvent(new Event('bottom-nav-navigate'))}
          className="touch-manipulation flex flex-col items-center justify-center gap-1 px-2 py-2 transition-colors active:scale-95 text-gray-500"
        >
          <User className="w-6 h-6" />
          <span className="text-xs font-medium">Entrar</span>
        </Link>
      </div>
    </nav>
  )
}
