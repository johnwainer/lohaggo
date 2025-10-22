'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DollarSign, Clock, Star, CheckCircle, MapPin, Plus, Calendar, X, ChevronRight } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { formatCurrency } from '@/lib/utils'
import { CityId } from '@/lib/city-context'

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
  partners: Array<{
    id: string
    price: number
    partner: {
      id: string
      rating: number
      totalReviews: number
      verified: boolean
      user: {
        name: string
        phone: string
      }
    }
  }>
}

interface Address {
  id: string
  label: string
  street: string
  number: string
  complement?: string
  neighborhood: string
  city: CityId
  postalCode?: string
  instructions?: string
  isPrimary: boolean
}

const cityLabels: Record<CityId, string> = {
  MEDELLIN: 'Medellín',
  BOGOTA: 'Bogotá',
  CALI: 'Cali',
  BARRANQUILLA: 'Barranquilla'
}

export default function ServiceDetailPage({ params }: { params: { slug: string } }) {
  const { data: session } = useSession()
  const router = useRouter()
  const [service, setService] = useState<Service | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string>('')
  const [requestData, setRequestData] = useState({
    address: '',
    notes: '',
    preferredDate: '',
    preferredTime: '',
    isUrgent: false
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchService()
  }, [params.slug])

  const fetchService = async () => {
    try {
      const res = await fetch(`/api/services/${params.slug}`)
      const data = await res.json()
      setService(data)
    } catch (error) {
      console.error('Error fetching service:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBooking = () => {
    if (!session) {
      router.push('/login?redirect=/servicios/' + params.slug)
      return
    }
    fetchAddresses()
    // Open the new request modal
    setShowRequestModal(true)
  }

  // New function name for handling requests (kept for clarity/compatibility)
  const handleRequest = () => {
    if (!session) {
      router.push('/login?redirect=/servicios/' + params.slug)
      return
    }
    fetchAddresses()
    setCurrentStep(1)
    setShowRequestModal(true)
  }

  const fetchAddresses = async () => {
    try {
      const res = await fetch('/api/addresses')
      if (res.ok) {
        const data = await res.json()
        setAddresses(data)
        const primaryAddress = data.find((addr: Address) => addr.isPrimary)
        if (primaryAddress) {
          setSelectedAddressId(primaryAddress.id)
        } else if (data.length > 0) {
          setSelectedAddressId(data[0].id)
        } else {
          setSelectedAddressId('')
        }
      } else {
        setSelectedAddressId('')
      }
    } catch (error) {
      console.error('Error fetching addresses:', error)
      setSelectedAddressId('')
    }
  }

  const getAddressString = (address: Address) => {
    return `${address.street} #${address.number}${address.complement ? ' - ' + address.complement : ''}, ${address.neighborhood}, ${cityLabels[address.city]}`
  }

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!service) return

    let finalAddress = requestData.address
    let finalCity: CityId | string = 'MEDELLIN'

    // If an existing address is selected, use it
    if (selectedAddressId) {
      const selectedAddress = addresses.find(addr => addr.id === selectedAddressId)
      if (selectedAddress) {
        finalAddress = getAddressString(selectedAddress)
        finalCity = selectedAddress.city
      }
    }

    if (!finalAddress) {
      alert('Por favor selecciona o ingresa una dirección')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/service-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: service.id,
          address: finalAddress,
          notes: requestData.notes,
          preferredDate: requestData.preferredDate || null,
          preferredTime: requestData.preferredTime || null,
          isUrgent: requestData.isUrgent,
          city: finalCity
        })
      })

      if (res.ok) {
        alert('¡Solicitud creada exitosamente! Los profesionales disponibles recibirán tu solicitud.')
        router.push('/dashboard')
      } else {
        const error = await res.json()
        alert(error.error || 'Error al crear solicitud')
      }
    } catch (error) {
      console.error('Error creating booking:', error)
      alert('Error al crear reserva')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!service) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Servicio no encontrado</h1>
          <button
            onClick={() => router.push('/servicios')}
            className="text-primary-600 hover:underline"
          >
            Volver a servicios
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Service Header */}
        <div className="bg-white rounded-xl shadow-md p-8 mb-8">
          <div className="flex items-start gap-6">
            <div className="text-6xl">{service.icon}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-3xl font-bold">{service.name}</h1>
                <span className="bg-primary-100 text-primary-700 text-sm font-medium px-3 py-1 rounded-full">
                  {service.category.name}
                </span>
              </div>
              <p className="text-gray-600 text-lg mb-6">{service.description}</p>

              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <DollarSign className="text-primary-600" size={20} />
                  <span className="text-gray-700">
                    Desde <span className="font-bold text-primary-600">{formatCurrency(service.basePrice)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="text-primary-600" size={20} />
                  <span className="text-gray-700">
                    Duración: <span className="font-semibold">{service.duration} min</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="text-primary-600" size={20} />
                  <span className="text-gray-700">
                    <span className="font-semibold">{service.partners.length}</span> profesionales disponibles
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Booking Button */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold mb-2">¿Listo para solicitar?</h2>
              <p className="text-gray-600">Envía tu solicitud a múltiples profesionales</p>
            </div>
            <button
              onClick={handleRequest}
              className="bg-primary-600 text-white px-8 py-3 rounded-lg hover:bg-primary-700 transition font-medium"
            >
              Solicitar servicio
            </button>
          </div>
        </div>

        {/* Available Professionals */}
        {service.partners.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-8">
            <h2 className="text-2xl font-bold mb-6">Profesionales disponibles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {service.partners.map((partnerService) => (
                <div key={partnerService.id} className="border rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{partnerService.partner.user.name}</h3>
                      {partnerService.partner.verified && (
                        <span className="text-green-600 text-sm">✓ Verificado</span>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-yellow-500">
                        <Star size={16} fill="currentColor" />
                        <span className="font-semibold">{partnerService.partner.rating.toFixed(1)}</span>
                      </div>
                      <span className="text-gray-500 text-sm">
                        ({partnerService.partner.totalReviews} reseñas)
                      </span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-primary-600 font-bold text-xl">{formatCurrency(partnerService.price)}</p>
                  </div>


                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Request Modal - Modern Step by Step */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden animate-slideUp">
            {/* Header with Progress */}
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold">Solicitar {service.name}</h2>
                  <p className="text-primary-100 text-sm mt-1">Paso {currentStep} de 3</p>
                </div>
                <button
                  onClick={() => setShowRequestModal(false)}
                  className="text-white hover:bg-white/20 rounded-full p-2 transition"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Progress Bar */}
              <div className="flex gap-2">
                {[1, 2, 3].map((step) => (
                  <div
                    key={step}
                    className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                      step <= currentStep ? 'bg-white' : 'bg-white/30'
                    }`}
                  />
                ))}
              </div>
            </div>

            <form onSubmit={submitRequest}>
              <div className="p-6">
                {/* Step 1: Dirección */}
                {currentStep === 1 && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MapPin className="text-primary-600" size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">¿Dónde necesitas el servicio?</h3>
                      <p className="text-gray-600">Selecciona o ingresa la dirección</p>
                    </div>

                    {addresses.length > 0 ? (
                      <div className="space-y-3">
                        {addresses.map((addr) => (
                          <label
                            key={addr.id}
                            className={`flex items-start gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                              selectedAddressId === addr.id
                                ? 'border-primary-600 bg-primary-50'
                                : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="address"
                              value={addr.id}
                              checked={selectedAddressId === addr.id}
                              onChange={(e) => setSelectedAddressId(e.target.value)}
                              className="mt-1 w-5 h-5 text-primary-600"
                            />
                            <div className="flex-1">
                              <div className="font-semibold text-gray-900 mb-1">{addr.label}</div>
                              <div className="text-sm text-gray-600">{getAddressString(addr)}</div>
                            </div>
                          </label>
                        ))}
                        <button
                          type="button"
                          onClick={() => router.push('/dashboard/addresses')}
                          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-primary-600 hover:border-primary-600 hover:bg-primary-50 transition font-medium flex items-center justify-center gap-2"
                        >
                          <Plus size={20} />
                          Agregar nueva dirección
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="relative">
                          <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                          <input
                            type="text"
                            required
                            placeholder="Ej: Calle 123 #45-67, Barrio Centro, Medellín"
                            value={requestData.address}
                            onChange={(e) => setRequestData({ ...requestData, address: e.target.value })}
                            className="w-full pl-12 pr-4 py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition"
                          />
                        </div>
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-lg">💡</span>
                            </div>
                            <div>
                              <p className="text-sm text-blue-900 font-medium mb-2">
                                Guarda tus direcciones para solicitar servicios más rápido
                              </p>
                              <button
                                type="button"
                                onClick={() => router.push('/dashboard/addresses')}
                                className="text-sm text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-1"
                              >
                                <Plus size={14} />
                                Ir a mis direcciones
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 2: Fecha y Hora */}
                {currentStep === 2 && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Calendar className="text-primary-600" size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">¿Cuándo necesitas el servicio?</h3>
                      <p className="text-gray-600">Selecciona la urgencia o programa una fecha</p>
                    </div>

                    <div className="space-y-4">
                      {/* Opción Urgente */}
                      <label
                        className={`flex items-start gap-4 p-5 border-2 rounded-xl cursor-pointer transition-all ${
                          requestData.isUrgent
                            ? 'border-red-500 bg-red-50'
                            : 'border-gray-200 hover:border-red-300 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="urgency"
                          checked={requestData.isUrgent}
                          onChange={() => setRequestData({ ...requestData, isUrgent: true, preferredDate: '', preferredTime: '' })}
                          className="mt-1 w-5 h-5 text-red-600"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl">⚡</span>
                            <span className="font-bold text-gray-900">Lo más pronto posible</span>
                          </div>
                          <p className="text-sm text-gray-600">Necesito el servicio urgentemente</p>
                        </div>
                      </label>

                      {/* Opción Programada */}
                      <label
                        className={`flex items-start gap-4 p-5 border-2 rounded-xl cursor-pointer transition-all ${
                          !requestData.isUrgent
                            ? 'border-primary-600 bg-primary-50'
                            : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="urgency"
                          checked={!requestData.isUrgent}
                          onChange={() => setRequestData({ ...requestData, isUrgent: false })}
                          className="mt-1 w-5 h-5 text-primary-600"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-2xl">📅</span>
                            <span className="font-bold text-gray-900">Programar fecha y hora</span>
                          </div>

                          {!requestData.isUrgent && (
                            <div className="space-y-3 mt-4" onClick={(e) => e.stopPropagation()}>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Fecha</label>
                                <div className="relative">
                                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                                  <input
                                    type="date"
                                    required={!requestData.isUrgent}
                                    min={new Date().toISOString().split('T')[0]}
                                    value={requestData.preferredDate}
                                    onChange={(e) => setRequestData({ ...requestData, preferredDate: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Hora</label>
                                <div className="relative">
                                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                                  <input
                                    type="time"
                                    required={!requestData.isUrgent}
                                    value={requestData.preferredTime}
                                    onChange={(e) => setRequestData({ ...requestData, preferredTime: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Step 3: Detalles y Confirmación */}
                {currentStep === 3 && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="text-primary-600" size={32} />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Detalles adicionales</h3>
                      <p className="text-gray-600">Cuéntanos más sobre lo que necesitas</p>
                    </div>

                    {/* Resumen */}
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5 space-y-3">
                      <h4 className="font-semibold text-gray-900 mb-3">Resumen de tu solicitud</h4>

                      <div className="flex items-start gap-3">
                        <MapPin className="text-primary-600 mt-0.5" size={18} />
                        <div>
                          <p className="text-sm font-medium text-gray-700">Dirección</p>
                          <p className="text-sm text-gray-600">
                            {selectedAddressId
                              ? getAddressString(addresses.find(a => a.id === selectedAddressId)!)
                              : requestData.address}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Calendar className="text-primary-600 mt-0.5" size={18} />
                        <div>
                          <p className="text-sm font-medium text-gray-700">Fecha y hora</p>
                          <p className="text-sm text-gray-600">
                            {requestData.isUrgent ? (
                              <span className="text-red-600 font-medium">⚡ Lo más pronto posible</span>
                            ) : (
                              `${new Date(requestData.preferredDate).toLocaleDateString('es-ES', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long'
                              })} a las ${requestData.preferredTime}`
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Notas */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Detalles adicionales (opcional)
                      </label>
                      <textarea
                        rows={4}
                        placeholder="Describe los detalles específicos: medidas, materiales, problemas específicos, etc."
                        value={requestData.notes}
                        onChange={(e) => setRequestData({ ...requestData, notes: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
                      />
                    </div>

                    {/* Info Box */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <CheckCircle className="text-white" size={18} />
                        </div>
                        <div>
                          <h4 className="font-semibold text-blue-900 mb-2">¿Cómo funciona?</h4>
                          <ul className="text-blue-800 text-sm space-y-1.5">
                            <li className="flex items-start gap-2">
                              <span className="text-blue-600 mt-0.5">✓</span>
                              <span>Tu solicitud llega a todos los profesionales disponibles</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-blue-600 mt-0.5">✓</span>
                              <span>Recibirás propuestas con diferentes precios</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-blue-600 mt-0.5">✓</span>
                              <span>Elige la propuesta que más te convenga</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-blue-600 mt-0.5">✓</span>
                              <span>Coordina los detalles finales con el profesional</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer with Navigation */}
              <div className="border-t bg-gray-50 px-6 py-4">
                <div className="flex gap-3">
                  {currentStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setCurrentStep(currentStep - 1)}
                      className="px-6 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-100 transition font-medium text-gray-700 flex items-center gap-2"
                      disabled={submitting}
                    >
                      <ChevronRight size={20} className="rotate-180" />
                      Anterior
                    </button>
                  )}

                  {currentStep < 3 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (currentStep === 1) {
                          if (addresses.length > 0 && !selectedAddressId) {
                            alert('Por favor selecciona una dirección')
                            return
                          }
                          if (addresses.length === 0 && !requestData.address) {
                            alert('Por favor ingresa una dirección')
                            return
                          }
                        }
                        if (currentStep === 2) {
                          if (!requestData.isUrgent && (!requestData.preferredDate || !requestData.preferredTime)) {
                            alert('Por favor selecciona fecha y hora o marca como urgente')
                            return
                          }
                        }
                        setCurrentStep(currentStep + 1)
                      }}
                      className="flex-1 bg-primary-600 text-white px-6 py-3 rounded-xl hover:bg-primary-700 transition font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary-600/30"
                    >
                      Continuar
                      <ChevronRight size={20} />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 bg-gradient-to-r from-primary-600 to-primary-700 text-white px-6 py-3 rounded-xl hover:from-primary-700 hover:to-primary-800 transition font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <CheckCircle size={20} />
                          Enviar solicitud
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
