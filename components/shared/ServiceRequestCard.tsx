import { Calendar, MapPin, DollarSign, User, MessageSquare } from 'lucide-react'
import { DESIGN_SYSTEM, getStatusClasses, getStatusLabel } from '@/lib/design-system'

interface ServiceRequestCardProps {
  request: {
    id: string
    serviceType: string
    description: string
    preferredDate: string
    location: string
    budget?: number
    status: string
    client?: {
      name: string
    }
    _count?: {
      offers: number
    }
  }
  userRole: 'CLIENT' | 'PARTNER'
  onViewDetails: (requestId: string) => void
  formatCurrency?: (amount: number) => string
}

export default function ServiceRequestCard({
  request,
  userRole,
  onViewDetails,
  formatCurrency = (amount) => `$${amount.toLocaleString()}`,
}: ServiceRequestCardProps) {
  return (
    <div
      className={`${DESIGN_SYSTEM.components.card.base} ${DESIGN_SYSTEM.components.card.interactive} ${DESIGN_SYSTEM.spacing.card}`}
      onClick={() => onViewDetails(request.id)}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className={`${DESIGN_SYSTEM.typography.h4} mb-1 truncate`}>
            {request.serviceType}
          </h3>
          <p className={`${DESIGN_SYSTEM.typography.bodySmall} line-clamp-2`}>
            {request.description}
          </p>
        </div>
        <span className={`${getStatusClasses(request.status)} px-3 py-1 rounded-full text-xs font-medium border self-start sm:self-center`}>
          {getStatusLabel(request.status)}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-gray-600">
          <Calendar size={16} className="flex-shrink-0" />
          <span className={DESIGN_SYSTEM.typography.bodySmall}>
            {new Date(request.preferredDate).toLocaleDateString('es-ES', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
        </div>

        <div className="flex items-center gap-2 text-gray-600">
          <MapPin size={16} className="flex-shrink-0" />
          <span className={`${DESIGN_SYSTEM.typography.bodySmall} truncate`}>
            {request.location}
          </span>
        </div>

        {request.budget && (
          <div className="flex items-center gap-2 text-gray-600">
            <DollarSign size={16} className="flex-shrink-0" />
            <span className={DESIGN_SYSTEM.typography.bodySmall}>
              Presupuesto: {formatCurrency(request.budget)}
            </span>
          </div>
        )}

        {request.client && userRole === 'PARTNER' && (
          <div className="flex items-center gap-2 text-gray-600">
            <User size={16} className="flex-shrink-0" />
            <span className={DESIGN_SYSTEM.typography.bodySmall}>
              Cliente: {request.client.name}
            </span>
          </div>
        )}

        {request._count && request._count.offers > 0 && (
          <div className="flex items-center gap-2 text-primary-600">
            <MessageSquare size={16} className="flex-shrink-0" />
            <span className={`${DESIGN_SYSTEM.typography.bodySmall} font-medium`}>
              {request._count.offers} {request._count.offers === 1 ? 'oferta' : 'ofertas'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
