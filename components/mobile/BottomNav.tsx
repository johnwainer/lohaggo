'use client'

import { CountBadge } from '@/components/ui/count-badge'
import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Home, User, Package, Bell, MessageSquare, UserCircle, Sparkles, Zap } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { usePartnerNavCounts } from '@/hooks/usePartnerNavCounts'
import { useClientNavCounts } from '@/hooks/useClientNavCounts'

const PARTNER_ACCOUNT_PATHS = ['/profile', '/partner/services', '/partner/verification', '/partner/bank-accounts', '/partner/achievements', '/partner/payments']

const partnerNavItems = [
  { id: 'overview', label: 'Inicio', icon: Home, path: '/partner' },
  { id: 'bookings', label: 'Reservas', icon: Package, path: '/partner?tab=bookings' },
  { id: 'messages', label: 'Chats', icon: MessageSquare, path: '/partner/messages' },
  { id: 'account', label: 'Cuenta', icon: UserCircle, path: '/profile' },
] as const

const clientNavItems = [
  { id: 'requests', label: 'Mi panel', icon: Package, path: '/dashboard?tab=requests' },
  { id: 'notifications', label: 'Avisos', icon: Bell, path: '/notifications' },
  { id: 'messages', label: 'Chats', icon: MessageSquare, path: '/dashboard/messages' },
  { id: 'profile', label: 'Perfil', icon: UserCircle, path: '/profile' },
] as const

function NavLink({ icon: Icon, label, isActive, badge, badgeLabel, href }: {
  icon: React.ElementType
  label: string
  isActive: boolean
  badge?: number
  badgeLabel?: string
  href: string
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      onClick={() => window.dispatchEvent(new Event('bottom-nav-navigate'))}
      style={{ WebkitTapHighlightColor: 'transparent' }}
      className={`touch-manipulation select-none relative flex min-h-[56px] min-w-[44px] flex-col items-center justify-center rounded-xl font-medium transition cursor-pointer ${
        isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-600 active:scale-95'
      }`}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      <span className="mt-0.5 text-[11px] leading-tight">{label}</span>
      <CountBadge count={badge ?? 0} size="sm" label={badgeLabel} className="absolute right-1 top-1" />
    </Link>
  )
}

