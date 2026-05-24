import type { BookingStatus } from '@prisma/client'

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = ['PENDING', 'CONFIRMED', 'IN_PROGRESS']

export function isChatActive(latestBookingStatus: BookingStatus | null): boolean {
  if (!latestBookingStatus) return true
  return ACTIVE_BOOKING_STATUSES.includes(latestBookingStatus)
}

export function chatStatusLabel(status: BookingStatus | null): string {
  switch (status) {
    case 'COMPLETED': return 'Servicio completado'
    case 'CANCELLED': return 'Reserva cancelada'
    case 'IN_PROGRESS': return 'En progreso'
    case 'CONFIRMED': return 'Confirmada'
    case 'PENDING': return 'Pendiente'
    default: return 'Activa'
  }
}
