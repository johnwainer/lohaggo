'use client'

import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'
import Link from 'next/link'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: string
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications?unreadOnly=true')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.slice(0, 5))
        setUnreadCount(data.length)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
    }
  }

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

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-gray-600 hover:text-gray-900 transition"
      >
        <Bell size={24} />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl z-20 border">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Notificaciones</h3>
              <Link
                href="/notifications"
                className="text-sm text-primary-600 hover:text-primary-700"
                onClick={() => setShowDropdown(false)}
              >
                Ver todas
              </Link>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No tienes notificaciones nuevas
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="p-4 border-b hover:bg-gray-50 cursor-pointer transition"
                    onClick={() => {
                      markAsRead(notification.id)
                      setShowDropdown(false)
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{notification.title}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(notification.createdAt).toLocaleString('es-ES')}
                        </p>
                      </div>
                      {!notification.read && (
                        <div className="w-2 h-2 bg-primary-600 rounded-full mt-2" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
