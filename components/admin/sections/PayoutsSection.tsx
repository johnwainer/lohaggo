'use client'

import { useEffect, useState } from 'react'
import { DollarSign, CheckCircle, Clock, XCircle, Search, Filter } from 'lucide-react'

interface Payout {
  id: string
  amount: number
  partnerCommission: number
  partnerCommissionRate: number
  netAmount: number
  status: string
  createdAt: string
  processedAt: string | null
  partner: {
    user: {
      name: string
      email: string
    }
  }
  payment: {
    booking: {
      service: {
        name: string
      }
    }
  }
}

export default function PayoutsSection() {
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('PENDING')
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => {
    fetchPayouts()
  }, [filter])

  const fetchPayouts = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/payouts/list?status=${filter}`)
      if (response.ok) {
        const data = await response.json()
        setPayouts(data)
      }
    } catch (error) {
      console.error('Error al cargar pagos:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleProcessPayout = async (payoutId: string) => {
    if (!confirm('¿Estás seguro de procesar este pago?')) return

    setProcessing(payoutId)
    try {
      const response = await fetch('/api/payouts/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ payoutId }),
      })

      if (response.ok) {
        alert('Pago procesado exitosamente')
        fetchPayouts()
      } else {
        const error = await response.json()
        alert(error.error || 'Error al procesar pago')
      }
    } catch (error) {
      alert('Error al procesar pago')
    } finally {
      setProcessing(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      PROCESSING: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      FAILED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
    }
    return styles[status as keyof typeof styles] || styles.PENDING
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4" />
      case 'PENDING':
        return <Clock className="w-4 h-4" />
      case 'FAILED':
      case 'CANCELLED':
        return <XCircle className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  const totalPending = payouts
    .filter((p) => p.status === 'PENDING')
    .reduce((sum, p) => sum + p.netAmount, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pagos a Socios</h2>
          <p className="text-gray-600 mt-1">Gestiona los pagos pendientes a los socios</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pagos Pendientes</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">
                {payouts.filter((p) => p.status === 'PENDING').length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Pendiente</p>
              <p className="text-2xl font-bold text-[#FF2D55] mt-1">
                ${totalPending.toLocaleString('es-CO')}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-[#FF2D55]" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pagos Completados</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {payouts.filter((p) => p.status === 'COMPLETED').length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-6">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF2D55] focus:border-transparent"
          >
            <option value="">Todos</option>
            <option value="PENDING">Pendientes</option>
            <option value="PROCESSING">En Proceso</option>
            <option value="COMPLETED">Completados</option>
            <option value="FAILED">Fallidos</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF2D55]"></div>
          </div>
        ) : payouts.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No hay pagos para mostrar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Socio</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                    Servicio
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                    Monto Servicio
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                    Comisión
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                    Pago Neto
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                    Estado
                  </th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-700">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr key={payout.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{payout.partner.user.name}</p>
                        <p className="text-sm text-gray-600">{payout.partner.user.email}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {payout.payment.booking.service.name}
                        </p>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <p className="font-medium text-gray-900">
                        ${payout.amount.toLocaleString('es-CO')}
                      </p>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <p className="text-red-600">
                        -${payout.partnerCommission.toLocaleString('es-CO')}
                      </p>
                      <p className="text-xs text-gray-500">({payout.partnerCommissionRate}%)</p>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <p className="font-bold text-green-600">
                        ${payout.netAmount.toLocaleString('es-CO')}
                      </p>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(
                            payout.status
                          )}`}
                        >
                          {getStatusIcon(payout.status)}
                          {payout.status}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center gap-2">
                        {payout.status === 'PENDING' && (
                          <button
                            onClick={() => handleProcessPayout(payout.id)}
                            disabled={processing === payout.id}
                            className="px-4 py-2 bg-[#FF2D55] text-white rounded-lg hover:bg-[#E6194B] disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors"
                          >
                            {processing === payout.id ? 'Procesando...' : 'Procesar Pago'}
                          </button>
                        )}
                        {payout.status === 'COMPLETED' && payout.processedAt && (
                          <p className="text-xs text-gray-500">
                            {new Date(payout.processedAt).toLocaleDateString('es-CO')}
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
