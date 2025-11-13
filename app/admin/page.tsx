'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/admin/Sidebar'
import DashboardSection from '@/components/admin/sections/DashboardSection'
import BookingsSection from '@/components/admin/sections/BookingsSection'
import UsersSection from '@/components/admin/sections/UsersSection'
import PartnersSection from '@/components/admin/sections/PartnersSection'
import ServicesSection from '@/components/admin/sections/ServicesSection'
import AnalyticsSection from '@/components/admin/sections/AnalyticsSection'
import NotificationsSection from '@/components/admin/sections/NotificationsSection'
import SettingsSection from '@/components/admin/sections/SettingsSection'
import DocumentsSection from '@/components/admin/sections/DocumentsSection'
import CommissionsSection from '@/components/admin/sections/CommissionsSection'
import PayoutsSection from '@/components/admin/sections/PayoutsSection'
import PaymentsSection from '@/components/admin/sections/PaymentsSection'
import CitiesSection from '@/components/admin/sections/CitiesSection'

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeSection, setActiveSection] = useState('dashboard')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      if (session?.user?.role !== 'ADMIN') {
        router.push('/dashboard')
      }
    }
  }, [status, session, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#FF2D55] mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Cargando panel administrativo...</p>
        </div>
      </div>
    )
  }

  if (status !== 'authenticated' || session?.user?.role !== 'ADMIN') {
    return null
  }
  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <DashboardSection />
      case 'bookings':
        return <BookingsSection />
      case 'users':
        return <UsersSection />
      case 'partners':
        return <PartnersSection />
      case 'documents':
        return <DocumentsSection />
      case 'services':
        return <ServicesSection />
      case 'cities':
        return <CitiesSection />
      case 'payments':
        return <PaymentsSection />
      case 'analytics':
        return <AnalyticsSection />
      case 'notifications':
        return <NotificationsSection />
      case 'settings':
        return <SettingsSection />
      case 'commissions':
        return <CommissionsSection />
      case 'payouts':
        return <PayoutsSection />
      default:
        return <DashboardSection />
    }
  }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      <main className="flex-1 overflow-auto ml-0 lg:ml-64">
        <div className="p-3 sm:p-6 lg:p-8">
          {renderSection()}
        </div>
      </main>
    </div>
  )
}