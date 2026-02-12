'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardSection from '@/components/admin/sections/DashboardSection'
import BookingsSection from '@/components/admin/sections/BookingsSection'
import UsersSection from '@/components/admin/sections/UsersSection'
import PartnersSection from '@/components/admin/sections/PartnersSection'
import ServicesSection from '@/components/admin/sections/ServicesSection'
import AnalyticsSection from '@/components/admin/sections/AnalyticsSection'
import NotificationsSection from '@/components/admin/sections/NotificationsSection'
import SettingsSection from '@/components/admin/sections/SettingsSection'
import CommissionsSection from '@/components/admin/sections/CommissionsSection'
import PayoutsSection from '@/components/admin/sections/PayoutsSection'
import PaymentsSection from '@/components/admin/sections/PaymentsSection'
import CitiesSection from '@/components/admin/sections/CitiesSection'

const VALID_SECTIONS = new Set([
  'dashboard',
  'bookings',
  'users',
  'partners',
  'services',
  'cities',
  'payments',
  'analytics',
  'notifications',
  'settings',
  'commissions',
  'payouts',
])

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeSection, setActiveSection] = useState('dashboard')

  useEffect(() => {
    const sectionFromQuery = searchParams.get('section')
    if (sectionFromQuery && VALID_SECTIONS.has(sectionFromQuery)) {
      setActiveSection(sectionFromQuery)
      return
    }

    if (!sectionFromQuery) {
      setActiveSection('dashboard')
    }
  }, [searchParams])

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
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-500 mx-auto mb-4"></div>
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

  return (
    <div className="min-h-screen bg-gray-50">
      {renderSection()}
    </div>
  )
}
