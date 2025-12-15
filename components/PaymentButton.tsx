'use client'

import { useState } from 'react'
import { CreditCard, DollarSign, AlertCircle, CheckCircle } from 'lucide-react'

interface PaymentButtonProps {
  bookingId: string
  amount: number
  serviceName: string
  onSuccess?: () => void
}

export default function PaymentButton({
  bookingId,
  amount,
  serviceName,
  onSuccess,
}: PaymentButtonProps) {
  const [loading, setLoading] = useState(false)
  const [breakdown, setBreakdown] = useState<any>(null)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePayment = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookingId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error al crear el pago')
      }

      const data = await response.json()
      setBreakdown(data.breakdown)

      if (data.initPoint) {
        window.location.href = data.initPoint
      } else if (data.sandboxInitPoint) {
        window.location.href = data.sandboxInitPoint
      }
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const fetchBreakdown = async () => {
    try {
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookingId }),
      })

      if (response.ok) {
        const data = await response.json()
        setBreakdown(data.breakdown)
        setShowBreakdown(true)
      }
    } catch (err) {
      console.error('Error al obtener desglose:', err)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}

      {!showBreakdown ? (
        <div className="flex gap-3">
          <button
            onClick={fetchBreakdown}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <DollarSign className="w-5 h-5" />
            Ver Desglose
          </button>
          <button
            onClick={handlePayment}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <CreditCard className="w-5 h-5" />
            {loading ? 'Procesando...' : 'Pagar Ahora'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary-600" />
              Desglose del Pago
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                <span className="text-gray-600">Servicio: {serviceName}</span>
                <span className="font-medium text-gray-900">
                  ${breakdown?.serviceAmount?.toLocaleString('es-CO')} COP
                </span>
              </div>

              <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                <span className="text-gray-600">
                  Tarifa de servicio ({breakdown?.clientCommissionRate}%)
                </span>
                <span className="font-medium text-gray-600">
                  +${breakdown?.clientCommission?.toLocaleString('es-CO')} COP
                </span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <span className="text-lg font-bold text-gray-900">Total a Pagar</span>
                <span className="text-2xl font-bold text-primary-600">
                  ${breakdown?.totalAmount?.toLocaleString('es-CO')} COP
                </span>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  Serás redirigido a MercadoPago para completar el pago de forma segura.
                </span>
              </p>
            </div>
          </div>

          <button
            onClick={handlePayment}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg font-semibold"
          >
            <CreditCard className="w-6 h-6" />
            {loading ? 'Redirigiendo a MercadoPago...' : 'Continuar al Pago'}
          </button>

          <button
            onClick={() => setShowBreakdown(false)}
            className="w-full px-6 py-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  )
}
