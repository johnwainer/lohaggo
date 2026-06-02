import type { BookingStatus, ProposalStatus, ServiceRequestStatus } from '@prisma/client'

export type ChatStateInput = {
  serviceRequestStatus: ServiceRequestStatus | null
  proposalStatus: ProposalStatus | null
  bookingStatus: BookingStatus | null
}

export type ChatState = {
  isActive: boolean
  statusLabel: string
}

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = ['PENDING', 'CONFIRMED', 'IN_PROGRESS']

function bookingActiveLabel(status: BookingStatus): string {
  switch (status) {
    case 'IN_PROGRESS': return 'En progreso'
    case 'CONFIRMED': return 'Confirmada'
    case 'PENDING': return 'Pendiente'
    default: return 'Activa'
  }
}

export function computeChatState({
  serviceRequestStatus,
  proposalStatus,
  bookingStatus,
}: ChatStateInput): ChatState {
  if (serviceRequestStatus === 'CANCELLED') {
    return { isActive: false, statusLabel: 'Solicitud cancelada' }
  }
  if (serviceRequestStatus === 'EXPIRED') {
    return { isActive: false, statusLabel: 'Solicitud expirada' }
  }
  if (proposalStatus === 'REJECTED') {
    return { isActive: false, statusLabel: 'Propuesta rechazada' }
  }
  if (bookingStatus) {
    if (bookingStatus === 'COMPLETED') return { isActive: false, statusLabel: 'Servicio completado' }
    if (bookingStatus === 'CANCELLED') return { isActive: false, statusLabel: 'Reserva cancelada' }
    if (ACTIVE_BOOKING_STATUSES.includes(bookingStatus)) {
      return { isActive: true, statusLabel: bookingActiveLabel(bookingStatus) }
    }
  }
  return { isActive: true, statusLabel: 'Activa' }
}
