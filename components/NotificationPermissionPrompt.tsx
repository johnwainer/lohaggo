'use client'

import { useState, useEffect } from 'react'
import { Bell, X, CheckCircle, AlertCircle } from 'lucide-react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { usePromptSlot } from '@/hooks/usePromptSlot'
import { trackPwaEvent } from '@/lib/pwa/telemetry-client'
import { PWA_EVENTS } from '@/lib/pwa/events'
import { PUSH_ASK_COPY, PUSH_ASK_EVENT, type PushAskReason } from '@/lib/pwa/push-ask'
import { useSession } from 'next-auth/react'
import { useCity } from '@/lib/city-context'

const COOLDOWN_KEY = 'push-ask-dismissed-at'
const COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000

function inCooldown() {
  try {
    const at = Number(localStorage.getItem(COOLDOWN_KEY) || 0)
    return at > 0 && Date.now() - at < COOLDOWN_MS
  } catch {
    return false
  }
}

/**
 * Push-permission ask, shown only when a screen asks for it with a reason (askForPush: after a request is
 * sent, after a partner sends a proposal). There is no timer. It takes the shared floating-prompt slot,
 * so it never stacks with the install or adoption prompts.
 */
export default function NotificationPermissionPrompt() {
  const { data: session } = useSession()
  const { showCityModal } = useCity()
  const [reason, setReason] = useState<PushAskReason | null>(null)
  const [hasInteracted, setHasInteracted] = useState(false)
  const { isSupported, isSubscribed, permission, isLoading, error, subscribeToPush } = usePushNotifications()

  useEffect(() => {
    const onAsk = (e: Event) => {
      const r = (e as CustomEvent<{ reason: PushAskReason }>).detail?.reason
      if (!r || inCooldown()) return
      setReason(r)
    }
    window.addEventListener(PUSH_ASK_EVENT, onAsk)
    return () => window.removeEventListener(PUSH_ASK_EVENT, onAsk)
  }, [])

  const eligible = Boolean(reason) && Boolean(session?.user?.id) && isSupported && !isSubscribed && permission === 'default' && !showCityModal
  const show = usePromptSlot('push', eligible || (hasInteracted && Boolean(reason)))

  useEffect(() => {
    if (show) trackPwaEvent({ eventName: PWA_EVENTS.PUSH_PROMPT_SHOWN, source: `contextual_${reason}` })
  }, [show, reason])

  const close = () => { setReason(null); setHasInteracted(false) }

  const handleEnable = async () => {
    setHasInteracted(true)
    const ok = await subscribeToPush()
    if (ok) setTimeout(close, 2000)
  }

  const handleDismiss = () => {
    try { localStorage.setItem(COOLDOWN_KEY, String(Date.now())) } catch { /* private mode */ }
    close()
  }

  if (!show || !reason) return null
  const copy = PUSH_ASK_COPY[reason]

  return (
    <div className="fixed bottom-[5.5rem] left-3 right-3 sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-sm z-40 pointer-events-none animate-slide-up">
      <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-white shadow-lg ring-1 ring-gray-200 py-2 pl-3 pr-1">
        <div className="flex-shrink-0 h-9 w-9 rounded-full bg-gradient-to-br from-secondary-500 to-secondary-600 flex items-center justify-center">
          <Bell className="text-white" size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 leading-tight">{copy.title}</p>
          <p className="text-[11px] text-gray-500 leading-tight">{copy.body}</p>
        </div>
        {error && hasInteracted ? (
          <span className="flex-shrink-0 text-red-600" title={error}>
            <AlertCircle size={18} />
          </span>
        ) : isSubscribed && hasInteracted ? (
          <span className="flex-shrink-0 text-emerald-600">
            <CheckCircle size={20} />
          </span>
        ) : (
          <button
            type="button"
            onClick={handleEnable}
            disabled={isLoading}
            className="flex-shrink-0 min-h-[44px] bg-secondary-500 text-white text-xs font-bold px-4 rounded-xl hover:bg-secondary-600 transition disabled:opacity-50"
          >
            {isLoading ? '...' : 'Activar'}
          </button>
        )}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Cerrar"
          className="flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-full text-gray-400 hover:text-gray-700 transition"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
