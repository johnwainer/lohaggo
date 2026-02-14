'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import Sidebar from '@/components/admin/Sidebar'

export default function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const getActiveSectionFromPath = () => {
    const sectionFromQuery = searchParams.get('section')
    const querySections = new Set([
      'dashboard',
      'analytics',
      'bookings',
      'users',
      'partners',
      'services',
      'cities',
      'payments',
      'notifications',
      'settings',
      'commissions',
      'payouts',
    ])

    if (pathname === '/admin' && sectionFromQuery && querySections.has(sectionFromQuery)) {
      return sectionFromQuery
    }
    if (pathname === '/admin') return 'dashboard'
    if (pathname.startsWith('/admin/monitoring')) return 'monitoring'
    if (pathname.startsWith('/admin/operations')) return 'operations'
    if (pathname.startsWith('/admin/training')) return 'training'
    if (pathname.startsWith('/admin/workflow')) return 'workflow'
    if (pathname.startsWith('/admin/ads')) return 'ads'
    if (pathname.startsWith('/admin/search-analytics')) return 'search-analytics'
    if (pathname.startsWith('/admin/platform-control')) return 'platform-control'
    if (pathname.startsWith('/admin/payment-config')) return 'payment-config'
    if (pathname.startsWith('/admin/banks')) return 'banks'
    if (pathname.startsWith('/admin/finance-ops')) return 'finance-ops'
    if (pathname.startsWith('/admin/compliance')) return 'compliance'
    if (pathname.startsWith('/admin/security')) return 'security'
    if (pathname.startsWith('/admin/commissions')) return 'commissions'
    if (pathname.startsWith('/admin/payouts')) return 'payouts'
    if (pathname.startsWith('/admin/documents')) return 'documents'
    if (pathname.startsWith('/admin/risk-control')) return 'risk-control'
    return 'dashboard'
  }

  const activeSection = getActiveSectionFromPath()

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar activeSection={activeSection} />
      <main className="flex-1 overflow-auto ml-0 lg:ml-64">
        <div className="p-3 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-7xl">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
