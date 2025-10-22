'use client'

import { useEffect, useState } from 'react'
import { DollarSign, Users, Calendar, Package, TrendingUp, UserCheck, FileText, Activity } from 'lucide-react'
import StatCard from '@/components/admin/StatCard'
import ChartCard from '@/components/admin/ChartCard'
import { formatCurrency } from '@/lib/utils'

interface Stats {
  totalUsers: number
  totalPartners: number
  totalBookings: number
  totalServices: number
  totalRevenue: number
  pendingBookings: number
  completedBookings: number
  activeRequests: number
  trends: {
    users: number
    bookings: number
    revenue: number
  }
}

interface Analytics {
  bookingsByMonth: {
    labels: string[]
    bookings: number[]
    revenue: number[]
  }
  usersByMonth: {
    labels: string[]
    users: number[]
  }
  bookingsByStatus: Array<{ status: string; _count: number }>
  topServices: Array<{ _count: number; service: { name: string; icon: string } }>
  revenueByCity: Array<{ city: string; _sum: { totalPrice: number }; _count: number }>
}

export default function DashboardSection() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [statsRes, analyticsRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/analytics')
      ])

      const statsData = await statsRes.json()
      const analyticsData = await analyticsRes.json()

      setStats(statsData)
      setAnalytics(analyticsData)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF2D55]"></div>
      </div>
    )
  }

  if (!stats || !analytics) {
    return <div className="p-8">Error al cargar datos</div>
  }

  const revenueChartData = {
    labels: analytics.bookingsByMonth.labels,
    datasets: [
      {
        label: 'Ingresos',
        data: analytics.bookingsByMonth.revenue,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  }

  const bookingsChartData = {
    labels: analytics.bookingsByMonth.labels,
    datasets: [
      {
        label: 'Reservas',
        data: analytics.bookingsByMonth.bookings,
        backgroundColor: 'rgba(147, 51, 234, 0.8)',
      }
    ]
  }

  const usersChartData = {
    labels: analytics.usersByMonth.labels,
    datasets: [
      {
        label: 'Nuevos Usuarios',
        data: analytics.usersByMonth.users,
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  }

  const statusChartData = {
    labels: analytics.bookingsByStatus.map(b => {
      const labels: Record<string, string> = {
        PENDING: 'Pendiente',
        CONFIRMED: 'Confirmada',
        IN_PROGRESS: 'En Progreso',
        COMPLETED: 'Completada',
        CANCELLED: 'Cancelada'
      }
      return labels[b.status] || b.status
    }),
    datasets: [
      {
        data: analytics.bookingsByStatus.map(b => b._count),
        backgroundColor: [
          'rgba(234, 179, 8, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(147, 51, 234, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(239, 68, 68, 0.8)',
        ],
      }
    ]
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Vista general de la plataforma Haggo</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Usuarios"
          value={stats.totalUsers}
          icon={Users}
          color="blue"
          trend={{
            value: stats.trends.users,
            isPositive: stats.trends.users >= 0
          }}
        />
        <StatCard
          title="Ingresos Totales"
          value={formatCurrency(stats.totalRevenue)}
          icon={DollarSign}
          color="green"
          trend={{
            value: stats.trends.revenue,
            isPositive: stats.trends.revenue >= 0
          }}
        />
        <StatCard
          title="Total Reservas"
          value={stats.totalBookings}
          icon={Calendar}
          color="purple"
          trend={{
            value: stats.trends.bookings,
            isPositive: stats.trends.bookings >= 0
          }}
        />
        <StatCard
          title="Socios Activos"
          value={stats.totalPartners}
          icon={UserCheck}
          color="indigo"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Reservas Pendientes"
          value={stats.pendingBookings}
          icon={Activity}
          color="yellow"
        />
        <StatCard
          title="Reservas Completadas"
          value={stats.completedBookings}
          icon={TrendingUp}
          color="teal"
        />
        <StatCard
          title="Solicitudes Activas"
          value={stats.activeRequests}
          icon={FileText}
          color="pink"
        />
        <StatCard
          title="Servicios Disponibles"
          value={stats.totalServices}
          icon={Package}
          color="red"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <ChartCard
          title="Ingresos Mensuales"
          type="line"
          data={revenueChartData}
        />
        <ChartCard
          title="Reservas por Mes"
          type="bar"
          data={bookingsChartData}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <ChartCard
          title="Nuevos Usuarios por Mes"
          type="line"
          data={usersChartData}
        />
        <ChartCard
          title="Reservas por Estado"
          type="doughnut"
          data={statusChartData}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Servicios Más Solicitados</h3>
          <div className="space-y-3">
            {analytics.topServices.slice(0, 5).map((service, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{service.service.icon}</span>
                  <span className="font-medium text-gray-700">{service.service.name}</span>
                </div>
                <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-semibold">
                  {service._count} reservas
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Ingresos por Ciudad</h3>
          <div className="space-y-3">
            {analytics.revenueByCity.map((city, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="font-medium text-gray-700">{city.city}</span>
                  <p className="text-sm text-gray-500">{city._count} reservas</p>
                </div>
                <span className="text-green-600 font-bold">
                  {formatCurrency(city._sum.totalPrice || 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
