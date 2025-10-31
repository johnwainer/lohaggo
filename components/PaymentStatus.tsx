'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react'

interface PaymentStatusProps {
  bookingId: string
}

export default function PaymentStatus({ bookingId }: PaymentStatusProps) {
  const [payment, setPayment] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPaymentStatus()
  }, [bookingId])

  const fetchPaymentStatus = async () => {
    try {
      const response = await fetch(`/api/payments/status?bookingId=${bookingId}`)
      if (response.ok) {
        const data = await response.json()
        setPayment(data)
      }
    } catch (error) {
      console.error('Error al obtener estado del pago:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF2D55]"></div>
      </div>
    )
  }

  if (!payment) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-yellow-600" />
          <div>
            <p className="font-medium text-yellow-900">Pago Pendiente</p>
            <p className="text-sm text-yellow-700">Este servicio aún no ha sido pagado</p>
          </div>
        </div>
      </div>
    )
  }

  const getStatusDisplay = () => {
    switch (payment.status) {
      case 'APPROVED':
        return {
          icon: <CheckCircle className="w-6 h-6 text-green-600" />,
          bg: 'bg-green-50',
          border: 'border-green-200',
          title: 'Pago Aprobado',
          titleColor: 'text-green-900',
          description: 'El pago ha sido procesado exitosamente',
          descColor: 'text-green-700',
        }
      case 'PENDING':
      case 'IN_PROCESS':
        return {
          icon: <Clock className="w-6 h-6 text-yellow-600" />,
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          title: 'Pago en Proceso',
          titleColor: 'text-yellow-900',
          description: 'Tu pago está siendo procesado',
          descColor: 'text-yellow-700',
        }
      case 'REJECTED':
      case 'CANCELLED':
        return {
          icon: <XCircle className="w-6 h-6 text-red-600" />,
          bg: 'bg-red-50',
          border: 'border-red-200',
          title: 'Pago Rechazado',
          titleColor: 'text-red-900',
          description: 'El pago no pudo ser procesado',
          descColor: 'text-red-700',
        }
      default:
        return {
          icon: <AlertCircle className="w-6 h-6 text-gray-600" />,
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          title: 'Estado Desconocido',
          titleColor: 'text-gray-900',
          description: 'Contacta con soporte',
          descColor: 'text-gray-700',
        }
    }
  }

  const statusDisplay = getStatusDisplay()

  return (
    <div className={`${statusDisplay.bg} border ${statusDisplay.border} rounded-lg p-6`}>
      <div className="flex items-start gap-4">
        {statusDisplay.icon}
        <div className="flex-1">
          <h3 className={`font-semibold ${statusDisplay.titleColor} mb-1`}>
            {statusDisplay.title}
          </h3>
          <p className={`text-sm ${statusDisplay.descColor} mb-4`}>{statusDisplay.description}</p>

          {payment.status === 'APPROVED' && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Monto del servicio:</span>
                <span className="font-medium text-gray-900">
                  ${payment.serviceAmount?.toLocaleString('es-CO')} COP
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Comisión de plataforma:</span>
                <span className="font-medium text-gray-900">
                  ${payment.clientCommission?.toLocaleString('es-CO')} COP
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-green-200">
                <span className="font-semibold text-gray-900">Total pagado:</span>
                <span className="font-bold text-green-600">
                  ${payment.totalAmount?.toLocaleString('es-CO')} COP
                </span>
              </div>
              {payment.paidAt && (
                <div className="flex justify-between text-xs text-gray-600 pt-2">
                  <span>Fecha de pago:</span>
                  <span>{new Date(payment.paidAt).toLocaleString('es-CO')}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
