'use client'

import { useRouter } from 'next/navigation'
import { Home, Package, MessageSquare, Heart } from 'lucide-react'

interface ClientDashboardNavProps {
  bookingsCount?: number
  requestsCount?: number
  favoritesCount?: number
  activeTab?: 'overview' | 'bookings' | 'requests' | 'favorites' | null
}

export default function ClientDashboardNav({
  bookingsCount = 0,
  requestsCount = 0,
  favoritesCount = 0,
  activeTab = null
}: ClientDashboardNavProps) {
  const router = useRouter()

  return (
    <div className="border-t border-gray-200 bg-gray-50">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <nav className="flex gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => router.push('/dashboard')}
            className={`flex items-center gap-2 sm:gap-2 px-4 sm:px-4 py-3 sm:py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <Home size={24} className="sm:w-[22px] sm:h-[22px]" />
            <span className="hidden sm:inline">Resumen</span>
          </button>

          <button
            onClick={() => router.push('/dashboard')}
            className={`flex items-center gap-2 sm:gap-2 px-4 sm:px-4 py-3 sm:py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'bookings'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <Package size={24} className="sm:w-[22px] sm:h-[22px]" />
            <span className="hidden sm:inline">Mis Reservas</span>
            {bookingsCount > 0 && (
              <span className="bg-primary-600 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                {bookingsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => router.push('/dashboard')}
            className={`flex items-center gap-2 sm:gap-2 px-4 sm:px-4 py-3 sm:py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'requests'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <MessageSquare size={24} className="sm:w-[22px] sm:h-[22px]" />
            <span className="hidden sm:inline">Mis Solicitudes</span>
            {requestsCount > 0 && (
              <span className="bg-primary-500 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                {requestsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => router.push('/dashboard?tab=favorites')}
            className={`flex items-center gap-2 sm:gap-2 px-4 sm:px-4 py-3 sm:py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'favorites'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <Heart size={24} className="sm:w-[22px] sm:h-[22px]" />
            <span className="hidden sm:inline">Favoritos</span>
            {favoritesCount > 0 && (
              <span className="bg-primary-500 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                {favoritesCount}
              </span>
            )}
          </button>
        </nav>
      </div>
    </div>
  )
}
