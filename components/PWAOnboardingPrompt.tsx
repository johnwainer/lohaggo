'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Bell, Smartphone, X } from 'lucide-react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { PWA_EVENTS } from '@/lib/pwa/events'
import { trackPwaEvent } from '@/lib/pwa/telemetry-client'

type PromptStage = 'INSTALL' | 'PUSH'
type PromptFormat = 'BANNER' | 'CARD'

type PromptPayload = {
  shouldShow: boolean
  stage?: PromptStage
  format?: PromptFormat
  variant?: 'A' | 'B'
  title?: string
  description?: string
  cta?: string
  context?: string
}

function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((window.navigator as any).standalone)
}

function isIos() {
  if (typeof window === 'undefined') return false
  return /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())
}

export default function PWAOnboardingPrompt() {
  const { data: session } = useSession()
  const pathname = usePathname()
  const router = useRouter()

  const [visible, setVisible] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [payload, setPayload] = useState<PromptPayload | null>(null)

  const { isSupported, isSubscribed, permission, subscribeToPush, isLoading: pushLoading } = usePushNotifications()

  const userRole = session?.user?.role
  const isAdmin = userRole === 'ADMIN'

  const shouldSkipPath = useMemo(
    () => ['/login', '/register', '/admin', '/download/android', '/download/ios', '/unete'].some((path) => pathname.startsWith(path)),
    [pathname]
  )

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadPrompt() {
      if (!session?.user?.id || isAdmin || shouldSkipPath) {
        setVisible(false)
        return
      }

      const standalone = isStandalone()
      if (standalone && (isSubscribed || permission === 'granted')) {
        setVisible(false)
        return
      }

      const res = await fetch('/api/pwa/adoption/next-prompt', { cache: 'no-store' }).catch(() => null)
      if (!res?.ok || !mounted) return

      const data: PromptPayload = await res.json()
      if (!data.shouldShow || !data.stage) {
        setVisible(false)
        return
      }

      if (data.stage === 'INSTALL' && standalone) {
        return
      }

      if (data.stage === 'PUSH' && (permission === 'granted' || isSubscribed)) {
        return
      }

      setPayload(data)
      setVisible(true)

      await fetch('/api/pwa/adoption/interaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'shown', stage: data.stage }),
      }).catch(() => undefined)

      trackPwaEvent({
        eventName: PWA_EVENTS.INSTALL_PROMPT_SHOWN,
        source: `adoption_${data.stage.toLowerCase()}_${(data.format || 'banner').toLowerCase()}`,
        role: userRole as 'CLIENT' | 'PARTNER' | 'ADMIN',
        metadata: { variant: data.variant, context: data.context },
      })
    }

    loadPrompt().catch(() => undefined)
    return () => {
      mounted = false
    }
  }, [session?.user?.id, isAdmin, shouldSkipPath, isSubscribed, permission, userRole])

  const dismissPrompt = async () => {
    if (!payload?.stage) return
    setVisible(false)

    await fetch('/api/pwa/adoption/interaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dismissed', stage: payload.stage }),
    }).catch(() => undefined)

    trackPwaEvent({
      eventName: PWA_EVENTS.INSTALL_PROMPT_DISMISSED,
      source: `adoption_${payload.stage.toLowerCase()}_dismissed`,
      role: userRole as 'CLIENT' | 'PARTNER' | 'ADMIN',
      metadata: { variant: payload.variant, context: payload.context },
    })
  }

  const handleInstall = async () => {
    if (!payload?.stage) return

    await fetch('/api/pwa/adoption/interaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'install_clicked', stage: payload.stage }),
    }).catch(() => undefined)

    trackPwaEvent({
      eventName: PWA_EVENTS.INSTALL_CLICKED,
      source: `adoption_${payload.stage.toLowerCase()}_cta`,
      role: userRole as 'CLIENT' | 'PARTNER' | 'ADMIN',
      metadata: { variant: payload.variant, context: payload.context },
    })

    if (deferredPrompt) {
      deferredPrompt.prompt()
      await deferredPrompt.userChoice
      setDeferredPrompt(null)
      setVisible(false)
      return
    }

    if (isIos()) {
      router.push('/download/ios')
      return
    }

    router.push('/download/android')
  }

  const handlePush = async () => {
    if (!payload?.stage) return

    await fetch('/api/pwa/adoption/interaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'push_clicked', stage: payload.stage }),
    }).catch(() => undefined)

    const ok = await subscribeToPush()
    if (ok) setVisible(false)
  }

  if (!visible || !payload?.stage || isAdmin || shouldSkipPath) return null

  const icon = payload.stage === 'INSTALL' ? <Smartphone size={16} /> : <Bell size={16} />
  const action = payload.stage === 'INSTALL' ? handleInstall : handlePush
  const cta = payload.cta || (payload.stage === 'INSTALL' ? 'Instalar app' : 'Activar notificaciones')
  const isCard = payload.format === 'CARD'

  return (
    <div className="fixed bottom-20 left-3 right-3 z-40 md:left-auto md:right-4 md:bottom-6 md:w-[380px] pointer-events-none">
      <div className={`pointer-events-auto rounded-2xl border bg-white shadow-lg ${isCard ? 'p-4' : 'p-3'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <div className="mt-0.5 text-primary-600">{icon}</div>
            <div className="min-w-0">
              <p className={`text-gray-900 ${isCard ? 'text-sm font-bold' : 'text-sm font-semibold'}`}>{payload.title}</p>
              <p className="text-xs text-gray-600 mt-1">{payload.description}</p>
            </div>
          </div>
          <button onClick={dismissPrompt} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={action}
            disabled={payload.stage === 'PUSH' && (!isSupported || isSubscribed || permission === 'granted' || pushLoading)}
            className="rounded-lg bg-primary-600 text-white px-3 py-2 text-xs font-semibold disabled:bg-gray-200 disabled:text-gray-500"
          >
            {payload.stage === 'PUSH' && pushLoading ? 'Activando...' : cta}
          </button>
          <button onClick={dismissPrompt} className="rounded-lg border px-3 py-2 text-xs text-gray-600">Luego</button>
        </div>
      </div>
    </div>
  )
}
