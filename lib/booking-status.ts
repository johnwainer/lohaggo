/**
 * One place that says what a booking looks like to each side: its state chip (label and color),
 * the timeline, and the next step with who has to act. Both panels and the shared card read it,
 * so «Pendiente», «Por pagar» or «Pago reportado» look and read the same everywhere.
 */
export type BookingVisualState =
  | 'PENDING'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'PAYMENT_REPORTED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PAID'
  | 'RATED'

export type BookingRole = 'CLIENT' | 'PARTNER'

type BookingLike = {
  status: string
  payment?: { status?: string | null; confirmationStatus?: string | null } | null
  review?: {
    clientToPartnerRating?: number | null
    partnerToClientRating?: number | null
  } | null
}

/** The payment is settled: approved online or confirmed by both sides offline. */
export function isPaymentSettled(payment: BookingLike['payment']): boolean {
  if (!payment) return false
  return payment.status === 'APPROVED' || payment.confirmationStatus === 'CONFIRMED'
}

export function getBookingVisualState(role: BookingRole, booking: BookingLike): BookingVisualState {
  if (booking.status === 'CANCELLED') return 'CANCELLED'

  if (booking.status === 'COMPLETED') {
    if (booking.payment?.status === 'REFUNDED') return 'REFUNDED'
    const paid = isPaymentSettled(booking.payment)
    const rated = role === 'CLIENT' ? !!booking.review?.clientToPartnerRating : !!booking.review?.partnerToClientRating
    if (paid && rated) return 'RATED'
    if (paid) return 'PAID'
    if (booking.payment?.confirmationStatus === 'CLIENT_REPORTED') return 'PAYMENT_REPORTED'
    return 'COMPLETED'
  }

  if (booking.status === 'IN_PROGRESS') return 'IN_PROGRESS'
  if (booking.status === 'CONFIRMED') return 'CONFIRMED'
  return 'PENDING'
}

const LABELS: Record<BookingVisualState, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completada',
  PAYMENT_REPORTED: 'Pago reportado',
  CANCELLED: 'Cancelada',
  REFUNDED: 'Reembolsada',
  PAID: 'Pagada',
  RATED: 'Calificada',
}

/** The chip's words. «Completada» becomes what is still missing: the client pays, the partner collects. */
export function getBookingVisualLabel(state: BookingVisualState, role?: BookingRole): string {
  if (state === 'COMPLETED' && role === 'CLIENT') return 'Por pagar'
  if (state === 'COMPLETED' && role === 'PARTNER') return 'Por cobrar'
  if (state === 'PAID' && role === 'PARTNER') return 'Pago recibido'
  return LABELS[state] || state
}

export type StatusColor = { full: string; cardBorder: string; dot: string }

/** Chip colors per state, the same in the card, the filters and the overview lists. */
export const BOOKING_STATUS_COLORS: Record<BookingVisualState, StatusColor> = {
  PENDING: { full: 'bg-amber-100 text-amber-900 border-amber-200', cardBorder: 'border-amber-400', dot: 'bg-amber-500' },
  CONFIRMED: { full: 'bg-primary-100 text-primary-800 border-primary-200', cardBorder: 'border-primary-500', dot: 'bg-primary-600' },
  IN_PROGRESS: { full: 'bg-sky-100 text-sky-900 border-sky-200', cardBorder: 'border-sky-500', dot: 'bg-sky-600' },
  COMPLETED: { full: 'bg-secondary-100 text-secondary-900 border-secondary-200', cardBorder: 'border-secondary-500', dot: 'bg-secondary-600' },
  PAYMENT_REPORTED: { full: 'bg-teal-100 text-teal-900 border-teal-200', cardBorder: 'border-teal-500', dot: 'bg-teal-600' },
  CANCELLED: { full: 'bg-gray-100 text-gray-700 border-gray-200', cardBorder: 'border-gray-300', dot: 'bg-gray-400' },
  REFUNDED: { full: 'bg-gray-100 text-gray-700 border-gray-200', cardBorder: 'border-gray-300', dot: 'bg-gray-400' },
  PAID: { full: 'bg-emerald-100 text-emerald-900 border-emerald-200', cardBorder: 'border-emerald-500', dot: 'bg-emerald-600' },
  RATED: { full: 'bg-blue-100 text-blue-900 border-blue-200', cardBorder: 'border-blue-500', dot: 'bg-blue-600' },
}

/** Colors for a raw Booking.status (overview lists that have no payment data). */
export function bookingStatusColor(status: string): StatusColor {
  return BOOKING_STATUS_COLORS[(status in BOOKING_STATUS_COLORS ? status : 'CANCELLED') as BookingVisualState]
}

/** Filter chips in the order a person follows the booking. */
export const BOOKING_FILTER_ORDER: BookingVisualState[] = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'PAYMENT_REPORTED', 'PAID', 'RATED', 'CANCELLED']

