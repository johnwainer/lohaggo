'use client'

import { SessionProvider } from 'next-auth/react'
import { CityProvider } from '@/lib/city-context'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      <CityProvider>{children}</CityProvider>
    </SessionProvider>
  )
}
