'use client'

import { SessionProvider } from 'next-auth/react'
import { CityProvider } from '@/lib/city-context'
import { IconThemeProvider } from '@/lib/icon-theme-context'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      <CityProvider>
        <IconThemeProvider>{children}</IconThemeProvider>
      </CityProvider>
    </SessionProvider>
  )
}
