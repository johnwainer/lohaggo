'use client'

import { useEffect, useState } from 'react'
import { Shield, ShieldCheck, Star, MapPin, Calendar, Package, CheckCircle } from 'lucide-react'
import DataTable from '@/components/admin/DataTable'

interface Partner {
  id: string
  userId: string
  bio: string | null
  rating: number
  totalReviews: number
  verified: boolean
  city: string
  createdAt: string
  user: {
    id: string
    email: string
    name: string
    phone: string | null
    createdAt: string
  }
  services: Array<{
    id: string
    price: number
    active: boolean
    service: {
      name: string
      icon: string
    }
  }>
  _count: {
    bookings: number
    proposals: number
  }
}

export default function PartnersSection() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPartners()
  }, [])

  const fetchPartners = async () => {
    try {
      const res = await fetch('/api/admin/partners')
      const data = await res.json()
      setPartners(data)
    } catch (error) {
      console.error('Error fetching partners:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyPartner = async (partnerId: string, verified: boolean) => {
    try {
      const res = await fetch('/api/admin/partners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId, verified })
      })

      if (res.ok) {
        alert(`Socio ${verified ? 'verificado' : 'desverificado'} exitosamente`)
        fetchPartners()
      } else {
        alert('Error al actualizar verificación')
      }
    } catch (error) {
      console.error('Error updating partner:', error)
      alert('Error al actualizar verificación')
    }
  }

  const columns = [
    {
      key: 'user',
      label: 'Socio',
      sortable: true,
      render: (value: any, row: Partner) => (
        <div>
          <div className="font-medium text-gray-900 flex items-center gap-2">
            {value.name}
            {row.verified && (
              <ShieldCheck size={16} className="text-green-600" />
            )}
          </div>
          <div className="text-sm text-gray-500">{value.email}</div>
          {value.phone && (
            <div className="text-sm text-gray-500">{value.phone}</div>
          )}
        </div>
      )
    },
    {
      key: 'rating',
      label: 'Calificación',
      sortable: true,
      render: (value: number, row: Partner) => (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Star size={16} className="text-yellow-500 fill-yellow-500" />
            <span className="font-semibold text-gray-900">{value.toFixed(1)}</span>
          </div>
          <span className="text-sm text-gray-500">({row.totalReviews} reseñas)</span>
        </div>
      )
    },
    {
      key: 'city',
      label: 'Ciudad',
      sortable: true,
      render: (value: string) => (
        <div className="flex items-center gap-1 text-gray-700">
          <MapPin size={14} />
          {value}
        </div>
      )
    },
    {
      key: 'services',
      label: 'Servicios',
      render: (value: any[]) => (
        <div className="flex flex-wrap gap-1">
          {value.slice(0, 3).map((s, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs"
              title={s.service.name}
            >
              <span>{s.service.icon}</span>
            </span>
          ))}
          {value.length > 3 && (
            <span className="text-xs text-gray-500">+{value.length - 3}</span>
          )}
        </div>
      )
    },
    {
      key: '_count',
      label: 'Actividad',
      render: (value: any) => (
        <div className="text-sm">
          <div className="text-gray-700">{value.bookings} reservas</div>
          <div className="text-gray-500">{value.proposals} propuestas</div>
        </div>
      )
    },
    {
      key: 'createdAt',
      label: 'Registro',
      sortable: true,
      render: (value: string) => (
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <Calendar size={14} />
          {new Date(value).toLocaleDateString('es-ES')}
        </div>
      )
    },
    {
      key: 'verified',
      label: 'Estado',
      render: (value: boolean, row: Partner) => (
        <div className="flex items-center gap-2">
          {value ? (
            <CheckCircle size={20} className="text-green-600" />
          ) : (
            <button
              onClick={() => handleVerifyPartner(row.id, true)}
              className="px-3 py-1 bg-gradient-to-r from-primary-500 to-secondary-500 text-white rounded-lg hover:from-primary-600 hover:to-secondary-600 transition-colors text-sm"
            >
              Verificar
            </button>
          )}
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Acciones',
      render: (_: any, row: Partner) => (
        <button
          onClick={() => handleVerifyPartner(row.id, !row.verified)}
          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
            row.verified
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'bg-green-100 text-green-700 hover:bg-green-200'
          }`}
        >
          {row.verified ? 'Desverificar' : 'Verificar'}
        </button>
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

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestión de Socios</h1>
        <p className="text-gray-600">Administra y verifica los socios de la plataforma</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm mb-1">Total Socios</p>
              <p className="text-3xl font-bold text-gray-900">{partners.length}</p>
            </div>
            <Package className="text-purple-600" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm mb-1">Verificados</p>
              <p className="text-3xl font-bold text-green-600">
                {partners.filter(p => p.verified).length}
              </p>
            </div>
            <ShieldCheck className="text-green-600" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm mb-1">Sin Verificar</p>
              <p className="text-3xl font-bold text-gray-600">
                {partners.filter(p => !p.verified).length}
              </p>
            </div>
            <Shield className="text-gray-600" size={32} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm mb-1">Calificación Promedio</p>
              <p className="text-3xl font-bold text-yellow-600 flex items-center gap-1">
                <Star size={24} className="fill-yellow-600" />
                {partners.length > 0
                  ? (partners.reduce((sum, p) => sum + p.rating, 0) / partners.length).toFixed(1)
                  : '0.0'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={partners}
        searchable
        exportable
        itemsPerPage={15}
      />
    </div>
  )
}
