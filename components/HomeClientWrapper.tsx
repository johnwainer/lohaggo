'use client'

import dynamic from 'next/dynamic'

const OnboardingTour = dynamic(() => import('@/components/OnboardingTour'), { ssr: false, loading: () => null })

interface HomeClientWrapperProps {
  children: React.ReactNode
}

export default function HomeClientWrapper({ children }: HomeClientWrapperProps) {
  return (
    <>
      <OnboardingTour />
      {children}
    </>
  )
}
