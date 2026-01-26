'use client'

import { Shield, AlertTriangle, CheckCircle, Lock, HeadphonesIcon, FileCheck } from 'lucide-react'

interface PlatformTrustBannerProps {
  variant?: 'warning' | 'info' | 'success'
  context?: 'chat' | 'booking' | 'general' | 'partner'
  className?: string
}

export default function PlatformTrustBanner({ 
  variant = 'warning', 
  context = 'general',
  className = '' 
}: PlatformTrustBannerProps) {
  
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
          message: 'Al usar LoHaggo estás protegido con nuestras garantías. NO aceptes pagos o acuerdos fuera de la plataforma.',
          benefits: [
            'Pagos seguros y protegidos',
            'Seguro de responsabilidad civil',
            'Garantía de satisfacción',
            'Soporte y mediación en caso de conflictos'
          ]
        }
      case 'partner':
        return {
          icon: <Shield className="w-5 h-5 flex-shrink-0" />,
          title: '💼 Trabaja seguro con LoHaggo',
          message: 'Mantén todas tus transacciones en la plataforma para estar protegido. NO aceptes pagos directos ni contacto externo.',
          benefits: [
            'Cobros garantizados y puntuales',
            'Seguro de responsabilidad incluido',
            'Soporte legal ante disputas',
            'Reputación y calificaciones verificadas'
          ]
        }
      default:
        return {
          icon: <CheckCircle className="w-5 h-5 flex-shrink-0" />,
          title: '✅ Beneficios de usar LoHaggo',
          message: 'Mantén todas tus transacciones en la plataforma para disfrutar de protección completa.',
          benefits: [
            'Profesionales verificados y calificados',
            'Pagos seguros con garantía',
            'Soporte al cliente 24/7',
            'Seguros y protección legal'
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
    <div className={`${variantStyles[variant]} border-2 rounded-xl p-4 md:p-6 ${className}`}>
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
            <span>Contactar fuera de la plataforma anula todas las garantías y protecciones</span>
          </div>
        </div>
      )}
    </div>
  )
}
