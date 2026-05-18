'use client'

import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { AppDownloadBanner } from './AppDownloadBanner'
import { BottomNav } from './mobile/BottomNav'
import NotificationPermissionPrompt from './NotificationPermissionPrompt'
import PWAInstallPrompt from './PWAInstallPrompt'
import PWAOnboardingPrompt from './PWAOnboardingPrompt'
import TermsBanner from './TermsBanner'
import TestModeBanner from './TestModeBanner'
import InactiveAccountBanner from './InactiveAccountBanner'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const isAdmin = pathname.startsWith('/admin')
  const isPartner = session?.user?.role === 'PARTNER'
  // Partner app: /partner/* always, /profile only when the user is a partner.
  // These pages have their own PartnerDashboardNav — the public Navbar would
  // conflict (both sticky top-0) and slide underneath it on scroll.
  const isPartnerApp = pathname.startsWith('/partner') || (isPartner && pathname === '/profile')

  if (isAdmin) {
    return <>{children}</>
  }

  if (isPartnerApp) {
    return (
      <>
        <TestModeBanner />
        <InactiveAccountBanner />
        {children}
        <NotificationPermissionPrompt />
        <PWAInstallPrompt />
        <PWAOnboardingPrompt />
        <TermsBanner />
      </>
    )
  }

  return (
    <>
      <TestModeBanner />
      <InactiveAccountBanner />
      <Navbar />
      <main className="min-h-screen pb-24 md:pb-0">
        {children}
      </main>
      <AppDownloadBanner />
      <Footer />
      <BottomNav />
      <NotificationPermissionPrompt />
      <PWAInstallPrompt />
      <PWAOnboardingPrompt />
      <TermsBanner />
    </>
  )
}
