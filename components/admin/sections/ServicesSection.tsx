'use client'

import { useEffect, useState } from 'react'
import { Package, DollarSign, Clock, TrendingUp, Edit, Trash2 } from 'lucide-react'
import DataTable from '@/components/admin/DataTable'
import { formatCurrency } from '@/lib/utils'

interface Service {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  basePrice: number
  duration: number
  popular: boolean
  category: {
    name: string
    icon: string
  }
  _count: {
    bookings: number
    partners: number
  }
}

export default function ServicesSection() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchServices()
  }, [])

  const fetchServices = async () => {
    try {
      const res = await fetch('/api/services')
      const data = await res.json()
      setServices(data)
    } catch (error) {
      console.error('Error fetching services:', error)
    } finally {
      setLoading(false)
    }
  }

  const columns = [
    {
      key: 'name',
      label: 'Servicio',
      sortable: true,
      render: (value: string, row: Service) => (
        <div className="flex items-center gap-3">
          <span className="text-3xl">{row.icon}</span>
          <div>
            <div className="font-medium text-gray-900">{value}</div>
            <div className="text-sm text-gray-500">{row.category.name}</div>
          </div>
        </div>
      )
    },
    {
      key: 'description',
      label: 'Descripción',
      render: (value: string) => (
        <div className="text-sm text-gray-600 max-w-xs truncate" title={value}>
          {value}
        </div>
      )
    },
    {
      key: 'basePrice',
      label: 'Precio Base',
      sortable: true,
      render: (value: number) => (
        <div className="flex items-center gap-1 font-semibold text-green-600">
          <DollarSign size={14} />
          {formatCurrency(value)}
        </div>
      )
    },
    {
      key: 'duration',
      label: 'Duración',
      sortable: true,
      render: (value: number) => (
        <div className="flex items-center gap-1 text-gray-700">
          <Clock size={14} />
          {value} min
        </div>
      )
    },
    {
      key: '_count',
      label: 'Estadísticas',
      render: (value: any) => (
        <div className="text-sm">
          <div className="text-gray-700">{value.bookings} reservas</div>
          <div className="text-gray-500">{value.partners} socios</div>
        </div>
      )
    },
    {
      key: 'popular',
      label: 'Popular',
      render: (value: boolean) => (
        value ? (
          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold flex items-center gap-1 w-fit">
            <TrendingUp size={12} />
            Popular
          </span>
        ) : (
          <span className="text-gray-400 text-xs">-</span>
        )
      )
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF2D55]"></div>
      </div>
    )
  }

  const totalBookings = services.reduce((sum, s) => sum + s._count.bookings, 0)
  const totalPartners = services.reduce((sum, s) => sum + s._count.partners, 0)
  const popularServices = services.filter(s => s.popular).length
  const avgPrice = services.reduce((sum, s) => sum + s.basePrice, 0) / services.length

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestión de Servicios</h1>
        <p className="text-gray-600">Administra todos los servicios disponibles en la plataforma</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm mb-1">Total Servicios</p>
              <p className="text-3xl font-bold text-gray-900">{services.length}</p>
            </div>
            <Package className="text-[#FF2D55]" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm mb-1">Servicios Populares</p>
              <p className="text-3xl font-bold text-yellow-600">{popularServices}</p>
            </div>
            <TrendingUp className="text-yellow-600" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm mb-1">Total Reservas</p>
              <p className="text-3xl font-bold text-purple-600">{totalBookings}</p>
            </div>
            <Package className="text-purple-600" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm mb-1">Precio Promedio</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(avgPrice)}</p>
            </div>
            <DollarSign className="text-green-600" size={32} />
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={services}
        searchable
        exportable
        itemsPerPage={15}
      />
    </div>
  )
}
