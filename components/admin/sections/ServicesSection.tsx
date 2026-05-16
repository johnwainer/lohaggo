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
  showPartnerCount: boolean
  showAvgRating: boolean
  category: {
    id?: string
    slug?: string
    name: string
    icon: string
  }
  _count: {
    bookings: number
    partners: number
  }
}

interface ServiceCategory {
  id: string
  name: string
  slug: string
  icon: string
}

export default function ServicesSection() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([])
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [serviceForm, setServiceForm] = useState({
    name: '',
    slug: '',
    description: '',
    icon: '🛠️',
    categoryId: '',
    basePrice: '0',
    duration: '60',
    popular: false,
    showPartnerCount: true,
    showAvgRating: true,
  })

  useEffect(() => {
    void fetchServices()
  }, [])

  useEffect(() => {
    if (!serviceForm.categoryId && serviceCategories.length > 0) {
      setServiceForm((prev) => ({ ...prev, categoryId: serviceCategories[0].id }))
    }
  }, [serviceCategories, serviceForm.categoryId])

  const fetchServices = async () => {
    try {
      const res = await fetch('/api/admin/services')
      const data = await res.json()
      const normalizedServices = Array.isArray(data?.services) ? data.services : []
      const normalizedCategories = Array.isArray(data?.categories) ? data.categories : []

      setServices(normalizedServices)
      setServiceCategories(normalizedCategories)
    } catch (error) {
      console.error('Error fetching services:', error)
      setServices([])
      setServiceCategories([])
    } finally {
      setLoading(false)
    }
  }

  const resetServiceForm = () => {
    setEditingServiceId(null)
    setServiceForm({
      name: '',
      slug: '',
      description: '',
      icon: '🛠️',
      categoryId: serviceCategories[0]?.id || '',
      basePrice: '0',
      duration: '60',
      popular: false,
      showPartnerCount: true,
      showAvgRating: true,
    })
  }

  const startEditService = (service: Service) => {
    setEditingServiceId(service.id)
    setServiceForm({
      name: service.name,
      slug: service.slug,
      description: service.description,
      icon: service.icon,
      categoryId: service.category.id || '',
      basePrice: String(service.basePrice),
      duration: String(service.duration),
      popular: Boolean(service.popular),
      showPartnerCount: service.showPartnerCount !== false,
      showAvgRating: service.showAvgRating !== false,
    })
  }

  const saveService = async () => {
    if (!serviceForm.name.trim() || !serviceForm.slug.trim() || !serviceForm.categoryId) {
      alert('Completa nombre, slug y categoría.')
      return
    }

    const payload = {
      name: serviceForm.name.trim(),
      slug: serviceForm.slug.trim().toLowerCase().replace(/\s+/g, '-'),
      description: serviceForm.description.trim(),
      icon: serviceForm.icon.trim() || '🛠️',
      categoryId: serviceForm.categoryId,
      basePrice: Number(serviceForm.basePrice),
      duration: Number(serviceForm.duration),
      popular: Boolean(serviceForm.popular),
      showPartnerCount: Boolean(serviceForm.showPartnerCount),
      showAvgRating: Boolean(serviceForm.showAvgRating),
    }

    if (!payload.description || Number.isNaN(payload.basePrice) || Number.isNaN(payload.duration)) {
      alert('Revisa descripción, precio y duración.')
      return
    }

    setSaving(true)
    try {
      const endpoint = editingServiceId ? `/api/admin/services/${editingServiceId}` : '/api/admin/services'
      const method = editingServiceId ? 'PUT' : 'POST'
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'No se pudo guardar el servicio')
        return
      }

      await fetchServices()
      resetServiceForm()
    } catch (error) {
      console.error('Error saving service:', error)
    } finally {
      setSaving(false)
    }
  }

  const deleteService = async (service: Service) => {
    const confirmed = window.confirm(`¿Eliminar el servicio "${service.name}"?`)
    if (!confirmed) return

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/services/${service.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'No se pudo eliminar el servicio')
        return
      }

      await fetchServices()
      if (editingServiceId === service.id) resetServiceForm()
    } catch (error) {
      console.error('Error deleting service:', error)
    } finally {
      setSaving(false)
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
      render: (value: { bookings: number; partners: number }) => (
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
    },
    {
      key: 'id',
      label: 'Acciones',
      render: (_value: string, row: Service) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => startEditService(row)}
            className="rounded-md bg-gray-100 p-2 text-gray-700 hover:bg-gray-200"
            title="Editar servicio"
          >
            <Edit size={14} />
          </button>
          <button
            onClick={() => deleteService(row)}
            className="rounded-md bg-red-50 p-2 text-red-600 hover:bg-red-100"
            title="Eliminar servicio"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  const totalBookings = services.reduce((sum, s) => sum + (s._count?.bookings || 0), 0)
  const popularServices = services.filter(s => s.popular).length
  const avgPrice = services.length > 0
    ? services.reduce((sum, s) => sum + s.basePrice, 0) / services.length
    : 0

  return (
    <div className="space-y-6">
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
            <Package className="text-primary-600" size={32} />
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

      <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {editingServiceId ? 'Editar servicio' : 'Crear servicio'}
          </h2>
          <p className="text-sm text-gray-600">Gestiona todos los atributos del servicio desde admin.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            value={serviceForm.name}
            onChange={(e) => setServiceForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Nombre"
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={serviceForm.slug}
            onChange={(e) => setServiceForm((prev) => ({ ...prev, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
            placeholder="slug"
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={serviceForm.icon}
            onChange={(e) => setServiceForm((prev) => ({ ...prev, icon: e.target.value }))}
            placeholder="Icono"
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={serviceForm.categoryId}
            onChange={(e) => setServiceForm((prev) => ({ ...prev, categoryId: e.target.value }))}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Selecciona categoría</option>
            {serviceCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.icon} {category.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            value={serviceForm.basePrice}
            onChange={(e) => setServiceForm((prev) => ({ ...prev, basePrice: e.target.value }))}
            placeholder="Precio base"
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="number"
            min={1}
            value={serviceForm.duration}
            onChange={(e) => setServiceForm((prev) => ({ ...prev, duration: e.target.value }))}
            placeholder="Duración (minutos)"
            className="border rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <textarea
          value={serviceForm.description}
          onChange={(e) => setServiceForm((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="Descripción del servicio"
          rows={3}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />

        <div className="flex flex-col gap-2">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={serviceForm.popular}
              onChange={(e) => setServiceForm((prev) => ({ ...prev, popular: e.target.checked }))}
            />
            Marcar como popular
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={serviceForm.showPartnerCount}
              onChange={(e) => setServiceForm((prev) => ({ ...prev, showPartnerCount: e.target.checked }))}
            />
            Mostrar número de socios disponibles a clientes
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={serviceForm.showAvgRating}
              onChange={(e) => setServiceForm((prev) => ({ ...prev, showAvgRating: e.target.checked }))}
            />
            Mostrar calificación promedio a clientes
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={saveService}
            disabled={saving}
            className="rounded-lg bg-primary-600 text-white text-sm px-4 py-2 disabled:opacity-50"
          >
            {editingServiceId ? 'Guardar cambios' : 'Crear servicio'}
          </button>
          {editingServiceId && (
            <button
              onClick={resetServiceForm}
              className="rounded-lg border border-gray-300 text-sm px-4 py-2 text-gray-700"
            >
              Cancelar edición
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
