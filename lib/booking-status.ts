import { DESIGN_SYSTEM } from '@/lib/design-system'

export type BookingVisualState =
  | 'PENDING'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'PAID'
  | 'RATED'

type BookingLike = {
  status: string
  payment?: { status?: string } | null
  review?: {
    clientToPartnerRating?: number | null
    partnerToClientRating?: number | null
  } | null
}

export function getBookingVisualState(role: 'CLIENT' | 'PARTNER', booking: BookingLike): BookingVisualState {
  if (booking.status === 'CANCELLED') return 'CANCELLED'

  if (booking.status === 'COMPLETED') {
    if (role === 'CLIENT') {
      const isPaid = booking.payment?.status === 'APPROVED'
      const isRated = !!booking.review?.clientToPartnerRating
      if (isPaid && isRated) return 'RATED'
      if (isPaid) return 'PAID'
      return 'COMPLETED'
    }

    const partnerRatedClient = !!booking.review?.partnerToClientRating
    return partnerRatedClient ? 'RATED' : 'COMPLETED'
  }

  if (booking.status === 'IN_PROGRESS') return 'IN_PROGRESS'
  if (booking.status === 'CONFIRMED') return 'CONFIRMED'
  return 'PENDING'
}

export function getBookingVisualLabel(state: BookingVisualState): string {
  return DESIGN_SYSTEM.statusLabels[state] || state
}

export function getBookingTimeline(role: 'CLIENT' | 'PARTNER') {
  if (role === 'CLIENT') {
    return [
      { key: 'PENDING', label: 'Solicitud' },
      { key: 'CONFIRMED', label: 'Confirmada' },
      { key: 'IN_PROGRESS', label: 'En curso' },
      { key: 'COMPLETED', label: 'Completada' },
      { key: 'PAID', label: 'Pagada' },
      { key: 'RATED', label: 'Calificada' },
    ]
  }

  return [
    { key: 'PENDING', label: 'Solicitud' },
    { key: 'CONFIRMED', label: 'Confirmada' },
    { key: 'IN_PROGRESS', label: 'En curso' },
    { key: 'COMPLETED', label: 'Completada' },
    { key: 'RATED', label: 'Calificada' },
  ]
}

export function isStepComplete(stepKey: string, visualState: BookingVisualState): boolean {
  const rank: Record<BookingVisualState, number> = {
    PENDING: 1,
    CONFIRMED: 2,
    IN_PROGRESS: 3,
    COMPLETED: 4,
    PAID: 5,
    RATED: 6,
    CANCELLED: 0,
  }
  if (visualState === 'CANCELLED') return stepKey === 'PENDING'
  return (rank[stepKey as BookingVisualState] || 0) <= rank[visualState]
}
