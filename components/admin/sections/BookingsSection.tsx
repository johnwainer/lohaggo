'use client'

import { useEffect, useState } from 'react'
import { Calendar, User, MapPin, DollarSign, Clock } from 'lucide-react'
import DataTable from '@/components/admin/DataTable'
import { formatCurrency } from '@/lib/utils'

interface Booking {
  id: string
  scheduledDate: string
  scheduledTime: string
  status: string
  totalPrice: number
  address: string
  city: string
  notes: string | null
  createdAt: string
  service: {
    name: string
    icon: string
  }
  user: {
    name: string
    email: string
  }
  partner: {
    user: {
      name: string
    }
  } | null
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-primary-100 text-primary-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

const statusLabels: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  IN_PROGRESS: 'En Progreso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
}

export default function BookingsSection() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    fetchBookings()
  }, [])

  const fetchBookings = async () => {
    try {
      const res = await fetch('/api/bookings')
      const data = await res.json()
      setBookings(data)
    } catch (error) {
      console.error('Error fetching bookings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (bookingId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (res.ok) {
        alert('Estado actualizado exitosamente')
        fetchBookings()
      } else {
        alert('Error al actualizar estado')
      }
    } catch (error) {
      console.error('Error updating booking:', error)
      alert('Error al actualizar estado')
    }
  }

  const filteredBookings = filter === 'all'
    ? bookings
    : bookings.filter(b => b.status === filter)

  const columns = [
    {
      key: 'service',
      label: 'Servicio',
      render: (value: any) => (
        <div className="flex items-center gap-2">
          <span className="text-2xl">{value.icon}</span>
          <span className="font-medium text-gray-900">{value.name}</span>
        </div>
      )
    },
    {
      key: 'user',
      label: 'Cliente',
      render: (value: any) => (
        <div>
          <div className="font-medium text-gray-900">{value.name}</div>
          <div className="text-sm text-gray-500">{value.email}</div>
        </div>
      )
    },
    {
      key: 'partner',
      label: 'Socio',
      render: (value: any) => (
        <div className="text-gray-700">
          {value ? value.user.name : <span className="text-gray-400">Sin asignar</span>}
        </div>
      )
    },
    {
      key: 'scheduledDate',
      label: 'Fecha y Hora',
      sortable: true,
      render: (value: string, row: Booking) => (
        <div className="text-sm">
          <div className="flex items-center gap-1 text-gray-900">
            <Calendar size={14} />
            {new Date(value).toLocaleDateString('es-ES')}
          </div>
          <div className="flex items-center gap-1 text-gray-600">
            <Clock size={14} />
            {row.scheduledTime}
          </div>
        </div>
      )
    },
    {
      key: 'city',
      label: 'Ubicación',
      render: (value: string, row: Booking) => (
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
      key: 'totalPrice',
      label: 'Precio',
      sortable: true,
      render: (value: number) => (
        <span className="font-semibold text-green-600">
          {formatCurrency(value)}
        </span>
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
      key: 'actions',
      label: 'Acciones',
      render: (_: any, row: Booking) => (
        <select
          onChange={(e) => handleStatusChange(row.id, e.target.value)}
          value={row.status}
          className="text-xs border border-gray-300 rounded px-2 py-1"
        >
          <option value="PENDING">Pendiente</option>
          <option value="CONFIRMED">Confirmada</option>
          <option value="IN_PROGRESS">En Progreso</option>
          <option value="COMPLETED">Completada</option>
          <option value="CANCELLED">Cancelada</option>
        </select>
      )
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  const stats = {
    total: bookings.length,
    pending: bookings.filter(b => b.status === 'PENDING').length,
    confirmed: bookings.filter(b => b.status === 'CONFIRMED').length,
    inProgress: bookings.filter(b => b.status === 'IN_PROGRESS').length,
    completed: bookings.filter(b => b.status === 'COMPLETED').length,
    cancelled: bookings.filter(b => b.status === 'CANCELLED').length,
    totalRevenue: bookings
      .filter(b => b.status === 'COMPLETED')
      .reduce((sum, b) => sum + b.totalPrice, 0)
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestión de Reservas</h1>
        <p className="text-gray-600">Administra todas las reservas de la plataforma</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-md p-4">
          <p className="text-gray-600 text-xs mb-1">Total</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl shadow-md p-4">
          <p className="text-yellow-700 text-xs mb-1">Pendientes</p>
          <p className="text-2xl font-bold text-yellow-800">{stats.pending}</p>
        </div>
        <div className="bg-primary-50 rounded-xl shadow-md p-4">
          <p className="text-primary-700 text-xs mb-1">Confirmadas</p>
          <p className="text-2xl font-bold text-primary-800">{stats.confirmed}</p>
        </div>
        <div className="bg-purple-50 rounded-xl shadow-md p-4">
          <p className="text-purple-700 text-xs mb-1">En Progreso</p>
          <p className="text-2xl font-bold text-purple-800">{stats.inProgress}</p>
        </div>
        <div className="bg-green-50 rounded-xl shadow-md p-4">
          <p className="text-green-700 text-xs mb-1">Completadas</p>
          <p className="text-2xl font-bold text-green-800">{stats.completed}</p>
        </div>
        <div className="bg-red-50 rounded-xl shadow-md p-4">
          <p className="text-red-700 text-xs mb-1">Canceladas</p>
          <p className="text-2xl font-bold text-red-800">{stats.cancelled}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl shadow-md p-4">
          <p className="text-green-100 text-xs mb-1">Ingresos</p>
          <p className="text-xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
        </div>
      </div>

      <div className="mb-6 flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'all'
              ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Todas
        </button>
        <button
          onClick={() => setFilter('PENDING')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'PENDING'
              ? 'bg-yellow-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Pendientes
        </button>
        <button
          onClick={() => setFilter('CONFIRMED')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'CONFIRMED'
              ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Confirmadas
        </button>
        <button
          onClick={() => setFilter('IN_PROGRESS')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'IN_PROGRESS'
              ? 'bg-purple-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          En Progreso
        </button>
        <button
          onClick={() => setFilter('COMPLETED')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'COMPLETED'
              ? 'bg-green-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Completadas
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
        data={filteredBookings}
        searchable
        exportable
        itemsPerPage={15}
      />
    </div>
  )
}