export function getBookingTimeline(role: BookingRole) {
  if (role === 'CLIENT') {
    return [
      { key: 'PENDING', label: 'Solicitud' },
      { key: 'CONFIRMED', label: 'Confirmada' },
      { key: 'IN_PROGRESS', label: 'En progreso' },
      { key: 'COMPLETED', label: 'Completada' },
      { key: 'PAID', label: 'Pagada' },
      { key: 'RATED', label: 'Calificada' },
    ]
  }

  return [
    { key: 'PENDING', label: 'Solicitud' },
    { key: 'CONFIRMED', label: 'Confirmada' },
    { key: 'IN_PROGRESS', label: 'En progreso' },
    { key: 'COMPLETED', label: 'Completada' },
    { key: 'PAID', label: 'Pago recibido' },
    { key: 'RATED', label: 'Calificada' },
  ]
}

export function isStepComplete(stepKey: string, visualState: BookingVisualState): boolean {
  const rank: Record<BookingVisualState, number> = {
    PENDING: 1,
    CONFIRMED: 2,
    IN_PROGRESS: 3,
    COMPLETED: 4,
    PAYMENT_REPORTED: 4,
    REFUNDED: 4,
    PAID: 5,
    RATED: 6,
    CANCELLED: 0,
  }
  if (visualState === 'CANCELLED') return stepKey === 'PENDING'
  return (rank[stepKey as BookingVisualState] || 0) <= rank[visualState]
}

export type NextStep = { text: string; actor: 'you' | 'them' | 'none' }

/**
 * What happens next and who has to do it, in a person's words. `payment.confirmationStatus` matters:
 * after the client reports a cash payment it is the partner's turn, not the client's.
 */
export function getNextStep(role: BookingRole, booking: BookingLike & { payment?: { status?: string | null; confirmationStatus?: string | null } | null }): NextStep {
  const state = getBookingVisualState(role, booking)
  const conf = booking.payment?.confirmationStatus || 'NONE'
  if (role === 'CLIENT') {
    switch (state) {
      case 'PENDING': return { text: 'Esperando que el socio confirme la reserva.', actor: 'them' }
      case 'CONFIRMED': return { text: 'Reserva confirmada. El socio llegará en la fecha acordada.', actor: 'them' }
      case 'IN_PROGRESS': return { text: 'El socio está trabajando en tu servicio.', actor: 'them' }
      case 'COMPLETED':
        if (conf === 'PARTNER_REPORTED') return { text: 'El socio dice que ya le pagaste: confírmalo abajo.', actor: 'you' }
        if (conf === 'REJECTED_BY_PARTNER') return { text: 'El socio no reconoce tu pago: revísalo y repórtalo de nuevo.', actor: 'you' }
        if (conf === 'DISPUTED') return { text: 'Hay una diferencia con el pago: soporte te ayudará a resolverla.', actor: 'none' }
        return { text: 'Servicio terminado: paga al socio y repórtalo aquí.', actor: 'you' }
      case 'PAYMENT_REPORTED': return { text: 'Reportaste el pago. El socio debe confirmar que lo recibió.', actor: 'them' }
      case 'PAID': return { text: 'Pago listo. Califica el servicio para cerrarlo.', actor: 'you' }
      case 'RATED': return { text: 'Servicio cerrado y calificado.', actor: 'none' }
      case 'REFUNDED': return { text: 'El pago fue reembolsado.', actor: 'none' }
      default: return { text: 'Reserva cancelada.', actor: 'none' }
    }
  }
  switch (state) {
    case 'PENDING': return { text: 'Confirma o rechaza esta reserva.', actor: 'you' }
    case 'CONFIRMED': return { text: 'Inicia el servicio cuando llegues al sitio.', actor: 'you' }
    case 'IN_PROGRESS': return { text: 'Marca el servicio como completado al terminar.', actor: 'you' }
    case 'COMPLETED':
      if (conf === 'PARTNER_REPORTED') return { text: 'Marcaste el pago como recibido. Falta que el cliente lo confirme.', actor: 'them' }
      if (conf === 'DISPUTED') return { text: 'Hay una diferencia con el pago: soporte te ayudará a resolverla.', actor: 'none' }
      return { text: 'Cobra al cliente. Cuando te pague, confírmalo aquí.', actor: 'them' }
    case 'PAYMENT_REPORTED': return { text: 'El cliente reportó el pago: confirma que lo recibiste.', actor: 'you' }
    case 'PAID': return { text: 'Pago recibido. Califica al cliente para cerrar.', actor: 'you' }
    case 'RATED': return { text: 'Servicio cerrado y calificado.', actor: 'none' }
    case 'REFUNDED': return { text: 'El pago fue reembolsado al cliente.', actor: 'none' }
    default: return { text: 'Reserva cancelada.', actor: 'none' }
  }
}
