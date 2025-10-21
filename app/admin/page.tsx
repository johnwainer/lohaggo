'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Users, Package, DollarSign, TrendingUp, Calendar, CheckCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Stats {
  totalBookings: number
  totalRevenue: number
  totalUsers: number
  totalServices: number
  pendingBookings: number
  completedBookings: number
}

interface Booking {
  id: string
  scheduledDate: string
  scheduledTime: string
  status: string
  totalPrice: number
  service: {
    name: string
    icon: string
  }
  user: {
    name: string
    email: string
  }
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

const statusLabels: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
}

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [stats, setStats] = useState<Stats>({
    totalBookings: 0,
    totalRevenue: 0,
    totalUsers: 0,
    totalServices: 0,
    pendingBookings: 0,
    completedBookings: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      if (session?.user?.role !== 'ADMIN') {
        router.push('/dashboard')
      } else {
        fetchData()
      }
    }
  }, [status, session])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch bookings
      const bookingsRes = await fetch('/api/bookings')
      const bookingsData = await bookingsRes.json()
      setBookings(bookingsData)

      // Calculate stats
      const totalRevenue = bookingsData
        .filter((b: Booking) => b.status === 'COMPLETED')
        .reduce((sum: number, b: Booking) => sum + b.totalPrice, 0)

      setStats({
        totalBookings: bookingsData.length,
        totalRevenue,
        totalUsers: 0, // Would need separate API
        totalServices: 50, // We have 50 services
        pendingBookings: bookingsData.filter((b: Booking) => b.status === 'PENDING').length,
        completedBookings: bookingsData.filter((b: Booking) => b.status === 'COMPLETED').length,
      })
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateBookingStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })

      if (res.ok) {
        alert('Estado actualizado')
        fetchData()
      } else {
        alert('Error al actualizar estado')
      }
    } catch (error) {
      console.error('Error updating booking:', error)
      alert('Error al actualizar estado')
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Panel Administrativo</h1>
          <p className="text-gray-600">Vista general de la plataforma</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm mb-1">Total Reservas</p>
                <p className="text-3xl font-bold">{stats.totalBookings}</p>
              </div>
              <Package size={40} className="opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm mb-1">Ingresos Totales</p>
                <p className="text-3xl font-bold">${stats.totalRevenue}</p>
              </div>
              <DollarSign size={40} className="opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm mb-1">Servicios</p>
                <p className="text-3xl font-bold">{stats.totalServices}</p>
              </div>
              <TrendingUp size={40} className="opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100 text-sm mb-1">Pendientes</p>
                <p className="text-3xl font-bold">{stats.pendingBookings}</p>
              </div>
              <Calendar size={40} className="opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-teal-100 text-sm mb-1">Completadas</p>
                <p className="text-3xl font-bold">{stats.completedBookings}</p>
              </div>
              <CheckCircle size={40} className="opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-pink-500 to-pink-600 text-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-pink-100 text-sm mb-1">Tasa Éxito</p>
                <p className="text-3xl font-bold">
                  {stats.totalBookings > 0 
                    ? Math.round((stats.completedBookings / stats.totalBookings) * 100)
                    : 0}%
                </p>
              </div>
              <TrendingUp size={40} className="opacity-80" />
            </div>
          </div>
        </div>

        {/* Recent Bookings */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="p-6 border-b bg-gray-50">
            <h2 className="text-xl font-bold">Reservas Recientes</h2>
          </div>
          
          {bookings.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="mx-auto text-gray-400 mb-4" size={48} />
              <p className="text-gray-600 text-lg">No hay reservas aún</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Servicio
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hora
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Precio
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bookings.slice(0, 10).map((booking) => (
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <span className="text-2xl mr-2">{booking.service.icon}</span>
                          <span className="font-medium">{booking.service.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="font-medium">{booking.user.name}</div>
                          <div className="text-sm text-gray-500">{booking.user.email}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(booking.scheduledDate).toLocaleDateString('es-ES')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {booking.scheduledTime}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[booking.status]}`}>
                          {statusLabels[booking.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-primary-600">
                        {formatCurrency(booking.totalPrice)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {booking.status === 'PENDING' && (
                          <button
                            onClick={() => updateBookingStatus(booking.id, 'CONFIRMED')}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Confirmar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
