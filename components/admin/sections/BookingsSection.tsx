'use client'

import { useEffect, useState } from 'react'
import { Calendar, User, MapPin, DollarSign, Clock } from 'lucide-react'
import DataTable from '@/components/admin/DataTable'
import OriginBadge from '@/components/shared/OriginBadge'
import { formatCurrency } from '@/lib/utils'
import { BOOKING_STATUS_LABEL, BOOKING_TRANSITIONS } from '@/lib/bookings/transitions'
import type { BookingStatus } from '@prisma/client'

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
  origin?: string
  originChannel?: string | null
  originConversationId?: string | null
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
  const [originFilter, setOriginFilter] = useState<'all' | 'app' | 'chat'>('all')

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
        const body = await res.json().catch(() => ({}))
        alert(body?.error || 'Error al actualizar estado')
      }
    } catch (error) {
      console.error('Error updating booking:', error)
      alert('Error al actualizar estado')
    }
  }

  const filteredBookings = bookings
    .filter(b => filter === 'all' || b.status === filter)
    .filter(b => originFilter === 'all' || (originFilter === 'chat' ? b.origin === 'chat' : b.origin !== 'chat'))

  const columns = [
    {
      key: 'service',
      label: 'Servicio',
      render: (value: any, row: Booking) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{value.icon}</span>
            <span className="font-medium text-gray-900">{value.name}</span>
          </div>
          <OriginBadge
            origin={row.origin}
            originChannel={row.originChannel}
            originConversationId={row.originConversationId}
            className="mt-1"
          />
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
      render: (_: any, row: Booking) => {
        const next = BOOKING_TRANSITIONS[row.status as BookingStatus] ?? []
        if (!next.length) return <span className="text-xs text-gray-400">Sin cambios posibles</span>
        return (
          <select
            onChange={(e) => { if (e.target.value !== row.status) handleStatusChange(row.id, e.target.value) }}
            value={row.status}
            className="text-xs border border-gray-300 rounded px-2 py-1"
          >
            <option value={row.status}>{BOOKING_STATUS_LABEL[row.status as BookingStatus] ?? row.status}</option>
            {next.filter((t) => t.by.includes('admin')).map((t) => (
              <option key={t.to} value={t.to}>→ {BOOKING_STATUS_LABEL[t.to]}</option>
            ))}
          </select>
        )
      }
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
    <div className="space-y-6">
      <div className="mb-4 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Gestión de Reservas</h1>
        <p className="text-gray-600">Administra todas las reservas de la plataforma</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4 mb-6 sm:mb-8">
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
        <div className="col-span-2 md:col-span-1 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl shadow-md p-4">
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
        <div className="flex w-full items-center gap-2 sm:w-auto sm:ml-auto">
          <label htmlFor="bookings-origin-filter" className="text-sm text-gray-600 shrink-0">Origen</label>
          <select
            id="bookings-origin-filter"
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value as 'all' | 'app' | 'chat')}
            className="flex-1 sm:flex-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
          >
            <option value="all">Todos</option>
            <option value="app">App</option>
            <option value="chat">Chat</option>
          </select>
        </div>
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
