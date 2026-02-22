'use client'

import ClientDashboardNav from '@/components/ClientDashboardNav'
import PartnerDashboardNav from '@/components/PartnerDashboardNav'

type Role = 'CLIENT' | 'PARTNER'

interface AccountTopHeaderProps {
  role: Role
  title: string
  subtitle?: string
  activeTab?: string | null
  action?: React.ReactNode
  counts?: {
    bookings?: number
    requests?: number
    favorites?: number
    notifications?: number
  }
}

export default function AccountTopHeader({
  role,
  title,
  subtitle,
  activeTab = null,
  action,
  counts
}: AccountTopHeaderProps) {
  return (
    <header className="account-header">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="panel-title truncate">{title}</h1>
            {subtitle ? <p className="panel-subtitle truncate hidden sm:block">{subtitle}</p> : null}
          </div>
          {action ? <div className="flex-shrink-0">{action}</div> : null}
        </div>
      </div>

      {role === 'PARTNER' ? (
        <PartnerDashboardNav
          bookingsCount={counts?.bookings ?? 0}
          requestsCount={counts?.requests ?? 0}
          notificationsCount={counts?.notifications}
          activeTab={activeTab}
        />
      ) : (
        <ClientDashboardNav
          bookingsCount={counts?.bookings ?? 0}
          requestsCount={counts?.requests ?? 0}
          favoritesCount={counts?.favorites ?? 0}
          notificationsCount={counts?.notifications}
          activeTab={activeTab as 'overview' | 'bookings' | 'requests' | 'favorites' | 'notifications' | null}
        />
      )}
    </header>
  )
}
