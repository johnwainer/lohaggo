'use client'

import { usePathname } from 'next/navigation'
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
  const isAdmin = pathname.startsWith('/admin')
  const isPartnerApp = pathname.startsWith('/partner')

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
