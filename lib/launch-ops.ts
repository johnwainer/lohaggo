import type { AdminSeverity, BookingStatus, PaymentIncidentType, SupportQueue } from '@prisma/client'

const severityHours: Record<AdminSeverity, number> = {
  LOW: 72,
  MEDIUM: 24,
  HIGH: 8,
  CRITICAL: 2,
}

export function calculateSlaDueAt(severity: AdminSeverity, baseDate = new Date()): Date {
  const hours = severityHours[severity] ?? 24
  return new Date(baseDate.getTime() + hours * 60 * 60 * 1000)
}

export function supportQueueForIncident(type: PaymentIncidentType): SupportQueue {
  if (type === 'CHARGEBACK') return 'RISK'
  if (type === 'REFUND_DISPUTE') return 'REFUNDS'
  return 'PAYMENTS'
}

export function severityForIncident(type: PaymentIncidentType): AdminSeverity {
  if (type === 'CHARGEBACK') return 'CRITICAL'
  if (type === 'PAYOUT_FAILURE') return 'HIGH'
  return 'MEDIUM'
}

export function computeRefundPolicy(params: {
  bookingStatus: BookingStatus
  totalAmount: number
  scheduledDate: Date
  now?: Date
}) {
  const now = params.now ?? new Date()
  const timeToServiceMs = params.scheduledDate.getTime() - now.getTime()
  const hoursToService = timeToServiceMs / (1000 * 60 * 60)

  if (params.bookingStatus === 'COMPLETED') {
    return {
      policyCode: 'NO_REFUND_COMPLETED',
      refundableAmount: 0,
      requiresManualReview: true,
      reason: 'Servicio completado',
    }
  }

  if (params.bookingStatus === 'IN_PROGRESS') {
    return {
      policyCode: 'MANUAL_IN_PROGRESS',
      refundableAmount: 0,
      requiresManualReview: true,
      reason: 'Servicio en progreso, requiere revisión manual',
    }
  }

  if (hoursToService >= 24) {
    return {
      policyCode: 'FLEX_24H',
      refundableAmount: params.totalAmount,
      requiresManualReview: false,
      reason: 'Cancelación con más de 24 horas',
    }
  }

  if (hoursToService >= 2) {
    return {
      policyCode: 'PARTIAL_2H_24H',
      refundableAmount: Number((params.totalAmount * 0.5).toFixed(2)),
      requiresManualReview: true,
      reason: 'Cancelación entre 2 y 24 horas',
    }
  }

  return {
    policyCode: 'NO_REFUND_LATE_CANCEL',
    refundableAmount: 0,
    requiresManualReview: true,
    reason: 'Cancelación tardía (menos de 2 horas)',
  }
}
