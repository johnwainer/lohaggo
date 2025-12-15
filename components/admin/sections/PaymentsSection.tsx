'use client'

import { useEffect, useState } from 'react'
import { DollarSign, CheckCircle, Clock, XCircle, Search, TrendingUp } from 'lucide-react'

interface Payment {
  id: string
  amount: number
  serviceAmount: number
  clientCommission: number
  clientCommissionRate: number
  totalAmount: number
  status: string
  paidAt: string | null
  createdAt: string
  booking: {
    service: {
      name: string
    }
    scheduledFor: string
    user: {
      name: string
      email: string
    }
    partner?: {
      user: {
        name: string
      }
    }
  }
  payout?: {
    partnerCommission: number
    partnerCommissionRate: number
    netAmount: number
  }
}

export default function PaymentsSection() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchPayments()
  }, [filter])

  const fetchPayments = async () => {
    try {
      setLoading(true)
      const url = filter === 'ALL'
        ? '/api/admin/payments'
        : `/api/admin/payments?status=${filter}`

      const response = await fetch(url)
      const data = await response.json()
      setPayments(data)
    } catch (error) {
      console.error('Error al cargar pagos:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredPayments = payments.filter(payment => {
    const searchLower = searchTerm.toLowerCase()
    return (
      payment.booking.user.name.toLowerCase().includes(searchLower) ||
      payment.booking.user.email.toLowerCase().includes(searchLower) ||
      payment.booking.service.name.toLowerCase().includes(searchLower)
    )
  })

  const stats = {
    total: payments.length,
    pending: payments.filter(p => p.status === 'PENDING').length,
    approved: payments.filter(p => p.status === 'APPROVED').length,
    totalApproved: payments
      .filter(p => p.status === 'APPROVED')
      .reduce((sum, p) => sum + p.totalAmount, 0),
    totalPending: payments
      .filter(p => p.status === 'PENDING')
      .reduce((sum, p) => sum + p.totalAmount, 0),
    totalClientCommission: payments
      .filter(p => p.status === 'APPROVED')
      .reduce((sum, p) => sum + p.clientCommission, 0),
    totalPartnerCommission: payments
      .filter(p => p.status === 'APPROVED' && p.payout)
      .reduce((sum, p) => sum + (p.payout?.partnerCommission || 0), 0),
    totalAppRevenue: payments
      .filter(p => p.status === 'APPROVED')
      .reduce((sum, p) => {
        const clientComm = p.clientCommission
        const partnerComm = p.payout?.partnerCommission || 0
        return sum + clientComm + partnerComm
      }, 0),
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      PENDING: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, text: 'Pendiente' },
      APPROVED: { color: 'bg-green-100 text-green-800', icon: CheckCircle, text: 'Aprobado' },
      REJECTED: { color: 'bg-red-100 text-red-800', icon: XCircle, text: 'Rechazado' },
      CANCELLED: { color: 'bg-gray-100 text-gray-800', icon: XCircle, text: 'Cancelado' },
    }
    const badge = badges[status as keyof typeof badges] || badges.PENDING
    const Icon = badge.icon
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.text}
      </span>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pagos</h1>
          <p className="text-gray-600 mt-1">Gestiona todos los pagos de la plataforma</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Pagos</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{stats.total}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pendientes</p>
              <p className="text-2xl font-bold text-yellow-600 mt-2">{stats.pending}</p>
              <p className="text-xs text-gray-500 mt-1">{formatCurrency(stats.totalPending)}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Aprobados</p>
              <p className="text-2xl font-bold text-green-600 mt-2">{stats.approved}</p>
              <p className="text-xs text-gray-500 mt-1">{formatCurrency(stats.totalApproved)}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Comisión por Clientes</p>
              <p className="text-2xl font-bold text-purple-600 mt-2">{formatCurrency(stats.totalClientCommission)}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Comisión por Socios</p>
              <p className="text-2xl font-bold text-orange-600 mt-2">{formatCurrency(stats.totalPartnerCommission)}</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ganancia Total</p>
              <p className="text-2xl font-bold text-primary-600 mt-2">{formatCurrency(stats.totalAppRevenue)}</p>
              <p className="text-xs text-gray-500 mt-1">Clientes + Socios</p>
            </div>
            <div className="bg-red-100 p-3 rounded-lg">
              <DollarSign className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Buscar por cliente, email o servicio..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('ALL')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === 'ALL'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilter('PENDING')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === 'PENDING'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pendientes
              </button>
              <button
                onClick={() => setFilter('APPROVED')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === 'APPROVED'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Aprobados
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Servicio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Socio
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor Servicio
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Comisión por Cliente
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Cobrado
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Comisión por Socio
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pago a Socio
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ganancia App
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-gray-500">
                    No se encontraron pagos
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => {
                  const appRevenue = payment.clientCommission + (payment.payout?.partnerCommission || 0)
                  return (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {payment.booking.user.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {payment.booking.user.email}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {payment.booking.service.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatDate(payment.booking.scheduledFor)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {payment.booking.partner?.user.name || 'Sin asignar'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(payment.serviceAmount)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm text-purple-600 font-medium">
                          {formatCurrency(payment.clientCommission)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {payment.clientCommissionRate}%
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-bold text-gray-900">
                          {formatCurrency(payment.totalAmount)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {payment.payout ? (
                          <>
                            <div className="text-sm text-orange-600 font-medium">
                              {formatCurrency(payment.payout.partnerCommission)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {payment.payout.partnerCommissionRate}%
                            </div>
                          </>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {payment.payout ? (
                          <div className="text-sm font-medium text-green-600">
                            {formatCurrency(payment.payout.netAmount)}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-bold text-primary-600">
                          {formatCurrency(appRevenue)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(payment.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {payment.paidAt ? formatDate(payment.paidAt) : formatDate(payment.createdAt)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
