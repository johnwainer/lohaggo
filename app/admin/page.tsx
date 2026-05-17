'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
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
  const searchParams = useSearchParams()
  const [activeSection, setActiveSection] = useState('dashboard')

  useEffect(() => {
    const sectionFromQuery = searchParams.get('section')
    if (sectionFromQuery && VALID_SECTIONS.has(sectionFromQuery)) {
      setActiveSection(sectionFromQuery)
    } else {
      setActiveSection('dashboard')
    }
  }, [searchParams])

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard': return <DashboardSection />
      case 'bookings': return <BookingsSection />
      case 'users': return <UsersSection />
      case 'partners': return <PartnersSection />
      case 'services': return <ServicesSection />
      case 'cities': return <CitiesSection />
      case 'payments': return <PaymentsSection />
      case 'analytics': return <AnalyticsSection />
      case 'notifications': return <NotificationsSection />
      case 'settings': return <SettingsSection />
      case 'commissions': return <CommissionsSection />
      case 'payouts': return <PayoutsSection />
      default: return <DashboardSection />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {renderSection()}
    </div>
  )
}
