'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DollarSign, Clock, Star, CheckCircle, MapPin, Plus, Calendar, X, ChevronRight, Camera, Upload, Trash2, Shield, CreditCard, GraduationCap, ShieldCheck } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { formatCurrency } from '@/lib/utils'
import { useCity } from '@/lib/city-context'
import ConfirmModal from '@/components/ConfirmModal'

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
      documents?: Array<{
        type: string
        status: string
      }>
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
  city: string
  postalCode?: string
  instructions?: string
  isPrimary: boolean
}

export default function ServiceDetailPage({ params }: { params: { slug: string } }) {
  const { slug } = params
  const { data: session } = useSession()
  const router = useRouter()
  const { getCityBySlug } = useCity()
  const [service, setService] = useState<Service | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string>('')
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [requestData, setRequestData] = useState({
    address: '',
    notes: '',
    preferredDate: '',
    preferredTime: '',
    isUrgent: false
  })
  const [submitting, setSubmitting] = useState(false)
  const [validationModal, setValidationModal] = useState({
    isOpen: false,
    message: ''
  })
  const [successModal, setSuccessModal] = useState({
    isOpen: false,
    message: '',
    type: 'success' as 'success' | 'error'
  })

  useEffect(() => {
    fetchService()
  }, [slug])

  const fetchService = async () => {
    try {
      const res = await fetch(`/api/services/${slug}`)
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
      router.push('/login?redirect=/servicios/' + slug)
      return
    }
    fetchAddresses()
    // Open the new request modal
    setShowRequestModal(true)
  }

  // New function name for handling requests (kept for clarity/compatibility)
  const handleRequest = () => {
    if (!session) {
      router.push('/login?redirect=/servicios/' + slug)
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
    const cityName = getCityBySlug(address.city)?.name || address.city
    return `${address.street} #${address.number}${address.complement ? ' - ' + address.complement : ''}, ${address.neighborhood}, ${cityName}`
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length + photos.length > 5) {
      setValidationModal({
        isOpen: true,
        message: 'Puedes subir máximo 5 fotos'
      })
      return
    }

    setPhotos([...photos, ...files])

    files.forEach(file => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreviews(prev => [...prev, reader.result as string])
      }
      reader.readAsDataURL(file)
    })
  }

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index))
    setPhotoPreviews(photoPreviews.filter((_, i) => i !== index))
  }

  const submitRequest = async () => {
    if (!service) return

    let finalAddress = requestData.address
    let finalCity = ''

    if (selectedAddressId) {
      const selectedAddress = addresses.find(addr => addr.id === selectedAddressId)
      if (selectedAddress) {
        finalAddress = getAddressString(selectedAddress)
        finalCity = selectedAddress.city
      }
    }

    if (!finalAddress) {
      setValidationModal({
        isOpen: true,
        message: 'Por favor selecciona o ingresa una dirección'
      })
      return
    }

    setSubmitting(true)
    try {
      let photoUrls: string[] = []

      if (photos.length > 0) {
        const formData = new FormData()
        photos.forEach((photo) => {
          formData.append('photos', photo)
        })

        const uploadRes = await fetch('/api/upload-photos', {
          method: 'POST',
          body: formData
        })

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json()
          photoUrls = uploadData.urls
        } else {
          throw new Error('Error al subir las fotos')
        }
      }

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
          city: finalCity,
          photoUrls
        })
      })

      if (res.ok) {
        setSuccessModal({
          isOpen: true,
          message: '¡Solicitud creada exitosamente! Los profesionales disponibles recibirán tu solicitud.',
          type: 'success'
        })
      } else {
        const error = await res.json()
        setSuccessModal({
          isOpen: true,
          message: error.error || 'Error al crear solicitud',
          type: 'error'
        })
      }
    } catch (error) {
      console.error('Error creating booking:', error)
      setSuccessModal({
        isOpen: true,
        message: 'Error al crear reserva',
        type: 'error'
      })
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

  const getVerificationBadges = (documents?: Array<{ type: string; status: string }>) => {
    if (!documents || documents.length === 0) return null

    const IDENTITY_TYPES = ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP']
    const EDUCATION_TYPES = ['DIPLOMA_BACHILLERATO', 'DIPLOMA_TECNICO', 'DIPLOMA_TECNOLOGO', 'DIPLOMA_PROFESIONAL', 'DIPLOMA_POSGRADO', 'CERTIFICADO_CURSO']

    const hasIdentity = documents.some(d => IDENTITY_TYPES.includes(d.type) && d.status === 'APPROVED')
    const hasEducation = documents.some(d => EDUCATION_TYPES.includes(d.type) && d.status === 'APPROVED')
    const hasBackground = documents.some(d => d.type === 'ANTECEDENTES' && d.status === 'APPROVED')

    return (
      <div className="flex items-center gap-2 mt-2">
        {hasIdentity && (
          <div className="group relative flex items-center gap-1 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-medium border border-blue-200">
            <CreditCard size={14} />
            <span>ID</span>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg z-10">
              Identidad verificada
            </span>
          </div>
        )}
        {hasEducation && (
          <div className="group relative flex items-center gap-1 bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full text-xs font-medium border border-purple-200">
            <GraduationCap size={14} />
            <span>EDU</span>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg z-10">
              Educación verificada
            </span>
          </div>
        )}
        {hasBackground && (
          <div className="group relative flex items-center gap-1 bg-green-50 text-green-700 px-2.5 py-1 rounded-full text-xs font-medium border border-green-200">
            <Shield size={14} />
            <span>ANT</span>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg z-10">
              Antecedentes verificados
            </span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {/* Service Header */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-8 mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row items-start gap-4 md:gap-6">
            <div className="emoji-icon" style={{ fontSize: '3em' }}>{service.icon}</div>
            <div className="flex-1 w-full">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3 md:mb-2">
                <h1 className="text-2xl md:text-3xl font-bold">{service.name}</h1>
                <span className="bg-primary-100 text-primary-700 text-xs md:text-sm font-medium px-3 py-1 rounded-full w-fit">
                  {service.category.name}
                </span>
              </div>
              <p className="text-gray-600 text-base md:text-lg mb-4 md:mb-6">{service.description}</p>

              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 md:gap-6">
                <div className="flex items-center gap-2">
                  <DollarSign className="text-primary-600" size={18} />
                  <span className="text-sm md:text-base text-gray-700">
                    Desde <span className="font-bold text-primary-600">{formatCurrency(service.basePrice)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="text-primary-600" size={18} />
                  <span className="text-sm md:text-base text-gray-700">
                    Duración: <span className="font-semibold">{service.duration} min</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="text-primary-600" size={18} />
                  <span className="text-sm md:text-base text-gray-700">
                    <span className="font-semibold">{service.partners.length}</span> profesionales disponibles
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Booking Button */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-6 mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg md:text-xl font-bold mb-1 md:mb-2">¿Listo para solicitar?</h2>
              <p className="text-sm md:text-base text-gray-600">Envía tu solicitud a múltiples profesionales</p>
            </div>
            <button
              onClick={handleRequest}
              className="w-full sm:w-auto bg-secondary-500 text-white px-6 md:px-8 py-3 rounded-lg hover:bg-secondary-600 transition font-medium text-sm md:text-base"
            >
              Solicitar servicio
            </button>
          </div>
        </div>

        {/* Available Professionals */}
        {service.partners.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-4 md:p-8">
            <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Profesionales disponibles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {service.partners.map((partnerService) => (
                <div
                  key={partnerService.id}
                  className="border rounded-lg p-4 md:p-6 flex flex-col md:block"
                >
                  <div className="flex items-start justify-between mb-3 md:mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-base md:text-lg">{partnerService.partner.user.name}</h3>
                        {partnerService.partner.verified && (
                          <div className="group relative">
                            <ShieldCheck size={16} className="text-green-600" />
                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg z-10">
                              Socio verificado
                            </span>
                          </div>
                        )}
                      </div>
                      {getVerificationBadges(partnerService.partner.documents)}
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-yellow-500 justify-end">
                        <Star size={14} fill="currentColor" className="md:w-4 md:h-4" />
                        <span className="font-semibold text-sm md:text-base">{partnerService.partner.rating.toFixed(1)}</span>
                      </div>
                      <span className="text-gray-500 text-xs md:text-sm">
                        ({partnerService.partner.totalReviews} reseñas)
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 md:mt-0 mb-3 md:mb-4">
                    <p className="text-primary-600 font-bold text-lg md:text-xl">{formatCurrency(partnerService.price)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-[#FF2D55] to-[#FF6900] p-4 md:p-6 text-white">
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold">Solicitar {service.name}</h2>
                  <p className="text-orange-100 text-xs md:text-sm mt-1">Paso {currentStep} de 4</p>
                </div>
                <button
                  onClick={() => setShowRequestModal(false)}
                  className="text-white hover:bg-white/20 rounded-full p-2 transition"
                >
                  <X size={20} className="md:w-6 md:h-6" />
                </button>
              </div>

              {/* Progress Bar */}
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`h-1.5 md:h-2 flex-1 rounded-full transition-all duration-300 ${step <= currentStep ? 'bg-white' : 'bg-white/30'
                      }`}
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="p-4 md:p-6">
                {/* Step 1: Dirección */}
                {currentStep === 1 && (
                  <div className="space-y-4 md:space-y-6 animate-fadeIn">
                    <div className="text-center mb-4 md:mb-6">
                      <div className="w-14 h-14 md:w-16 md:h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                        <MapPin className="text-[#FF6900]" size={28} />
                      </div>
                      <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2">¿Dónde necesitas el servicio?</h3>
                      <p className="text-sm md:text-base text-gray-600">Selecciona o ingresa la dirección</p>
                    </div>

                    {addresses.length > 0 ? (
                      <div className="space-y-3">
                        {addresses.map((addr) => (
                          <label
                            key={addr.id}
                            className={`flex items-start gap-3 md:gap-4 p-3 md:p-4 border-2 rounded-xl cursor-pointer transition-all ${selectedAddressId === addr.id
                              ? 'border-[#FF6900] bg-orange-50'
                              : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
                              }`}
                          >
                            <input
                              type="radio"
                              name="address"
                              value={addr.id}
                              checked={selectedAddressId === addr.id}
                              onChange={(e) => setSelectedAddressId(e.target.value)}
                              className="mt-1 w-4 h-4 md:w-5 md:h-5 text-[#FF6900]"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm md:text-base text-gray-900 mb-1">{addr.label}</div>
                              <div className="text-xs md:text-sm text-gray-600 break-words">{getAddressString(addr)}</div>
                            </div>
                          </label>
                        ))}
                        <button
                          type="button"
                          onClick={() => router.push('/dashboard/addresses')}
                          className="w-full py-2.5 md:py-3 border-2 border-dashed border-gray-300 rounded-xl text-[#FF6900] hover:border-[#FF6900] hover:bg-orange-50 transition font-medium flex items-center justify-center gap-2 text-sm md:text-base"
                        >
                          <Plus size={18} />
                          Agregar nueva dirección
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="relative">
                          <MapPin className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                          <input
                            type="text"
                            placeholder="Ej: Calle 123 #45-67, Barrio Centro"
                            value={requestData.address}
                            onChange={(e) => setRequestData({ ...requestData, address: e.target.value })}
                            className="w-full pl-10 md:pl-12 pr-4 py-3 md:py-4 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#FF6900] focus:border-[#FF6900] outline-none transition text-sm md:text-base"
                          />
                        </div>
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3 md:p-4">
                          <div className="flex items-start gap-2 md:gap-3">
                            <div className="w-7 h-7 md:w-8 md:h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-base md:text-lg">💡</span>
                            </div>
                            <div>
                              <p className="text-xs md:text-sm text-blue-900 font-medium mb-2">
                                Guarda tus direcciones para solicitar servicios más rápido
                              </p>
                              <button
                                type="button"
                                onClick={() => router.push('/dashboard/addresses')}
                                className="text-xs md:text-sm text-[#FF6900] hover:text-[#FF5900] font-semibold flex items-center gap-1"
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
                  <div className="space-y-4 md:space-y-6 animate-fadeIn">
                    <div className="text-center mb-4 md:mb-6">
                      <div className="w-14 h-14 md:w-16 md:h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                        <Calendar className="text-[#FF6900]" size={28} />
                      </div>
                      <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2">¿Cuándo necesitas el servicio?</h3>
                      <p className="text-sm md:text-base text-gray-600">Selecciona la urgencia o programa una fecha</p>
                    </div>

                    <div className="space-y-4">
                      {/* Opción Urgente */}
                      <label
                        className={`flex items-start gap-3 md:gap-4 p-4 md:p-5 border-2 rounded-xl cursor-pointer transition-all ${requestData.isUrgent
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 hover:border-red-300 hover:bg-gray-50'
                          }`}
                      >
                        <input
                          type="radio"
                          name="urgency"
                          checked={requestData.isUrgent}
                          onChange={() => setRequestData({ ...requestData, isUrgent: true, preferredDate: '', preferredTime: '' })}
                          className="mt-1 w-4 h-4 md:w-5 md:h-5 text-red-600"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl md:text-2xl">⚡</span>
                            <span className="font-bold text-sm md:text-base text-gray-900">Lo más pronto posible</span>
                          </div>
                          <p className="text-xs md:text-sm text-gray-600">Necesito el servicio urgentemente</p>
                        </div>
                      </label>

                      {/* Opción Programada */}
                      <label
                        className={`flex items-start gap-3 md:gap-4 p-4 md:p-5 border-2 rounded-xl cursor-pointer transition-all ${!requestData.isUrgent
                          ? 'border-[#FF6900] bg-orange-50'
                          : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
                          }`}
                      >
                        <input
                          type="radio"
                          name="urgency"
                          checked={!requestData.isUrgent}
                          onChange={() => setRequestData({ ...requestData, isUrgent: false })}
                          className="mt-1 w-4 h-4 md:w-5 md:h-5 text-[#FF6900]"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xl md:text-2xl">📅</span>
                            <span className="font-bold text-sm md:text-base text-gray-900">Programar fecha y hora</span>
                          </div>

                          {!requestData.isUrgent && (
                            <div className="space-y-3 mt-4" onClick={(e) => e.stopPropagation()}>
                              <div>
                                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">Fecha</label>
                                <div className="relative">
                                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                                  <input
                                    type="date"
                                    min={new Date().toISOString().split('T')[0]}
                                    value={requestData.preferredDate}
                                    onChange={(e) => setRequestData({ ...requestData, preferredDate: e.target.value })}
                                    className="w-full pl-9 md:pl-10 pr-3 md:pr-4 py-2.5 md:py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6900] focus:border-[#FF6900] outline-none text-sm md:text-base"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs md:text-sm font-medium text-gray-700 mb-2">Hora</label>
                                <div className="relative">
                                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                                  <input
                                    type="time"
                                    value={requestData.preferredTime}
                                    onChange={(e) => setRequestData({ ...requestData, preferredTime: e.target.value })}
                                    className="w-full pl-9 md:pl-10 pr-3 md:pr-4 py-2.5 md:py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6900] focus:border-[#FF6900] outline-none text-sm md:text-base"
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
                  <div className="space-y-3 md:space-y-6 animate-fadeIn">
                    <div className="text-center mb-3 md:mb-6">
                      <div className="w-12 h-12 md:w-16 md:h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-2 md:mb-4">
                        <CheckCircle className="text-[#FF6900]" size={24} />
                      </div>
                      <h3 className="text-base md:text-xl font-bold text-gray-900 mb-1 md:mb-2">Detalles adicionales</h3>
                      <p className="text-xs md:text-base text-gray-600">Cuéntanos más sobre lo que necesitas</p>
                    </div>

                    {/* Resumen */}
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-3 md:p-5 space-y-2 md:space-y-3">
                      <h4 className="font-semibold text-sm md:text-base text-gray-900 mb-2 md:mb-3">Resumen de tu solicitud</h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                        <div className="flex items-start gap-2">
                          <MapPin className="text-[#FF6900] mt-0.5 flex-shrink-0" size={14} />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-700">Dirección</p>
                            <p className="text-xs text-gray-600 break-words">
                              {selectedAddressId
                                ? getAddressString(addresses.find(a => a.id === selectedAddressId)!)
                                : requestData.address || 'No especificada'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2">
                          <Calendar className="text-[#FF6900] mt-0.5 flex-shrink-0" size={14} />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-700">Fecha y hora</p>
                            <p className="text-xs text-gray-600">
                              {requestData.isUrgent ? (
                                <span className="text-red-600 font-medium">⚡ Lo más pronto posible</span>
                              ) : (
                                requestData.preferredDate
                                  ? `${new Date(requestData.preferredDate).toLocaleDateString('es-ES', {
                                    weekday: 'long',
                                    day: 'numeric',
                                    month: 'long'
                                  })} a las ${requestData.preferredTime || '—'}`
                                  : 'No especificada'
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Notas */}
                    <div>
                      <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1.5 md:mb-2">
                        Detalles adicionales (opcional)
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Describe los detalles específicos: medidas, materiales, problemas específicos, etc."
                        value={requestData.notes}
                        onChange={(e) => setRequestData({ ...requestData, notes: e.target.value })}
                        className="w-full px-3 md:px-4 py-2 md:py-3 border-2 border-orange-200 bg-orange-50 text-orange-900 rounded-xl focus:ring-2 focus:ring-[#FF6900] focus:border-[#FF6900] outline-none resize-none text-xs md:text-base"
                      />
                    </div>
                  </div>
                )}

                {/* Step 4: Fotos */}
                {currentStep === 4 && (
                  <div className="space-y-4 md:space-y-6 animate-fadeIn">
                    <div className="text-center mb-4 md:mb-6">
                      <div className="w-14 h-14 md:w-16 md:h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                        <Camera className="text-[#FF6900]" size={28} />
                      </div>
                      <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-2">Agrega fotos (opcional)</h3>
                      <p className="text-sm md:text-base text-gray-600">Ayuda a los profesionales a entender mejor tu necesidad</p>
                    </div>

                    {/* Upload Area */}
                    <div className="space-y-4">
                      <label className="block">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handlePhotoChange}
                          className="hidden"
                          disabled={photos.length >= 5}
                        />
                        <div className={`border-2 border-dashed rounded-xl p-6 md:p-8 text-center cursor-pointer transition-all ${photos.length >= 5
                          ? 'border-gray-300 bg-gray-100 cursor-not-allowed'
                          : 'border-[#FF6900] bg-orange-50 hover:bg-orange-100'
                          }`}>
                          <Upload className={`mx-auto mb-3 ${photos.length >= 5 ? 'text-gray-400' : 'text-[#FF6900]'}`} size={32} />
                          <p className={`font-semibold mb-1 ${photos.length >= 5 ? 'text-gray-500' : 'text-gray-900'}`}>
                            {photos.length >= 5 ? 'Máximo de fotos alcanzado' : 'Haz clic para subir fotos'}
                          </p>
                          <p className="text-sm text-gray-600">
                            {photos.length >= 5 ? 'Ya has subido 5 fotos' : `Puedes subir hasta ${5 - photos.length} foto(s) más`}
                          </p>
                        </div>
                      </label>

                      {/* Photo Previews */}
                      {photoPreviews.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                          {photoPreviews.map((preview, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={preview}
                                alt={`Preview ${index + 1}`}
                                className="w-full h-32 md:h-40 object-cover rounded-lg border-2 border-gray-200"
                              />
                              <button
                                type="button"
                                onClick={() => removePhoto(index)}
                                className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Info Box */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-3 md:p-5">
                      <div className="flex items-start gap-2 md:gap-3">
                        <div className="w-6 h-6 md:w-8 md:h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                          <Camera className="text-white" size={14} />
                        </div>
                        <div>
                          <h4 className="font-semibold text-xs md:text-base text-blue-900 mb-1.5 md:mb-2">¿Por qué agregar fotos?</h4>
                          <ul className="text-blue-800 text-xs md:text-sm space-y-1">
                            <li className="flex items-start gap-1.5">
                              <span className="text-blue-600 mt-0.5 text-xs">✓</span>
                              <span>Los profesionales entenderán mejor tu necesidad</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <span className="text-blue-600 mt-0.5 text-xs">✓</span>
                              <span>Recibirás propuestas más precisas</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                              <span className="text-blue-600 mt-0.5 text-xs">✓</span>
                              <span>Evitarás malentendidos sobre el trabajo</span>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer with Navigation */}
              <div className="border-t bg-gray-50 px-4 md:px-6 py-3 md:py-4">
                <div className="flex gap-2 md:gap-3">
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

                  {currentStep < 4 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (currentStep === 1) {
                          if (addresses.length > 0 && !selectedAddressId) {
                            setValidationModal({
                              isOpen: true,
                              message: 'Por favor selecciona una dirección'
                            })
                            return
                          }
                          if (addresses.length === 0 && !requestData.address) {
                            setValidationModal({
                              isOpen: true,
                              message: 'Por favor ingresa una dirección'
                            })
                            return
                          }
                        }
                        if (currentStep === 2) {
                          if (!requestData.isUrgent && (!requestData.preferredDate || !requestData.preferredTime)) {
                            setValidationModal({
                              isOpen: true,
                              message: 'Por favor selecciona fecha y hora o marca como urgente'
                            })
                            return
                          }
                        }
                        setCurrentStep(currentStep + 1)
                      }}
                      className="flex-1 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl hover:from-[#FF1D45] hover:to-[#FF5900] transition font-semibold flex items-center justify-center gap-2 shadow-lg shadow-orange-600/30 text-sm md:text-base"
                    >
                      Continuar
                      <ChevronRight size={18} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={submitRequest}
                      disabled={submitting}
                      className="flex-1 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl hover:from-[#FF1D45] hover:to-[#FF5900] transition font-semibold flex items-center justify-center gap-2 shadow-lg shadow-orange-600/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
                    >
                      {submitting ? (
                        <>
                          <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <CheckCircle size={18} />
                          Enviar solicitud
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={validationModal.isOpen}
        onClose={() => setValidationModal({ isOpen: false, message: '' })}
        onConfirm={() => setValidationModal({ isOpen: false, message: '' })}
        title="Atención"
        message={validationModal.message}
        confirmText="Entendido"
        type="warning"
      />

      <ConfirmModal
        isOpen={successModal.isOpen}
        onClose={() => {
          setSuccessModal({ isOpen: false, message: '', type: 'success' })
          if (successModal.type === 'success') {
            router.push('/dashboard')
          }
        }}
        onConfirm={() => {
          setSuccessModal({ isOpen: false, message: '', type: 'success' })
          if (successModal.type === 'success') {
            router.push('/dashboard')
          }
        }}
        title={successModal.type === 'success' ? '¡Éxito!' : 'Error'}
        message={successModal.message}
        confirmText="Entendido"
        type={successModal.type}
      />
    </div>
  )
}
