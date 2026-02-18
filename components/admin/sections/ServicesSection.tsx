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
    id?: string
    slug?: string
    name: string
    icon: string
  }
  useCategories?: ServiceUseCategory[]
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

interface ServiceUseCategory {
  id: string
  name: string
  slug: string
  icon: string
  description?: string | null
  order?: number
  isActive?: boolean
  _count?: {
    services: number
  }
}

interface AssignableService {
  id: string
  name: string
  slug: string
  icon: string
  category: {
    name: string
  }
  useCategories: ServiceUseCategory[]
}

export default function ServicesSection() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [useCategories, setUseCategories] = useState<ServiceUseCategory[]>([])
  const [assignableServices, setAssignableServices] = useState<AssignableService[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategorySlug, setNewCategorySlug] = useState('')
  const [newCategoryIcon, setNewCategoryIcon] = useState('🏷️')
  const [newCategoryDescription, setNewCategoryDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
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
  })

  useEffect(() => {
    Promise.all([fetchServices(), fetchUseCategoriesAndAssignments()])
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

  const fetchUseCategoriesAndAssignments = async () => {
    try {
      const [categoriesRes, assignmentsRes] = await Promise.all([
        fetch('/api/admin/service-use-categories'),
        fetch('/api/admin/service-use-categories/assignments'),
      ])

      const [categoriesData, assignmentsData] = await Promise.all([categoriesRes.json(), assignmentsRes.json()])

      setUseCategories(categoriesData.categories || [])
      setAssignableServices(assignmentsData.services || [])

      const availableServices: AssignableService[] = assignmentsData.services || []
      if (availableServices.length > 0) {
        const serviceToUse =
          availableServices.find((service) => service.id === selectedServiceId) || availableServices[0]
        setSelectedServiceId(serviceToUse.id)
        setSelectedCategoryIds((serviceToUse.useCategories || []).map((c: ServiceUseCategory) => c.id))
      }
    } catch (error) {
      console.error('Error loading use categories data:', error)
      setUseCategories([])
      setAssignableServices([])
    }
  }

  const resetCategoryForm = () => {
    setNewCategoryName('')
    setNewCategorySlug('')
    setNewCategoryIcon('🏷️')
    setNewCategoryDescription('')
    setEditingCategoryId(null)
  }

  const saveUseCategory = async () => {
    if (!newCategoryName.trim() || !newCategorySlug.trim()) return
    setSaving(true)
    try {
      const payload = {
        name: newCategoryName.trim(),
        slug: newCategorySlug.trim(),
        icon: newCategoryIcon.trim() || '🏷️',
        description: newCategoryDescription.trim() || null,
      }

      const endpoint = editingCategoryId
        ? `/api/admin/service-use-categories/${editingCategoryId}`
        : '/api/admin/service-use-categories'
      const method = editingCategoryId ? 'PUT' : 'POST'

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'No se pudo guardar la categoría de uso')
        return
      }
      resetCategoryForm()
      await fetchUseCategoriesAndAssignments()
    } catch (error) {
      console.error('Error saving use category:', error)
    } finally {
      setSaving(false)
    }
  }

  const startEditCategory = (category: ServiceUseCategory) => {
    setEditingCategoryId(category.id)
    setNewCategoryName(category.name)
    setNewCategorySlug(category.slug)
    setNewCategoryIcon(category.icon || '🏷️')
    setNewCategoryDescription(category.description || '')
  }

  const deleteUseCategory = async (categoryId: string) => {
    const confirmed = window.confirm('¿Eliminar esta categoría de uso?')
    if (!confirmed) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/service-use-categories/${categoryId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'No se pudo eliminar la categoría')
        return
      }
      await fetchUseCategoriesAndAssignments()
    } catch (error) {
      console.error('Error deleting use category:', error)
    } finally {
      setSaving(false)
    }
  }

  const onChangeSelectedService = (serviceId: string) => {
    setSelectedServiceId(serviceId)
    const current = assignableServices.find((service) => service.id === serviceId)
    setSelectedCategoryIds((current?.useCategories || []).map((category) => category.id))
  }

  const toggleCategoryForService = (categoryId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    )
  }

  const saveServiceAssignments = async () => {
    if (!selectedServiceId || selectedCategoryIds.length === 0) {
      alert('Selecciona un servicio y al menos una categoría de uso.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/service-use-categories/assignments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: selectedServiceId, categoryIds: selectedCategoryIds }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'No se pudieron guardar las categorías del servicio')
        return
      }
      await fetchUseCategoriesAndAssignments()
    } catch (error) {
      console.error('Error saving service assignments:', error)
    } finally {
      setSaving(false)
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

      await Promise.all([fetchServices(), fetchUseCategoriesAndAssignments()])
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

      await Promise.all([fetchServices(), fetchUseCategoriesAndAssignments()])
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
      key: 'useCategories',
      label: 'Categorías rápidas',
      render: (_value: unknown, row: Service) => {
        const categories = row.useCategories || []
        if (categories.length === 0) {
          return <span className="text-xs text-gray-400">Sin asignar</span>
        }
        return (
          <div className="flex flex-wrap gap-1 max-w-xs">
            {categories.slice(0, 3).map((category) => (
              <span
                key={`${row.id}-${category.id}`}
                className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold"
              >
                {category.icon} {category.name}
              </span>
            ))}
            {categories.length > 3 && (
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold">
                +{categories.length - 3}
              </span>
            )}
          </div>
        )
      },
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
  const totalPartners = services.reduce((sum, s) => sum + (s._count?.partners || 0), 0)
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

        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={serviceForm.popular}
            onChange={(e) => setServiceForm((prev) => ({ ...prev, popular: e.target.checked }))}
          />
          Marcar como popular
        </label>

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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Categorías rápidas para usuarios</h2>
            <p className="text-sm text-gray-600">
              Máximo 10. Se usan en el filtro “¿Dónde necesitas el servicio?” de la app.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Nombre (ej. Casa)"
              className="border rounded-lg px-3 py-2 text-sm"
            />
            <input
              value={newCategorySlug}
              onChange={(e) => setNewCategorySlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="slug (ej. casa)"
              className="border rounded-lg px-3 py-2 text-sm"
            />
            <input
              value={newCategoryIcon}
              onChange={(e) => setNewCategoryIcon(e.target.value)}
              placeholder="Icono"
              className="border rounded-lg px-3 py-2 text-sm"
            />
            <input
              value={newCategoryDescription}
              onChange={(e) => setNewCategoryDescription(e.target.value)}
              placeholder="Descripción corta"
              className="border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={saveUseCategory}
              disabled={saving}
              className="rounded-lg bg-primary-600 text-white text-sm px-4 py-2 disabled:opacity-50"
            >
              {editingCategoryId ? 'Guardar cambios' : 'Crear categoría'}
            </button>
            {editingCategoryId && (
              <button
                onClick={resetCategoryForm}
                className="rounded-lg border border-gray-300 text-sm px-4 py-2 text-gray-700"
              >
                Cancelar edición
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-80 overflow-auto pr-1">
            {useCategories.map((category) => (
              <div key={category.id} className="border rounded-lg p-3 flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-gray-900">
                    {category.icon} {category.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {category.slug} · {category._count?.services || 0} servicios
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => startEditCategory(category)}
                    className="p-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                    title="Editar categoría"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={() => deleteUseCategory(category.id)}
                    className="p-2 rounded-md bg-red-50 text-red-600 hover:bg-red-100"
                    title="Eliminar categoría"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Asignación por servicio</h2>
            <p className="text-sm text-gray-600">
              Cada servicio debe tener al menos una categoría rápida.
            </p>
          </div>

          <select
            value={selectedServiceId}
            onChange={(e) => onChangeSelectedService(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Selecciona un servicio</option>
            {assignableServices.map((service) => (
              <option key={service.id} value={service.id}>
                {service.icon} {service.name}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-auto pr-1">
            {useCategories.map((category) => (
              <label
                key={category.id}
                className="flex items-center gap-2 border rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selectedCategoryIds.includes(category.id)}
                  onChange={() => toggleCategoryForService(category.id)}
                />
                <span>
                  {category.icon} {category.name}
                </span>
              </label>
            ))}
          </div>

          <button
            onClick={saveServiceAssignments}
            disabled={saving || !selectedServiceId}
            className="rounded-lg bg-primary-600 text-white text-sm px-4 py-2 disabled:opacity-50"
          >
            Guardar categorías del servicio
          </button>
        </div>
      </div>
    </div>
  )
}
