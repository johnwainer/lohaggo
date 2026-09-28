import { Suspense } from 'react'
import { ServiciosContent } from '@/components/services/ServiciosContent'

export default function ServiciosPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
        </div>
      }
    >
      <ServiciosContent />
    </Suspense>
  )
}
