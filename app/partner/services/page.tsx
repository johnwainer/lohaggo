'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Trash2,
  DollarSign,
  MapPin,
  AlertCircle,
  CheckCircle,
  Settings,
  Menu,
  X,
  Home,
  Package,
  Bell,
  Activity,
  LogOut,
  User,
  MessageSquare
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface Service {
  id: string
  name: string
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
}

const CITIES = [
  { value: 'MEDELLIN', label: 'Medellín' },
  { value: 'BOGOTA', label: 'Bogotá' },
  { value: 'CALI', label: 'Cali' },
  { value: 'BARRANQUILLA', label: 'Barranquilla' }
]

export default function ServicesManagementPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [allServices, setAllServices] = useState<Service[]>([])
  const [activeServices, setActiveServices] = useState<Service[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [bookingsCount, setBookingsCount] = useState(0)
  const [requestsCount, setRequestsCount] = useState(0)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated') {
      fetchServices()
      fetchCounts()
    }
  }, [status, router])

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
      console.error('Error fetching counts:', error)
    }
  }

  const fetchServices = async () => {
    setLoading(true)
    try {
      console.debug('fetchServices: iniciando petición de servicios')
      const servicesRes = await fetch('/api/partner/services')

      if (!servicesRes.ok) {
        console.error('Error response from /api/partner/services:', servicesRes.status, servicesRes.statusText)
        let errorData = null
        try {
          errorData = await servicesRes.json()
        } catch (e) {
          console.warn('No JSON body in error response for services', e)
        }
        console.debug('Error data (services):', errorData)
        showMessage('error', `Error al cargar servicios: ${errorData?.error || 'Error desconocido'}`)
        return
      }

      const servicesData = await servicesRes.json()
      console.debug('Services data received:', servicesData)

      if (servicesData && Array.isArray(servicesData.services)) {
        setAllServices(servicesData.services)

        const activeOnes = servicesData.services.filter((service: Service) => service.isActive)
        setActiveServices(activeOnes)
        console.debug('Active services set:', activeOnes.length)
      } else {
        console.error('Services data is not in expected format:', servicesData)
        showMessage('error', 'Formato de datos incorrecto')
      }
    } catch (error) {
      console.error('Error fetching services:', error)
      showMessage('error', 'Error al cargar servicios')
    } finally {
      setLoading(false)
      console.debug('fetchServices: finalizado, loading set to false')
    }
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleAddService = async (service: Service) => {
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

  const categories = Array.from(new Set(allServices.map(s => s.category.name)))
  const filteredServices = selectedCategory === 'all'
    ? allServices
    : allServices.filter(s => s.category.name === selectedCategory)

  console.debug('ServicesManagementPage render:', {
    allServicesCount: allServices.length,
    activeServicesCount: activeServices.length,
    filteredServicesCount: Array.isArray(filteredServices) ? filteredServices.length : 0,
    selectedCategory,
    loading
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Cargando servicios...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div>
        <header className="bg-white shadow-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Gestión de Servicios</h1>
                  <p className="hidden sm:block text-sm text-gray-600">Administra los servicios que ofreces</p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <nav className="flex gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => router.push('/partner')}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
                >
                  <Home size={20} className="sm:w-[22px] sm:h-[22px]" />
                  <span className="hidden sm:inline">Resumen</span>
                </button>

                <button
                  onClick={() => router.push('/partner?tab=bookings')}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
                >
                  <Package size={20} className="sm:w-[22px] sm:h-[22px]" />
                  <span className="hidden sm:inline">Mis Reservas</span>
                  {bookingsCount > 0 && (
                    <span className="bg-primary-600 text-white text-[10px] px-2 py-0.5 rounded-full ml-2">
                      {bookingsCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => router.push('/partner?tab=my-requests')}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
                >
                  <MessageSquare size={20} className="sm:w-[22px] sm:h-[22px]" />
                  <span className="hidden sm:inline">Para Mí</span>
                  {requestsCount > 0 && (
                    <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full ml-2">
                      {requestsCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => router.push('/partner?tab=all-requests')}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
                >
                  <Activity size={20} className="sm:w-[22px] sm:h-[22px]" />
                  <span className="hidden sm:inline">Todas</span>
                </button>

                <button
                  onClick={() => router.push('/partner/notifications')}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
                >
                  <Bell size={20} className="sm:w-[22px] sm:h-[22px]" />
                  <span className="hidden sm:inline">Notificaciones</span>
                </button>

                <button
                  onClick={() => router.push('/partner/services')}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-primary-600 text-primary-600 transition whitespace-nowrap"
                >
                  <Settings size={20} className="sm:w-[22px] sm:h-[22px]" />
                  <span className="hidden sm:inline">Mis Servicios</span>
                </button>
              </nav>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Servicios Activos</p>
                    <p className="text-3xl font-bold text-primary-600">{activeServices.length}</p>
                  </div>
                  <Settings className="text-primary-600" size={40} />
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm">Servicios Disponibles</p>
                    <p className="text-3xl font-bold text-gray-900">{allServices.length}</p>
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
                <div className="bg-white rounded-xl shadow-md p-8 text-center">
                  <AlertCircle className="mx-auto text-gray-400 mb-4" size={48} />
                  <p className="text-gray-600">No tienes servicios activos</p>
                  <p className="text-sm text-gray-500 mt-2">Agrega servicios para empezar a recibir solicitudes</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeServices.map((service) => (
                    <div key={service.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition">
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-start gap-4">
                            <div className="text-4xl">{service.icon}</div>
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

                      <div className="border-t border-gray-200 p-6 bg-gradient-to-r from-blue-50 to-indigo-50">
                        <div className="flex items-center gap-2 mb-4">
                          <Settings size={20} className="text-primary-600" />
                          <h4 className="font-semibold text-gray-900">Configuración del Servicio</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              💰 Precio del Servicio
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                value={service.price}
                                onChange={(e) => {
                                  const newServices = activeServices.map(s =>
                                    s.id === service.id ? { ...s, price: parseFloat(e.target.value) } : s
                                  )
                                  setActiveServices(newServices)
                                }}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                min="0"
                                step="1000"
                              />
                              <button
                                onClick={() => handleUpdatePrice(service.partnerServiceId!, service.id, service.price, service.city || 'MEDELLIN')}
                                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
                              >
                                Guardar
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              📍 Ciudad
                            </label>
                            <div className="flex gap-2">
                              <select
                                value={service.city || 'MEDELLIN'}
                                onChange={(e) => {
                                  const newServices = activeServices.map(s =>
                                    s.id === service.id ? { ...s, city: e.target.value } : s
                                  )
                                  setActiveServices(newServices)
                                }}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                              >
                                {CITIES.map(city => (
                                  <option key={city.value} value={city.value}>
                                    {city.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => handleUpdatePrice(service.partnerServiceId!, service.id, service.price, service.city || 'MEDELLIN')}
                                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
                              >
                                Guardar
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {showAddModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                  <div className="p-6 border-b border-gray-200">
                    <h2 className="text-2xl font-bold">Agregar Servicio</h2>
                    <p className="text-gray-600 mt-1">Selecciona un servicio para agregar a tu perfil</p>
                  </div>

                  <div className="p-6 border-b border-gray-200">
                    {allServices.length === 0 ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
                        <p className="text-gray-600 text-sm">Cargando categorías...</p>
                      </div>
                    ) : (
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => setSelectedCategory('all')}
                          className={`px-4 py-2 rounded-lg transition ${
                            selectedCategory === 'all'
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          Todos
                        </button>
                        {categories.map(category => (
                          <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            className={`px-4 py-2 rounded-lg transition ${
                              selectedCategory === category
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {category}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-6">
                    {filteredServices.length === 0 ? (
                      <div className="text-center py-8">
                        <AlertCircle className="mx-auto text-gray-400 mb-4" size={48} />
                        <p className="text-gray-600">No hay servicios disponibles en esta categoría</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredServices.map((service) => (
                          <div
                            key={service.id}
                            className={`border rounded-lg p-4 cursor-pointer transition ${
                              service.isActive
                                ? 'border-green-500 bg-green-50'
                                : 'border-gray-200 hover:border-primary-500 hover:bg-primary-50'
                            }`}
                            onClick={() => !service.isActive && handleAddService(service)}
                          >
                            <div className="flex items-start gap-3">
                              <div className="text-3xl">{service.icon}</div>
                              <div className="flex-1">
                                <h3 className="font-semibold text-gray-900">{service.name}</h3>
                                <p className="text-sm text-gray-600 mt-1">{service.description}</p>
                                <div className="flex items-center gap-3 mt-2">
                                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                    {service.category.name}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {service.duration} min
                                  </span>
                                  <span className="text-xs font-semibold text-primary-600">
                                    {formatCurrency(service.basePrice)}
                                  </span>
                                </div>
                                {service.isActive && (
                                  <div className="mt-2 flex items-center gap-1 text-green-600 text-sm">
                                    <CheckCircle size={16} />
                                    <span>Ya agregado</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-6 border-t border-gray-200 flex justify-end">
                    <button
                      onClick={() => setShowAddModal(false)}
                      className="px-6 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                    >
                      Cerrar
                    </button>
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
