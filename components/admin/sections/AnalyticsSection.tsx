'use client'

import { useEffect, useState } from 'react'
import ChartCard from '@/components/admin/ChartCard'

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

export default function AnalyticsSection() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/admin/analytics')
      const data = await res.json()
      setAnalytics(data)
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (!analytics) {
    return <div className="p-8">Error al cargar analíticas</div>
  }

  const revenueChartData = {
    labels: analytics.bookingsByMonth.labels,
    datasets: [
      {
        label: 'Ingresos ($)',
        data: analytics.bookingsByMonth.revenue,
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
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
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
      }
    ]
  }

  const usersChartData = {
    labels: analytics.usersByMonth.labels,
    datasets: [
      {
        label: 'Nuevos Usuarios',
        data: analytics.usersByMonth.users,
        borderColor: 'rgb(147, 51, 234)',
        backgroundColor: 'rgba(147, 51, 234, 0.1)',
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
          'rgba(34, 197, 94, 0.8)',
          'rgba(239, 68, 68, 0.8)',
        ],
      }
    ]
  }

  const topServicesChartData = {
    labels: analytics.topServices.map(s => s.service.name),
    datasets: [
      {
        label: 'Reservas',
        data: analytics.topServices.map(s => s._count),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(147, 51, 234, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(234, 179, 8, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(20, 184, 166, 0.8)',
          'rgba(236, 72, 153, 0.8)',
          'rgba(99, 102, 241, 0.8)',
          'rgba(249, 115, 22, 0.8)',
          'rgba(168, 85, 247, 0.8)',
        ],
      }
    ]
  }

  const revenueByCityChartData = {
    labels: analytics.revenueByCity.map(c => c.city),
    datasets: [
      {
        label: 'Ingresos ($)',
        data: analytics.revenueByCity.map(c => c._sum.totalPrice || 0),
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
      }
    ]
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Analíticas Avanzadas</h1>
        <p className="text-gray-600">Análisis detallado del rendimiento de la plataforma</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ChartCard
          title="Evolución de Ingresos (Últimos 12 Meses)"
          type="line"
          data={revenueChartData}
        />
        <ChartCard
          title="Reservas por Mes (Últimos 12 Meses)"
          type="bar"
          data={bookingsChartData}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ChartCard
          title="Crecimiento de Usuarios (Últimos 12 Meses)"
          type="line"
          data={usersChartData}
        />
        <ChartCard
          title="Distribución de Reservas por Estado"
          type="doughnut"
          data={statusChartData}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Top 10 Servicios Más Solicitados"
          type="bar"
          data={topServicesChartData}
        />
        <ChartCard
          title="Ingresos por Ciudad"
          type="bar"
          data={revenueByCityChartData}
        />
      </div>
    </div>
  )
}
