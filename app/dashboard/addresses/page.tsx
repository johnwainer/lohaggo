'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import {
  MapPin, Plus, Edit2, Trash2, Home, Building, Star, ArrowLeft
} from 'lucide-react'
import { useCity } from '@/lib/city-context'
import AccountTopHeader from '@/components/shared/AccountTopHeader'
import AccountPanel from '@/components/shared/AccountPanel'
import ConfirmModal from '@/components/ConfirmModal'
import { useDialog } from '@/components/ui/use-dialog'

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
  const { cities, getCityBySlug } = useCity()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)
  const [deleting, setDeleting] = useState<Address | null>(null)
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
    if (status === 'authenticated') {
      fetchAddresses()
    }
  }, [status])

  // The select's values are city slugs ('medellin'): the default must be one of them
  const defaultCitySlug = (cities.find(c => c.status === 'ACTIVE') || cities[0])?.slug || ''

  useEffect(() => {
    if (defaultCitySlug && !formData.city) {
      setFormData(prev => ({ ...prev, city: defaultCitySlug }))
    }
  }, [defaultCitySlug, formData.city])

  const { dialogProps, titleId } = useDialog(showModal, () => handleCloseModal())

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
        city: defaultCitySlug,
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
      <div className="panel-page min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="account-shell">
      <AccountTopHeader
        role="CLIENT"
        title="Mis Direcciones"
        subtitle="Administra tus direcciones de servicio"
        action={
          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="flex min-h-[44px] items-center gap-1.5 sm:gap-2 rounded-full bg-primary-600 px-3 sm:px-4 py-2 text-white hover:bg-primary-700 transition font-semibold text-sm whitespace-nowrap"
          >
            <Plus size={16} className="sm:w-[18px] sm:h-[18px]" aria-hidden="true" />
            <span className="hidden sm:inline">Agregar Dirección</span>
            <span className="sm:hidden">Agregar</span>
          </button>
        }
      />

      <div className="account-main">

        {addresses.length === 0 ? (
          <AccountPanel className="text-center">
            <MapPin className="mx-auto text-gray-500 mb-3 sm:mb-4" size={48} aria-hidden="true" />
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
              No tienes direcciones guardadas
            </h2>
            <p className="text-gray-600 mb-4 sm:mb-6 text-sm sm:text-base">
              Agrega una dirección para solicitar servicios más rápido
            </p>
            <button
              type="button"
              onClick={() => handleOpenModal()}
              className="inline-flex min-h-[44px] items-center gap-2 bg-primary-600 text-white px-5 py-2.5 sm:px-6 sm:py-3 rounded-full hover:bg-primary-700 transition font-medium"
            >
              <Plus size={18} aria-hidden="true" />
              <span className="hidden xs:inline">Agregar Primera Dirección</span>
              <span className="xs:hidden">Agregar</span>
            </button>
          </AccountPanel>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {addresses.map((address) => (
              <div
                key={address.id}
                className={`surface-card p-6 border-2 transition ${
                  address.isPrimary ? 'border-primary-500' : 'border-slate-200'
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
                      <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                        {address.label}
                        {address.isPrimary && (
                          <span className="inline-flex items-center gap-1 bg-primary-500 text-white text-xs px-2 py-1 rounded-full">
                            <Star size={12} fill="white" aria-hidden="true" />
                            Principal
                          </span>
                        )}
                      </h2>
                      <p className="text-sm text-gray-600">
                        {getCityBySlug(address.city)?.name || address.city}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenModal(address)}
                      aria-label={`Editar dirección ${address.label}`}
                      className="inline-flex h-11 w-11 items-center justify-center text-gray-700 hover:bg-gray-100 rounded-full transition"
                    >
                      <Edit2 size={18} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(address)}
                      aria-label={`Eliminar dirección ${address.label}`}
                      className="inline-flex h-11 w-11 items-center justify-center text-red-700 hover:bg-red-50 rounded-full transition"
                    >
                      <Trash2 size={18} aria-hidden="true" />
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
                    type="button"
                    onClick={() => handleSetPrimary(address)}
                    className="mt-4 min-h-[44px] w-full text-sm text-primary-700 hover:bg-primary-500/5 py-2 rounded-full transition font-medium"
                  >
                    Establecer como principal
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => { if (deleting) void handleDelete(deleting.id) }}
        title="Eliminar dirección"
        message={deleting ? `¿Eliminar la dirección «${deleting.label}»? No podrás recuperarla.` : ''}
        confirmText="Sí, eliminar"
        cancelText="No, mantener"
        type="danger"
      />

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
          <button type="button" aria-label="Cerrar" tabIndex={-1} onClick={handleCloseModal} className="absolute inset-0 cursor-default bg-slate-900/50" />
          <div {...dialogProps} className="relative bg-white rounded-t-3xl sm:rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto outline-none">
            <div className="sticky top-0 z-10 bg-white border-b px-4 sm:px-6 py-3 flex items-center gap-2">
              <button
                type="button"
                onClick={handleCloseModal}
                aria-label="Volver"
                className="inline-flex h-11 w-11 items-center justify-center hover:bg-gray-100 rounded-full transition"
              >
                <ArrowLeft size={24} aria-hidden="true" />
              </button>
              <h2 id={titleId} className="text-xl sm:text-2xl font-bold text-gray-900">
                {editingAddress ? 'Editar dirección' : 'Nueva dirección'}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div role="alert" className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="address-label" className="block text-sm font-medium text-gray-700 mb-2">
                  Etiqueta <span className="text-red-700" aria-hidden="true">*</span>
                </label>
                <input
                  type="text"
                  required
                  id="address-label"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="Ej: Casa, Oficina, Casa de mamá"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="address-street" className="block text-sm font-medium text-gray-700 mb-2">
                    Calle/Carrera <span className="text-red-700" aria-hidden="true">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    id="address-street"
                  value={formData.street}
                    onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    placeholder="Ej: Calle 10, Carrera 43A"
                  />
                </div>

                <div>
                  <label htmlFor="address-number" className="block text-sm font-medium text-gray-700 mb-2">
                    Número <span className="text-red-700" aria-hidden="true">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    id="address-number"
                  value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    placeholder="Ej: 25-30, 15-20"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="address-complement" className="block text-sm font-medium text-gray-700 mb-2">
                  Complemento
                </label>
                <input
                  type="text"
                  id="address-complement"
                  value={formData.complement}
                  onChange={(e) => setFormData({ ...formData, complement: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="Ej: Apto 301, Interior 5, Torre B"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="address-neighborhood" className="block text-sm font-medium text-gray-700 mb-2">
                    Barrio <span className="text-red-700" aria-hidden="true">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    id="address-neighborhood"
                  value={formData.neighborhood}
                    onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    placeholder="Ej: El Poblado, Chapinero"
                  />
                </div>

                <div>
                  <label htmlFor="address-city" className="block text-sm font-medium text-gray-700 mb-2">
                    Ciudad <span className="text-red-700" aria-hidden="true">*</span>
                  </label>
                  <select
                    required
                    id="address-city"
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
                <label htmlFor="address-postalCode" className="block text-sm font-medium text-gray-700 mb-2">
                  Código Postal
                </label>
                <input
                  type="text"
                  id="address-postalCode"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  placeholder="Ej: 050021"
                />
              </div>

              <div>
                <label htmlFor="address-instructions" className="block text-sm font-medium text-gray-700 mb-2">
                  Instrucciones adicionales
                </label>
                <textarea
                  id="address-instructions"
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
                  className="flex-1 min-h-[44px] px-6 py-3 border border-gray-300 text-gray-700 rounded-full hover:bg-gray-50 transition font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 min-h-[44px] px-6 py-3 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition font-medium disabled:opacity-50"
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
