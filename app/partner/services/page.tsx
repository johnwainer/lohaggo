'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  Settings
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import AccountTopHeader from '@/components/shared/AccountTopHeader'
import AccountPanel from '@/components/shared/AccountPanel'
import ServiceIcon from '@/components/ServiceIcon'

interface ApprovedDoc {
  id: string
  type: string
  status: string
}

interface Service {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  basePrice: number
  duration: number
  category: {
    name: string
  }
  isActive: boolean
  partnerServiceId?: string
  price: number
  city?: string
  approvedDocuments?: ApprovedDoc[]
}

const EDUCATION_TYPES = ['DIPLOMA_BACHILLERATO', 'DIPLOMA_TECNICO', 'DIPLOMA_TECNOLOGO', 'DIPLOMA_PROFESIONAL', 'DIPLOMA_POSGRADO', 'CERTIFICADO_CURSO']

const DOC_ICONS: Record<string, string> = {
  DIPLOMA_BACHILLERATO: '🎓',
  DIPLOMA_TECNICO: '📋',
  DIPLOMA_TECNOLOGO: '📋',
  DIPLOMA_PROFESIONAL: '🏛️',
  DIPLOMA_POSGRADO: '🎓',
  CERTIFICADO_CURSO: '📜',
}

const CITIES = [
  { value: 'MEDELLIN', label: 'Medellín' },
  { value: 'BOGOTA', label: 'Bogotá' },
  { value: 'CALI', label: 'Cali' },
  { value: 'BARRANQUILLA', label: 'Barranquilla' }
]

