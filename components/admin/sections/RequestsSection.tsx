'use client'

import { useEffect, useState } from 'react'
import { FileText, Clock, CheckCircle, XCircle, AlertCircle, MapPin, Calendar } from 'lucide-react'
import DataTable from '@/components/admin/DataTable'
import { formatCurrency } from '@/lib/utils'

interface ServiceRequest {
  id: string
  address: string
  notes: string | null
  city: string
  preferredDate: string | null
  isUrgent: boolean
  status: string
  expiresAt: string
  createdAt: string
  user?: {
    name: string
    email: string
  }
  service?: {
    name: string
    icon: string
  }
  _count?: {
    proposals: number
  }
}

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  ACCEPTED: 'bg-orange-100 text-orange-800',
  EXPIRED: 'bg-gray-100 text-gray-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

const statusLabels: Record<string, string> = {
  ACTIVE: 'Activa',
  ACCEPTED: 'Aceptada',
  EXPIRED: 'Expirada',
  CANCELLED: 'Cancelada',
}

export default function RequestsSection() {
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    fetchRequests()
  }, [])

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/admin/service-requests')
      const data = await res.json()
      setRequests(data)
    } catch (error) {
      console.error('Error fetching requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredRequests = filter === 'all'
    ? requests
    : requests.filter(r => r.status === filter)

  const columns = [
    {
      key: 'service',
      label: 'Servicio',
      render: (value: any) => (
        <div className="flex items-center gap-2">
          <span className="text-2xl">{value?.icon ?? ''}</span>
          <span className="font-medium text-gray-900">{value?.name ?? '—'}</span>
        </div>
      )
    },
    {
      key: 'user',
      label: 'Cliente',
      render: (value: any) => (
        <div>
          <div className="font-medium text-gray-900">{value?.name ?? '—'}</div>
          <div className="text-sm text-gray-500">{value?.email ?? ''}</div>
        </div>
      )
    },
    {
      key: 'city',
      label: 'Ubicación',
      render: (value: string, row: ServiceRequest) => (
        <div className="text-sm">
          <div className="flex items-center gap-1 text-gray-900">
            <MapPin size={14} />
            {value}
          </div>
          <div className="text-gray-500 text-xs truncate max-w-[150px]" title={row.address}>
            {row.address}
          </div>
        </div>
      )
    },
    {
      key: 'preferredDate',
      label: 'Fecha Preferida',
      render: (value: string | null) => (
        value ? (
          <div className="flex items-center gap-1 text-sm text-gray-700">
            <Calendar size={14} />
            {new Date(value).toLocaleDateString('es-ES')}
          </div>
        ) : (
          <span className="text-gray-400 text-sm">Sin preferencia</span>
        )
      )
    },
    {
      key: '_count',
      label: 'Propuestas',
      sortable: true,
      render: (value: any) => (
        <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-semibold">
          {value?.proposals || 0}
        </span>
      )
    },
    {
      key: 'isUrgent',
      label: 'Urgente',
      render: (value: boolean) => (
        value ? (
          <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-semibold flex items-center gap-1 w-fit">
            <AlertCircle size={12} />
            Urgente
          </span>
        ) : (
          <span className="text-gray-400 text-xs">-</span>
        )
      )
    },
    {
      key: 'status',
      label: 'Estado',
      sortable: true,
      render: (value: string) => (
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[value]}`}>
          {statusLabels[value]}
        </span>
      )
    },
    {
      key: 'expiresAt',
      label: 'Expira',
      sortable: true,
      render: (value: string) => {
        const expiresAt = new Date(value)
        const now = new Date()
        const isExpired = expiresAt < now
        const hoursLeft = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)))

        return (
          <div className="text-sm">
            <div className={`flex items-center gap-1 ${isExpired ? 'text-red-600' : 'text-gray-700'}`}>
              <Clock size={14} />
              {isExpired ? 'Expirada' : `${hoursLeft}h restantes`}
            </div>
            <div className="text-xs text-gray-500">
              {expiresAt.toLocaleDateString('es-ES')}
            </div>
          </div>
        )
      }
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF2D55]"></div>
      </div>
    )
  }

  const stats = {
    total: requests.length,
    active: requests.filter(r => r.status === 'ACTIVE').length,
    accepted: requests.filter(r => r.status === 'ACCEPTED').length,
    expired: requests.filter(r => r.status === 'EXPIRED').length,
    cancelled: requests.filter(r => r.status === 'CANCELLED').length,
    urgent: requests.filter(r => r.isUrgent).length,
    totalProposals: requests.reduce((sum, r) => sum + (r._count?.proposals || 0), 0)
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Solicitudes de Servicio</h1>
        <p className="text-gray-600">Administra todas las solicitudes y propuestas de la plataforma</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-md p-4">
          <p className="text-gray-600 text-xs mb-1">Total</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-green-50 rounded-xl shadow-md p-4">
          <p className="text-green-700 text-xs mb-1">Activas</p>
          <p className="text-2xl font-bold text-green-800">{stats.active}</p>
        </div>
        <div className="bg-orange-50 rounded-xl shadow-md p-4">
          <p className="text-orange-700 text-xs mb-1">Aceptadas</p>
          <p className="text-2xl font-bold text-orange-800">{stats.accepted}</p>
        </div>
        <div className="bg-gray-50 rounded-xl shadow-md p-4">
          <p className="text-gray-700 text-xs mb-1">Expiradas</p>
          <p className="text-2xl font-bold text-gray-800">{stats.expired}</p>
        </div>
        <div className="bg-red-50 rounded-xl shadow-md p-4">
          <p className="text-red-700 text-xs mb-1">Canceladas</p>
          <p className="text-2xl font-bold text-red-800">{stats.cancelled}</p>
        </div>
        <div className="bg-orange-50 rounded-xl shadow-md p-4">
          <p className="text-orange-700 text-xs mb-1">Urgentes</p>
          <p className="text-2xl font-bold text-orange-800">{stats.urgent}</p>
        </div>
        <div className="bg-purple-50 rounded-xl shadow-md p-4">
          <p className="text-purple-700 text-xs mb-1">Propuestas</p>
          <p className="text-2xl font-bold text-purple-800">{stats.totalProposals}</p>
        </div>
      </div>

      <div className="mb-6 flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'all'
              ? 'bg-gradient-to-r from-[#FF2D55] to-[#FF6900] text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Todas
        </button>
        <button
          onClick={() => setFilter('ACTIVE')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'ACTIVE'
              ? 'bg-green-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Activas
        </button>
        <button
          onClick={() => setFilter('ACCEPTED')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'ACCEPTED'
              ? 'bg-gradient-to-r from-[#FF2D55] to-[#FF6900] text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Aceptadas
        </button>
        <button
          onClick={() => setFilter('EXPIRED')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'EXPIRED'
              ? 'bg-gray-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Expiradas
        </button>
        <button
          onClick={() => setFilter('CANCELLED')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'CANCELLED'
              ? 'bg-red-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Canceladas
        </button>
      </div>

      <DataTable
        columns={columns}
        data={filteredRequests}
        searchable
        exportable
        itemsPerPage={15}
      />
    </div>
  )
}
