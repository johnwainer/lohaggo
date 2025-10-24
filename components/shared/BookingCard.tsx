import { Calendar, MapPin, Clock, User } from 'lucide-react'
import { DESIGN_SYSTEM, getStatusClasses, getStatusLabel } from '@/lib/design-system'

interface BookingCardProps {
  booking: {
    id: string
    service: {
      name: string
      category: string
    }
    scheduledDate: string
    scheduledTime: string
    location: string
    status: string
    client?: {
      name: string
    }
    partner?: {
      name: string
    }
  }
  userRole: 'CLIENT' | 'PARTNER'
  onViewDetails: (bookingId: string) => void
}

export default function BookingCard({ booking, userRole, onViewDetails }: BookingCardProps) {
  const otherUser = userRole === 'CLIENT' ? booking.partner : booking.client

  return (
    <div
      className={`${DESIGN_SYSTEM.components.card.base} ${DESIGN_SYSTEM.components.card.interactive} ${DESIGN_SYSTEM.spacing.card}`}
      onClick={() => onViewDetails(booking.id)}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className={`${DESIGN_SYSTEM.typography.h4} mb-1 truncate`}>
            {booking.service.name}
          </h3>
          <p className={`${DESIGN_SYSTEM.typography.bodySmall} truncate`}>
            {booking.service.category}
          </p>
        </div>
        <span className={`${getStatusClasses(booking.status)} px-3 py-1 rounded-full text-xs font-medium border self-start sm:self-center`}>
          {getStatusLabel(booking.status)}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-gray-600">
          <Calendar size={16} className="flex-shrink-0" />
          <span className={DESIGN_SYSTEM.typography.bodySmall}>
            {new Date(booking.scheduledDate).toLocaleDateString('es-ES', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </div>

        <div className="flex items-center gap-2 text-gray-600">
          <Clock size={16} className="flex-shrink-0" />
          <span className={DESIGN_SYSTEM.typography.bodySmall}>{booking.scheduledTime}</span>
        </div>

        <div className="flex items-center gap-2 text-gray-600">
          <MapPin size={16} className="flex-shrink-0" />
          <span className={`${DESIGN_SYSTEM.typography.bodySmall} truncate`}>
            {booking.location}
          </span>
        </div>

        {otherUser && (
          <div className="flex items-center gap-2 text-gray-600">
            <User size={16} className="flex-shrink-0" />
            <span className={DESIGN_SYSTEM.typography.bodySmall}>
              {userRole === 'CLIENT' ? 'Socio' : 'Cliente'}: {otherUser.name}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
