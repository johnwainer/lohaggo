'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Bell, Download, Smartphone, X } from 'lucide-react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { PWA_EVENTS } from '@/lib/pwa/events'
import { trackPwaEvent } from '@/lib/pwa/telemetry-client'

const REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000

function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((window.navigator as any).standalone)
}

function isIos() {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent.toLowerCase()
  return /iphone|ipad|ipod/.test(ua)
}

export default function PWAOnboardingPrompt() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()

  const [visible, setVisible] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [installed, setInstalled] = useState(false)

  const { isSupported, isSubscribed, permission, subscribeToPush, isLoading: pushLoading } = usePushNotifications()

  const userRole = session?.user?.role
  const isAdmin = userRole === 'ADMIN'
  const shouldSkipPath = useMemo(
    () => ['/login', '/register', '/admin', '/download/android', '/download/ios'].some((path) => pathname.startsWith(path)),
    [pathname]
  )

  useEffect(() => {
    if (isAdmin || shouldSkipPath || !session?.user?.id) {
      setVisible(false)
      return
    }

    const currentInstalled = isStandalone()
    setInstalled(currentInstalled)

    if (currentInstalled && (isSubscribed || permission === 'granted')) {
      setVisible(false)
      return
    }

    const key = `pwa-onboarding-last-dismissed-${session.user.id}`
    const forced = localStorage.getItem('pwa-onboarding-force') === '1'
    const lastDismissed = Number(localStorage.getItem(key) || '0')
    const hasCooldown = Date.now() - lastDismissed < REMINDER_INTERVAL_MS

    if (!hasCooldown || forced) {
      const timer = setTimeout(() => {
        setVisible(true)
        localStorage.removeItem('pwa-onboarding-force')
        trackPwaEvent({
          eventName: PWA_EVENTS.INSTALL_PROMPT_SHOWN,
          source: 'post_auth_onboarding',
          role: userRole as 'CLIENT' | 'PARTNER' | 'ADMIN',
        })
      }, 1200)
      return () => clearTimeout(timer)
    }
  }, [isAdmin, shouldSkipPath, session?.user?.id, isSubscribed, permission, installed, userRole])

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [])

  const closePrompt = () => {
    if (session?.user?.id) {
      localStorage.setItem(`pwa-onboarding-last-dismissed-${session.user.id}`, Date.now().toString())
    }
    setVisible(false)
    trackPwaEvent({
      eventName: PWA_EVENTS.INSTALL_PROMPT_DISMISSED,
      source: 'post_auth_onboarding',
      role: userRole as 'CLIENT' | 'PARTNER' | 'ADMIN',
    })
  }

  const handleInstall = async () => {
    trackPwaEvent({
      eventName: PWA_EVENTS.INSTALL_CLICKED,
      source: 'post_auth_onboarding',
      role: userRole as 'CLIENT' | 'PARTNER' | 'ADMIN',
    })

    if (deferredPrompt) {
      deferredPrompt.prompt()
      await deferredPrompt.userChoice
      setDeferredPrompt(null)
      return
    }

    if (isIos()) {
      router.push('/download/ios')
      return
    }

    router.push('/download/android')
  }

  const handleEnablePush = async () => {
    await subscribeToPush()
  }

  if (!visible || isAdmin || shouldSkipPath) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 p-4 flex items-end sm:items-center sm:justify-center">
      <div className="w-full sm:max-w-md bg-white rounded-2xl border shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-primary-600 to-secondary-500 px-4 py-4 text-white">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-white/80">Onboarding LoHaggo</p>
              <h3 className="text-lg font-bold">Activa tu experiencia completa</h3>
            </div>
            <button onClick={closePrompt} aria-label="Cerrar" className="text-white/80 hover:text-white">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="rounded-xl border p-3">
            <div className="flex items-center gap-2 mb-2">
              <Smartphone size={16} className="text-primary-600" />
              <p className="font-semibold text-sm">1. Instala la PWA</p>
            </div>
            <p className="text-xs text-gray-600 mb-3">Abre LoHaggo como app y mejora la velocidad de uso.</p>
            <button
              onClick={handleInstall}
              disabled={installed}
              className="w-full rounded-lg bg-primary-600 text-white px-3 py-2 text-sm font-semibold disabled:bg-gray-200 disabled:text-gray-500"
            >
              {installed ? 'App instalada' : 'Instalar app'}
            </button>
          </div>

          <div className="rounded-xl border p-3">
            <div className="flex items-center gap-2 mb-2">
              <Bell size={16} className="text-secondary-600" />
              <p className="font-semibold text-sm">2. Activa notificaciones</p>
            </div>
            <p className="text-xs text-gray-600 mb-3">Recibe alertas de solicitudes, reservas, pagos y campañas en tiempo real.</p>
            <button
              onClick={handleEnablePush}
              disabled={!isSupported || isSubscribed || permission === 'granted' || pushLoading}
              className="w-full rounded-lg bg-secondary-600 text-white px-3 py-2 text-sm font-semibold disabled:bg-gray-200 disabled:text-gray-500"
            >
              {permission === 'granted' || isSubscribed ? 'Notificaciones activas' : pushLoading ? 'Activando...' : 'Activar notificaciones'}
            </button>
          </div>

          <button onClick={closePrompt} className="w-full rounded-lg border px-3 py-2 text-sm font-medium text-gray-700">
            Recordarmelo luego
          </button>
        </div>
      </div>
    </div>
  )
}
