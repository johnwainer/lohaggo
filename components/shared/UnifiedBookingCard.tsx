'use client'

import { CountBadge } from '@/components/ui/count-badge'
import { Calendar, CheckCircle2, ChevronDown, Clock, Loader2, MapPin, MessageCircle, Star, User } from 'lucide-react'
import ServiceIcon from '@/components/ServiceIcon'
import OriginBadge from '@/components/shared/OriginBadge'
import { useMemo, useState, type ReactNode } from 'react'
import { DESIGN_SYSTEM } from '@/lib/design-system'
import { formatBookingWhen, formatCalendarDay } from '@/lib/bookings/when'
import { BOOKING_STATUS_COLORS, BookingVisualState, getBookingTimeline, getBookingVisualLabel, getNextStep, isStepComplete, type NextStep } from '@/lib/booking-status'

type Action = {
  label: string
  onClick: () => void | Promise<void>
  icon?: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
  disabled?: boolean
  badge?: number
  /** What the badge counts, for screen readers («mensajes sin leer» by default) */
  badgeLabel?: string
}

interface UnifiedBookingCardProps {
  role: 'CLIENT' | 'PARTNER'
  serviceName: string
  serviceIcon: string
  serviceSlug?: string
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
  /** Booking.origin: 'chat' shows a discreet «Creada por chat» note */
  origin?: string | null
  originChannel?: string | null
  /** What happens next and who acts; computed from the booking with getNextStep. Falls back to the state alone. */
  nextStep?: NextStep
  /** Words over the price: «Total a pagar» for the client, «Valor del servicio» for the partner */
  priceLabel?: string
  /** A line under the price, e.g. «Recibes $90.000 · comisión 10 %» */
  priceDetail?: string
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
  serviceSlug,
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
  origin,
  originChannel,
  nextStep,
  priceLabel,
  priceDetail,
}: UnifiedBookingCardProps) {
  const color = BOOKING_STATUS_COLORS[visualState]
  const timeline = getBookingTimeline(role)
  const when = formatBookingWhen({ scheduledDate: new Date(scheduledDate), scheduledTime })
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const step = useMemo(() => nextStep || getNextStep(role, syntheticBooking(visualState)), [nextStep, role, visualState])
  const counterpartWord = role === 'CLIENT' ? 'el socio' : 'el cliente'

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
              {getBookingVisualLabel(visualState, role)}
            </span>
          </div>
          {priorityBadges.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1">
              {priorityBadges.slice(0, 2).map((badge) => (
                <span key={badge} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                  {badge}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="mb-3 flex items-start gap-3">
          {serviceSlug
            ? <ServiceIcon slug={serviceSlug} emoji={serviceIcon} size="lg" />
            : <div className="text-4xl leading-none">{serviceIcon}</div>
          }
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold text-gray-900 md:text-lg">{serviceName}</h3>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-600 md:text-sm">
              <User className="h-3.5 w-3.5" />
              <span className="font-medium">{counterpartLabel}:</span>
              <span className="truncate">{counterpartName}</span>
            </p>
            <OriginBadge variant="user" origin={origin} originChannel={originChannel} className="mt-0.5" />
          </div>
          <div className="shrink-0 text-right">
            {priceLabel && <p className="text-[11px] font-medium text-gray-600">{priceLabel}</p>}
            <p className="text-sm font-bold text-primary-700 md:text-base">{totalPrice}</p>
            {priceDetail && <p className="text-[11px] text-gray-600">{priceDetail}</p>}
          </div>
        </div>

        <div className="mb-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:hidden">
            {timeline.slice(0, compact ? 4 : timeline.length).map((step) => {
              const complete = isStepComplete(step.key, visualState)
              return (
                <div key={step.key} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <span aria-hidden="true" className={`h-2 w-2 rounded-full ${complete ? 'bg-primary-600' : 'bg-gray-300'}`} />
                  <span className={`text-[11px] ${complete ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{step.label}<span className="sr-only">{complete ? ' (hecho)' : ' (pendiente)'}</span></span>
                </div>
              )
            })}
          </div>
          <div className="hidden md:grid grid-cols-3 gap-2">
            {timeline.slice(0, compact ? 4 : timeline.length).map((step) => {
              const complete = isStepComplete(step.key, visualState)
              return (
                <div key={step.key} className="flex items-center gap-1.5">
                  <span aria-hidden="true" className={`h-2 w-2 rounded-full ${complete ? 'bg-primary-600' : 'bg-gray-300'}`} />
                  <span className={`text-xs ${complete ? 'text-gray-800 font-semibold' : 'text-gray-600'}`}>{step.label}<span className="sr-only">{complete ? ' (hecho)' : ' (pendiente)'}</span></span>
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
              <p className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" aria-hidden="true" />{formatCalendarDay(scheduledDate)}</p>
              <p className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{scheduledTime}</p>
              <p className="flex min-w-0 items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="truncate" title={address}>{address}</span></p>
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

        <div className={`mb-2 rounded-xl px-3 py-2 text-xs ${step.actor === 'you' ? 'bg-amber-50 text-amber-900' : 'bg-gray-50 text-gray-700'}`}>
          {step.actor !== 'none' && (
            <span className="mr-1 font-bold">{step.actor === 'you' ? 'Te toca a ti:' : `Esperando a ${counterpartWord}:`}</span>
          )}
          <span>{step.text}</span>
          <span className="sr-only"> Fecha del servicio: {when}.</span>
        </div>

        {primaryAction && (
          <button
            type="button"
            onClick={() => runAction(primaryAction)}
            disabled={primaryAction.disabled || pendingAction !== null}
            className={`mb-2 w-full ${getActionClass(primaryAction.variant || 'primary')} flex items-center justify-center gap-2 disabled:opacity-50`}
          >
            {pendingAction === primaryAction.label ? <Loader2 className="h-4 w-4 animate-spin" /> : primaryAction.icon}
            <span>{primaryAction.label}</span>
          </button>
        )}

        {secondaryActions.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {secondaryActions.map((action, i) => (
              <button
                key={action.label}
                type="button"
                onClick={() => runAction(action)}
                disabled={action.disabled || pendingAction !== null}
                className={`${getActionClass(action.variant || 'secondary')} relative flex items-center justify-center gap-2 disabled:opacity-50 ${secondaryActions.length % 2 === 1 && i === secondaryActions.length - 1 ? 'col-span-2' : ''}`}
              >
                {pendingAction === action.label ? <Loader2 className="h-4 w-4 animate-spin" /> : action.icon || <MessageCircle className="h-4 w-4" />}
                <span className="truncate">{action.label}</span>
                <CountBadge count={action.badge ?? 0} label={action.badgeLabel || 'mensajes sin leer'} className="absolute -right-1 -top-1 ring-2 ring-white" />
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

/** A booking shaped like the state, for cards whose caller did not pass the next step */
function syntheticBooking(state: BookingVisualState) {
  switch (state) {
    case 'PAYMENT_REPORTED': return { status: 'COMPLETED', payment: { confirmationStatus: 'CLIENT_REPORTED' } }
    case 'PAID': return { status: 'COMPLETED', payment: { status: 'APPROVED' } }
    case 'RATED': return { status: 'COMPLETED', payment: { status: 'APPROVED' }, review: { clientToPartnerRating: 5, partnerToClientRating: 5 } }
    case 'REFUNDED': return { status: 'COMPLETED', payment: { status: 'REFUNDED' } }
    default: return { status: state }
  }
}
