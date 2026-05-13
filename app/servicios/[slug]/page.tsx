'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { flushSync } from 'react-dom'
import { DollarSign, Clock, Star, CheckCircle, MapPin, Plus, Calendar, X, ChevronRight, Camera, Upload, Trash2, Shield, CreditCard, GraduationCap, ShieldCheck, UserPlus, Bell, Briefcase, TrendingUp, Users, Sparkles, Heart } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { formatCurrency } from '@/lib/utils'
import { useCity } from '@/lib/city-context'
import ConfirmModal from '@/components/ConfirmModal'
import AdBanner from '@/components/ads/AdBanner'
import ServiceDetailTour from '@/components/ServiceDetailTour'
import PlatformTrustBanner from '@/components/PlatformTrustBanner'

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
      completedServicesCount: number
      verified: boolean
      user: {
        name: string
        phone: string
        image: string | null
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

export default function ServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const { getCityBySlug } = useCity()
  const [service, setService] = useState<Service | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string>('')
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('')
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [requestData, setRequestData] = useState({
    address: '',
    notes: '',
    budget: '',
    preferredDate: '',
    preferredTime: '',
    isUrgent: false
  })
  const [submitting, setSubmitting] = useState(false)
  const [requestActionLoading, setRequestActionLoading] = useState<'ALL' | string | null>(null)
  const [validationModal, setValidationModal] = useState({
    isOpen: false,
    message: ''
  })
  const [successModal, setSuccessModal] = useState({
    isOpen: false,
    message: '',
    type: 'success' as 'success' | 'error'
  })
  const [favoritePartners, setFavoritePartners] = useState<Set<string>>(new Set())
  const [loadingFavorite, setLoadingFavorite] = useState<string | null>(null)
  const [isFavoriteService, setIsFavoriteService] = useState(false)
  const [loadingFavoriteService, setLoadingFavoriteService] = useState(false)

  useEffect(() => {
    fetchService()
    if (session?.user) {
      fetchFavorites()
    }
  }, [slug, session])

  useEffect(() => {
    if (service && session?.user) {
      fetchFavoriteServices()
    }
  }, [slug, session])

  const fetchService = async () => {
    try {
      const citySlug = localStorage.getItem('selectedCity') || 'medellin'
      const res = await fetch(`/api/services/${slug}?city=${citySlug}`)
      const data = await res.json()
      setService(data)
    } catch (error) {
      console.error('Error fetching service:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchFavorites = async () => {
    try {
      const res = await fetch('/api/favorites')
      if (res.ok) {
        const data = await res.json()
        const favoriteIds = new Set<string>(data.map((fav: any) => fav.partnerId))
        setFavoritePartners(favoriteIds)
      }
    } catch (error) {
      console.error('Error fetching favorites:', error)
    }
  }

  const toggleFavorite = async (partnerId: string) => {
    if (status === 'loading') {
      return
    }
    if (!session) {
      router.push('/login?redirect=/servicios/' + slug)
      return
    }

    setLoadingFavorite(partnerId)
    try {
      const isFavorite = favoritePartners.has(partnerId)

      if (isFavorite) {
        const res = await fetch(`/api/favorites?partnerId=${partnerId}`, {
          method: 'DELETE'
        })

        if (res.ok) {
          setFavoritePartners(prev => {
            const newSet = new Set(prev)
            newSet.delete(partnerId)
            return newSet
          })
        }
      } else {
        const res = await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ partnerId })
        })

        if (res.ok) {
          setFavoritePartners(prev => new Set(prev).add(partnerId))
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error)
    } finally {
      setLoadingFavorite(null)
    }
  }

  const fetchFavoriteServices = async () => {
    if (!service) return

    try {
      const res = await fetch('/api/favorite-services')
      if (res.ok) {
        const data = await res.json()
        const isFav = data.some((fav: any) => fav.serviceId === service.id)
        setIsFavoriteService(isFav)
      }
    } catch (error) {
      console.error('Error fetching favorite services:', error)
    }
  }

  const toggleFavoriteService = async () => {
    if (status === 'loading') {
      return
    }
    if (!session) {
      router.push('/login?redirect=/servicios/' + slug)
      return
    }

    if (!service) return

    setLoadingFavoriteService(true)
    try {
      if (isFavoriteService) {
        const res = await fetch(`/api/favorite-services?serviceId=${service.id}`, {
          method: 'DELETE'
        })

        if (res.ok) {
          setIsFavoriteService(false)
        }
      } else {
        const res = await fetch('/api/favorite-services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ serviceId: service.id })
        })

        if (res.ok) {
          setIsFavoriteService(true)
        }
      }
    } catch (error) {
      console.error('Error toggling favorite service:', error)
    } finally {
      setLoadingFavoriteService(false)
    }
  }

  const openRequestFlow = async (partnerId: string | null) => {
    if (status === 'loading') {
      setValidationModal({
        isOpen: true,
        message: 'Estamos validando tu sesión. Intenta nuevamente en unos segundos.'
      })
      return
    }
    if (!session) {
      router.push('/login?redirect=/servicios/' + slug)
      return
    }
    if (session.user?.isActive === false) {
      setValidationModal({
        isOpen: true,
        message: 'Tu cuenta está inactiva. No puedes solicitar servicios. Contacta al administrador.'
      })
      return
    }

    const citySlug = localStorage.getItem('selectedCity') || 'medellin'
    const currentCity = getCityBySlug(citySlug)

    // Si la ciudad está en modo registro de socios, siempre redirigir.
    if (currentCity?.partnerRegistry) {
      router.push('/registro-socios')
      return
    }

    await fetchAddresses()
    setCurrentStep(1)
    setSelectedPartnerId(partnerId || '')
    setShowRequestModal(true)
  }

  const handleBooking = async (event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault()
    event?.stopPropagation()
    const startedAt = Date.now()
    flushSync(() => {
      setRequestActionLoading('ALL')
    })
    try {
      await openRequestFlow(null)
      const elapsed = Date.now() - startedAt
      if (elapsed < 350) {
        await new Promise((resolve) => setTimeout(resolve, 350 - elapsed))
      }
    } finally {
      setRequestActionLoading(null)
    }
  }

  const handleRequest = async (event?: React.MouseEvent<HTMLButtonElement>) => {
    await handleBooking(event)
  }

  const handleRequestToPartner = async (partnerId: string, event?: React.MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault()
    event?.stopPropagation()
    const startedAt = Date.now()
    flushSync(() => {
      setRequestActionLoading(partnerId)
    })
    try {
      await openRequestFlow(partnerId)
      const elapsed = Date.now() - startedAt
      if (elapsed < 350) {
        await new Promise((resolve) => setTimeout(resolve, 350 - elapsed))
      }
    } finally {
      setRequestActionLoading(null)
    }
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

  const compressImage = async (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height

          // Redimensionar si es muy grande
          const maxDimension = 1920
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension
              width = maxDimension
            } else {
              width = (width / height) * maxDimension
              height = maxDimension
            }
          }

          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                })
                resolve(compressedFile)
              } else {
                resolve(file)
              }
            },
            'image/jpeg',
            0.8 // Calidad 80%
          )
        }
        img.src = e.target?.result as string
      }
      reader.readAsDataURL(file)
    })
  }

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length + photos.length > 5) {
      setValidationModal({
        isOpen: true,
        message: 'Puedes subir máximo 5 fotos'
      })
      return
    }

    const compressedFiles: File[] = []
    for (const file of files) {
      const compressed = await compressImage(file)
      compressedFiles.push(compressed)
    }

    setPhotos([...photos, ...compressedFiles])

    compressedFiles.forEach(file => {
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

        // Comprimir cada foto antes de subirla
        for (const photo of photos) {
          const compressedPhoto = await compressImage(photo)
          formData.append('photos', compressedPhoto)
        }

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
          budget: requestData.budget ? parseFloat(requestData.budget) : undefined,
          preferredDate: requestData.preferredDate || null,
          preferredTime: requestData.preferredTime || null,
          isUrgent: requestData.isUrgent,
          city: finalCity,
          photoUrls,
          partnerId: selectedPartnerId || null
        })
      })

      if (res.ok) {
        const partnerName = selectedPartnerId
          ? service.partners.find(p => p.partner.id === selectedPartnerId)?.partner.user.name
          : null

        setSuccessModal({
          isOpen: true,
          message: partnerName
            ? `¡Solicitud enviada exitosamente a ${partnerName}!`
            : '¡Solicitud creada exitosamente! Los profesionales disponibles recibirán tu solicitud.',
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

  const IDENTITY_TYPES = ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP']
  const EDUCATION_TYPES = ['DIPLOMA_BACHILLERATO', 'DIPLOMA_TECNICO', 'DIPLOMA_TECNOLOGO', 'DIPLOMA_PROFESIONAL', 'DIPLOMA_POSGRADO', 'CERTIFICADO_CURSO']

  const isFullyVerified = (partner: { verified: boolean; documents?: Array<{ type: string; status: string }> }) => {
    const docs = partner.documents ?? []
    const hasIdentity = docs.some(d => IDENTITY_TYPES.includes(d.type) && d.status === 'APPROVED')
    const hasEducation = docs.some(d => EDUCATION_TYPES.includes(d.type) && d.status === 'APPROVED')
    const hasBackground = docs.some(d => d.type === 'ANTECEDENTES' && d.status === 'APPROVED')
    return hasIdentity && hasEducation && hasBackground
  }

  const getVerificationBadges = (
    verified: boolean,
    documents?: Array<{ type: string; status: string }>
  ) => {
    const hasIdentity = documents?.some(d => IDENTITY_TYPES.includes(d.type) && d.status === 'APPROVED') ?? false
    const hasEducation = documents?.some(d => EDUCATION_TYPES.includes(d.type) && d.status === 'APPROVED') ?? false
    const hasBackground = documents?.some(d => d.type === 'ANTECEDENTES' && d.status === 'APPROVED') ?? false

    const badges = [
      (hasIdentity && hasEducation && hasBackground) && {
        icon: <ShieldCheck size={13} />,
        label: 'Verificado Plus',
        bg: 'bg-emerald-50 border-emerald-300 text-emerald-700',
        tooltip: 'Identidad, antecedentes y estudios verificados',
      },
      hasIdentity && {
        icon: <CreditCard size={13} />,
        label: 'Identidad',
        bg: 'bg-blue-50 border-blue-200 text-blue-700',
        tooltip: 'Documento de identidad aprobado',
      },
      hasBackground && {
        icon: <Shield size={13} />,
        label: 'Sin antecedentes',
        bg: 'bg-green-50 border-green-200 text-green-700',
        tooltip: 'Verificación de antecedentes aprobada',
      },
      hasEducation && {
        icon: <GraduationCap size={13} />,
        label: 'Estudios',
        bg: 'bg-purple-50 border-purple-200 text-purple-700',
        tooltip: 'Título o certificado de estudios aprobado',
      },
    ].filter(Boolean) as { icon: React.ReactNode; label: string; bg: string; tooltip: string }[]

    if (!badges.length) return null

    return (
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {badges.map((b) => (
          <div key={b.label} className={`group relative flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${b.bg}`}>
            {b.icon}
            <span>{b.label}</span>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg z-10">
              {b.tooltip}
            </span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ServiceDetailTour />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {/* Service Header */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-8 mb-6 md:mb-8" data-tour="service-header">
          <div className="flex flex-col sm:flex-row items-start gap-4 md:gap-6">
            <div className="emoji-icon" style={{ fontSize: '3em' }}>{service.icon}</div>
            <div className="flex-1 w-full">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3 md:mb-2">
                <h1 className="text-2xl md:text-3xl font-bold">{service.name}</h1>
                <span className="bg-primary-100 text-primary-700 text-xs md:text-sm font-medium px-3 py-1 rounded-full w-fit">
                  {service.category.name}
                </span>
                {session?.user && (
                  <button
                    onClick={toggleFavoriteService}
                    disabled={loadingFavoriteService}
                    className={`ml-auto sm:ml-2 p-2.5 rounded-xl transition-all shadow-md hover:shadow-lg ${isFavoriteService
                      ? 'bg-gradient-to-br from-primary-100 to-amber-100 text-primary-600 hover:from-orange-200 hover:to-amber-200'
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      } ${loadingFavoriteService ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title={isFavoriteService ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                  >
                    <Heart size={20} fill={isFavoriteService ? 'currentColor' : 'none'} />
                  </button>
                )}
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

        {/* Ad Banner for this specific service */}
        <AdBanner placement="SERVICE" serviceId={service.id} className="mb-6 md:mb-8 h-32 md:h-40 lg:h-48" />

        {/* Booking Button - Only show if partners available */}
        {service.partners.length > 0 && (
          <div className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-secondary-50 to-accent-50 rounded-2xl shadow-lg border-2 border-primary-200 p-6 md:p-8 mb-6 md:mb-8 group hover:shadow-xl transition-all duration-300" data-tour="request-button">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-400/10 to-secondary-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

            <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900">¿Listo para solicitar?</h2>
                </div>
                <p className="text-base md:text-lg text-gray-700 font-medium">
                  Envía tu solicitud a <span className="text-primary-600 font-bold">{service.partners.length} {service.partners.length === 1 ? 'profesional' : 'profesionales'}</span> y recibe múltiples propuestas
                </p>
              </div>

              <button
                type="button"
                onClick={(event) => void handleRequest(event)}
                disabled={requestActionLoading !== null}
                className="w-full sm:w-auto bg-gradient-to-r from-primary-500 via-secondary-500 to-accent-500 text-white px-8 md:px-10 py-4 rounded-xl hover:from-primary-600 hover:via-secondary-600 hover:to-accent-600 transition-all duration-300 font-bold text-base md:text-lg shadow-lg hover:shadow-2xl hover:scale-105 flex items-center justify-center gap-3 group/btn"
              >
                {requestActionLoading === 'ALL' ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/70 border-t-white" />
                    <span>Abriendo formulario...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 group-hover/btn:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <span>Solicitar a todos los socios</span>
                    <svg className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Available Professionals */}
        {service.partners.length > 0 ? (
          <div className="bg-white rounded-xl shadow-md p-4 md:p-8" data-tour="partners-list">
            <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6">Profesionales disponibles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {service.partners
                .sort((a, b) => {
                  const aFullyVerified = isFullyVerified(a.partner)
                  const bFullyVerified = isFullyVerified(b.partner)

                  if (aFullyVerified && !bFullyVerified) return -1
                  if (!aFullyVerified && bFullyVerified) return 1

                  if (a.partner.completedServicesCount !== b.partner.completedServicesCount) {
                    return b.partner.completedServicesCount - a.partner.completedServicesCount
                  }

                  return b.partner.rating - a.partner.rating
                })
                .map((partnerService) => {
                  const fullyVerified = isFullyVerified(partnerService.partner)

                  return (
                    <div
                      key={partnerService.id}
                      className={`group relative rounded-xl p-5 md:p-6 transition-all duration-300 hover:shadow-xl ${fullyVerified
                        ? 'bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 border-2 border-emerald-400 shadow-lg shadow-emerald-100/50 hover:shadow-emerald-200/70 hover:border-emerald-500'
                        : 'bg-white border-2 border-gray-200 hover:border-gray-300 shadow-md hover:shadow-lg'
                        }`}
                    >
                      <button
                        onClick={() => toggleFavorite(partnerService.partner.id)}
                        disabled={loadingFavorite === partnerService.partner.id}
                        className={`absolute top-4 right-4 p-2.5 rounded-full transition-all duration-200 z-10 shadow-sm hover:shadow-md ${favoritePartners.has(partnerService.partner.id)
                          ? 'bg-red-500 text-white hover:bg-red-600 scale-110'
                          : 'bg-white text-gray-400 hover:bg-red-50 hover:text-red-500 hover:scale-110'
                          } ${loadingFavorite === partnerService.partner.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <Heart
                          size={18}
                          fill={favoritePartners.has(partnerService.partner.id) ? 'currentColor' : 'none'}
                          className="transition-all"
                        />
                      </button>

                      {fullyVerified && (
                        <div className="flex items-center gap-2 mb-4 bg-gradient-to-r from-emerald-600 to-green-600 text-white px-4 py-2 rounded-full text-xs font-bold w-fit shadow-md">
                          <ShieldCheck size={16} className="animate-pulse" />
                          <span>VERIFICADO PLUS</span>
                        </div>
                      )}

                      <div className="flex items-start gap-4 mb-4">
                        <div className="flex-shrink-0">
                          {partnerService.partner.user.image ? (
                            <img
                              src={partnerService.partner.user.image}
                              alt={partnerService.partner.user.name}
                              className={`w-14 h-14 md:w-16 md:h-16 rounded-full object-cover shadow-md ${fullyVerified
                                ? 'ring-2 ring-emerald-500'
                                : 'ring-2 ring-gray-300'
                                }`}
                            />
                          ) : (
                            <div className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center text-white font-bold text-xl md:text-2xl shadow-md ${fullyVerified
                              ? 'bg-gradient-to-br from-emerald-500 to-green-600'
                              : 'bg-gradient-to-br from-gray-400 to-gray-500'
                              }`}>
                              {partnerService.partner.user.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0 pr-8">
                          <div className="flex items-center gap-2 mb-1.5">
                            <h3 className="font-bold text-lg md:text-xl text-gray-900 truncate">
                              {partnerService.partner.user.name}
                            </h3>
                          </div>

                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex items-center gap-1.5 bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-3 py-1 rounded-full shadow-sm">
                              <Star size={14} fill="currentColor" />
                              <span className="font-bold text-sm">{partnerService.partner.rating.toFixed(1)}</span>
                            </div>
                            <span className="text-gray-600 text-xs md:text-sm font-medium">
                              ({partnerService.partner.totalReviews} {partnerService.partner.totalReviews === 1 ? 'reseña' : 'reseñas'})
                            </span>
                          </div>

                          {getVerificationBadges(partnerService.partner.verified, partnerService.partner.documents)}
                        </div>
                      </div>

                      <div className="mb-4 pb-4 border-b border-gray-200">
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle size={16} className="text-green-600" />
                          <span className="text-sm text-gray-700">
                            <span className="font-bold text-green-600">{partnerService.partner.completedServicesCount}</span> {partnerService.partner.completedServicesCount === 1 ? 'servicio completado' : 'servicios completados'}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-gray-600 text-sm font-medium">Precio:</span>
                          <p className={`font-bold text-2xl md:text-3xl ${fullyVerified ? 'text-emerald-600' : 'text-primary-600'
                            }`}>
                            {formatCurrency(partnerService.price)}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(event) => void handleRequestToPartner(partnerService.partner.id, event)}
                        disabled={requestActionLoading !== null}
                        className={`w-full font-bold py-3.5 px-4 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2 group/btn ${fullyVerified
                          ? 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white'
                          : 'bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-[#E02850] hover:to-[#E65F00] text-white'
                          }`}
                      >
                        {requestActionLoading === partnerService.partner.id ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/70 border-t-white" />
                            <span>Abriendo...</span>
                          </>
                        ) : (
                          <>
                            <UserPlus size={18} />
                            <span>Solicitar servicio</span>
                            <ChevronRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                          </>
                        )}
                      </button>
                    </div>
                  )
                })}
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-primary-50 via-white to-secondary-50 rounded-xl shadow-lg p-6 md:p-12 border-2 border-primary-200">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full mb-4 shadow-lg">
                  <Users size={32} className="text-white md:w-10 md:h-10" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
                  ¡Aún no hay profesionales disponibles!
                </h2>
                <p className="text-gray-600 text-base md:text-lg max-w-2xl mx-auto">
                  Sé el primero en ofrecer <span className="font-semibold text-primary-600">{service.name}</span> en tu ciudad o notifícanos que estás buscando este servicio.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8">
                <div className="bg-white rounded-xl p-6 shadow-md border-2 border-primary-100 hover:border-primary-300 transition-all hover:shadow-xl group">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Briefcase size={24} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-900 mb-2">Conviértete en Socio</h3>
                      <p className="text-gray-600 text-sm mb-4">
                        Ofrece tus servicios profesionales, gana dinero extra y construye tu reputación en la plataforma.
                      </p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        <div className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full">
                          <TrendingUp size={12} />
                          <span>Ingresos flexibles</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded-full">
                          <Shield size={12} />
                          <span>Verificación segura</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-purple-700 bg-purple-50 px-2 py-1 rounded-full">
                          <Sparkles size={12} />
                          <span>Sin costos iniciales</span>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          if (session) {
                            await signOut({ redirect: false })
                          }
                          router.push('/registro-socios')
                        }}
                        className="w-full bg-gradient-to-r from-primary-500 to-secondary-500 text-white font-semibold py-3 px-4 rounded-lg hover:from-primary-600 hover:to-secondary-600 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group"
                      >
                        <UserPlus size={18} />
                        <span>Registrarme como Socio</span>
                        <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-md border-2 border-blue-100 hover:border-blue-300 transition-all hover:shadow-xl group">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Bell size={24} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-900 mb-2">Notificar Interés</h3>
                      <p className="text-gray-600 text-sm mb-4">
                        Déjanos saber que necesitas este servicio. Te avisaremos cuando haya profesionales disponibles.
                      </p>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                        <p className="text-xs text-blue-800">
                          <span className="font-semibold">💡 Beneficio:</span> Serás el primero en recibir ofertas especiales y descuentos de lanzamiento.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const message = `Hola, estoy interesado en el servicio de ${service.name} en ${getCityBySlug(slug)?.name || 'mi ciudad'}. ¿Cuándo estará disponible?`
                          window.open(`https://wa.me/573001234567?text=${encodeURIComponent(message)}`, '_blank')
                        }}
                        className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold py-3 px-4 rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 group"
                      >
                        <Bell size={18} />
                        <span>Notificar mi Interés</span>
                        <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-primary-100 to-secondary-100 rounded-xl p-6 border border-primary-200">
                <div className="flex flex-col md:flex-row items-center gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-md">
                      <Sparkles size={24} className="text-primary-500" />
                    </div>
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h4 className="font-bold text-gray-900 mb-1">¿Por qué unirte a LoHaggo?</h4>
                    <p className="text-gray-700 text-sm">
                      Más de <span className="font-semibold text-primary-600">10,000 clientes</span> confían en nosotros.
                      Únete a nuestra comunidad de profesionales verificados y empieza a generar ingresos hoy mismo.
                    </p>
                  </div>
                  <button
                    onClick={() => router.push('/how-it-works')}
                    className="flex-shrink-0 bg-white text-primary-600 font-semibold py-2 px-6 rounded-lg hover:bg-primary-50 transition-all shadow-md hover:shadow-lg border-2 border-primary-200 whitespace-nowrap"
                  >
                    Conocer más
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative z-[101]">
            <div className="bg-gradient-to-r from-primary-500 to-secondary-500 p-4 md:p-6 text-white">
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold">Solicitar {service.name}</h2>
                  {selectedPartnerId && (
                    <p className="text-primary-100 text-xs md:text-sm mt-1">
                      Para: {service.partners.find(p => p.partner.id === selectedPartnerId)?.partner.user.name}
                    </p>
                  )}
                  <p className="text-primary-100 text-xs md:text-sm mt-1">Paso {currentStep} de 5</p>
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
                {[1, 2, 3, 4, 5].map((step) => (
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
                {/* Step 1: Trust Platform Banner */}
                {currentStep === 1 && (
                  <div className="space-y-3 md:space-y-4 animate-fadeIn">
                    <div className="text-center mb-3 md:mb-4">
                      <div className="w-12 h-12 md:w-14 md:h-14 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-2 md:mb-3">
                        <Shield className="text-secondary-600" size={24} />
                      </div>
                      <h3 className="text-base md:text-lg font-bold text-gray-900 mb-1">Tu seguridad es nuestra prioridad</h3>
                      <p className="text-xs md:text-sm text-gray-600">Beneficios de usar nuestra plataforma</p>
                    </div>

                    <PlatformTrustBanner
                      variant="info"
                      context="booking"
                      className="mb-3"
                    />
                  </div>
                )}

                {/* Step 2: Dirección */}
                {currentStep === 2 && (
                  <div className="space-y-4 md:space-y-6 animate-fadeIn">
                    <div className="text-center mb-4 md:mb-6">
                      <div className="w-14 h-14 md:w-16 md:h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                        <MapPin className="text-secondary-600" size={28} />
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
                              ? 'border-secondary-500 bg-primary-50'
                              : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                              }`}
                          >
                            <input
                              type="radio"
                              name="address"
                              value={addr.id}
                              checked={selectedAddressId === addr.id}
                              onChange={(e) => setSelectedAddressId(e.target.value)}
                              className="mt-1 w-4 h-4 md:w-5 md:h-5 text-secondary-600"
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
                          className="w-full py-2.5 md:py-3 border-2 border-dashed border-gray-300 rounded-xl text-secondary-600 hover:border-secondary-500 hover:bg-primary-50 transition font-medium flex items-center justify-center gap-2 text-sm md:text-base"
                        >
                          <Plus size={18} />
                          Agregar nueva dirección
                        </button>
                      </div>
                    ) : (
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
                              className="text-xs md:text-sm text-secondary-600 hover:text-secondary-700 font-semibold flex items-center gap-1"
                            >
                              <Plus size={14} />
                              Ir a mis direcciones
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Fecha y Hora */}
                {currentStep === 3 && (
                  <div className="space-y-4 md:space-y-6 animate-fadeIn">
                    <div className="text-center mb-4 md:mb-6">
                      <div className="w-14 h-14 md:w-16 md:h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                        <Calendar className="text-secondary-600" size={28} />
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
                          ? 'border-secondary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                          }`}
                      >
                        <input
                          type="radio"
                          name="urgency"
                          checked={!requestData.isUrgent}
                          onChange={() => setRequestData({ ...requestData, isUrgent: false })}
                          className="mt-1 w-4 h-4 md:w-5 md:h-5 text-secondary-600"
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
                                    className="w-full pl-9 md:pl-10 pr-3 md:pr-4 py-2.5 md:py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 outline-none text-sm md:text-base"
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
                                    className="w-full pl-9 md:pl-10 pr-3 md:pr-4 py-2.5 md:py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 outline-none text-sm md:text-base"
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

                {/* Step 4: Detalles y Confirmación */}
                {currentStep === 4 && (
                  <div className="space-y-3 md:space-y-6 animate-fadeIn">
                    <div className="text-center mb-3 md:mb-6">
                      <div className="w-12 h-12 md:w-16 md:h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-2 md:mb-4">
                        <CheckCircle className="text-secondary-600" size={24} />
                      </div>
                      <h3 className="text-base md:text-xl font-bold text-gray-900 mb-1 md:mb-2">Detalles adicionales</h3>
                      <p className="text-xs md:text-base text-gray-600">Cuéntanos más sobre lo que necesitas</p>
                    </div>

                    {/* Resumen */}
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-3 md:p-5 space-y-2 md:space-y-3">
                      <h4 className="font-semibold text-sm md:text-base text-gray-900 mb-2 md:mb-3">Resumen de tu solicitud</h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                        <div className="flex items-start gap-2">
                          <MapPin className="text-secondary-600 mt-0.5 flex-shrink-0" size={14} />
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
                          <Calendar className="text-secondary-600 mt-0.5 flex-shrink-0" size={14} />
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
                        className="w-full px-3 md:px-4 py-2 md:py-3 border-2 border-primary-200 bg-primary-50 text-primary-900 rounded-xl focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 outline-none resize-none text-xs md:text-base"
                      />
                    </div>

                    {/* Budget */}
                    <div>
                      <label className="block text-xs md:text-sm font-semibold text-gray-700 mb-1.5 md:mb-2">
                        Tu presupuesto (opcional)
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder={`Mínimo: ${formatCurrency(selectedPartnerId ? service.partners.find(p => p.partner.id === selectedPartnerId)?.price || service.basePrice : service.basePrice)}`}
                          value={requestData.budget}
                          onChange={(e) => setRequestData({ ...requestData, budget: e.target.value })}
                          className="w-full pl-9 md:pl-10 pr-3 md:pr-4 py-2.5 md:py-3 border-2 border-primary-200 bg-primary-50 text-primary-900 rounded-xl focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 outline-none text-xs md:text-base"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {selectedPartnerId
                          ? `El presupuesto debe ser al menos ${formatCurrency(service.partners.find(p => p.partner.id === selectedPartnerId)?.price || service.basePrice)} para este socio`
                          : `El presupuesto debe ser al menos ${formatCurrency(service.basePrice)} para este servicio`
                        }
                      </p>
                    </div>
                  </div>
                )}

                {/* Step 5: Fotos */}
                {currentStep === 5 && (
                  <div className="space-y-4 md:space-y-6 animate-fadeIn">
                    <div className="text-center mb-4 md:mb-6">
                      <div className="w-14 h-14 md:w-16 md:h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                        <Camera className="text-secondary-600" size={28} />
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
                          : 'border-secondary-500 bg-primary-50 hover:bg-primary-100'
                          }`}>
                          <Upload className={`mx-auto mb-3 ${photos.length >= 5 ? 'text-gray-400' : 'text-secondary-600'}`} size={32} />
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

                  {currentStep < 5 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (currentStep === 2) {
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
                        if (currentStep === 3) {
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
                      className="flex-1 bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl hover:from-primary-600 hover:to-secondary-600 transition font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary-600/30 text-sm md:text-base"
                    >
                      Continuar
                      <ChevronRight size={18} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={submitRequest}
                      disabled={submitting}
                      className="flex-1 bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl hover:from-primary-600 hover:to-secondary-600 transition font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary-600/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
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
