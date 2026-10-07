'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bell, MessageCircle, Calendar, FileText, CheckCircle, XCircle,
  Trophy, Send, AlertCircle, X
} from 'lucide-react'
import { useNotificationRealtime } from '@/hooks/useNotificationRealtime'
import { notificationTarget } from '@/components/NotificationBell'

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
const FRESH_WINDOW_MS = 30 * 1000 // only toast notifications created in the last 30s
const SKIP_PATH_PREFIXES = ['/admin', '/login', '/register', '/registro']

function parseData(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try { return JSON.parse(raw) as Record<string, unknown> } catch { return {} }
}

/** Same destinations as the bell and the inbox: messages open the chats list of each side, never the panel home. */
function getActionUrl(n: Notification, role: string | undefined): string {
  return notificationTarget(n.type, role, parseData(n.data))
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
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname
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

      const now = Date.now()
      const fresh = list.find(
        (n) =>
          !seenIdsRef.current.has(n.id) &&
          now - new Date(n.createdAt).getTime() < FRESH_WINDOW_MS
      )
      if (!fresh) return

      seenIdsRef.current.add(fresh.id)
      // On the client panel the page itself announces the new proposal (and points at it): no second alert
      if (fresh.type === 'NEW_PROPOSAL' && pathnameRef.current?.startsWith('/dashboard')) return
      const toast: Toast = {
        id: fresh.id,
        type: fresh.type,
        title: fresh.title,
        message: fresh.message,
        href: getActionUrl(fresh, session?.user?.role),
        enteredAt: Date.now(),
      }

      setToasts((prev) => [toast, ...prev].slice(0, MAX_STACK))
    } catch {
      // silent
    }
  }, [session?.user?.role])

  useNotificationRealtime(skipRender ? null : session?.user?.id, onNotification)

  // Hover or keyboard focus on a toast holds it on screen; leaving gives it its full time again
  const pausedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (toasts.length === 0) return
    const timer = setInterval(() => {
      const now = Date.now()
      setToasts((prev) => {
        const next = prev.filter((t) => pausedRef.current.has(t.id) || now - t.enteredAt < AUTO_DISMISS_MS)
        return next.length === prev.length ? prev : next
      })
    }, 500)
    return () => clearInterval(timer)
  }, [toasts.length])

  const pause = useCallback((id: string) => {
    pausedRef.current.add(id)
  }, [])

  const resume = useCallback((id: string) => {
    if (!pausedRef.current.delete(id)) return
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, enteredAt: Date.now() } : t)))
  }, [])

  const dismiss = useCallback((id: string) => {
    pausedRef.current.delete(id)
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

  if (skipRender) return null

  return (
    <div
      className="fixed left-0 right-0 z-[100] flex flex-col items-center gap-2 px-3 pointer-events-none"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      role="region"
      aria-label="Avisos en tiempo real"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((t) => {
        const Icon = getIcon(t.type)
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex w-full max-w-md items-stretch overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/5 animate-slide-down"
            onMouseEnter={() => pause(t.id)}
            onMouseLeave={() => resume(t.id)}
            onFocus={() => pause(t.id)}
            onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) resume(t.id) }}
          >
            <button
              type="button"
              onClick={() => handleClick(t)}
              className="flex min-w-0 flex-1 items-stretch text-left transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 rounded-l-2xl"
            >
              <span aria-hidden="true" className={`flex w-12 shrink-0 items-center justify-center bg-gradient-to-b ${getAccent(t.type)} text-white`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1 px-3 py-2.5">
                <span className="block truncate text-sm font-bold text-gray-900">{t.title}</span>
                <span className="mt-0.5 block text-xs leading-snug text-gray-600 line-clamp-2">{t.message}</span>
              </span>
            </button>
            <button
              type="button"
              aria-label="Cerrar aviso"
              onClick={() => dismiss(t.id)}
              className="flex min-h-[44px] w-11 shrink-0 items-center justify-center text-gray-600 hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 rounded-r-2xl"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
