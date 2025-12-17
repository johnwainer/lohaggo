'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { MapPin, Bell, Menu, X } from 'lucide-react'
import { useCity } from '@/lib/city-context'

export function MobileHeader() {
  const { data: session } = useSession()
  const { selectedCity, getCityBySlug, setShowCityModal } = useCity()
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationCount, setNotificationCount] = useState(0)

  const city = getCityBySlug(selectedCity)

  useEffect(() => {
    if (session) {
      fetch('/api/notifications/unread-count')
        .then((res) => res.json())
        .then((data) => setNotificationCount(data.count || 0))
        .catch(() => {})
    }
  }, [session])

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 safe-area-top md:hidden">
        <div className="flex items-center justify-between h-14 px-4">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">L</span>
            </div>
            <span className="font-bold text-lg text-gray-900">LoHaggo</span>
          </Link>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowCityModal(true)}
              className="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <MapPin className="w-4 h-4" />
              <span className="max-w-[80px] truncate">{city?.name || 'City'}</span>
            </button>

            {session && (
              <Link
                href="/notifications"
                className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <Bell className="w-5 h-5" />
                {notificationCount > 0 && (
                  <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                )}
              </Link>
            )}

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-30 bg-black bg-opacity-50 md:hidden" onClick={() => setMenuOpen(false)}>
          <div
            className="fixed top-14 right-0 w-64 h-full bg-white shadow-xl safe-area-top"
            onClick={(e) => e.stopPropagation()}
          >
            <nav className="flex flex-col p-4 space-y-2">
              {session ? (
                <>
                  <Link
                    href="/profile"
                    className="px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    Profile
                  </Link>
                  <Link
                    href="/dashboard"
                    className="px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/my-ratings"
                    className="px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    My Ratings
                  </Link>
                  <hr className="my-2" />
                  <Link
                    href="/how-it-works"
                    className="px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    How it Works
                  </Link>
                  <Link
                    href="/faq"
                    className="px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    FAQ
                  </Link>
                  <Link
                    href="/contact"
                    className="px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    Contact
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    className="px-4 py-3 bg-primary-600 text-white hover:bg-primary-700 rounded-lg transition-colors text-center"
                    onClick={() => setMenuOpen(false)}
                  >
                    Sign Up
                  </Link>
                  <hr className="my-2" />
                  <Link
                    href="/how-it-works"
                    className="px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    How it Works
                  </Link>
                  <Link
                    href="/faq"
                    className="px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    FAQ
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
