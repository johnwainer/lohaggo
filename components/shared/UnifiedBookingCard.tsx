'use client'

import { Calendar, CheckCircle2, ChevronDown, Clock, Loader2, MapPin, MessageCircle, Star, User } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { DESIGN_SYSTEM } from '@/lib/design-system'
import { BookingVisualState, getBookingTimeline, getBookingVisualLabel, isStepComplete } from '@/lib/booking-status'

type Action = {
  label: string
  onClick: () => void | Promise<void>
  icon?: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
  disabled?: boolean
  badge?: number
}

interface UnifiedBookingCardProps {
  role: 'CLIENT' | 'PARTNER'
  serviceName: string
  serviceIcon: string
  counterpartName: string
  counterpartLabel: string
  visualState: BookingVisualState
  totalPrice: string
  scheduledDate: string
  scheduledTime: string
  address: string
  notes?: string
  priorityBadges?: string[]
  primaryAction?: Action
  secondaryActions?: Action[]
  compact?: boolean
  metadataInline?: string
}

function getActionClass(variant: Action['variant'] = 'secondary') {
  if (variant === 'primary') return `min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${DESIGN_SYSTEM.components.button.primary}`
  if (variant === 'ghost') return `min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${DESIGN_SYSTEM.components.button.ghost}`
  return `min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${DESIGN_SYSTEM.components.button.outline}`
}

export default function UnifiedBookingCard({
  role,
  serviceName,
  serviceIcon,
  counterpartName,
  counterpartLabel,
  visualState,
  totalPrice,
  scheduledDate,
  scheduledTime,
  address,
  notes,
  priorityBadges = [],
  primaryAction,
  secondaryActions = [],
  compact = true,
  metadataInline,
}: UnifiedBookingCardProps) {
  const color = DESIGN_SYSTEM.statusColors[visualState]
  const timeline = getBookingTimeline(role)
  const relativeTime = formatDistanceToNow(new Date(scheduledDate), { addSuffix: true, locale: es })
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const stepMicrocopy = useMemo(() => {
    if (role === 'CLIENT') {
      if (visualState === 'COMPLETED') return 'Pendiente por ti: completa el pago para cerrar el servicio.'
      if (visualState === 'PAID') return 'Siguiente paso: califica el servicio para cerrar la experiencia.'
      if (visualState === 'IN_PROGRESS') return 'El socio está trabajando en tu solicitud.'
      if (visualState === 'CONFIRMED') return 'Tu reserva está confirmada. Espera el inicio del servicio.'
      return 'Revisa el estado y continúa con el siguiente paso.'
    }

    if (visualState === 'PENDING') return 'Acción requerida: confirma o rechaza esta reserva.'
    if (visualState === 'CONFIRMED') return 'Acción requerida: inicia el servicio cuando llegues al sitio.'
    if (visualState === 'IN_PROGRESS') return 'Acción requerida: marca como completado al finalizar.'
    if (visualState === 'COMPLETED') return 'Siguiente paso: califica al cliente.'
    return 'Reserva cerrada.'
  }, [role, visualState])

  const runAction = async (action: Action) => {
    if (pendingAction || action.disabled) return
    setPendingAction(action.label)
    try {
      await action.onClick()
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <article className={`rounded-2xl border ${color?.cardBorder || 'border-gray-200'} bg-white shadow-sm`}>
      <div className="p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${color?.full || ''}`}>
              {getBookingVisualLabel(visualState)}
            </span>
            <span className="text-xs text-gray-500">{relativeTime}</span>
          </div>
          {priorityBadges.length > 0 && (
            <div className="flex gap-1">
              {priorityBadges.slice(0, 2).map((badge) => (
                <span key={badge} className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                  {badge}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mb-3 flex items-start gap-3">
          <div className="text-4xl leading-none">{serviceIcon}</div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold text-gray-900 md:text-lg">{serviceName}</h3>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-600 md:text-sm">
              <User className="h-3.5 w-3.5" />
              <span className="font-medium">{counterpartLabel}:</span>
              <span className="truncate">{counterpartName}</span>
            </p>
          </div>
          <p className="text-sm font-bold text-primary-700 md:text-base">{totalPrice}</p>
        </div>

        <div className="mb-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:hidden">
            {timeline.slice(0, compact ? 4 : timeline.length).map((step) => {
              const complete = isStepComplete(step.key, visualState)
              return (
                <div key={step.key} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <span className={`h-2 w-2 rounded-full ${complete ? 'bg-primary-600' : 'bg-gray-300'}`} />
                  <span className={`text-[10px] ${complete ? 'font-semibold text-gray-800' : 'text-gray-500'}`}>{step.label}</span>
                </div>
              )
            })}
          </div>
          <div className="hidden md:grid grid-cols-3 gap-2">
            {timeline.slice(0, compact ? 4 : timeline.length).map((step) => {
              const complete = isStepComplete(step.key, visualState)
              return (
                <div key={step.key} className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${complete ? 'bg-primary-600' : 'bg-gray-300'}`} />
                  <span className={`text-[11px] ${complete ? 'text-gray-800 font-semibold' : 'text-gray-500'}`}>{step.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
          {metadataInline ? (
            <p className="text-xs text-gray-700 md:text-sm">{metadataInline}</p>
          ) : (
            <div className="grid grid-cols-1 gap-1 text-xs text-gray-700 md:grid-cols-3 md:text-sm">
              <p className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{new Date(scheduledDate).toLocaleDateString('es-ES')}</p>
              <p className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{scheduledTime}</p>
              <p className="inline-flex items-center gap-1.5 truncate"><MapPin className="h-3.5 w-3.5" />{address}</p>
            </div>
          )}
        </div>

        {notes && (
          <details className="mb-3 rounded-xl border border-gray-200 bg-white px-3 py-2">
            <summary className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-gray-700">
              <ChevronDown className="h-3.5 w-3.5" />
              Ver notas
            </summary>
            <p className="mt-2 text-xs text-gray-700 md:text-sm">{notes}</p>
          </details>
        )}

        <p className="mb-2 text-xs font-medium text-gray-600">{stepMicrocopy}</p>

        {primaryAction && (
          <button
            type="button"
            onClick={() => runAction(primaryAction)}
            disabled={primaryAction.disabled || pendingAction !== null}
            className={`mb-2 w-full ${getActionClass(primaryAction.variant || 'primary')} flex items-center justify-center gap-2 rounded-xl disabled:opacity-50`}
          >
            {pendingAction === primaryAction.label ? <Loader2 className="h-4 w-4 animate-spin" /> : primaryAction.icon}
            <span>{primaryAction.label}</span>
          </button>
        )}

        {secondaryActions.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {secondaryActions.slice(0, 2).map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => runAction(action)}
                disabled={action.disabled || pendingAction !== null}
                className={`${getActionClass(action.variant || 'secondary')} relative flex items-center justify-center gap-2 rounded-xl disabled:opacity-50`}
              >
                {pendingAction === action.label ? <Loader2 className="h-4 w-4 animate-spin" /> : action.icon || <MessageCircle className="h-4 w-4" />}
                <span className="truncate">{action.label}</span>
                {action.badge && action.badge > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white">
                    {action.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {visualState === 'RATED' && (
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Servicio cerrado y calificado
            <Star className="h-3.5 w-3.5 fill-blue-700" />
          </div>
        )}
      </div>
    </article>
  )
}
