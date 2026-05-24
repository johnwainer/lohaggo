'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bell, MessageCircle, Calendar, FileText, CheckCircle, XCircle,
  Trophy, Send, AlertCircle, X
} from 'lucide-react'
import { useNotificationRealtime } from '@/hooks/useNotificationRealtime'

type NotificationType =
  | 'NEW_SERVICE_REQUEST' | 'NEW_PROPOSAL' | 'PROPOSAL_ACCEPTED' | 'PROPOSAL_REJECTED'
  | 'BOOKING_CONFIRMED'   | 'BOOKING_CANCELLED' | 'BOOKING_IN_PROGRESS' | 'BOOKING_COMPLETED'
  | 'DOCUMENT_APPROVED'   | 'DOCUMENT_REJECTED' | 'ACHIEVEMENT_UNLOCKED' | 'NEW_MESSAGE'

interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  data: string | null
  read: boolean
  createdAt: string
}

interface Toast {
  id: string
  type: NotificationType
  title: string
  message: string
  href: string
  enteredAt: number
}

const AUTO_DISMISS_MS = 7000
const MAX_STACK = 3
const SKIP_PATH_PREFIXES = ['/admin', '/login', '/register', '/registro']

function parseData(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try { return JSON.parse(raw) as Record<string, unknown> } catch { return {} }
}

function getActionUrl(n: Notification, role: string | undefined): string {
  const d = parseData(n.data)
  if (typeof d.targetUrl === 'string' && d.targetUrl.startsWith('/')) return d.targetUrl

  const isPartner = role === 'PARTNER'
  switch (n.type) {
    case 'NEW_MESSAGE':
      return isPartner ? '/partner/messages' : '/dashboard'
    case 'NEW_SERVICE_REQUEST':
      return '/partner?tab=my-requests'
    case 'NEW_PROPOSAL':
      return '/dashboard?tab=requests'
    case 'PROPOSAL_ACCEPTED':
      return '/partner?tab=bookings'
    case 'PROPOSAL_REJECTED':
      return '/partner?tab=my-requests'
    case 'BOOKING_CONFIRMED':
    case 'BOOKING_CANCELLED':
    case 'BOOKING_IN_PROGRESS':
    case 'BOOKING_COMPLETED':
      return isPartner ? '/partner?tab=bookings' : '/dashboard?tab=bookings'
    case 'DOCUMENT_APPROVED':
    case 'DOCUMENT_REJECTED':
      return '/partner/verification'
    case 'ACHIEVEMENT_UNLOCKED':
      return '/partner/achievements'
    default:
      return '/notifications'
  }
}

function getIcon(type: NotificationType) {
  switch (type) {
    case 'NEW_MESSAGE':         return MessageCircle
    case 'NEW_SERVICE_REQUEST': return Send
    case 'NEW_PROPOSAL':        return FileText
    case 'PROPOSAL_ACCEPTED':   return CheckCircle
    case 'PROPOSAL_REJECTED':   return XCircle
    case 'BOOKING_CONFIRMED':   return Calendar
    case 'BOOKING_CANCELLED':   return XCircle
    case 'BOOKING_IN_PROGRESS': return Calendar
    case 'BOOKING_COMPLETED':   return CheckCircle
    case 'DOCUMENT_APPROVED':   return CheckCircle
    case 'DOCUMENT_REJECTED':   return AlertCircle
    case 'ACHIEVEMENT_UNLOCKED':return Trophy
    default:                    return Bell
  }
}

function getAccent(type: NotificationType): string {
  switch (type) {
    case 'PROPOSAL_REJECTED':
    case 'BOOKING_CANCELLED':
    case 'DOCUMENT_REJECTED':
      return 'from-red-500 to-orange-500'
    case 'PROPOSAL_ACCEPTED':
    case 'BOOKING_CONFIRMED':
    case 'BOOKING_COMPLETED':
    case 'DOCUMENT_APPROVED':
      return 'from-emerald-500 to-green-600'
    case 'ACHIEVEMENT_UNLOCKED':
      return 'from-amber-400 to-orange-500'
    case 'NEW_MESSAGE':
      return 'from-violet-500 to-fuchsia-500'
    case 'NEW_SERVICE_REQUEST':
    case 'NEW_PROPOSAL':
      return 'from-blue-500 to-indigo-600'
    case 'BOOKING_IN_PROGRESS':
      return 'from-sky-500 to-blue-600'
    default:
      return 'from-gray-700 to-gray-900'
  }
}

export default function InAppNotificationToast() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [toasts, setToasts] = useState<Toast[]>([])
  const seenIdsRef = useRef<Set<string>>(new Set())
  const skipRender =
    status !== 'authenticated' ||
    !session?.user?.id ||
    SKIP_PATH_PREFIXES.some((p) => pathname?.startsWith(p))

  const onNotification = useCallback(async () => {
    if (typeof document !== 'undefined' && document.hidden) return
    try {
      const res = await fetch('/api/notifications?unreadOnly=true', { cache: 'no-store' })
      if (!res.ok) return
      const list: Notification[] = await res.json()
      if (!Array.isArray(list) || list.length === 0) return

      const fresh = list
        .filter((n) => !seenIdsRef.current.has(n.id))
        .slice(0, 2)
      if (fresh.length === 0) return

      const newToasts: Toast[] = fresh.map((n) => {
        seenIdsRef.current.add(n.id)
        return {
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          href: getActionUrl(n, session?.user?.role),
          enteredAt: Date.now(),
        }
      })

      setToasts((prev) => [...newToasts, ...prev].slice(0, MAX_STACK))
    } catch {
      // silent
    }
  }, [session?.user?.role])

  useNotificationRealtime(skipRender ? null : session?.user?.id, onNotification)

  useEffect(() => {
    if (toasts.length === 0) return
    const timer = setInterval(() => {
      const now = Date.now()
      setToasts((prev) => prev.filter((t) => now - t.enteredAt < AUTO_DISMISS_MS))
    }, 500)
    return () => clearInterval(timer)
  }, [toasts.length])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const handleClick = useCallback((toast: Toast) => {
    fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationId: toast.id }),
    }).catch(() => {})
    dismiss(toast.id)
    router.push(toast.href)
  }, [router, dismiss])

  if (skipRender || toasts.length === 0) return null

  return (
    <div
      className="fixed left-0 right-0 z-[100] flex flex-col items-center gap-2 px-3 pointer-events-none"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      role="region"
      aria-label="Notificaciones en tiempo real"
    >
      {toasts.map((t) => {
        const Icon = getIcon(t.type)
        return (
          <div
            key={t.id}
            className="pointer-events-auto w-full max-w-md animate-slide-down"
          >
            <button
              type="button"
              onClick={() => handleClick(t)}
              className={`group flex w-full items-stretch gap-0 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/5 transition-transform active:scale-[0.98]`}
            >
              <div className={`flex w-12 shrink-0 items-center justify-center bg-gradient-to-b ${getAccent(t.type)} text-white`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0 px-3 py-2.5 text-left">
                <p className="text-sm font-bold text-gray-900 truncate">{t.title}</p>
                <p className="text-xs text-gray-600 line-clamp-2 leading-snug mt-0.5">{t.message}</p>
              </div>
              <span
                role="button"
                aria-label="Cerrar"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); dismiss(t.id) }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); dismiss(t.id) } }}
                className="flex w-9 shrink-0 cursor-pointer items-center justify-center self-stretch text-gray-400 hover:text-gray-700 hover:bg-gray-50"
              >
                <X className="h-4 w-4" />
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
