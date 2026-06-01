'use client'

import { useState, useEffect } from 'react'
import { Bell, X, CheckCircle, AlertCircle } from 'lucide-react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { trackPwaEvent } from '@/lib/pwa/telemetry-client'
import { PWA_EVENTS } from '@/lib/pwa/events'
import { useSession } from 'next-auth/react'
import { useCity } from '@/lib/city-context'
import { usePathname } from 'next/navigation'

interface NotificationPermissionPromptProps {
  onClose?: () => void
  autoShow?: boolean
}

export default function NotificationPermissionPrompt({
  onClose,
  autoShow = true
}: NotificationPermissionPromptProps) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const { showCityModal } = useCity()
  const [isVisible, setIsVisible] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)
  const {
    isSupported,
    isSubscribed,
    permission,
    isLoading,
    error,
    subscribeToPush
  } = usePushNotifications()

  useEffect(() => {
    if (typeof window === 'undefined') return

    const dismissed = localStorage.getItem('notification-prompt-dismissed')
    const lastShown = localStorage.getItem('notification-prompt-last-shown')
    const now = Date.now()
    const threeDays = 3 * 24 * 60 * 60 * 1000

    if (dismissed === 'true' && lastShown) {
      const timeSinceLastShown = now - parseInt(lastShown)
      if (timeSinceLastShown < threeDays) {
        return
      }
    }

    if (autoShow && isSupported && !isSubscribed && permission === 'default') {
      const timer = setTimeout(() => {
        setIsVisible(true)
        trackPwaEvent({ eventName: PWA_EVENTS.PUSH_PROMPT_SHOWN, source: 'global_notification_prompt' })
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [autoShow, isSupported, isSubscribed, permission])

  const handleEnable = async () => {
    setHasInteracted(true)
    const success = await subscribeToPush()

    if (success) {
      setTimeout(() => {
        handleClose()
      }, 2000)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem('notification-prompt-dismissed', 'true')
    localStorage.setItem('notification-prompt-last-shown', Date.now().toString())
    handleClose()
  }

  const handleClose = () => {
    setIsVisible(false)
    onClose?.()
  }

  if (pathname?.startsWith('/unete') || showCityModal || !session?.user?.id || !isVisible || !isSupported || isSubscribed || permission === 'denied') {
    return null
  }

  return (
    <>
      {/* Banner compacto en mobile y desktop (no tapa contenido).
          Wrapper pointer-events-none para no robar clicks; tarjeta interna re-habilita. */}
      <div className="fixed bottom-[5.5rem] left-3 right-3 sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-sm z-40 pointer-events-none animate-slide-up">
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-white shadow-lg ring-1 ring-gray-200 px-3 py-2.5">
          <div className="flex-shrink-0 h-9 w-9 rounded-full bg-gradient-to-br from-secondary-500 to-secondary-600 flex items-center justify-center">
            <Bell className="text-white" size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 leading-tight truncate">Activa notificaciones</p>
            <p className="text-[11px] text-gray-500 leading-tight truncate">No te pierdas reservas, propuestas y mensajes</p>
          </div>
          {error && hasInteracted ? (
            <span className="flex-shrink-0 text-[11px] text-red-600 font-semibold" title={error}>
              <AlertCircle size={16} />
            </span>
          ) : isSubscribed && hasInteracted ? (
            <span className="flex-shrink-0 text-emerald-600">
              <CheckCircle size={18} />
            </span>
          ) : (
            <button
              onClick={handleEnable}
              disabled={isLoading}
              className="flex-shrink-0 bg-secondary-500 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-secondary-600 transition disabled:opacity-50"
            >
              {isLoading ? '...' : 'Activar'}
            </button>
          )}
          <button
            onClick={handleDismiss}
            aria-label="Cerrar"
            className="flex-shrink-0 text-gray-400 hover:text-gray-700 transition"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }

        .animate-slide-up {
          animation: slide-up 0.4s ease-out;
        }
      `}</style>
    </>
  )
}
