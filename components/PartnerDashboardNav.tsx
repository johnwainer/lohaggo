'use client'

import { useRouter } from 'next/navigation'
import { Home, Package, MessageSquare } from 'lucide-react'

interface PartnerDashboardNavProps {
  bookingsCount?: number
  requestsCount?: number
  activeTab?: string | null
}

export default function PartnerDashboardNav({
  bookingsCount = 0,
  requestsCount = 0,
  activeTab = null
}: PartnerDashboardNavProps) {
  const router = useRouter()

  return (
    <div className="border-t border-gray-200 bg-gray-50">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <nav className="flex gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => router.push('/partner')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <Home size={24} />
            <span className="hidden sm:inline">Resumen</span>
          </button>

          <button
            onClick={() => router.push('/partner?tab=bookings')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'bookings'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <Package size={24} />
            <span className="hidden sm:inline">Mis Reservas</span>
            {bookingsCount > 0 && (
              <span className="bg-primary-600 text-white text-xs px-2 py-0.5 rounded-full">
                {bookingsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => router.push('/partner?tab=my-requests')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'my-requests'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <MessageSquare size={24} />
            <span className="hidden sm:inline">Para Mí</span>
            {requestsCount > 0 && (
              <span className="bg-primary-500 text-white text-xs px-2 py-0.5 rounded-full">
                {requestsCount}
              </span>
            )}
          </button>
        </nav>
      </div>
    </div>
  )
}
