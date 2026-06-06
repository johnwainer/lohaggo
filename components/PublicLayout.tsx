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
import InactiveAccountBanner from './InactiveAccountBanner'
import PasswordUpdateBanner from './shared/PasswordUpdateBanner'
import FloatingButtons from './FloatingButtons'
import PartnerShell from './partner/PartnerShell'
import InAppBrowserBanner from './InAppBrowserBanner'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const isAdmin = pathname.startsWith('/admin')
  const isPartnerPath = pathname.startsWith('/partner')
  const isProfilePath = pathname === '/profile' || pathname.startsWith('/profile/')
  // /profile es compartido entre CLIENT y PARTNER — solo aplicamos shell de
  // socio si el usuario actual es PARTNER.
  const isPartner = session?.user?.role === 'PARTNER'
  const usePartnerShell = isPartnerPath || (isProfilePath && isPartner)

  if (isAdmin) {
    return <>{children}</>
  }

  if (usePartnerShell) {
    return (
      <>
        <InAppBrowserBanner />
        <InactiveAccountBanner />
        <PasswordUpdateBanner />
        <PartnerShell>{children}</PartnerShell>
        <BottomNav />
        <NotificationPermissionPrompt />
      </>
    )
  }

  return (
    <>
      <InAppBrowserBanner />
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
    </>
  )
}
