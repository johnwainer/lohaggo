'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Sidebar from '@/components/admin/Sidebar'
import { activeSectionFor } from '@/components/admin/admin-menu'

const COLLAPSED_KEY = 'admin.sidebar.collapsed'

export default function AdminLayoutClient({
  children,
  isSuperAdmin = false,
}: {
  children: React.ReactNode
  isSuperAdmin?: boolean
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeSection = activeSectionFor(pathname, searchParams.get('section'))

  // Desktop rail, remembered per browser
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSED_KEY) === '1') } catch { /* storage unavailable */ }
  }, [])
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSED_KEY, c ? '0' : '1') } catch { /* noop */ }
      return !c
    })
  }

  // Full-bleed pages need no padding or max-width wrapper
  const isFullBleed = pathname.startsWith('/admin/inbox')
  const offset = collapsed ? 'lg:ml-20' : 'lg:ml-64'

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar activeSection={activeSection} isSuperAdmin={isSuperAdmin} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <main data-admin-main className={isFullBleed ? `fixed inset-x-0 bottom-0 top-14 lg:top-0 ${collapsed ? 'lg:left-20' : 'lg:left-64'} overflow-hidden flex flex-col transition-all duration-300` : `flex-1 min-w-0 ml-0 ${offset} overflow-auto transition-all duration-300`}>
        {isFullBleed ? (
          children
        ) : (
          <div className="px-3 pb-6 pt-[4.5rem] sm:px-6 sm:pb-6 lg:p-8">
            <div className="mx-auto w-full max-w-7xl">
              {children}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
