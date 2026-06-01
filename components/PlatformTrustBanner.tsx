'use client'

import { Shield, AlertTriangle, CheckCircle, Lock, HeadphonesIcon, FileCheck, X } from 'lucide-react'
import { useEffect, useState } from 'react'

interface PlatformTrustBannerProps {
  variant?: 'warning' | 'info' | 'success'
  context?: 'chat' | 'booking' | 'general' | 'partner'
  className?: string
  /** Si se pasa, el banner se puede cerrar y la decisión persiste en localStorage. */
  dismissKey?: string
}

export default function PlatformTrustBanner({
  variant = 'warning',
  context = 'general',
  className = '',
  dismissKey,
}: PlatformTrustBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
    if (dismissKey) {
      try {
        setDismissed(localStorage.getItem(`trust-banner:${dismissKey}`) === '1')
      } catch { /* ignore */ }
    }
  }, [dismissKey])

  const handleDismiss = () => {
    setDismissed(true)
    if (dismissKey) {
      try { localStorage.setItem(`trust-banner:${dismissKey}`, '1') } catch { /* ignore */ }
    }
  }

  if (dismissKey && hydrated && dismissed) return null
  
  const getContent = () => {
    switch (context) {
      case 'chat':
        return {
          icon: <AlertTriangle className="w-5 h-5 flex-shrink-0" />,
          title: '⚠️ Mantén tu comunicación en la plataforma',
          message: 'Por tu seguridad, NO compartas números de teléfono, WhatsApp, emails o redes sociales. Toda comunicación debe ser a través de LoHaggo para garantizar tu protección.',
          benefits: [
            'Protección contra fraudes y estafas',
            'Soporte 24/7 ante cualquier problema',
            'Historial completo de conversaciones',
            'Garantía de servicio respaldada'
          ]
        }
      case 'booking':
        return {
          icon: <Shield className="w-5 h-5 flex-shrink-0" />,
          title: '🛡️ Tu seguridad es nuestra prioridad',
          message: 'El pago se acuerda directamente con el socio (efectivo o transferencia a su cuenta). Mantén el chat y el reporte del pago dentro de LoHaggo para conservar tus garantías y soporte.',
          benefits: [
            'Profesionales verificados y calificados',
            'Historial completo del servicio y conversaciones',
            'Reporte y confirmación de pago en la app',
            'Soporte y mediación en caso de conflictos'
          ]
        }
      case 'partner':
        return {
          icon: <Shield className="w-5 h-5 flex-shrink-0" />,
          title: '💼 Trabaja seguro con LoHaggo',
          message: 'El cliente te paga directamente en efectivo o por transferencia a tu cuenta. Mantén la comunicación dentro del chat de LoHaggo para conservar tus garantías y reputación.',
          benefits: [
            'Cliente verificado con historial en la plataforma',
            'Confirmación de pago documentada en la app',
            'Soporte y mediación ante disputas',
            'Reputación y calificaciones verificadas'
          ]
        }
      default:
        return {
          icon: <CheckCircle className="w-5 h-5 flex-shrink-0" />,
          title: '✅ Beneficios de usar LoHaggo',
          message: 'Catálogo de profesionales verificados, chat seguro y reporte de pago en la app. El pago se acuerda directamente entre cliente y socio.',
          benefits: [
            'Profesionales verificados y calificados',
            'Chat e historial dentro de la app',
            'Soporte al cliente 24/7',
            'Calificaciones y mediación ante disputas'
          ]
        }
    }
  }

  const content = getContent()

  const variantStyles = {
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    success: 'bg-green-50 border-green-200 text-green-900'
  }

  const iconStyles = {
    warning: 'text-amber-600',
    info: 'text-blue-600',
    success: 'text-green-600'
  }

  return (
    <div className={`${variantStyles[variant]} border-2 rounded-xl p-4 md:p-6 relative ${className}`}>
      {dismissKey && (
        <button
          onClick={handleDismiss}
          aria-label="Cerrar banner"
          className="absolute top-2 right-2 p-1.5 rounded-lg hover:bg-black/5 transition opacity-60 hover:opacity-100"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      <div className="flex items-start gap-3 mb-4">
        <div className={iconStyles[variant]}>
          {content.icon}
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-base md:text-lg mb-2">{content.title}</h3>
          <p className="text-sm md:text-base font-medium leading-relaxed">{content.message}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        {content.benefits.map((benefit, index) => (
          <div key={index} className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <span className="text-xs md:text-sm font-medium">{benefit}</span>
          </div>
        ))}
      </div>

      {(context === 'chat' || context === 'booking') && (
        <div className="mt-4 pt-4 border-t border-current/20">
          <div className="flex items-center gap-2 text-xs md:text-sm font-bold">
            <Lock className="w-4 h-4" />
            <span>Comunicarte fuera del chat de LoHaggo anula las garantías y el soporte</span>
          </div>
        </div>
      )}
    </div>
  )
}