/** The raised orange button in the middle. The whole column (circle and word) is one link. */
function CenterAction({ href, label, srExtra, icon: Icon, isActive, badge, badgeLabel }: {
  href: string
  label: string
  srExtra?: string
  icon: React.ElementType
  isActive: boolean
  badge?: number
  badgeLabel?: string
}) {
  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      onClick={() => window.dispatchEvent(new Event('bottom-nav-navigate'))}
      style={{ WebkitTapHighlightColor: 'transparent' }}
      className="group touch-manipulation select-none relative z-20 flex min-h-[56px] min-w-[44px] flex-col items-center justify-end rounded-xl transition cursor-pointer"
    >
      <span
        className={`absolute left-1/2 -top-2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white transition-all group-active:scale-95 ${
          isActive
            ? 'bg-secondary-100 shadow-sm'
            : 'bg-gradient-to-br from-secondary-500 to-secondary-600 shadow-[0_8px_24px_-4px_rgba(234,88,12,0.55)]'
        }`}
      >
        <Icon className={`h-7 w-7 ${isActive ? 'text-secondary-600' : 'text-white'}`} strokeWidth={2.5} aria-hidden="true" />
        {!isActive && (
          <CountBadge count={badge ?? 0} tone="danger" pulse label={badgeLabel} className="absolute -right-1 -top-1 ring-2 ring-white" />
        )}
      </span>
      <span className="mt-1 whitespace-nowrap text-[11px] font-semibold leading-tight tracking-tight text-secondary-700">
        {label}
        {srExtra && <span className="sr-only"> {srExtra}</span>}
      </span>
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
    if (id === 'solicitudes') return pathname === '/partner' && tab === 'my-requests'
    if (id === 'messages') return pathname.startsWith('/partner/messages')
    if (id === 'account') return PARTNER_ACCOUNT_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
    return false
  }

  const badge = (id: string) => {
    if (id === 'bookings') return counts.bookings
    if (id === 'messages') return counts.messages
    return 0
  }
  const badgeLabel = (id: string) => {
    if (id === 'bookings') return 'reservas por atender'
    if (id === 'messages') return 'mensajes sin leer'
    return undefined
  }

  const solicitudesActive = isActive('solicitudes')
  const requestsBadge = counts.requests
  const leftItems = partnerNavItems.slice(0, 2)
  const rightItems = partnerNavItems.slice(2)

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden"
      data-tour="bottom-nav"
    >
      <div className="relative mx-auto grid max-w-2xl grid-cols-[1fr_1fr_1.35fr_1fr_1fr] gap-1 px-2 py-2">
        {leftItems.map((item) => (
          <NavLink
            key={item.id}
            icon={item.icon}
            label={item.label}
            isActive={isActive(item.id)}
            badge={badge(item.id)}
            badgeLabel={badgeLabel(item.id)}
            href={item.path}
          />
        ))}

        <CenterAction
          href="/partner?tab=my-requests"
          label="Oportunidades"
          icon={Zap}
          isActive={solicitudesActive}
          badge={requestsBadge}
          badgeLabel="oportunidades nuevas"
        />

        {rightItems.map((item) => (
          <NavLink
            key={item.id}
            icon={item.icon}
            label={item.label}
            isActive={isActive(item.id)}
            badge={badge(item.id)}
            badgeLabel={badgeLabel(item.id)}
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
    if (id === 'requests') return pathname === '/dashboard' && (tab === 'requests' || tab === 'bookings')
    if (id === 'notifications') return pathname.startsWith('/notifications')
    if (id === 'messages') return pathname.startsWith('/dashboard/messages')
    if (id === 'profile') return pathname === '/profile' || pathname.startsWith('/profile/')
    return false
  }

  const badge = (id: string) => {
    if (id === 'requests') return counts.action
    if (id === 'notifications') return counts.notifications
    if (id === 'messages') return counts.messages
    return 0
  }
  const badgeLabel = (id: string) => {
    if (id === 'requests') return 'pendientes de ti'
    if (id === 'notifications') return 'notificaciones sin leer'
    if (id === 'messages') return 'mensajes sin leer'
    return undefined
  }

  const solicitarActive = isActive('solicitar')
  const leftItems = clientNavItems.slice(0, 2)
  const rightItems = clientNavItems.slice(2)

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden"
      data-tour="bottom-nav"
    >
      <div className="relative mx-auto grid max-w-2xl grid-cols-[1fr_1fr_1.35fr_1fr_1fr] gap-1 px-2 py-2">
        {leftItems.map((item) => (
          <NavLink
            key={item.id}
            icon={item.icon}
            label={item.label}
            isActive={isActive(item.id)}
            badge={badge(item.id)}
            badgeLabel={badgeLabel(item.id)}
            href={item.path}
          />
        ))}

        <CenterAction
          href="/"
          label="Solicitar"
          srExtra="servicio"
          icon={Sparkles}
          isActive={solicitarActive}
        />

        {rightItems.map((item) => (
          <NavLink
            key={item.id}
            icon={item.icon}
            label={item.label}
            isActive={isActive(item.id)}
            badge={badge(item.id)}
            badgeLabel={badgeLabel(item.id)}
            href={item.path}
          />
        ))}
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
    <nav aria-label="Navegación principal" className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom md:hidden" data-tour="bottom-nav">
      <div className="grid h-16 grid-cols-2">
        <Link
          href="/"
          aria-current={isHomeActive ? 'page' : undefined}
          onClick={() => window.dispatchEvent(new Event('bottom-nav-navigate'))}
          className={`touch-manipulation flex flex-col items-center justify-center gap-1 px-2 py-2 transition-colors active:scale-95 ${isHomeActive ? 'text-primary-600' : 'text-gray-500'}`}
        >
          <Home className="w-6 h-6" aria-hidden="true" />
          <span className="text-xs font-medium">Inicio</span>
        </Link>
        <Link
          href="/login"
          onClick={() => window.dispatchEvent(new Event('bottom-nav-navigate'))}
          className="touch-manipulation flex flex-col items-center justify-center gap-1 px-2 py-2 transition-colors active:scale-95 text-gray-500"
        >
          <User className="w-6 h-6" aria-hidden="true" />
          <span className="text-xs font-medium">Entrar</span>
        </Link>
      </div>
    </nav>
  )
}
