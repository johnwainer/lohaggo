'use client'

import { use, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { flushSync } from 'react-dom'
import { DollarSign, Clock, Star, CheckCircle, MapPin, Plus, Calendar, X, ChevronRight, Camera, Upload, Trash2, Shield, CreditCard, GraduationCap, ShieldCheck, UserPlus, Bell, Briefcase, TrendingUp, Users, Sparkles, Heart, Building2 } from 'lucide-react'
import ServiceIcon from '@/components/ServiceIcon'
import { useSession, signOut } from 'next-auth/react'
import { formatCurrency } from '@/lib/utils'
import { useCity } from '@/lib/city-context'
import ConfirmModal from '@/components/ConfirmModal'
import AdBanner from '@/components/ads/AdBanner'
import ServiceDetailTour from '@/components/ServiceDetailTour'
import { useTrust } from '@/lib/public/useTrust'
import PhoneVerify from '@/components/service-request/PhoneVerify'
import AddressStep from '@/components/service-request/AddressStep'
import RequestSuccess from '@/components/service-request/RequestSuccess'
import StickyRequestBar from '@/components/service-request/StickyRequestBar'
import GuaranteeStrip from '@/components/service-request/GuaranteeStrip'
import { ga4Loaded, track } from '@/lib/analytics/track'
import { withRedirect } from '@/lib/navigation/safe-redirect'
import { cityEnumFromName, splitAddressText } from '@/lib/geo/address'
import {
  clearDraft, composeNotes, DRAFT_PHOTOS_KEY, loadDraft, saveDraft, timingPayload,
  type AddressMode, type NewAddressDraft, type WhenMode,
} from '@/lib/service-requests/draft'

const TOTAL_STEPS = 3
const safeStorage = () => { try { return typeof window !== 'undefined' ? window.localStorage : null } catch { return null } }

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
  partners: Array<{
    id: string
    price: number
    partner: {
      id: string
      rating: number
      totalReviews: number
      completedServicesCount: number
      verified: boolean
      isCompany?: boolean
      companyName?: string | null
      user: {
        name: string
        phone: string
        image: string | null
      }
      documents?: Array<{
        type: string
        status: string
      }>
      slug?: string | null
      isPublicProfile?: boolean
      isAvailable?: boolean
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
  const { data: session, status, update: updateSession } = useSession()
  const [phoneVerifyOpen, setPhoneVerifyOpen] = useState(false)
  const [submitAfterLogin, setSubmitAfterLogin] = useState(false)
  const router = useRouter()
  const { getCityBySlug } = useCity()
  const { whatsappPhone, claims } = useTrust()
  const [service, setService] = useState<Service | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string>('')
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('')
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [addressMode, setAddressMode] = useState<AddressMode>('new')
  const [newAddress, setNewAddress] = useState<NewAddressDraft>({ street: '', neighborhood: '', instructions: '' })
  const [when, setWhen] = useState<WhenMode>('asap')
  const [requestData, setRequestData] = useState({
    notes: '',
    budget: '',
    preferredDate: '',
    preferredTime: '',
  })
  const [successInfo, setSuccessInfo] = useState<{ partnerName: string | null } | null>(null)
  const viewTracked = useRef(false)
  const resumeHandled = useRef(false)

  const draftSnapshot = (step: number) => ({
    slug,
    step,
    partnerId: selectedPartnerId,
    addressMode,
    selectedAddressId,
    newAddress,
    when,
    preferredDate: requestData.preferredDate,
    preferredTime: requestData.preferredTime,
    notes: requestData.notes,
    budget: requestData.budget,
  })

  // Autosave the wizard on every change so nothing is lost on login/registration or a closed tab.
  useEffect(() => {
    if (!showRequestModal || successInfo) return
    saveDraft(safeStorage(), draftSnapshot(currentStep))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRequestModal, successInfo, currentStep, selectedPartnerId, addressMode, selectedAddressId, newAddress, when, requestData])

  // Back from /login or /register with ?resume=1: reopen the wizard where it was left.
  useEffect(() => {
    if (resumeHandled.current || !service || status === 'loading') return
    if (typeof window === 'undefined' || new URLSearchParams(window.location.search).get('resume') !== '1') return
    resumeHandled.current = true
    router.replace(`/servicios/${slug}`, { scroll: false })
    if (!loadDraft(safeStorage(), slug)) return
    void openRequestFlow(null, { resume: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, status])

  // From a partner's public profile («Solicitar a este socio»): ?partnerId= preselects that partner.
  const partnerParamHandled = useRef(false)
  useEffect(() => {
    if (partnerParamHandled.current || !service || status === 'loading') return
    if (typeof window === 'undefined') return
    const qs = new URLSearchParams(window.location.search)
    const partnerId = qs.get('partnerId')
    if (!partnerId || qs.get('resume') === '1') return
    partnerParamHandled.current = true
    if (!service.partners.some((ps) => ps.partner.id === partnerId)) return
    void handleRequestToPartner(partnerId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, status])

  useEffect(() => {
    if (!service || viewTracked.current) return
    viewTracked.current = true
    track('view_content', { content_name: service.name, content_ids: [service.id], content_category: service.category.name, value: service.basePrice })
  }, [service])
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
      if (!res.ok) { setLoading(false); return }
      const data = await res.json()
      if (data?.id) setService(data)
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

  const restorePhotos = async () => {
    try {
      const raw = safeStorage()?.getItem(DRAFT_PHOTOS_KEY)
      const urls: string[] = raw ? JSON.parse(raw) : []
      if (!Array.isArray(urls) || urls.length === 0) return
      const files = await Promise.all(urls.slice(0, 5).map(async (u, i) => {
        const blob = await (await fetch(u)).blob()
        return new File([blob], `foto-${i + 1}.jpg`, { type: blob.type || 'image/jpeg' })
      }))
      setPhotos(files)
      setPhotoPreviews(urls.slice(0, 5))
    } catch { /* photos are optional */ }
  }

  /** Loads the saved draft (if any) into the wizard. Returns the step to show. */
  const applyDraft = async (savedAddresses: Address[], partnerId: string | null | undefined) => {
    const draft = loadDraft(safeStorage(), slug)
    if (!draft) {
      setAddressMode(savedAddresses.length > 0 ? 'saved' : 'new')
      setSelectedPartnerId(partnerId || '')
      return 1
    }
    const savedStillThere = draft.addressMode === 'saved' && savedAddresses.some(a => a.id === draft.selectedAddressId)
    setAddressMode(savedStillThere ? 'saved' : (draft.newAddress.street || savedAddresses.length === 0 ? 'new' : 'saved'))
    if (savedStillThere) setSelectedAddressId(draft.selectedAddressId)
    setNewAddress(draft.newAddress)
    setWhen(draft.when)
    setRequestData({ notes: draft.notes, budget: draft.budget, preferredDate: draft.preferredDate, preferredTime: draft.preferredTime })
    setSelectedPartnerId(partnerId === undefined ? draft.partnerId : (partnerId || ''))
    await restorePhotos()
    return draft.step
  }

  const openRequestFlow = async (partnerId: string | null, opts: { resume?: boolean } = {}) => {
    if (status === 'loading') {
      setValidationModal({
        isOpen: true,
        message: 'Estamos validando tu sesión. Intenta nuevamente en unos segundos.'
      })
      return
    }
    if (session && session.user?.isActive === false) {
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

    const saved = session ? await fetchAddresses() : []
    if (!session) setAddresses([])
    const step = await applyDraft(saved, opts.resume ? undefined : partnerId)
    setCurrentStep(opts.resume ? step : Math.min(step, TOTAL_STEPS))
    setSuccessInfo(null)
    setShowRequestModal(true)
    if (!opts.resume && service) {
      track('begin_checkout', { content_name: service.name, content_ids: [service.id], content_category: service.category.name })
    }
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

  const handleRequestToPartner = async (partnerId: string, event?: React.MouseEvent<HTMLElement>) => {
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

  const fetchAddresses = async (): Promise<Address[]> => {
    try {
      const res = await fetch('/api/addresses')
      if (res.ok) {
        const data: Address[] = await res.json()
        setAddresses(data)
        const primaryAddress = data.find((addr: Address) => addr.isPrimary)
        if (primaryAddress) {
          setSelectedAddressId(primaryAddress.id)
        } else if (data.length > 0) {
          setSelectedAddressId(data[0].id)
        } else {
          setSelectedAddressId('')
        }
        return data
      }
      setSelectedAddressId('')
      return []
    } catch (error) {
      console.error('Error fetching addresses:', error)
      setSelectedAddressId('')
      return []
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

    const urls = await Promise.all(compressedFiles.map(file => new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.readAsDataURL(file)
    })))
    setPhotoPreviews(prev => {
      const next = [...prev, ...urls]
      persistPhotos(next)
      return next
    })
  }

  /** Best effort: photos ride along with the draft only while they fit in localStorage. */
  const persistPhotos = (urls: string[]) => {
    const storage = safeStorage()
    if (!storage) return
    try {
      if (urls.length === 0) storage.removeItem(DRAFT_PHOTOS_KEY)
      else storage.setItem(DRAFT_PHOTOS_KEY, JSON.stringify(urls))
    } catch {
      try { storage.removeItem(DRAFT_PHOTOS_KEY) } catch { /* ignore */ }
    }
  }

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index))
    const next = photoPreviews.filter((_, i) => i !== index)
    setPhotoPreviews(next)
    persistPhotos(next)
  }

  const currentCityName = () => {
    const citySlug = (typeof window !== 'undefined' && localStorage.getItem('selectedCity')) || 'medellin'
    return getCityBySlug(citySlug)?.name || 'Medellín'
  }

  const newAddressString = () =>
    `${newAddress.street.trim()}, ${newAddress.neighborhood.trim()}, ${currentCityName()}`

  const validateAddressStep = (): string | null => {
    if (addressMode === 'saved' && addresses.length > 0) {
      return selectedAddressId && addresses.some(a => a.id === selectedAddressId) ? null : 'Elige una dirección o usa otra'
    }
    if (newAddress.street.trim().length < 5) return 'Escribe la dirección (calle y número)'
    if (newAddress.neighborhood.trim().length < 2) return 'Escribe el barrio'
    return null
  }

  const validateWhenStep = (): string | null => {
    if (when !== 'scheduled') return null
    if (!requestData.preferredDate || !requestData.preferredTime) return 'Elige fecha y hora, o cambia a otra opción'
    return null
  }

  /** Saves a typed address to the client's list so next time it is one tap. Never blocks the request. */
  const saveNewAddress = async () => {
    const street = newAddress.street.trim()
    const neighborhood = newAddress.neighborhood.trim()
    const dup = addresses.some(a =>
      getAddressString(a).toLowerCase().includes(street.toLowerCase()) && a.neighborhood.trim().toLowerCase() === neighborhood.toLowerCase())
    if (dup) return
    const parts = splitAddressText(street)
    try {
      await fetch('/api/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: (addresses.length === 0 ? 'Mi dirección' : neighborhood).slice(0, 50),
          street: parts.street.length >= 5 ? parts.street : street,
          number: parts.street.length >= 5 ? parts.number : 'S/N',
          complement: parts.street.length >= 5 ? parts.complement : undefined,
          neighborhood: neighborhood.slice(0, 100),
          city: cityEnumFromName(currentCityName()) || 'MEDELLIN',
          instructions: newAddress.instructions.trim() || undefined,
          isPrimary: addresses.length === 0,
        }),
      })
    } catch { /* optional */ }
  }

  const submitRequest = async () => {
    if (!service) return

    const addressError = validateAddressStep()
    if (addressError) {
      setCurrentStep(1)
      setValidationModal({ isOpen: true, message: addressError })
      return
    }
    const whenError = validateWhenStep()
    if (whenError) {
      setCurrentStep(2)
      setValidationModal({ isOpen: true, message: whenError })
      return
    }

    if (!session) {
      // No account needed: the phone is confirmed with a WhatsApp code and the request goes out
      saveDraft(safeStorage(), draftSnapshot(TOTAL_STEPS))
      setPhoneVerifyOpen(true)
      return
    }

    let finalAddress = ''
    let finalCity = ''
    const usingSaved = addressMode === 'saved' && addresses.length > 0
    if (usingSaved) {
      const selectedAddress = addresses.find(addr => addr.id === selectedAddressId)
      if (selectedAddress) {
        finalAddress = getAddressString(selectedAddress)
        finalCity = selectedAddress.city
      }
    } else {
      finalAddress = newAddressString()
      finalCity = cityEnumFromName(currentCityName())
    }

    const timing = timingPayload(when, requestData.preferredDate, requestData.preferredTime)
    const notes = composeNotes({
      notes: requestData.notes,
      timingNote: timing.note,
      instructions: usingSaved ? '' : newAddress.instructions,
    })

    setSubmitting(true)
    try {
      let photoUrls: string[] = []

      if (photos.length > 0) {
        const formData = new FormData()
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
          notes: notes || undefined,
          budget: requestData.budget ? parseFloat(requestData.budget) : undefined,
          preferredDate: timing.preferredDate,
          preferredTime: timing.preferredTime,
          isUrgent: timing.isUrgent,
          city: finalCity || undefined,
          photoUrls,
          partnerId: selectedPartnerId || null,
          gaTracked: ga4Loaded()
        })
      })

      if (res.ok) {
        const created = await res.clone().json().catch(() => null) as { id?: string } | null
        if (!usingSaved) await saveNewAddress()
        clearDraft(safeStorage())
        track('lead', { content_name: service.name, content_ids: [service.id], content_category: service.category.name, value: requestData.budget ? parseFloat(requestData.budget) : undefined }, { eventId: created?.id ? `lead-${created.id}` : undefined })
        const partner = selectedPartnerId ? service.partners.find(p => p.partner.id === selectedPartnerId)?.partner : null
        setSuccessInfo({ partnerName: partner ? (partner.isCompany && partner.companyName ? partner.companyName : partner.user.name) : null })
      } else {
        const error = await res.json().catch(() => ({}))
        setSuccessModal({
          isOpen: true,
          message: error.error || 'Error al crear solicitud',
          type: 'error'
        })
      }
    } catch (error) {
      console.error('Error creating request:', error)
      setSuccessModal({
        isOpen: true,
        message: 'No pudimos enviar tu solicitud. Revisa tu conexión e intenta de nuevo.',
        type: 'error'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const closeRequestModal = () => {
    setShowRequestModal(false)
    if (successInfo) {
      setSuccessInfo(null)
      setPhotos([])
      setPhotoPreviews([])
      setRequestData({ notes: '', budget: '', preferredDate: '', preferredTime: '' })
      setNewAddress({ street: '', neighborhood: '', instructions: '' })
      setWhen('asap')
    }
  }

  const trackWhatsApp = (source: string) => {
    track('whatsapp_click', { content_name: service?.name, source })
  }

  // Signed in with the WhatsApp code: once the session is there, the request goes out with the draft
  useEffect(() => {
    if (!submitAfterLogin || !session?.user) return
    setSubmitAfterLogin(false)
    void submitRequest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitAfterLogin, session])

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

  const getPartnerTier = (documents: Array<{ type: string; status: string }> = []) => {
    const hasIdentity = documents.some(d => IDENTITY_TYPES.includes(d.type) && d.status === 'APPROVED')
    const hasBackground = documents.some(d => d.type === 'ANTECEDENTES' && d.status === 'APPROVED')
    const hasEducation = documents.some(d => EDUCATION_TYPES.includes(d.type) && d.status === 'APPROVED')

    if (hasIdentity && hasBackground && hasEducation) return {
      level: 3 as const,
      label: 'Pro',
      card: 'bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border-2 border-amber-400 shadow-lg shadow-amber-100/50 hover:shadow-amber-200/60 hover:border-amber-500',
      avatarBg: 'bg-gradient-to-br from-amber-500 to-orange-500',
      ring: 'ring-2 ring-amber-400',
      badgeBg: 'from-amber-500 to-orange-500',
      buttonBg: 'from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600',
      priceColor: 'text-amber-600',
    }
    if (hasIdentity && hasBackground) return {
      level: 2 as const,
      label: 'De Confianza',
      card: 'bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 border-2 border-blue-300 shadow-lg shadow-blue-100/50 hover:shadow-blue-200/60 hover:border-blue-400',
      avatarBg: 'bg-gradient-to-br from-blue-500 to-indigo-500',
      ring: 'ring-2 ring-blue-400',
      badgeBg: 'from-blue-600 to-indigo-600',
      buttonBg: 'from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700',
      priceColor: 'text-blue-700',
    }
    return {
      level: 1 as const,
      label: 'Verificado',
      card: 'bg-white border-2 border-gray-200 hover:border-gray-300 shadow-md hover:shadow-lg',
      avatarBg: 'bg-gradient-to-br from-emerald-400 to-teal-500',
      ring: 'ring-2 ring-gray-300',
      badgeBg: 'from-emerald-500 to-teal-500',
      buttonBg: 'from-primary-500 to-secondary-500 hover:from-[#E02850] hover:to-[#E65F00]',
      priceColor: 'text-primary-600',
    }
  }

  const isFullyVerified = (partner: { verified: boolean; documents?: Array<{ type: string; status: string }> }) =>
    getPartnerTier(partner.documents ?? []).level === 3

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
        icon: <ShieldCheck size={13} />,
        label: 'Antecedentes revisados ✓',
        bg: 'bg-teal-50 border-teal-400 text-teal-700 font-bold',
        tooltip: 'Verificación de antecedentes penales aprobada',
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
          <div key={b.label} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${b.bg}`}>
            {b.icon}
            <span>{b.label}</span>
          </div>
        ))}
      </div>
    )
  }

  const selectedPartnerPrice = selectedPartnerId ? service.partners.find(p => p.partner.id === selectedPartnerId)?.price : undefined
  const minBudget = selectedPartnerPrice ?? service.basePrice
  const fromPrice = service.partners.length > 0 ? Math.min(...service.partners.map(p => p.price)) : service.basePrice
  const whatsappOrderText = `Hola, quiero pedir ${service.name} en Medellín. ¿Me ayudas? (ref: web-${slug})`

  return (
    <div className="min-h-screen bg-gray-50">
      <ServiceDetailTour />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {/* Service Header */}
        <div className="bg-white rounded-xl shadow-md p-4 md:p-8 mb-6 md:mb-8" data-tour="service-header">
          <div className="flex flex-col sm:flex-row items-start gap-4 md:gap-6">
            <ServiceIcon slug={service.slug} emoji={service.icon} size="lg" />
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

        {claims.trust_guarantee && <GuaranteeStrip className="mb-6 md:mb-8" />}

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
                  const aTier = getPartnerTier(a.partner.documents ?? []).level
                  const bTier = getPartnerTier(b.partner.documents ?? []).level
                  if (aTier !== bTier) return bTier - aTier
                  if (a.partner.completedServicesCount !== b.partner.completedServicesCount)
                    return b.partner.completedServicesCount - a.partner.completedServicesCount
                  return b.partner.rating - a.partner.rating
                })
                .map((partnerService) => {
                  const tier = getPartnerTier(partnerService.partner.documents ?? [])

                  return (
                    <div
                      key={partnerService.id}
                      role="button"
                      tabIndex={0}
                      onClick={(event) => void handleRequestToPartner(partnerService.partner.id, event)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') void handleRequestToPartner(partnerService.partner.id) }}
                      className={`group relative rounded-xl p-5 md:p-6 transition-all duration-300 hover:shadow-xl cursor-pointer ${tier.card}`}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(partnerService.partner.id) }}
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

                      <div className={`flex items-center gap-2 mb-4 bg-gradient-to-r ${tier.badgeBg} text-white px-3 py-1.5 rounded-full text-xs font-bold w-fit shadow-sm`}>
                        {tier.level === 3 ? <ShieldCheck size={13} /> : tier.level === 2 ? <Shield size={13} /> : <CreditCard size={13} />}
                        <span>{tier.label.toUpperCase()}</span>
                      </div>

                      <div className="flex items-start gap-4 mb-4">
                        <div className="flex-shrink-0">
                          {partnerService.partner.user.image ? (
                            <img
                              src={partnerService.partner.user.image}
                              alt={partnerService.partner.user.name}
                              className={`w-14 h-14 md:w-16 md:h-16 rounded-full object-cover shadow-md ${tier.ring}`}
                            />
                          ) : (
                            <div className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center text-white font-bold text-xl md:text-2xl shadow-md ${tier.avatarBg}`}>
                              {partnerService.partner.user.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0 pr-8">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <h3 className="font-bold text-lg md:text-xl text-gray-900 truncate">
                              {partnerService.partner.isCompany && partnerService.partner.companyName
                                ? partnerService.partner.companyName
                                : partnerService.partner.user.name}
                            </h3>
                            {partnerService.partner.isCompany && (
                              <span className="flex items-center gap-1 text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full shrink-0">
                                <Building2 size={11} /> Empresa
                              </span>
                            )}
                          </div>
                          <div className="mb-1.5">
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                              partnerService.partner.isAvailable !== false
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${partnerService.partner.isAvailable !== false ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                              {partnerService.partner.isAvailable !== false ? 'Disponible' : 'No disponible'}
                            </span>
                          </div>

                          {partnerService.partner.totalReviews > 0 ? (
                            <div className="flex items-center gap-2 mb-2">
                              <div className="flex items-center gap-1.5 bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-3 py-1 rounded-full shadow-sm">
                                <Star size={14} fill="currentColor" />
                                <span className="font-bold text-sm">{partnerService.partner.rating.toFixed(1)}</span>
                              </div>
                              <span className="text-gray-600 text-xs md:text-sm font-medium">
                                ({partnerService.partner.totalReviews} {partnerService.partner.totalReviews === 1 ? 'reseña' : 'reseñas'})
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 mb-2 text-xs md:text-sm font-semibold text-emerald-700">
                              <Sparkles size={14} />
                              <span>Nuevo en LoHaggo · Identidad verificada</span>
                            </div>
                          )}

                          {getVerificationBadges(partnerService.partner.verified, partnerService.partner.documents)}
                        </div>
                      </div>

                      <div className="mb-4 pb-4 border-b border-gray-200">
                        {partnerService.partner.totalReviews > 0 && partnerService.partner.completedServicesCount > 0 && (
                          <div className="flex items-center gap-2 mb-3">
                            <CheckCircle size={16} className="text-green-600" />
                            <span className="text-sm text-gray-700">
                              <span className="font-bold text-green-600">{partnerService.partner.completedServicesCount}</span> {partnerService.partner.completedServicesCount === 1 ? 'servicio completado' : 'servicios completados'}
                            </span>
                          </div>
                        )}
                        <div className="flex items-baseline gap-2">
                          <span className="text-gray-600 text-sm font-medium">Desde:</span>
                          <p className={`font-bold text-2xl md:text-3xl ${tier.priceColor}`}>
                            {formatCurrency(partnerService.price)}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(event) => { event.stopPropagation(); void handleRequestToPartner(partnerService.partner.id, event) }}
                        disabled={requestActionLoading !== null}
                        className={`w-full font-bold py-3.5 px-4 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2 group/btn bg-gradient-to-r ${tier.buttonBg} text-white`}
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
                      {partnerService.partner.slug && partnerService.partner.isPublicProfile && (
                        <Link
                          href={`/pro/${partnerService.partner.slug}`}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
                        >
                          Ver perfil
                        </Link>
                      )}
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
                          <span className="font-semibold">💡 Aviso:</span> Te avisamos cuando haya profesionales para este servicio.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const message = `Hola, estoy interesado en el servicio de ${service.name} en ${getCityBySlug(slug)?.name || 'mi ciudad'}. ¿Cuándo estará disponible?`
                          if (whatsappPhone) window.open(`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`, '_blank')
                          else window.location.href = `mailto:hola@lohaggo.com?subject=${encodeURIComponent(`Interés en ${service.name}`)}&body=${encodeURIComponent(message)}`
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
                      Únete a nuestra comunidad de profesionales verificados y recibe solicitudes de clientes en tu ciudad.
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

      {/* Mobile sticky CTA */}
      {service.partners.length > 0 && !showRequestModal && (
        <>
          <div className="h-28 md:hidden" aria-hidden="true" />
          <StickyRequestBar
            label={`Solicitar ${service.name} · desde ${formatCurrency(fromPrice)}`}
            loading={requestActionLoading === 'ALL'}
            onRequest={() => void handleRequest()}
            whatsappPhone={whatsappPhone}
            whatsappText={whatsappOrderText}
            onWhatsAppClick={() => trackWhatsApp('sticky_bar')}
            aboveRaisedNav={Boolean(session)}
          />
        </>
      )}

      {/* Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-[100] sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto relative z-[101]">
            {successInfo ? (
              <RequestSuccess
                serviceName={service.name}
                cityName={currentCityName()}
                partnerCount={service.partners.length}
                partnerName={successInfo.partnerName}
                whatsappPhone={whatsappPhone}
                whatsappText={`Hola, acabo de pedir ${service.name} en LoHaggo. ¿Me ayudas? (ref: web-${slug})`}
                onWhatsAppClick={() => trackWhatsApp('request_success')}
                onClose={closeRequestModal}
              />
            ) : (
            <>
            <div className="sticky top-0 z-10 bg-gradient-to-r from-primary-500 to-secondary-500 p-4 md:p-6 text-white">
              <div className="flex items-center justify-between mb-3">
                <div className="min-w-0">
                  <h2 className="text-lg md:text-2xl font-bold truncate">Solicitar {service.name}</h2>
                  {selectedPartnerId && (
                    <p className="text-primary-100 text-xs md:text-sm mt-0.5 truncate">
                      Para: {service.partners.find(p => p.partner.id === selectedPartnerId)?.partner.user.name}
                    </p>
                  )}
                  <p className="text-primary-100 text-xs md:text-sm mt-0.5">
                    Paso {currentStep} de {TOTAL_STEPS} · {['Dónde', 'Cuándo', 'Qué necesitas'][currentStep - 1]}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Cerrar"
                  onClick={closeRequestModal}
                  className="text-white hover:bg-white/20 rounded-full p-2 transition shrink-0"
                >
                  <X size={22} />
                </button>
              </div>
              <div className="flex gap-2">
                {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((step) => (
                  <div
                    key={step}
                    className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${step <= currentStep ? 'bg-white' : 'bg-white/30'}`}
                  />
                ))}
              </div>
            </div>

            <div className="p-4 md:p-6">
              {/* Step 1: Dónde */}
              {currentStep === 1 && (
                <AddressStep
                  addresses={addresses}
                  mode={addresses.length > 0 ? addressMode : 'new'}
                  selectedAddressId={selectedAddressId}
                  newAddress={newAddress}
                  formatAddress={(a) => getAddressString(a as Address)}
                  onSelectSaved={(id) => { setSelectedAddressId(id); setAddressMode('saved') }}
                  onUseNew={() => setAddressMode('new')}
                  onNewAddressChange={setNewAddress}
                />
              )}

              {/* Step 2: Cuándo */}
              {currentStep === 2 && (
                <div className="space-y-3 animate-fadeIn">
                  <h3 className="text-lg md:text-xl font-bold text-gray-900">¿Cuándo lo necesitas?</h3>
                  {([
                    { id: 'asap', icon: '⚡', title: 'Lo antes posible', desc: 'Hoy o en cuanto un socio pueda', on: 'border-red-500 bg-red-50' },
                    { id: 'flexible', icon: '🗓️', title: 'Esta semana, horario flexible', desc: 'Los socios te proponen día y hora', on: 'border-secondary-500 bg-primary-50' },
                    { id: 'scheduled', icon: '📅', title: 'Elegir fecha y hora', desc: 'Tú decides cuándo', on: 'border-secondary-500 bg-primary-50' },
                  ] as const).map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-start gap-3 p-4 border-2 rounded-2xl cursor-pointer transition ${when === opt.id ? opt.on : 'border-gray-200 hover:border-primary-300'}`}
                    >
                      <input
                        type="radio"
                        name="when"
                        checked={when === opt.id}
                        onChange={() => setWhen(opt.id)}
                        className="mt-1 w-5 h-5 text-secondary-600"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xl" aria-hidden="true">{opt.icon}</span>
                          <span className="font-bold text-sm md:text-base text-gray-900">{opt.title}</span>
                        </div>
                        <p className="text-xs md:text-sm text-gray-600 mt-0.5">{opt.desc}</p>
                        {opt.id === 'scheduled' && when === 'scheduled' && (
                          <div className="grid grid-cols-2 gap-3 mt-3" onClick={(e) => e.stopPropagation()}>
                            <div>
                              <label htmlFor="req-date" className="block text-xs font-medium text-gray-700 mb-1">Fecha</label>
                              <input
                                id="req-date"
                                type="date"
                                min={new Date(Date.now() - 5 * 3600_000).toISOString().split('T')[0]}
                                value={requestData.preferredDate}
                                onChange={(e) => setRequestData({ ...requestData, preferredDate: e.target.value })}
                                className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 outline-none text-base"
                              />
                            </div>
                            <div>
                              <label htmlFor="req-time" className="block text-xs font-medium text-gray-700 mb-1">Hora</label>
                              <input
                                id="req-time"
                                type="time"
                                value={requestData.preferredTime}
                                onChange={(e) => setRequestData({ ...requestData, preferredTime: e.target.value })}
                                className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 outline-none text-base"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {/* Step 3: Qué necesitas */}
              {currentStep === 3 && (
                <div className="space-y-4 animate-fadeIn">
                  <h3 className="text-lg md:text-xl font-bold text-gray-900">¿Qué necesitas?</h3>

                  <div className="bg-gray-50 rounded-2xl p-3 space-y-2 text-xs text-gray-600">
                    <div className="flex items-start gap-2">
                      <MapPin className="text-secondary-600 mt-0.5 flex-shrink-0" size={14} />
                      <span className="break-words">
                        {addressMode === 'saved' && addresses.find(a => a.id === selectedAddressId)
                          ? getAddressString(addresses.find(a => a.id === selectedAddressId)!)
                          : newAddress.street ? newAddressString() : 'Sin dirección'}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Calendar className="text-secondary-600 mt-0.5 flex-shrink-0" size={14} />
                      <span>
                        {when === 'asap' && <span className="text-red-600 font-medium">⚡ Lo antes posible</span>}
                        {when === 'flexible' && 'Esta semana, horario flexible'}
                        {when === 'scheduled' && (requestData.preferredDate
                          ? `${new Date(`${requestData.preferredDate}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })} a las ${requestData.preferredTime || '—'}`
                          : 'Sin fecha')}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="req-notes" className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Cuéntale al socio qué necesitas
                    </label>
                    <textarea
                      id="req-notes"
                      rows={3}
                      maxLength={1500}
                      placeholder="Ej: la llave del lavamanos gotea, es un apto de 2 baños…"
                      value={requestData.notes}
                      onChange={(e) => setRequestData({ ...requestData, notes: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-secondary-500/20 focus:border-secondary-500 outline-none resize-none text-base"
                    />
                  </div>

                  <div>
                    <label htmlFor="req-budget" className="block text-sm font-semibold text-gray-700 mb-1.5">
                      Tu presupuesto <span className="font-normal text-gray-400">(opcional)</span>
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        id="req-budget"
                        type="number"
                        inputMode="numeric"
                        min="0"
                        step="1000"
                        placeholder={`Desde ${formatCurrency(minBudget)}`}
                        value={requestData.budget}
                        onChange={(e) => setRequestData({ ...requestData, budget: e.target.value })}
                        className="w-full pl-9 pr-4 py-3 border-2 border-gray-200 rounded-2xl focus:ring-2 focus:ring-secondary-500/20 focus:border-secondary-500 outline-none text-base"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Si lo pones, debe ser al menos {formatCurrency(minBudget)}.</p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-700 mb-1.5">
                      Fotos <span className="font-normal text-gray-400">(opcional, hasta 5)</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {photoPreviews.map((preview, index) => (
                        <div key={index} className="relative">
                          <img src={preview} alt={`Foto ${index + 1}`} className="h-20 w-20 object-cover rounded-xl border border-gray-200" />
                          <button
                            type="button"
                            aria-label={`Quitar foto ${index + 1}`}
                            onClick={() => removePhoto(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                      {photos.length < 5 && (
                        <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-secondary-500 bg-primary-50 text-secondary-600 hover:bg-primary-100">
                          <input type="file" accept="image/*" multiple onChange={handlePhotoChange} className="hidden" />
                          <Camera size={20} />
                          <span className="text-[11px] font-semibold">Agregar</span>
                        </label>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Con fotos recibes propuestas más precisas.</p>
                  </div>

                  {!session && (
                    <p className="rounded-2xl bg-blue-50 px-3 py-2 text-xs text-blue-900">
                      Al enviar confirmas tu celular con un código por WhatsApp. No necesitas crear contraseña.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer with Navigation */}
            <div className="sticky bottom-0 border-t bg-white px-4 md:px-6 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              <div className="flex gap-2 md:gap-3">
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className="px-4 md:px-6 py-3 border-2 border-gray-300 rounded-full hover:bg-gray-100 transition font-medium text-gray-700 flex items-center gap-1"
                    disabled={submitting}
                  >
                    <ChevronRight size={18} className="rotate-180" />
                    Atrás
                  </button>
                )}

                {currentStep < TOTAL_STEPS ? (
                  <button
                    type="button"
                    onClick={() => {
                      const error = currentStep === 1 ? validateAddressStep() : validateWhenStep()
                      if (error) {
                        setValidationModal({ isOpen: true, message: error })
                        return
                      }
                      setCurrentStep(currentStep + 1)
                    }}
                    className="flex-1 bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-4 md:px-6 py-3 rounded-full hover:from-primary-600 hover:to-secondary-600 transition font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary-600/30 text-base"
                  >
                    Continuar
                    <ChevronRight size={18} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submitRequest}
                    disabled={submitting}
                    className="flex-1 bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-4 md:px-6 py-3 rounded-full hover:from-primary-600 hover:to-secondary-600 transition font-semibold flex items-center justify-center gap-2 shadow-lg shadow-primary-600/30 disabled:opacity-50 disabled:cursor-not-allowed text-base"
                  >
                    {submitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
            </>
            )}
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
      {phoneVerifyOpen && (
        <PhoneVerify
          loginHref={withRedirect('/login', `/servicios/${slug}?resume=1`)}
          onClose={() => setPhoneVerifyOpen(false)}
          onVerified={async () => {
            setPhoneVerifyOpen(false)
            await updateSession()
            setSubmitAfterLogin(true)
          }}
        />
      )}
    </div>
  )
}
