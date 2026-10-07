'use client'

import { CountBadge } from '@/components/ui/count-badge'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: string
  data?: string | null
}

const isInternalPath = (v: unknown): v is string => typeof v === 'string' && /^\/(?![/\\])/.test(v) && !v.includes('\\')
/** A link that only points at the panel's home says nothing concrete: fall back to the destination for the type. */
const GENERIC_TARGETS = new Set(['/dashboard', '/partner', '/notifications', '/partner/notifications'])

export function parseNotificationData(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

/**
 * Where a notification takes its reader: its own link (`targetUrl`, `actionUrl`, `url`) when it brings a
 * concrete one, else the place for its type (messages, requests, bookings, verification…).
 */
export function notificationTarget(type: string, role: string | undefined, data: Record<string, unknown>): string {
  for (const key of ['targetUrl', 'actionUrl', 'url']) {
    const v = data[key]
    if (isInternalPath(v) && !GENERIC_TARGETS.has(v)) return v
  }
  const isPartner = role === 'PARTNER'
  if (type === 'NEW_MESSAGE' || data.chatId) return isPartner ? '/partner/messages' : '/dashboard/messages'
  if (isPartner) {
    if (type === 'DOCUMENT_APPROVED' || type === 'DOCUMENT_REJECTED') return '/partner/verification'
    if (type === 'ACHIEVEMENT_UNLOCKED') return '/partner/achievements'
    if (type === 'NEW_SERVICE_REQUEST' || type === 'PROPOSAL_REJECTED') return '/partner?tab=my-requests'
    if (data.bookingId || data.paymentId || type.startsWith('BOOKING_') || type.startsWith('PAYMENT_') || type.startsWith('RATING_') || type === 'PROPOSAL_ACCEPTED') {
      return '/partner?tab=bookings'
    }
    if (data.serviceRequestId || data.proposalId) return '/partner?tab=my-requests'
    return '/partner'
  }
  if (type === 'RATING_RECEIVED') return '/my-ratings'
  if (type === 'NEW_PROPOSAL' || type === 'REQUEST_EXPIRING_SOON' || type === 'NEW_SERVICE_REQUEST') return '/dashboard?tab=requests'
  if (data.bookingId || data.paymentId || type.startsWith('BOOKING_') || type.startsWith('PAYMENT_') || type.startsWith('RATING_')) {
    return '/dashboard?tab=bookings'
  }
  if (data.serviceRequestId || data.proposalId) return '/dashboard?tab=requests'
  return '/dashboard'
}

/** «hace 2 horas», «hace 5 minutos» */
export function relativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return ''
  return formatDistanceToNow(d, { addSuffix: true, locale: es })
}

export default function NotificationBell() {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?unreadOnly=true')
      if (res.ok) {
        const data = await res.json()
        if (!Array.isArray(data)) return
        setNotifications(data.slice(0, 5))
        setUnreadCount(data.length)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  useEffect(() => {
    setShowDropdown(false)
  }, [pathname])

  useEffect(() => {
    if (!showDropdown) return
    const onPointer = (e: MouseEvent | TouchEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDropdown(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('touchstart', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('touchstart', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [showDropdown])

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId })
      })
      fetchNotifications()
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    setShowDropdown(false)
    void markAsRead(notification.id)
    router.push(notificationTarget(notification.type, session?.user?.role, parseNotificationData(notification.data)))
  }

  const notificationsUrl = session?.user?.role === 'PARTNER'
    ? '/partner/notifications'
    : '/notifications'

  const buttonLabel = unreadCount > 0
    ? `Notificaciones, ${unreadCount > 99 ? 'más de 99' : unreadCount} sin leer`
    : 'Notificaciones'

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setShowDropdown(!showDropdown)}
        aria-label={buttonLabel}
        aria-expanded={showDropdown}
        aria-haspopup="true"
        aria-controls="campana-notificaciones"
        className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
      >
        <Bell size={24} aria-hidden="true" />
        <CountBadge count={unreadCount} max={99} tone="danger" label="notificaciones sin leer" className="absolute right-0 top-0" />
      </button>

      {showDropdown && (
        <div
          id="campana-notificaciones"
          role="region"
          aria-label="Notificaciones sin leer"
          className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden bg-white rounded-2xl shadow-xl z-20 border border-gray-200"
        >
          <div className="flex items-center justify-between border-b border-gray-200 pl-4 pr-2 py-1">
            <h2 className="text-base font-semibold text-gray-900">Notificaciones</h2>
            <Link
              href={notificationsUrl}
              className="inline-flex min-h-[44px] items-center rounded-full px-3 text-sm font-semibold text-primary-700 hover:bg-primary-50"
              onClick={() => setShowDropdown(false)}
            >
              Ver todas
            </Link>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-8 text-center text-sm text-gray-600">
                No tienes notificaciones nuevas
              </p>
            ) : (
              <ul>
                {notifications.map((notification) => (
                  <li key={notification.id} className="border-b border-gray-100 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(notification)}
                      className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-gray-900">{notification.title}</span>
                        <span className="mt-1 block text-sm text-gray-600 line-clamp-2">{notification.message}</span>
                        <time dateTime={notification.createdAt} className="mt-1 block text-xs text-gray-600">
                          {relativeTime(notification.createdAt)}
                        </time>
                      </span>
                      {!notification.read && (
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary-600">
                          <span className="sr-only">Sin leer</span>
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
