'use client'

import { Camera, Clock, Users } from 'lucide-react'
import { useResponseTime } from '@/lib/service-requests/useResponseTime'

type Props = {
  /** Partners really told about this request (from the create response); null when unknown */
  notified: number | null
  serviceName: string
  hasPhotos: boolean
  hasBudget: boolean
  className?: string
}

/** «N socios notificados · la primera propuesta suele llegar en ~X min» plus a nudge for what is missing. */
export function waitingHeadline(notified: number | null, serviceName: string): string {
  if (notified && notified > 0) return `${notified} ${notified === 1 ? 'socio notificado' : 'socios notificados'}`
  return `Estamos avisando a socios de ${serviceName}`
}

export default function WaitingInfo({ notified, serviceName, hasPhotos, hasBudget, className = '' }: Props) {
  const typical = useResponseTime()
  const nudge = !hasPhotos && !hasBudget
    ? 'Sin fotos ni presupuesto: cuando un socio te escriba, mándale una foto por el chat para una propuesta más precisa.'
    : !hasPhotos
      ? 'Sin fotos: cuando un socio te escriba, mándale una foto por el chat para una propuesta más precisa.'
      : !hasBudget
        ? 'Sin presupuesto: dile al socio por el chat cuánto quieres invertir y ajusta su propuesta.'
        : null

  return (
    <div className={`rounded-2xl bg-gray-50 p-4 text-left ${className}`}>
      <div className="flex items-start gap-3">
        <Users className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" aria-hidden="true" />
        <p className="text-sm font-semibold text-gray-900">{waitingHeadline(notified, serviceName)}</p>
      </div>
      <div className="mt-2 flex items-start gap-3">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" aria-hidden="true" />
        <p className="text-sm text-gray-700">
          {typical ? <>La primera propuesta suele llegar en <span className="font-semibold">{typical}</span>.</> : 'Te avisamos apenas llegue la primera propuesta.'}
        </p>
      </div>
      {nudge && (
        <div className="mt-2 flex items-start gap-3">
          <Camera className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" aria-hidden="true" />
          <p className="text-sm text-gray-700">{nudge}</p>
        </div>
      )}
    </div>
  )
}