export default function ServicesManagementPage() {
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const [allServices, setAllServices] = useState<Service[]>([])
  const [activeServices, setActiveServices] = useState<Service[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showUnverified, setShowUnverified] = useState(false)
  const [bookingsCount, setBookingsCount] = useState(0)
  const [requestsCount, setRequestsCount] = useState(0)

  useEffect(() => {
    if (status === 'authenticated') {
      fetchServices()
      fetchCounts()
    }
  }, [status])

  const fetchCounts = async () => {
    try {
      const [bookingsRes, requestsRes] = await Promise.all([
        fetch('/api/bookings'),
        fetch('/api/partner/service-requests')
      ])

      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json()
        setBookingsCount(Array.isArray(bookingsData) ? bookingsData.length : 0)
      }

      if (requestsRes.ok) {
        const requestsData = await requestsRes.json()
        setRequestsCount(Array.isArray(requestsData) ? requestsData.length : 0)
      }
    } catch (error) {
      // Error fetching counts
    }
  }

  const fetchServices = async () => {
    setLoading(true)
    try {
      const servicesRes = await fetch('/api/partner/services')

      if (!servicesRes.ok) {
        let errorData = null
        try {
          errorData = await servicesRes.json()
        } catch (e) {
          // No JSON body in error response
        }
        showMessage('error', `Error al cargar servicios: ${errorData?.error || 'Error desconocido'}`)
        return
      }

      const servicesData = await servicesRes.json()

      if (servicesData && Array.isArray(servicesData.services)) {
        setAllServices(servicesData.services)

        const activeOnes = servicesData.services.filter((service: Service) => service.isActive)
        setActiveServices(activeOnes)
      } else {
        showMessage('error', 'Formato de datos incorrecto')
      }
    } catch (error) {
      showMessage('error', 'Error al cargar servicios')
    } finally {
      setLoading(false)
    }
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleAddService = async (service: Service) => {
    if (activeServices.length >= 5) {
      showMessage('error', 'Solo puedes ofrecer un máximo de 5 servicios')
      return
    }

    try {
      const res = await fetch('/api/partner/services', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceId: service.id,
        }),
      })

      if (res.ok) {
        showMessage('success', 'Servicio agregado correctamente')
        fetchServices()
        setShowAddModal(false)
      } else {
        const errorData = await res.json()
        showMessage('error', `Error al agregar servicio: ${errorData.error || 'Error desconocido'}`)
      }
    } catch (error) {
      console.error('Error adding service:', error)
      showMessage('error', 'Error al agregar el servicio')
    }
  }

  const handleRemoveService = async (partnerServiceId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este servicio?')) {
      return
    }

    try {
      const res = await fetch('/api/partner/services', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partnerServiceId,
        }),
      })

      if (res.ok) {
        showMessage('success', 'Servicio eliminado correctamente')
        fetchServices()
      } else {
        const errorData = await res.json()
        showMessage('error', `Error al eliminar servicio: ${errorData.error || 'Error desconocido'}`)
      }
    } catch (error) {
      console.error('Error removing service:', error)
      showMessage('error', 'Error al eliminar el servicio')
    }
  }

  const handleUpdatePrice = async (partnerServiceId: string, serviceId: string, price: number, city: string) => {
    try {
      const res = await fetch('/api/partner/services', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partnerServiceId,
          serviceId,
          price,
          city,
        }),
      })

      if (res.ok) {
        showMessage('success', 'Servicio actualizado correctamente')
        fetchServices()
      } else {
        const errorData = await res.json()
        showMessage('error', `Error al actualizar: ${errorData.error || 'Error desconocido'}`)
      }
    } catch (error) {
      console.error('Error updating service:', error)
      showMessage('error', 'Error al actualizar el servicio')
    }
  }

  // Por defecto, oculta servicios para los que el socio no tiene documentos
  // aprobados aún (no puede activarlos). Mantiene visibles los ya activos.
  const isVerifiedForService = (s: Service) => s.isActive || (s.approvedDocuments && s.approvedDocuments.length > 0)
  const verifiedServices = showUnverified ? allServices : allServices.filter(isVerifiedForService)
  const hiddenByVerification = allServices.length - verifiedServices.length
  const categories = Array.from(new Set(verifiedServices.map(s => s.category.name)))
  const filteredServices = selectedCategory === 'all'
    ? verifiedServices
    : verifiedServices.filter(s => s.category.name === selectedCategory)

  if (loading) {
    return (
      <div className="panel-page min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Cargando servicios...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="account-shell">
      <div>
        <AccountTopHeader
          role="PARTNER"
          title="Gestión de Servicios"
          subtitle="Administra los servicios que ofreces"
          counts={{
            bookings: bookingsCount,
            requests: requestsCount
          }}
        />

        <main className="account-main">
          <div>
            {message && (
              <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
                message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}>
                {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                <span>{message.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="surface-card p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Servicios Activos</p>
                    <p className="text-3xl font-bold text-primary-600">{activeServices.length}</p>
                  </div>
                  <Settings className="text-primary-600" size={40} />
                </div>
              </div>
              <div className="surface-card p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Para activar</p>
                    <p className="text-3xl font-bold text-gray-900">{verifiedServices.length - activeServices.length}</p>
                    {hiddenByVerification > 0 && (
                      <p className="text-[11px] text-gray-500 mt-0.5">{hiddenByVerification} requieren verificación</p>
                    )}
                  </div>
                  <Plus className="text-gray-600" size={40} />
                </div>
              </div>
            </div>

            <div className="mb-6">
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition flex items-center gap-2 font-medium"
              >
                <Plus size={20} />
                Agregar Nuevo Servicio
              </button>
            </div>

            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Mis Servicios</h2>
              {activeServices.length === 0 ? (
                <AccountPanel className="text-center">
                  <AlertCircle className="mx-auto text-gray-400 mb-4" size={48} />
                  <p className="text-gray-600">No tienes servicios activos</p>
                  <p className="text-sm text-gray-500 mt-2">Agrega servicios para empezar a recibir solicitudes</p>
                </AccountPanel>
              ) : (
                <div className="space-y-4">
                  {activeServices.map((service) => (
                    <div key={service.id} className="surface-card overflow-hidden hover:shadow-[0_12px_30px_rgba(15,23,42,0.12)] transition">
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-start gap-4">
                            <ServiceIcon slug={service.slug} emoji={service.icon} size="lg" />
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">{service.name}</h3>
                              <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                              <div className="flex items-center gap-4 mt-2">
                                <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                                  {service.category.name}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {service.duration} min
                                </span>
                              </div>
                              {service.approvedDocuments && service.approvedDocuments.filter(d => EDUCATION_TYPES.includes(d.type)).length > 0 && (
                                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                  {service.approvedDocuments.filter(d => EDUCATION_TYPES.includes(d.type)).map(d => (
                                    <span
                                      key={d.id}
                                      title={d.type.replace(/_/g, ' ')}
                                      className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium"
                                    >
                                      {DOC_ICONS[d.type] ?? '📄'} Certificado
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm text-gray-600 bg-blue-50 px-3 py-1 rounded-lg flex items-center">
                              <Settings size={16} className="inline mr-1" />
                              Editable abajo
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRemoveService(service.partnerServiceId!)
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Eliminar servicio"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-gray-100 px-4 py-4 bg-gray-50">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1.5">💰 Precio</label>
                            <input
                              type="number"
                              value={service.price}
                              onChange={(e) => {
                                const newServices = activeServices.map(s =>
                                  s.id === service.id ? { ...s, price: parseFloat(e.target.value) } : s
                                )
                                setActiveServices(newServices)
                              }}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                              min="0"
                              step="1000"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1.5">📍 Ciudad</label>
                            <select
                              value={service.city || 'MEDELLIN'}
                              onChange={(e) => {
                                const newServices = activeServices.map(s =>
                                  s.id === service.id ? { ...s, city: e.target.value } : s
                                )
                                setActiveServices(newServices)
                              }}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                            >
                              {CITIES.map(city => (
                                <option key={city.value} value={city.value}>{city.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="sm:self-end">
                            <button
                              onClick={() => handleUpdatePrice(service.partnerServiceId!, service.id, service.price, service.city || 'MEDELLIN')}
                              className="w-full sm:w-auto px-5 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition"
                            >
                              Guardar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {showAddModal && (
              <div className="fixed inset-0 bg-black/50 z-50 flex flex-col justify-end sm:items-center sm:justify-center sm:p-4">
                <div className="bg-white w-full rounded-t-2xl sm:rounded-2xl sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] overflow-hidden flex flex-col">
                  {/* Header */}
                  <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Agregar servicio</h2>
                      <p className="text-xs text-gray-500 mt-0.5">Máximo 5 servicios en tu perfil</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        activeServices.length >= 5 ? 'bg-red-100 text-red-700' : 'bg-primary-100 text-primary-700'
                      }`}>
                        {activeServices.length}/5
                      </span>
                      <button
                        onClick={() => setShowAddModal(false)}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 transition"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Verification filter banner */}
                  {hiddenByVerification > 0 && (
                    <div className="px-5 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2 text-xs">
                      <AlertCircle size={14} className="text-amber-600 flex-shrink-0" />
                      <span className="text-amber-900 flex-1">
                        Ocultando <strong>{hiddenByVerification}</strong> servicios sin documentos aprobados.
                      </span>
                      <button
                        onClick={() => setShowUnverified(v => !v)}
                        className="font-semibold text-amber-700 hover:text-amber-900 whitespace-nowrap"
                      >
                        {showUnverified ? 'Ocultar' : 'Ver todos'}
                      </button>
                    </div>
                  )}

                  {/* Category tabs — horizontal scroll */}
                  <div className="px-5 py-3 border-b border-gray-100">
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                      <button
                        onClick={() => setSelectedCategory('all')}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition ${
                          selectedCategory === 'all'
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Todos
                      </button>
                      {categories.map(category => (
                        <button
                          key={category}
                          onClick={() => setSelectedCategory(category)}
                          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition ${
                            selectedCategory === category
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Service list */}
                  <div className="flex-1 overflow-y-auto">
                    {filteredServices.length === 0 ? (
                      <div className="text-center py-12">
                        <AlertCircle className="mx-auto text-gray-300 mb-3" size={40} />
                        <p className="text-gray-500 text-sm">No hay servicios en esta categoría</p>
                      </div>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {filteredServices.map((service) => {
                          const isDisabled = !service.isActive && activeServices.length >= 5
                          return (
                            <li
                              key={service.id}
                              onClick={() => !service.isActive && !isDisabled && handleAddService(service)}
                              className={`flex items-center gap-3 px-5 py-3.5 transition ${
                                service.isActive
                                  ? 'bg-green-50'
                                  : isDisabled
                                  ? 'opacity-40 cursor-not-allowed'
                                  : 'active:bg-gray-50 cursor-pointer hover:bg-gray-50'
                              }`}
                            >
                              <ServiceIcon slug={service.slug} emoji={service.icon} size="sm" />
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 text-sm leading-tight">{service.name}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{service.category.name} · {service.duration} min</p>
                              </div>
                              <div className="flex-shrink-0">
                                {service.isActive ? (
                                  <CheckCircle size={20} className="text-green-500" />
                                ) : isDisabled ? (
                                  <AlertCircle size={20} className="text-gray-300" />
                                ) : (
                                  <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full">+ Agregar</span>
                                )}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
