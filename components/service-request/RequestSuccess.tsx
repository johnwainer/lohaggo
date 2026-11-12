'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Bell, CheckCircle2, Loader2 } from 'lucide-react'
import WhatsAppIcon, { whatsappHref } from './WhatsAppIcon'
import WaitingInfo from './WaitingInfo'
import { usePushNotifications } from '@/hooks/usePushNotifications'

type Props = {
  serviceName: string
  cityName: string
  partnerCount: number
  partnerName?: string | null
  /** Partners really told (create response); null when unknown */
  partnersNotified?: number | null
  hasPhotos?: boolean
  hasBudget?: boolean
  whatsappPhone: string | null
  whatsappText: string
  onWhatsAppClick?: () => void
  onClose: () => void
}

export default function RequestSuccess({ serviceName, cityName, partnerCount, partnerName, partnersNotified = null, hasPhotos = false, hasBudget = false, whatsappPhone, whatsappText, onWhatsAppClick, onClose }: Props) {
  const { isSupported, isSubscribed, permission, isLoading, subscribeToPush } = usePushNotifications()
  const [pushError, setPushError] = useState(false)
  const headline = partnerName
    ? `¡Listo! Tu solicitud ya está con ${partnerName}`
    : partnerCount > 0
      ? `¡Listo! Tu solicitud ya está con ${partnerCount} ${partnerCount === 1 ? 'socio verificado' : 'socios verificados'} de ${serviceName} en ${cityName}`
      : `¡Listo! Recibimos tu solicitud de ${serviceName} en ${cityName}`

  // The push ask lives here, where it has an obvious reason: a tap on the button is the permission gesture
  const canAskPush = isSupported && !isSubscribed && permission === 'default'

  return (
    <div className="p-6 md:p-8 text-center animate-fadeIn">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle2 className="h-9 w-9 text-emerald-600" />
      </div>
      <h2 className="text-xl md:text-2xl font-bold text-gray-900">{headline}</h2>

      <WaitingInfo className="mt-4" notified={partnerName ? null : partnersNotified} serviceName={serviceName} hasPhotos={hasPhotos} hasBudget={hasBudget} />

      <p className="mt-3 text-sm md:text-base text-gray-600">
        {isSubscribed || permission === 'granted' ? 'Te avisamos en este celular y por WhatsApp cuando llegue la primera propuesta.' : 'Te avisamos por WhatsApp cuando llegue la primera propuesta.'}
      </p>

      <div className="mt-5 space-y-3">
        {canAskPush && (
          <button
            type="button"
            disabled={isLoading}
            onClick={async () => { setPushError(false); const ok = await subscribeToPush(); if (!ok) setPushError(true) }}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full border-2 border-secondary-500 bg-primary-50 px-4 py-3 text-base font-semibold text-secondary-700 hover:bg-primary-100 disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Bell className="h-5 w-5" aria-hidden="true" />}
            Avísame aquí cuando llegue la primera propuesta
          </button>
        )}
        {pushError && <p role="alert" className="text-xs text-amber-700">No pudimos activar los avisos en este navegador. Igual te escribimos por WhatsApp.</p>}
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
        <button type="button" onClick={onClose} className="min-h-[44px] w-full py-2 text-sm font-medium text-gray-500 hover:text-gray-700">
          Cerrar
        </button>
      </div>
    </div>
  )
}
