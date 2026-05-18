'use client'

import PartnerDashboardNav from '@/components/PartnerDashboardNav'

interface PartnerHeaderProps {
  title: string
  subtitle?: string
  activeTab?: string
  bookingsCount?: number
  requestsCount?: number
  onTabChange?: (tab: string) => void
  showNavigation?: boolean
}

export default function PartnerHeader({
  title,
  subtitle,
  activeTab,
  bookingsCount = 0,
  requestsCount = 0,
  onTabChange,
  showNavigation = true,
}: PartnerHeaderProps) {
  return (
    <header className="bg-white shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className="min-w-0 flex-1">
              <h1 className="panel-title truncate">{title}</h1>
              {subtitle && (
                <p className="panel-subtitle truncate hidden sm:block">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {showNavigation && (
        <PartnerDashboardNav
          bookingsCount={bookingsCount}
          requestsCount={requestsCount}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
      )}
    </header>
  )
}
