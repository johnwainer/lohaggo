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
import InactiveAccountBanner from './InactiveAccountBanner'
import PasswordUpdateBanner from './shared/PasswordUpdateBanner'
import FloatingButtons from './FloatingButtons'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname.startsWith('/admin')
  const isPartnerPanel = pathname.startsWith('/partner')

  if (isAdmin) {
    return <>{children}</>
  }

  // Panel socio (rutas internas, no la landing pública /partner) tiene su propio shell.
  // El layout en app/partner/layout.tsx renderiza PartnerShell.
  if (isPartnerPanel) {
    return (
      <>
        <InactiveAccountBanner />
        <PasswordUpdateBanner />
        {children}
        <BottomNav />
        <NotificationPermissionPrompt />
      </>
    )
  }

  return (
    <>
      <InactiveAccountBanner />
      <Navbar />
      <PasswordUpdateBanner />
      <main className="min-h-screen pb-24 md:pb-0">
        {children}
      </main>
      <AppDownloadBanner />
      <Footer />
      <BottomNav />
      <FloatingButtons />
      <NotificationPermissionPrompt />
      <PWAInstallPrompt />
      <PWAOnboardingPrompt />
      <TermsBanner />
    </>
  )
}
