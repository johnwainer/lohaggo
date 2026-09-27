'use client'

import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import WhatsAppIcon, { whatsappHref } from './WhatsAppIcon'

type Props = {
  serviceName: string
  cityName: string
  partnerCount: number
  partnerName?: string | null
  whatsappPhone: string | null
  whatsappText: string
  onWhatsAppClick?: () => void
  onClose: () => void
}

export default function RequestSuccess({ serviceName, cityName, partnerCount, partnerName, whatsappPhone, whatsappText, onWhatsAppClick, onClose }: Props) {
  const headline = partnerName
    ? `¡Listo! Tu solicitud ya está con ${partnerName}`
    : partnerCount > 0
      ? `¡Listo! Tu solicitud ya está con ${partnerCount} ${partnerCount === 1 ? 'socio verificado' : 'socios verificados'} de ${serviceName} en ${cityName}`
      : `¡Listo! Recibimos tu solicitud de ${serviceName} en ${cityName}`

  return (
    <div className="p-6 md:p-8 text-center animate-fadeIn">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle2 className="h-9 w-9 text-emerald-600" />
      </div>
      <h2 className="text-xl md:text-2xl font-bold text-gray-900">{headline}</h2>
      <p className="mt-2 text-sm md:text-base text-gray-600">Te avisamos por WhatsApp cuando llegue la primera propuesta.</p>

      <div className="mt-6 space-y-3">
        <Link
          href="/dashboard?tab=requests"
          className="flex w-full items-center justify-center rounded-full bg-gradient-to-r from-primary-500 to-secondary-500 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary-600/30"
        >
          Ver mi solicitud
        </Link>
        {whatsappPhone && (
          <a
            href={whatsappHref(whatsappPhone, whatsappText)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onWhatsAppClick}
            className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-[#25D366] py-3 text-base font-semibold text-[#128C7E] hover:bg-[#25D366]/10"
          >
            <WhatsAppIcon />
            Hablar por WhatsApp
          </a>
        )}
        <button type="button" onClick={onClose} className="w-full py-2 text-sm font-medium text-gray-500 hover:text-gray-700">
          Cerrar
        </button>
      </div>
    </div>
  )
}
