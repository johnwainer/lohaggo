'use client'

import { SessionProvider } from 'next-auth/react'
import { CityProvider } from '@/lib/city-context'
import { isNativePlatform } from '@/lib/platform'

export function Providers({ children }: { children: React.ReactNode }) {
  const basePath = isNativePlatform()
    ? `${process.env.NEXT_PUBLIC_API_URL || 'https://www.lohaggo.com'}/api/auth`
    : '/api/auth'

  return (
    <SessionProvider
      basePath={basePath}
      refetchInterval={0}
      refetchOnWindowFocus={false}
    >
      <CityProvider>{children}</CityProvider>
    </SessionProvider>
  )
}
