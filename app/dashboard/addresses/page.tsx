'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  MapPin, Plus, Edit2, Trash2, Home, Building, Star, ArrowLeft,
  Package, MessageSquare, Heart
} from 'lucide-react'
import { useCity } from '@/lib/city-context'

interface Address {
  id: string
  label: string
  street: string
  number: string
  complement?: string
  neighborhood: string
  city: string
  postalCode?: string
  instructions?: string
  isPrimary: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function AddressesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { cities, getCityBySlug } = useCity()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)
  const [bookingsCount, setBookingsCount] = useState(0)
  const [requestsCount, setRequestsCount] = useState(0)
  const [favoritesCount, setFavoritesCount] = useState(0)
  const [formData, setFormData] = useState({
    label: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    postalCode: '',
    instructions: '',
    isPrimary: false
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      fetchAddresses()
      fetchCounts()
    }
  }, [status, router])

  useEffect(() => {
    if (cities.length > 0 && !formData.city) {
      const activeCity = cities.find(c => c.status === 'ACTIVE')
      const defaultCity = activeCity || cities[0]
      setFormData(prev => ({ ...prev, city: defaultCity.slug }))
    }
  }, [cities, formData.city])

  const fetchAddresses = async () => {
    try {
      const res = await fetch('/api/addresses')
      if (res.ok) {
        const data = await res.json()
        setAddresses(data)
      }
    } catch (error) {
      console.error('Error fetching addresses:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCounts = async () => {
    try {
      const [bookingsRes, requestsRes, favoritesRes] = await Promise.all([
        fetch('/api/bookings'),
        fetch('/api/service-requests'),
        fetch('/api/favorites')
      ])

      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json()
        setBookingsCount(Array.isArray(bookingsData) ? bookingsData.length : 0)
      }

      if (requestsRes.ok) {
        const requestsData = await requestsRes.json()
        const requests = Array.isArray(requestsData) ? requestsData : Array.isArray(requestsData?.serviceRequests) ? requestsData.serviceRequests : []
        setRequestsCount(requests.length)
      }

      if (favoritesRes.ok) {
        const favoritesData = await favoritesRes.json()
        setFavoritesCount(Array.isArray(favoritesData) ? favoritesData.length : 0)
      }
    } catch (error) {
      console.error('Error fetching counts:', error)
    }
  }

  const handleOpenModal = (address?: Address) => {
    if (address) {
      setEditingAddress(address)
      setFormData({
        label: address.label,
        street: address.street,
        number: address.number,
        complement: address.complement || '',
        neighborhood: address.neighborhood,
        city: address.city,
        postalCode: address.postalCode || '',
        instructions: address.instructions || '',
        isPrimary: address.isPrimary
      })
    } else {
      setEditingAddress(null)
      setFormData({
        label: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: 'MEDELLIN',
        postalCode: '',
        instructions: '',
        isPrimary: addresses.length === 0
      })
    }
    setShowModal(true)
    setError('')
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingAddress(null)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const url = editingAddress
        ? `/api/addresses/${editingAddress.id}`
        : '/api/addresses'

      const method = editingAddress ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        await fetchAddresses()
        handleCloseModal()
      } else {
        const data = await res.json()
        setError(data.error || 'Error al guardar dirección')
      }
    } catch (error) {
      setError('Error al guardar dirección')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta dirección?')) return

    try {
      const res = await fetch(`/api/addresses/${id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        await fetchAddresses()
      }
    } catch (error) {
      console.error('Error deleting address:', error)
    }
  }

  const handleSetPrimary = async (address: Address) => {
    try {
      const res = await fetch(`/api/addresses/${address.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...address, isPrimary: true })
      })

      if (res.ok) {
        await fetchAddresses()
      }
    } catch (error) {
      console.error('Error setting primary address:', error)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header con submenú */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">Mis Direcciones</h1>
                <p className="text-xs sm:text-sm text-gray-600 truncate hidden sm:block">Administra tus direcciones de servicio</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 bg-gray-50">
          <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
            <nav className="flex gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
              >
                <Home size={20} className="sm:w-[22px] sm:h-[22px]" />
                <span className="hidden sm:inline">Resumen</span>
              </button>

              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
              >
                <Package size={20} className="sm:w-[22px] sm:h-[22px]" />
                <span className="hidden sm:inline">Mis Reservas</span>
                {bookingsCount > 0 && (
                  <span className="bg-primary-600 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                    {bookingsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
              >
                <MessageSquare size={20} className="sm:w-[22px] sm:h-[22px]" />
                <span className="hidden sm:inline">Mis Solicitudes</span>
                {requestsCount > 0 && (
                  <span className="bg-primary-500 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                    {requestsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => router.push('/dashboard?tab=favorites')}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
              >
                <Heart size={20} className="sm:w-[22px] sm:h-[22px]" />
                <span className="hidden sm:inline">Favoritos</span>
                {favoritesCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                    {favoritesCount}
                  </span>
                )}
              </button>

            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-3xl font-bold text-gray-900 truncate">Mis Direcciones</h2>
              <p className="text-gray-600 mt-1 text-xs sm:text-base hidden sm:block">Administra tus direcciones de servicio</p>
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-1.5 sm:gap-2 bg-primary-500 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-lg hover:bg-[#E02849] transition font-medium text-xs sm:text-base flex-shrink-0"
            >
              <Plus size={16} className="sm:w-[18px] sm:h-[18px]" />
              <span className="hidden xs:inline">Agregar Dirección</span>
              <span className="xs:hidden">Agregar</span>
            </button>
          </div>
        </div>

        {addresses.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 sm:p-12 text-center">
            <MapPin className="mx-auto text-gray-400 mb-3 sm:mb-4" size={48} />
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
              No tienes direcciones guardadas
            </h3>
            <p className="text-gray-600 mb-4 sm:mb-6 text-sm sm:text-base">
              Agrega una dirección para solicitar servicios más rápido
            </p>
            <button
              onClick={() => handleOpenModal()}
              className="inline-flex items-center gap-2 bg-primary-500 text-white px-5 py-2.5 sm:px-6 sm:py-3 rounded-lg hover:bg-[#E02849] transition font-medium"
            >
              <Plus size={18} />
              <span className="hidden xs:inline">Agregar Primera Dirección</span>
              <span className="xs:hidden">Agregar</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {addresses.map((address) => (
              <div
                key={address.id}
                className={`bg-white rounded-xl shadow-sm p-6 border-2 transition ${
                  address.isPrimary ? 'border-primary-500' : 'border-transparent'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary-500/10 p-3 rounded-lg">
                      {address.label.toLowerCase().includes('casa') ? (
                        <Home className="text-primary-600" size={24} />
                      ) : (
                        <Building className="text-primary-600" size={24} />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        {address.label}
                        {address.isPrimary && (
                          <span className="inline-flex items-center gap-1 bg-primary-500 text-white text-xs px-2 py-1 rounded-full">
                            <Star size={12} fill="white" />
                            Principal
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {getCityBySlug(address.city)?.name || address.city}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenModal(address)}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(address.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-gray-700">
                  <p>
                    <span className="font-medium">Dirección:</span> {address.street} #{address.number}
                    {address.complement && ` - ${address.complement}`}
                  </p>
                  <p>
                    <span className="font-medium">Barrio:</span> {address.neighborhood}
                  </p>
                  {address.postalCode && (
                    <p>
                      <span className="font-medium">Código Postal:</span> {address.postalCode}
                    </p>
                  )}
                  {address.instructions && (
                    <p className="text-gray-600 italic">
                      <span className="font-medium not-italic">Instrucciones:</span> {address.instructions}
                    </p>
                  )}
                </div>

                {!address.isPrimary && (
                  <button
                    onClick={() => handleSetPrimary(address)}
                    className="mt-4 w-full text-sm text-primary-600 hover:bg-primary-500/5 py-2 rounded-lg transition font-medium"
                  >
                    Establecer como principal
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingAddress ? 'Editar Dirección' : 'Nueva Dirección'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Etiqueta <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="Ej: Casa, Oficina, Casa de mamá"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Calle/Carrera <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.street}
                    onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    placeholder="Ej: Calle 10, Carrera 43A"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Número <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    placeholder="Ej: 25-30, 15-20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Complemento
                </label>
                <input
                  type="text"
                  value={formData.complement}
                  onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="Ej: Apto 301, Interior 5, Torre B"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Barrio <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.neighborhood}
                    onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    placeholder="Ej: El Poblado, Chapinero"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ciudad <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  >
                    {cities.map((city) => (
                      <option
                        key={city.id}
                        value={city.slug}
                        disabled={city.status !== 'ACTIVE'}
                      >
                        {city.name}
                        {city.status === 'COMING_SOON'
                          ? ' (próximamente)'
                          : city.status === 'INACTIVE'
                          ? ' (no disponible)'
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Código Postal
                </label>
                <input
                  type="text"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="Ej: 050021"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instrucciones adicionales
                </label>
                <textarea
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  rows={3}
                  placeholder="Ej: Portón verde, timbre 301, al lado del supermercado"
                />
              </div>

              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="isPrimary"
                  checked={formData.isPrimary}
                  onChange={(e) => setFormData({ ...formData, isPrimary: e.target.checked })}
                  className="w-5 h-5 border-2 border-gray-300 rounded cursor-pointer checked:bg-primary-500 checked:border-primary-500"
                />
                <label htmlFor="isPrimary" className="text-sm text-gray-700 cursor-pointer">
                  Establecer como dirección principal
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-[#E02849] transition font-medium disabled:opacity-50"
                >
                  {submitting ? 'Guardando...' : editingAddress ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
