'use client'

interface PartnerHeaderProps {
  title: string
  subtitle?: string
  // Props legacy mantenidas para no romper callsites existentes; ignoradas
  activeTab?: string
  bookingsCount?: number
  requestsCount?: number
  onTabChange?: (tab: string) => void
  showNavigation?: boolean
}

export default function PartnerHeader({ title, subtitle }: PartnerHeaderProps) {
  return (
    <header className="bg-white md:bg-transparent border-b border-gray-200 md:border-0 px-4 md:px-0 py-3 md:py-0 md:mb-4">
      <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">{title}</h1>
      {subtitle && (
        <p className="text-xs md:text-sm text-gray-500 mt-0.5 truncate">{subtitle}</p>
      )}
    </header>
  )
}
