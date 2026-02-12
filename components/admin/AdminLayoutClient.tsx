'use client'

import { usePathname } from 'next/navigation'
import Sidebar from '@/components/admin/Sidebar'

export default function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  const getActiveSectionFromPath = () => {
    if (pathname === '/admin') return 'dashboard'
    if (pathname.startsWith('/admin/monitoring')) return 'monitoring'
    if (pathname.startsWith('/admin/ads')) return 'ads'
    if (pathname.startsWith('/admin/search-analytics')) return 'search-analytics'
    if (pathname.startsWith('/admin/payment-config')) return 'payment-config'
    if (pathname.startsWith('/admin/commissions')) return 'commissions'
    if (pathname.startsWith('/admin/payouts')) return 'payouts'
    if (pathname.startsWith('/admin/documents')) return 'documents'
    return 'dashboard'
  }

  const activeSection = getActiveSectionFromPath()

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar activeSection={activeSection} />
      <main className="flex-1 overflow-auto ml-0 lg:ml-64">
        <div className="p-3 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
