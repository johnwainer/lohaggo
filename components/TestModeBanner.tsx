'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

export default function TestModeBanner() {
  const [isTestMode, setIsTestMode] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkPaymentMode = async () => {
      try {
        const response = await fetch('/api/payment-mode')
        const data = await response.json()
        setIsTestMode(data.isTestMode)
      } catch (error) {
        setIsTestMode(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkPaymentMode()
  }, [])

  useEffect(() => {
    if (isTestMode && isVisible) {
      document.body.style.paddingTop = '80px'
    } else {
      document.body.style.paddingTop = '0'
    }

    return () => {
      document.body.style.paddingTop = '0'
    }
  }, [isTestMode, isVisible])

  if (isLoading || !isTestMode || !isVisible) {
    return null
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 text-white shadow-lg animate-pulse">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <AlertTriangle className="w-6 h-6 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-sm sm:text-base">
                ⚠️ MODO PRUEBAS ACTIVO
              </p>
              <p className="text-xs sm:text-sm opacity-90">
                El sistema de pagos está configurado en modo de pruebas. Los pagos no son reales.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
            aria-label="Cerrar banner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
