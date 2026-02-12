'use client'

import { useSession } from 'next-auth/react'
import OnboardingTour from '@/components/OnboardingTour'

interface HomeClientWrapperProps {
  children: React.ReactNode
}

export default function HomeClientWrapper({ children }: HomeClientWrapperProps) {
  const { data: session } = useSession()

  return (
    <>
      <OnboardingTour />
      {children}
    </>
  )
}
