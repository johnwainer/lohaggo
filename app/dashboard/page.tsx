'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  MessageSquare, Calendar, Clock, MapPin, Package, CheckCircle, DollarSign,
  TrendingUp, Activity, Search, Menu, X, Home, Bell,
  Settings, LogOut, ChevronRight, Plus, AlertCircle, User, XCircle, Star, Filter,
  Shield, CreditCard, GraduationCap, ShieldCheck, MessageCircle, Heart
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import Modal from '@/components/Modal'
import ConfirmModal from '@/components/ConfirmModal'
import ImageGalleryModal from '@/components/ImageGalleryModal'
import RatingModal from '@/components/RatingModal'
import UnifiedBookingCard from '@/components/shared/UnifiedBookingCard'
import ServiceIcon from '@/components/ServiceIcon'
import ClientDashboardNav from '@/components/ClientDashboardNav'
import { getBookingVisualState, type BookingVisualState } from '@/lib/booking-status'
import { useNotificationUnreadCount } from '@/hooks/useNotificationUnreadCount'

const ChatModal = dynamic(() => import('@/components/ChatModal'), {
  ssr: false,
  loading: () => null
})

interface Booking {
  id: string
  scheduledDate: string
  scheduledTime: string
  address: string
  notes: string
  status: string
  totalPrice: number
  createdAt: string
  proposalId?: string
  service: {
    name: string
    slug: string
    icon: string
    category: {
      name: string
    }
  }
  partner?: {
    user: {
      name: string
    }
  }
  review?: {
    id: string
    clientToPartnerRating: number | null
    partnerToClientRating: number | null
  }
  payment?: {
    id: string
    status: string
    totalAmount: number
  }
}

interface ServiceRequest {
  id: string
  address: string
  notes?: string
  city: string
  status: string
  expiresAt: string
  createdAt: string
  isUrgent?: boolean
  preferredDate?: string
  preferredTime?: string
  budget?: number
  service: {
    name: string
    slug: string
    icon: string
    category: {
      name: string
    }
  }
  photos?: Array<{
    id: string
    url: string
    order: number
  }>
  proposals: Array<{
    id: string
    price: number
    notes?: string
    status: string
    partner: {
      verified: boolean
      user: {
        name: string
      }
      documents?: Array<{
        type: string
        status: string
      }>
    }
  }>
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-secondary-100 text-secondary-800 border-secondary-200',
  CONFIRMED: 'bg-primary-100 text-primary-800 border-primary-200',
  IN_PROGRESS: 'bg-gray-100 text-gray-800 border-gray-300',
  COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  CANCELLED: 'bg-gray-100 text-gray-700 border-gray-200',
}

const statusLabels: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  PAID: 'Pagada',
  RATED: 'Calificada',
}

const requestStatusColors: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  ACCEPTED: 'bg-primary-100 text-primary-800 border-primary-200',
  EXPIRED: 'bg-gray-100 text-gray-800 border-gray-200',
  CANCELLED: 'bg-gray-100 text-gray-700 border-gray-200',
}

const requestStatusLabels: Record<string, string> = {
  ACTIVE: 'Activa',
  ACCEPTED: 'Aceptada',
  EXPIRED: 'Expirada',
  CANCELLED: 'Cancelada',
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const unreadNotifications = useNotificationUnreadCount(status === 'authenticated')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([])
  const [favoritePartners, setFavoritePartners] = useState<any[]>([])
  const [favoriteServices, setFavoriteServices] = useState<any[]>([])
  const [clientCommissionRate, setClientCommissionRate] = useState<number>(5.0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [requestSearchTerm, setRequestSearchTerm] = useState('')
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>('ALL')
  const [favoritesView, setFavoritesView] = useState<'partners' | 'services'>('partners')
  const [favoritesSearch, setFavoritesSearch] = useState('')
  const [favoritesSort, setFavoritesSort] = useState<'recent' | 'rating' | 'name'>('recent')
  const [mobileStatusSheetOpen, setMobileStatusSheetOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'requests' | 'favorites'>('overview')
  const [imageGallery, setImageGallery] = useState<{ isOpen: boolean; photos: Array<{ id: string; url: string; order: number }>; initialIndex: number }>({ isOpen: false, photos: [], initialIndex: 0 })


  const [modal, setModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  })

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    type: 'danger' | 'warning' | 'info'
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: () => {}
  })

  const [ratingModal, setRatingModal] = useState<{
    isOpen: boolean
    bookingId: string
    serviceName: string
    partnerName: string
    scheduledAt: string
  }>({
    isOpen: false,
    bookingId: '',
    serviceName: '',
    partnerName: '',
    scheduledAt: ''
  })

  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean
    bookingId: string
    serviceName: string
    amount: number
  }>({
    isOpen: false,
    bookingId: '',
    serviceName: '',
    amount: 0
  })

  const [chatModal, setChatModal] = useState<{
    isOpen: boolean
    proposalId: string
    partnerName: string
    serviceName: string
  }>({
    isOpen: false,
    proposalId: '',
    partnerName: '',
    serviceName: ''
  })
  const [favoriteServicePicker, setFavoriteServicePicker] = useState<{
    isOpen: boolean
    partnerId: string
    partnerName: string
    services: Array<{
      id: string
      name: string
      slug: string
      icon: string
      price?: number
      city?: string
    }>
  }>({
    isOpen: false,
    partnerId: '',
    partnerName: '',
    services: []
  })

  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})

  const [paymentBreakdown, setPaymentBreakdown] = useState<{
    serviceAmount: number
    clientCommission: number
    clientCommissionRate: number
    totalAmount: number
  } | null>(null)

  const [paymentMethods, setPaymentMethods] = useState<Array<{
    id: string
    lastFourDigits: string
    cardBrand: string
    isDefault: boolean
  }>>([])

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('')
  const [processingPayment, setProcessingPayment] = useState(false)
  const [loadingBreakdown, setLoadingBreakdown] = useState(false)

  useEffect(() => {
    if (status === 'authenticated') {
      fetchBookings()
      fetchServiceRequests()
      fetchFavorites()
    }
  }, [status])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && ['overview', 'bookings', 'requests', 'favorites'].includes(tab)) {
      setActiveTab(tab as 'overview' | 'bookings' | 'requests' | 'favorites')
    }
  }, [searchParams])

  useEffect(() => {
    if (status !== 'authenticated') return
    if (bookings.length === 0 && serviceRequests.length === 0) return

    const controller = new AbortController()
    let intervalId: ReturnType<typeof setInterval> | null = null

    const tick = () => {
      if (document.hidden) return
      fetchUnreadCounts(controller.signal)
    }

    tick()
    intervalId = setInterval(tick, 10000)

    const onVisibility = () => {
      if (!document.hidden) tick()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      if (intervalId) clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibility)
      controller.abort()
    }
  }, [status, bookings, serviceRequests])

  const fetchUnreadCounts = async (signal?: AbortSignal) => {
    try {
      const proposalIds = [
        ...bookings.map((b) => b.proposalId).filter((id): id is string => !!id),
        ...serviceRequests.flatMap((r) => (r.proposals || []).map((p) => p.id)),
      ]

      if (proposalIds.length === 0) {
        if (!signal?.aborted) setUnreadCounts({})
        return
      }

      const res = await fetch('/api/chat/unread-counts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalIds }),
        signal,
      })

      if (!res.ok) return

      const data = await res.json()
      if (!signal?.aborted) setUnreadCounts(data.counts || {})
    } catch {
      // aborted or network error — silent
    }
  }

  const fetchBookings = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/bookings')
      const data = await res.json()
      setBookings(Array.isArray(data) ? data : [])
    } catch (error) {
      setBookings([])
    } finally {
      setLoading(false)
    }
  }

  const fetchServiceRequests = async () => {
    try {
      const res = await fetch('/api/service-requests')
      const data = await res.json()

      const rawRequests = Array.isArray(data)
        ? data
        : Array.isArray(data?.serviceRequests)
          ? data.serviceRequests
          : []

      const normalizedRequests = rawRequests.map((request: any) => ({
        ...request,
        proposals: Array.isArray(request?.proposals) ? request.proposals : []
      })) as ServiceRequest[]

      setServiceRequests(normalizedRequests)

      if (data?.clientCommissionRate !== undefined) {
        setClientCommissionRate(data.clientCommissionRate)
      }
    } catch (error) {
      setServiceRequests([])
    }
  }

  const fetchFavorites = async () => {
    try {
      const [partnersRes, servicesRes] = await Promise.all([
        fetch('/api/favorites'),
        fetch('/api/favorite-services')
      ])

      if (partnersRes.ok) {
        const data = await partnersRes.json()
        setFavoritePartners(data)
      }

      if (servicesRes.ok) {
        const data = await servicesRes.json()
        setFavoriteServices(data)
      }
    } catch (error) {
      console.error('Error fetching favorites:', error)
      setFavoritePartners([])
      setFavoriteServices([])
    }
  }

  const removeFavorite = async (partnerId: string) => {
    try {
      const res = await fetch(`/api/favorites?partnerId=${partnerId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        setFavoritePartners(prev => prev.filter(fav => fav.partnerId !== partnerId))
      }
    } catch (error) {
      console.error('Error removing favorite:', error)
    }
  }

  const removeFavoriteService = async (serviceId: string) => {
    try {
      const res = await fetch(`/api/favorite-services?serviceId=${serviceId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        setFavoriteServices(prev => prev.filter(fav => fav.serviceId !== serviceId))
        setModal({
          isOpen: true,
          title: 'Service removed',
          message: 'The service has been removed from your favorites',
          type: 'success'
        })
      }
    } catch (error) {
      console.error('Error removing favorite service:', error)
      setModal({
        isOpen: true,
        title: 'Error',
        message: 'Could not remove the service from favorites',
        type: 'error'
      })
    }
  }

  const acceptProposal = async (proposalId: string, partnerName: string, price: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Aceptar Propuesta',
      message: `¿Estás seguro de aceptar la propuesta de ${partnerName} por ${formatCurrency(price)}?\n\nAl aceptar:\n• Se creará una reserva automáticamente\n• Se rechazarán las demás propuestas\n• El socio será notificado`,
      type: 'info',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/proposals/${proposalId}/accept`, {
            method: 'POST'
          })

          if (res.ok) {
            setModal({
              isOpen: true,
              title: '¡Propuesta Aceptada!',
              message: `Has aceptado la propuesta de ${partnerName}.\n\nSe ha creado una reserva automáticamente.`,
              type: 'success'
            })
            fetchServiceRequests()
            fetchBookings()
          } else {
            const error = await res.json()
            setModal({
              isOpen: true,
              title: 'Error al Aceptar',
              message: error.error || 'No se pudo aceptar la propuesta.',
              type: 'error'
            })
          }
        } catch (error) {
          setModal({
            isOpen: true,
            title: 'Error de Conexión',
            message: 'No se pudo conectar con el servidor.',
            type: 'error'
          })
        }
      }
    })
  }

  const cancelBooking = async (id: string, serviceName: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Cancelar Reserva',
      message: `¿Estás seguro de cancelar la reserva de "${serviceName}"?\n\nEsta acción no se puede deshacer.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/bookings/${id}`, {
            method: 'DELETE'
          })

          if (res.ok) {
            setModal({
              isOpen: true,
              title: 'Reserva Cancelada',
              message: `La reserva de "${serviceName}" ha sido cancelada exitosamente.`,
              type: 'success'
            })
            fetchBookings()
          } else {
            setModal({
              isOpen: true,
              title: 'Error al Cancelar',
              message: 'No se pudo cancelar la reserva.',
              type: 'error'
            })
          }
        } catch (error) {
          setModal({
            isOpen: true,
            title: 'Error de Conexión',
            message: 'No se pudo conectar con el servidor.',
            type: 'error'
          })
        }
      }
    })
  }

  const openPaymentModal = async (bookingId: string, serviceName: string, amount: number) => {
    setLoadingBreakdown(true)
    setPaymentBreakdown(null)

    try {
      const res = await fetch('/api/payment-methods')
      if (res.ok) {
        const methods = await res.json()
        setPaymentMethods(Array.isArray(methods) ? methods : [])

        if (Array.isArray(methods) && methods.length > 0) {
          const defaultMethod = methods.find((m: any) => m.isDefault)
          if (defaultMethod) {
            setSelectedPaymentMethod(defaultMethod.id)
          } else if (methods.length === 1) {
            // Auto-select the only available method when there's exactly one
            setSelectedPaymentMethod(methods[0].id)
          } else {
            setSelectedPaymentMethod('')
          }
        } else {
          setSelectedPaymentMethod('')
        }
      }
    } catch (error) {
      // Handle error silently
    }

    try {
      const breakdownRes = await fetch('/api/payments/breakdown', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookingId }),
      })

      if (breakdownRes.ok) {
        const data = await breakdownRes.json()
        setPaymentBreakdown(data.breakdown)
      }
    } catch (error) {
      // Handle error silently
    } finally {
      setLoadingBreakdown(false)
    }

    setPaymentModal({
      isOpen: true,
      bookingId,
      serviceName,
      amount
    })
  }

  const processPayment = async () => {
    if (!selectedPaymentMethod && paymentMethods.length > 0) {
      setModal({
        isOpen: true,
        title: 'Método de Pago Requerido',
        message: 'Por favor selecciona un método de pago.',
        type: 'warning'
      })
      return
    }

    setProcessingPayment(true)

    try {
      const res = await fetch('/api/payments/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: paymentModal.bookingId,
          paymentMethodId: selectedPaymentMethod || null
        })
      })

      const data = await res.json()

      if (res.ok) {
        const totalPaid = paymentBreakdown?.totalAmount || paymentModal.amount
        setModal({
          isOpen: true,
          title: '¡Pago Exitoso!',
          message: `El pago de ${formatCurrency(totalPaid)} ha sido procesado exitosamente.`,
          type: 'success'
        })
        setPaymentModal({ isOpen: false, bookingId: '', serviceName: '', amount: 0 })
        setPaymentBreakdown(null)
        fetchBookings()
      } else {
        setModal({
          isOpen: true,
          title: 'Error en el Pago',
          message: data.error || 'No se pudo procesar el pago.',
          type: 'error'
        })
      }
    } catch (error) {
      setModal({
        isOpen: true,
        title: 'Error de Conexión',
        message: 'No se pudo conectar con el servidor.',
        type: 'error'
      })
    } finally {
      setProcessingPayment(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="panel-page min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Cargando panel...</p>
        </div>
      </div>
    )
  }

  const totalSpent = bookings
    .filter(b => b.status === 'COMPLETED')
    .reduce((sum, b) => sum + b.totalPrice, 0)

  const pendingCount = bookings.filter(b => b.status === 'PENDING').length
  const confirmedCount = bookings.filter(b => b.status === 'CONFIRMED').length
  const completedCount = bookings.filter(b => b.status === 'COMPLETED').length
  const activeRequestsCount = serviceRequests.filter(r => r.status === 'ACTIVE').length
  const totalProposals = serviceRequests.reduce((total, req) => total + req.proposals.length, 0)

  const filteredBookings = bookings
    .filter(booking =>
      booking.service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.address.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter((booking) => {
      if (!filter) return true
      const visualState = getBookingVisualState('CLIENT', booking)
      return visualState === filter
    })
    .sort((a, b) => {
      const rank: Record<BookingVisualState, number> = {
        COMPLETED: 1,
        PAID: 2,
        PENDING: 3,
        CONFIRMED: 4,
        IN_PROGRESS: 5,
        RATED: 6,
        CANCELLED: 7,
      }
      const aState = getBookingVisualState('CLIENT', a)
      const bState = getBookingVisualState('CLIENT', b)
      const rankDiff = rank[aState] - rank[bState]
      if (rankDiff !== 0) return rankDiff
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

  const bookingFilterCounts = bookings.reduce<Record<string, number>>((acc, booking) => {
    const visualState = getBookingVisualState('CLIENT', booking)
    acc[visualState] = (acc[visualState] || 0) + 1
    return acc
  }, {})

  const requestStatusCounts = serviceRequests.reduce<Record<string, number>>((acc, request) => {
    acc[request.status] = (acc[request.status] || 0) + 1
    return acc
  }, {})

  const filteredRequests = serviceRequests
    .filter(request =>
      request.service.name.toLowerCase().includes(requestSearchTerm.toLowerCase()) ||
      request.address.toLowerCase().includes(requestSearchTerm.toLowerCase())
    )
    .filter(request => requestStatusFilter === 'ALL' || request.status === requestStatusFilter)
    .sort((a, b) => {
      const rank: Record<string, number> = { ACTIVE: 1, ACCEPTED: 2, EXPIRED: 3, CANCELLED: 4 }
      const rankDiff = (rank[a.status] || 99) - (rank[b.status] || 99)
      if (rankDiff !== 0) return rankDiff
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

  const filteredFavoritePartners = favoritePartners
    .filter((favorite) => {
      const partnerName = favorite.partner?.user?.name?.toLowerCase() || ''
      const servicesText = (favorite.partner?.services || [])
        .map((ps: any) => ps.service?.name || '')
        .join(' ')
        .toLowerCase()
      const query = favoritesSearch.toLowerCase()
      return partnerName.includes(query) || servicesText.includes(query)
    })
    .sort((a, b) => {
      if (favoritesSort === 'rating') {
        return (b.partner?.rating || 0) - (a.partner?.rating || 0)
      }
      if (favoritesSort === 'name') {
        return (a.partner?.user?.name || '').localeCompare(b.partner?.user?.name || '', 'es')
      }
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    })

  const filteredFavoriteServices = favoriteServices
    .filter((favorite) => {
      const serviceName = favorite.service?.name?.toLowerCase() || ''
      const categoryName = favorite.service?.category?.name?.toLowerCase() || ''
      const query = favoritesSearch.toLowerCase()
      return serviceName.includes(query) || categoryName.includes(query)
    })
    .sort((a, b) => {
      if (favoritesSort === 'name') {
        return (a.service?.name || '').localeCompare(b.service?.name || '', 'es')
      }
      if (favoritesSort === 'rating') {
        const aPartners = a.partners?.length || 0
        const bPartners = b.partners?.length || 0
        return bPartners - aPartners
      }
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    })

  const getVerificationBadges = (documents?: Array<{ type: string; status: string }>) => {
    if (!documents || documents.length === 0) return null

    const IDENTITY_TYPES = ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP']
    const EDUCATION_TYPES = ['DIPLOMA_BACHILLERATO', 'DIPLOMA_TECNICO', 'DIPLOMA_TECNOLOGO', 'DIPLOMA_PROFESIONAL', 'DIPLOMA_POSGRADO', 'CERTIFICADO_CURSO']

    const hasIdentity = documents.some(d => IDENTITY_TYPES.includes(d.type) && d.status === 'APPROVED')
    const hasEducation = documents.some(d => EDUCATION_TYPES.includes(d.type) && d.status === 'APPROVED')
    const hasBackground = documents.some(d => d.type === 'ANTECEDENTES' && d.status === 'APPROVED')

    return (
      <div className="flex items-center gap-1.5 ml-2">
        {hasIdentity && (
          <div className="group relative inline-block">
            <CreditCard size={16} className="text-primary-600" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap pointer-events-none z-50">
              Identidad verificada
            </span>
          </div>
        )}
        {hasEducation && (
          <div className="group relative inline-block">
            <GraduationCap size={16} className="text-secondary-600" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap pointer-events-none z-50">
              Educación verificada
            </span>
          </div>
        )}
        {hasBackground && (
          <div className="group relative inline-block">
            <Shield size={16} className="text-emerald-600" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap pointer-events-none z-50">
              Antecedentes verificados
            </span>
          </div>
        )}
      </div>
    )
  }

  const getRelativeTime = (isoDate: string) => {
    const now = Date.now()
    const target = new Date(isoDate).getTime()
    const diffMs = now - target
    const minutes = Math.floor(diffMs / (1000 * 60))
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (minutes < 1) return 'Ahora mismo'
    if (minutes < 60) return `Hace ${minutes} min`
    if (hours < 24) return `Hace ${hours} h`
    return `Hace ${days} d`
  }

  const handleFavoritePartnerRequest = (partner: any) => {
    const services = (partner.services || [])
      .filter((ps: any) => ps?.service?.slug)
      .map((ps: any) => ({
        id: ps.service.id,
        name: ps.service.name,
        slug: ps.service.slug,
        icon: ps.service.icon,
        price: ps.price,
        city: ps.city
      }))

    if (services.length === 0) {
      setModal({
        isOpen: true,
        title: 'Sin servicios disponibles',
        message: 'Este socio no tiene servicios activos en este momento.',
        type: 'warning'
      })
      return
    }

    if (services.length === 1) {
      router.push(`/servicios/${services[0].slug}?partnerId=${partner.id}`)
      return
    }

    setFavoriteServicePicker({
      isOpen: true,
      partnerId: partner.id,
      partnerName: partner.user?.name || 'Socio',
      services
    })
  }

  return (
    <div className="account-shell">
      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText={confirmModal.type === 'danger' ? 'Sí, cancelar' : 'Sí, aceptar'}
      />

      {paymentModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-cardHover max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Pagar servicio</h3>
            <p className="text-slate-600 mb-4">Servicio: <span className="font-semibold text-slate-900">{paymentModal.serviceName}</span></p>

            {loadingBreakdown ? (
              <div className="bg-slate-50 rounded-2xl p-6 mb-6 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent"></div>
              </div>
            ) : paymentBreakdown ? (
              <div className="bg-slate-50 rounded-2xl p-4 mb-6 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Precio del servicio</span>
                  <span className="font-medium text-slate-900">
                    ${paymentBreakdown.serviceAmount.toLocaleString('es-CO')} COP
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm pb-3 border-b border-slate-200">
                  <span className="text-slate-600">
                    Tarifa de servicio ({paymentBreakdown.clientCommissionRate}%)
                  </span>
                  <span className="font-medium text-slate-600">
                    +${paymentBreakdown.clientCommission.toLocaleString('es-CO')} COP
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <span className="text-base font-bold text-slate-900">Total a pagar</span>
                  <span className="text-2xl font-bold text-primary-600">
                    ${paymentBreakdown.totalAmount.toLocaleString('es-CO')} COP
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-2xl font-bold text-primary-600 mb-6">Total: {formatCurrency(paymentModal.amount)}</p>
            )}

            {paymentMethods.length > 0 ? (
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">Método de pago</label>
                <select
                  value={selectedPaymentMethod}
                  onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 bg-slate-50 focus:bg-white"
                >
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.cardBrand} •••• {method.lastFourDigits} {method.isDefault ? '(Predeterminada)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
                <p className="text-sm text-amber-800">No tienes métodos de pago guardados. Se procesará con Mercado Pago.</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setPaymentModal({ isOpen: false, bookingId: '', serviceName: '', amount: 0 })
                  setPaymentBreakdown(null)
                }}
                disabled={processingPayment}
                className="flex-1 px-4 py-3 border border-slate-200 text-slate-700 rounded-full hover:bg-slate-50 transition-colors font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={processPayment}
                disabled={processingPayment || loadingBreakdown}
                className="flex-1 bg-primary-600 text-white px-4 py-3 rounded-full hover:bg-primary-700 transition-colors font-semibold disabled:opacity-50 flex items-center justify-center gap-2 shadow-card"
              >
                {processingPayment ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    <DollarSign size={18} />
                    Pagar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <header className="account-header">
          <div className="hidden sm:block max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <div className="min-w-0 flex-1">
                  <h1 className="panel-title truncate">
                    {activeTab === 'overview' && 'Resumen General'}
                    {activeTab === 'bookings' && 'Mis Reservas'}
                    {activeTab === 'requests' && 'Mis Solicitudes'}
                    {activeTab === 'favorites' && 'Mis Favoritos'}
                  </h1>
                  <p className="panel-subtitle truncate hidden sm:block">
                    {activeTab === 'overview' && 'Vista general de tu actividad'}
                    {activeTab === 'bookings' && 'Gestiona tus reservas de servicios'}
                    {activeTab === 'requests' && 'Solicitudes y propuestas recibidas'}
                    {activeTab === 'favorites' && 'Tus profesionales favoritos'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <ClientDashboardNav
            bookingsCount={bookings.length}
            requestsCount={serviceRequests.length}
            favoritesCount={favoritePartners.length}
            notificationsCount={unreadNotifications}
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab)}
          />
        </header>

        <main className="account-main">
          {activeTab === 'overview' && (
            <div className="space-y-4 sm:space-y-6">
              <div>
                <p className="text-sm text-slate-500">Hola,</p>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  {session?.user?.name || 'Usuario'}
                </h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="rounded-2xl bg-white border border-slate-100 shadow-card p-4 sm:p-5">
                  <span className="inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-primary-100 text-primary-700 mb-2 sm:mb-3">
                    <Package className="w-4 h-4 sm:w-5 sm:h-5" />
                  </span>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 leading-none">{bookings.length}</p>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">Reservas</p>
                </div>
                <div className="rounded-2xl bg-white border border-slate-100 shadow-card p-4 sm:p-5">
                  <span className="inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-secondary-100 text-secondary-700 mb-2 sm:mb-3">
                    <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                  </span>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 leading-none">{serviceRequests.length}</p>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">Solicitudes</p>
                </div>
                <div className="rounded-2xl bg-white border border-slate-100 shadow-card p-4 sm:p-5">
                  <span className="inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-accent-100 text-accent-700 mb-2 sm:mb-3">
                    <Heart className="w-4 h-4 sm:w-5 sm:h-5" />
                  </span>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 leading-none">{favoritePartners.length}</p>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">Favoritos</p>
                </div>
                <div className="rounded-2xl bg-white border border-slate-100 shadow-card p-4 sm:p-5">
                  <span className="inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 mb-2 sm:mb-3">
                    <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
                  </span>
                  <p className="text-lg sm:text-2xl font-bold text-slate-900 leading-none">{formatCurrency(totalSpent)}</p>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">Gastado</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                  <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">
                    <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
                      <h3 className="text-base sm:text-lg font-semibold text-slate-900 flex items-center gap-2">
                        <Activity className="text-primary-600 w-5 h-5" />
                        Estado de reservas
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Resumen de tus servicios</p>
                    </div>
                    <div className="p-4 sm:p-6">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 sm:p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                              <Clock className="w-3.5 h-3.5" />
                            </span>
                          </div>
                          <p className="text-2xl sm:text-3xl font-bold text-slate-900 leading-none">{pendingCount}</p>
                          <p className="text-xs text-slate-500 mt-1">Pendientes</p>
                        </div>
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 sm:p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                              <CheckCircle className="w-3.5 h-3.5" />
                            </span>
                          </div>
                          <p className="text-2xl sm:text-3xl font-bold text-slate-900 leading-none">{confirmedCount}</p>
                          <p className="text-xs text-slate-500 mt-1">Confirmadas</p>
                        </div>
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 sm:p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
                              <Activity className="w-3.5 h-3.5" />
                            </span>
                          </div>
                          <p className="text-2xl sm:text-3xl font-bold text-slate-900 leading-none">{bookings.filter(b => b.status === 'IN_PROGRESS').length}</p>
                          <p className="text-xs text-slate-500 mt-1">En progreso</p>
                        </div>
                        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 sm:p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                              <Star className="w-3.5 h-3.5" />
                            </span>
                          </div>
                          <p className="text-2xl sm:text-3xl font-bold text-slate-900 leading-none">{bookings.filter(b => b.status === 'COMPLETED').length}</p>
                          <p className="text-xs text-slate-500 mt-1">Completadas</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">
                    <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <h3 className="text-base sm:text-lg font-semibold text-slate-900 flex items-center gap-2">
                          <Clock className="text-primary-600 w-5 h-5" />
                          Actividad reciente
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Últimas reservas</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('bookings')}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:text-primary-800 transition-colors"
                      >
                        Ver todo
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-3 sm:p-4">
                      {bookings.slice(0, 4).length === 0 ? (
                        <div className="text-center py-10">
                          <div className="bg-slate-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                            <Package className="text-slate-400 w-7 h-7" />
                          </div>
                          <p className="text-slate-700 font-semibold mb-1">No hay actividad reciente</p>
                          <p className="text-sm text-slate-500">Tus reservas aparecerán aquí</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {bookings.slice(0, 4).map((booking) => (
                            <div key={booking.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
                              <ServiceIcon slug={booking.service.slug} emoji={booking.service.icon} size="lg" animate />
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-900 text-sm truncate">{booking.service.name}</p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="text-xs text-slate-500 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(booking.scheduledDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                                  </span>
                                  <span className="text-xs text-slate-400">·</span>
                                  <span className="text-xs text-slate-500">{booking.scheduledTime}</span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1.5">
                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                                  booking.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                                  booking.status === 'CONFIRMED' ? 'bg-primary-100 text-primary-700' :
                                  booking.status === 'IN_PROGRESS' ? 'bg-secondary-100 text-secondary-700' :
                                  'bg-slate-100 text-slate-700'
                                }`}>
                                  {statusLabels[booking.status]}
                                </span>
                                <p className="text-sm font-bold text-slate-900">{formatCurrency(booking.totalPrice)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 sm:space-y-6">
                  <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                          <MessageSquare className="w-5 h-5" />
                        </span>
                        <h3 className="text-base sm:text-lg font-semibold text-slate-900">Solicitudes</h3>
                      </div>
                    </div>
                    <div className="space-y-2.5 mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Activas</span>
                        <span className="text-xl font-bold text-slate-900">{activeRequestsCount}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-500">Propuestas</span>
                        <span className="text-xl font-bold text-slate-900">{totalProposals}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('requests')}
                      className="w-full bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold py-3 rounded-full transition-colors flex items-center justify-center gap-2"
                    >
                      Ver solicitudes
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent-100 text-accent-700">
                          <Heart className="w-5 h-5" />
                        </span>
                        <h3 className="text-base sm:text-lg font-semibold text-slate-900">Favoritos</h3>
                      </div>
                      <button
                        onClick={() => setActiveTab('favorites')}
                        className="text-sm font-semibold text-primary-700 hover:text-primary-800"
                      >
                        Ver todo
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                        <p className="text-xs text-slate-500 mb-1">Socios</p>
                        <p className="text-xl font-bold text-slate-900">{favoritePartners.length}</p>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                        <p className="text-xs text-slate-500 mb-1">Servicios</p>
                        <p className="text-xl font-bold text-slate-900">{favoriteServices.length}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500">
                      Accede a tus favoritos para solicitar más rápido.
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-5 sm:p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-secondary-100 text-secondary-700">
                        <Plus className="w-5 h-5" />
                      </span>
                      <h3 className="text-base sm:text-lg font-semibold text-slate-900">Acciones rápidas</h3>
                    </div>
                    <div className="space-y-2">
                      <button
                        onClick={() => router.push('/servicios')}
                        data-testid="dashboard-cta-search-services"
                        className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-100 text-slate-900 font-medium py-3 rounded-xl transition-colors flex items-center justify-between px-4"
                      >
                        <span className="flex items-center gap-2 text-sm">
                          <Search className="w-4 h-4 text-slate-500" />
                          Buscar servicios
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </button>
                      <button
                        onClick={() => router.push('/profile')}
                        data-testid="dashboard-cta-profile"
                        className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-100 text-slate-900 font-medium py-3 rounded-xl transition-colors flex items-center justify-between px-4"
                      >
                        <span className="flex items-center gap-2 text-sm">
                          <User className="w-4 h-4 text-slate-500" />
                          Mi perfil
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </button>
                      <button
                        onClick={() => router.push('/dashboard/addresses')}
                        data-testid="dashboard-cta-addresses"
                        className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-100 text-slate-900 font-medium py-3 rounded-xl transition-colors flex items-center justify-between px-4"
                      >
                        <span className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-slate-500" />
                          Direcciones
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bookings' && (
            <div className="space-y-4 sm:space-y-6">
              <div className="sticky top-14 sm:top-16 z-20 bg-white rounded-2xl shadow-card border border-slate-100 p-3 sm:p-4">
                <div className="hidden sm:flex sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                    <input
                      type="text"
                      placeholder="Buscar por servicio o dirección..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-full focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all bg-slate-50 focus:bg-white text-sm"
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    <button
                      onClick={() => setFilter('')}
                      className={`px-4 py-2.5 rounded-full text-sm font-semibold transition-colors ${
                        filter === ''
                          ? 'bg-primary-600 text-white shadow-card'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      Todas ({bookings.length})
                    </button>
                    {(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'PAID', 'RATED', 'CANCELLED'] as const).map((key) => (
                      <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className={`px-4 py-2.5 rounded-full text-sm font-semibold transition-colors ${
                          filter === key
                            ? 'bg-primary-600 text-white shadow-card'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {statusLabels[key]} ({bookingFilterCounts[key] || 0})
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:hidden space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      placeholder="Buscar servicio o dirección..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full rounded-full border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 focus:bg-white"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-600">
                      {filteredBookings.length} resultados {filter ? `· ${statusLabels[filter]}` : '· Todas'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setMobileStatusSheetOpen(true)}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                    >
                      <Filter className="h-4 w-4" />
                      Estados
                    </button>
                  </div>
                </div>
              </div>

              {mobileStatusSheetOpen && (
                <div className="fixed inset-0 z-40 sm:hidden">
                  <button
                    type="button"
                    aria-label="Cerrar filtros"
                    onClick={() => setMobileStatusSheetOpen(false)}
                    className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                  />
                  <div className="absolute bottom-0 left-0 right-0 rounded-t-3xl bg-white p-4 shadow-sheet pb-[env(safe-area-inset-bottom)]">
                    <div className="flex justify-center pt-1 pb-2" aria-hidden="true">
                      <span className="h-1.5 w-12 rounded-full bg-slate-200" />
                    </div>
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-slate-900">Filtrar por estado</h4>
                      <button
                        type="button"
                        onClick={() => setMobileStatusSheetOpen(false)}
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600"
                      >
                        Cerrar
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pb-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFilter('')
                          setMobileStatusSheetOpen(false)
                        }}
                        className={`rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
                          filter === '' ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        Todas ({bookings.length})
                      </button>
                      {(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'PAID', 'RATED', 'CANCELLED'] as const).map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setFilter(key)
                            setMobileStatusSheetOpen(false)
                          }}
                          className={`rounded-full px-3 py-2 text-xs font-semibold transition-colors ${
                            filter === key ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {statusLabels[key]} ({bookingFilterCounts[key] || 0})
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {filteredBookings.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-card p-10 sm:p-14 text-center border border-slate-100">
                  <div className="bg-slate-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                    <Package className="text-slate-400 w-9 h-9" />
                  </div>
                  <p className="text-slate-900 text-lg font-bold mb-1">No hay reservas</p>
                  <p className="text-slate-500 text-sm">Aquí aparecerán tus reservas cuando realices alguna</p>
                  <button
                    type="button"
                    onClick={() => router.push('/servicios')}
                    className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 shadow-card"
                  >
                    Explorar servicios
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {filteredBookings.map((booking) => {
                    const visualState = getBookingVisualState('CLIENT', booking)
                    const priorityBadges: string[] = []
                    if (visualState === 'COMPLETED' || booking.payment?.status === 'PENDING') {
                      priorityBadges.push('PAGO PENDIENTE')
                    }
                    if (visualState === 'PAID') priorityBadges.push('SIN CALIFICAR')

                    const primaryAction =
                      visualState === 'COMPLETED'
                        ? {
                            label: 'Pagar ahora',
                            onClick: () => openPaymentModal(booking.id, booking.service.name, booking.totalPrice),
                            icon: <DollarSign size={18} />,
                            variant: 'primary' as const,
                            disabled: session?.user?.isActive === false,
                          }
                        : visualState === 'PAID'
                        ? {
                            label: 'Calificar servicio',
                            onClick: () =>
                              setRatingModal({
                                isOpen: true,
                                bookingId: booking.id,
                                serviceName: booking.service.name,
                                partnerName: booking.partner?.user.name || 'el socio',
                                scheduledAt: `${new Date(booking.scheduledDate).toLocaleDateString('es-ES')} · ${booking.scheduledTime}`,
                              }),
                            icon: <Star size={18} />,
                            variant: 'primary' as const,
                            disabled: session?.user?.isActive === false,
                          }
                        : undefined

                    const secondaryActions: Array<{
                      label: string
                      onClick: () => void
                      icon?: ReactNode
                      variant?: 'primary' | 'secondary' | 'ghost'
                      disabled?: boolean
                      badge?: number
                    }> = []

                    if (booking.proposalId && booking.status !== 'CANCELLED') {
                      secondaryActions.push({
                        label: 'Chat',
                        onClick: () =>
                          setChatModal({
                            isOpen: true,
                            proposalId: booking.proposalId!,
                            partnerName: booking.partner?.user.name || 'Socio',
                            serviceName: booking.service.name,
                          }),
                        icon: <MessageCircle size={16} />,
                        variant: 'secondary',
                        disabled: session?.user?.isActive === false,
                        badge: unreadCounts[booking.proposalId] || 0,
                      })
                    }

                    if ((booking.status === 'PENDING' || booking.status === 'CONFIRMED') && booking.payment?.status !== 'APPROVED') {
                      secondaryActions.push({
                        label: 'Cancelar',
                        onClick: () => cancelBooking(booking.id, booking.service.name),
                        icon: <XCircle size={16} />,
                        variant: 'secondary',
                        disabled: session?.user?.isActive === false,
                      })
                    }

                    return (
                      <UnifiedBookingCard
                        key={booking.id}
                        role="CLIENT"
                        serviceName={booking.service.name}
                        serviceIcon={booking.service.icon}
                        serviceSlug={booking.service.slug}
                        counterpartName={booking.partner?.user.name || 'Socio'}
                        counterpartLabel="Socio"
                        visualState={visualState}
                        totalPrice={formatCurrency(booking.totalPrice)}
                        scheduledDate={booking.scheduledDate}
                        scheduledTime={booking.scheduledTime}
                        address={booking.address}
                        notes={booking.notes}
                        priorityBadges={priorityBadges}
                        primaryAction={primaryAction}
                        secondaryActions={secondaryActions}
                        metadataInline={`${new Date(booking.scheduledDate).toLocaleDateString('es-ES')} · ${booking.scheduledTime} · ${booking.address}`}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'favorites' && (
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between mb-3">
                  <div className="inline-flex rounded-full bg-slate-100 p-1 w-fit">
                    <button
                      onClick={() => setFavoritesView('partners')}
                      className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-colors ${
                        favoritesView === 'partners'
                          ? 'bg-white text-primary-700 shadow-card'
                          : 'text-slate-600'
                      }`}
                    >
                      Socios ({favoritePartners.length})
                    </button>
                    <button
                      onClick={() => setFavoritesView('services')}
                      className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-colors ${
                        favoritesView === 'services'
                          ? 'bg-white text-primary-700 shadow-card'
                          : 'text-slate-600'
                      }`}
                    >
                      Servicios ({favoriteServices.length})
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500">Ordenar</label>
                    <select
                      value={favoritesSort}
                      onChange={(e) => setFavoritesSort(e.target.value as 'recent' | 'rating' | 'name')}
                      className="text-xs sm:text-sm border border-slate-200 rounded-full px-3 py-1.5 bg-white"
                    >
                      <option value="recent">Recientes</option>
                      <option value="rating">Mejor valorados</option>
                      <option value="name">Nombre A-Z</option>
                    </select>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    value={favoritesSearch}
                    onChange={(e) => setFavoritesSearch(e.target.value)}
                    placeholder={favoritesView === 'partners' ? 'Buscar socio o servicio...' : 'Buscar servicio o categoría...'}
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-full bg-slate-50 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 focus:bg-white"
                  />
                </div>
              </div>

              {favoritesView === 'partners' ? (
                filteredFavoritePartners.length === 0 ? (
                  <div className="bg-white rounded-2xl shadow-card p-10 sm:p-14 text-center border border-slate-100">
                    <div className="bg-accent-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                      <Heart size={32} className="text-accent-600" />
                    </div>
                    <p className="text-slate-900 text-lg font-bold mb-1">No tienes socios favoritos</p>
                    <p className="text-slate-500 text-sm sm:text-base mb-5">Guarda profesionales para contratarlos más rápido.</p>
                    <button
                      onClick={() => router.push('/servicios')}
                      className="bg-primary-600 text-white px-6 py-2.5 rounded-full hover:bg-primary-700 transition-colors font-semibold shadow-card"
                    >
                      Explorar servicios
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {filteredFavoritePartners.map((favorite) => {
                      const partner = favorite.partner
                      return (
                        <div key={favorite.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-card">
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center font-bold text-primary-700 text-lg shrink-0">
                              {partner.user.name?.charAt(0) || 'P'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-sm sm:text-base text-slate-900 truncate">{partner.user.name}</p>
                                {partner.verified && <ShieldCheck size={14} className="text-emerald-600 shrink-0" />}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-600 mb-2">
                                <Star size={14} className="text-amber-500 fill-amber-500" />
                                <span>{partner.rating.toFixed(1)}</span>
                                <span className="text-slate-400">({partner.totalReviews})</span>
                              </div>
                              <p className="text-xs text-slate-500 truncate">
                                {(partner.services || []).slice(0, 2).map((ps: any) => ps.service.name).join(' · ') || 'Sin servicios visibles'}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleFavoritePartnerRequest(partner)}
                              className="w-full bg-primary-600 text-white px-3 py-2.5 rounded-full hover:bg-primary-700 transition-colors text-sm font-semibold disabled:opacity-50"
                            >
                              Solicitar
                            </button>
                            <button
                              onClick={() => removeFavorite(partner.id)}
                              className="w-full bg-white border border-slate-200 text-slate-700 px-3 py-2.5 rounded-full hover:bg-slate-50 transition-colors text-sm font-medium"
                            >
                              Quitar
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              ) : (
                filteredFavoriteServices.length === 0 ? (
                  <div className="bg-white rounded-2xl shadow-card p-10 sm:p-14 text-center border border-slate-100">
                    <div className="bg-accent-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                      <Heart size={32} className="text-accent-600" />
                    </div>
                    <p className="text-slate-900 text-lg font-bold mb-1">No tienes servicios favoritos</p>
                    <p className="text-slate-500 text-sm sm:text-base mb-5">Marca servicios para volver a contratarlos en segundos.</p>
                    <button
                      onClick={() => router.push('/servicios')}
                      className="bg-primary-600 text-white px-6 py-2.5 rounded-full hover:bg-primary-700 transition-colors font-semibold shadow-card"
                    >
                      Explorar servicios
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {filteredFavoriteServices.map((favorite) => {
                      const service = favorite.service
                      return (
                        <div key={favorite.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-card">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center shrink-0">
                                <ServiceIcon slug={service.slug} emoji={service.icon} size="sm" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-sm sm:text-base text-slate-900 truncate">{service.name}</p>
                                <p className="text-xs text-slate-500">{service.category.name}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => removeFavoriteService(service.id)}
                              className="shrink-0 p-2 rounded-full bg-accent-50 text-accent-600 hover:bg-accent-100 transition-colors"
                              title="Quitar de favoritos"
                            >
                              <Heart size={16} fill="currentColor" />
                            </button>
                          </div>
                          <p className="text-xs text-slate-500 mb-3">
                            {favorite.partners?.length || 0} {(favorite.partners?.length || 0) === 1 ? 'socio disponible' : 'socios disponibles'}
                          </p>
                          <button
                            onClick={() => router.push(`/servicios/${service.slug}`)}
                            className="w-full bg-primary-600 text-white px-3 py-2.5 rounded-full hover:bg-primary-700 transition-colors text-sm font-semibold"
                          >
                            Ver servicio
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )
              )}
            </div>
          )}

          {activeTab === 'requests' && (
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-white rounded-2xl shadow-card border border-slate-100 p-3 sm:p-4">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Buscar por servicio o dirección..."
                    value={requestSearchTerm}
                    onChange={(e) => setRequestSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm sm:text-base border border-slate-200 rounded-full focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all bg-slate-50 focus:bg-white"
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {[
                    { value: 'ALL', label: 'Todas', count: serviceRequests.length },
                    { value: 'ACTIVE', label: 'Activas', count: requestStatusCounts.ACTIVE || 0 },
                    { value: 'ACCEPTED', label: 'Aceptadas', count: requestStatusCounts.ACCEPTED || 0 },
                    { value: 'EXPIRED', label: 'Expiradas', count: requestStatusCounts.EXPIRED || 0 },
                    { value: 'CANCELLED', label: 'Canceladas', count: requestStatusCounts.CANCELLED || 0 },
                  ].map((option) => {
                    const isActive = requestStatusFilter === option.value
                    return (
                      <button
                        key={option.value}
                        onClick={() => setRequestStatusFilter(option.value)}
                        className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors ${
                          isActive
                            ? 'bg-primary-600 text-white shadow-card'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <span>{option.label}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                          isActive ? 'bg-white/20 text-white' : 'bg-white text-slate-600'
                        }`}>
                          {option.count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {filteredRequests.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-card p-10 sm:p-14 text-center border border-slate-100">
                  <div className="bg-primary-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="text-primary-600 w-9 h-9" />
                  </div>
                  <p className="text-slate-900 text-lg font-bold mb-1">No hay solicitudes para este filtro</p>
                  <p className="text-slate-500 text-sm">Prueba con otro estado o crea una nueva solicitud.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:gap-4">
                  {filteredRequests.map((request) => {
                    const sortedProposals = [...request.proposals].sort((a, b) => {
                      const IDENTITY_TYPES = ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP']
                      const EDUCATION_TYPES = ['DIPLOMA_BACHILLERATO', 'DIPLOMA_TECNICO', 'DIPLOMA_TECNOLOGO', 'DIPLOMA_PROFESIONAL', 'DIPLOMA_POSGRADO', 'CERTIFICADO_CURSO']

                      const hasIdentityA = a.partner.documents?.some((d: any) =>
                        IDENTITY_TYPES.includes(d.type) && d.status === 'APPROVED'
                      )
                      const hasEducationA = a.partner.documents?.some((d: any) =>
                        EDUCATION_TYPES.includes(d.type) && d.status === 'APPROVED'
                      )
                      const hasBackgroundA = a.partner.documents?.some((d: any) =>
                        d.type === 'ANTECEDENTES' && d.status === 'APPROVED'
                      )
                      const isFullyVerifiedA = hasIdentityA && hasEducationA && hasBackgroundA

                      const hasIdentityB = b.partner.documents?.some((d: any) =>
                        IDENTITY_TYPES.includes(d.type) && d.status === 'APPROVED'
                      )
                      const hasEducationB = b.partner.documents?.some((d: any) =>
                        EDUCATION_TYPES.includes(d.type) && d.status === 'APPROVED'
                      )
                      const hasBackgroundB = b.partner.documents?.some((d: any) =>
                        d.type === 'ANTECEDENTES' && d.status === 'APPROVED'
                      )
                      const isFullyVerifiedB = hasIdentityB && hasEducationB && hasBackgroundB

                      if (isFullyVerifiedA && !isFullyVerifiedB) return -1
                      if (!isFullyVerifiedA && isFullyVerifiedB) return 1
                      return 0
                    })

                    return (
                      <div
                        key={request.id}
                        className="bg-white rounded-2xl border border-slate-100 shadow-card p-4 sm:p-5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] sm:text-xs font-bold px-2.5 py-1 rounded-full border ${requestStatusColors[request.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                              {requestStatusLabels[request.status]}
                            </span>
                            {request.isUrgent && (
                              <span className="text-[11px] sm:text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                                Urgente
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{getRelativeTime(request.createdAt)}</p>
                        </div>

                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-11 h-11 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0">
                            <ServiceIcon slug={request.service.slug} emoji={request.service.icon} size="sm" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">{request.service.name}</p>
                            <p className="text-xs sm:text-sm text-gray-500">{request.service.category.name}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[11px] text-gray-500">Propuestas</p>
                            <p className="text-base sm:text-lg font-bold text-primary-600">{request.proposals.length}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 text-xs sm:text-sm">
                          <div className="flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
                            <MapPin size={14} className="text-gray-500 shrink-0" />
                            <span className="text-gray-700 truncate">{request.address}, {request.city}</span>
                          </div>
                          <div className="flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
                            <Calendar size={14} className="text-gray-500 shrink-0" />
                            <span className="text-gray-700 truncate">
                              {request.preferredDate
                                ? `${new Date(request.preferredDate).toLocaleDateString('es-ES')}${request.preferredTime ? ` · ${request.preferredTime}` : ''}`
                                : 'Sin fecha preferida'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
                            <Clock size={14} className="text-gray-500 shrink-0" />
                            <span className="text-gray-700">Expira: {new Date(request.expiresAt).toLocaleDateString('es-ES')}</span>
                          </div>
                          <div className="flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
                            <DollarSign size={14} className="text-gray-500 shrink-0" />
                            <span className="text-gray-700">
                              {request.budget ? `Presupuesto: ${formatCurrency(request.budget)}` : 'Sin presupuesto definido'}
                            </span>
                          </div>
                        </div>

                        {request.notes && (
                          <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
                            <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Detalles</p>
                            <p className="text-sm text-gray-700">{request.notes}</p>
                          </div>
                        )}

                        {request.photos && request.photos.length > 0 && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs sm:text-sm font-medium text-gray-700">Evidencias</p>
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-100">
                                {request.photos.length} fotos
                              </span>
                            </div>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                              {request.photos.sort((a, b) => a.order - b.order).map((photo, index) => (
                                <button
                                  key={photo.id}
                                  type="button"
                                  className="relative rounded-lg overflow-hidden border border-gray-200"
                                  onClick={() => setImageGallery({ isOpen: true, photos: request.photos || [], initialIndex: index })}
                                >
                                  <img
                                    src={photo.url}
                                    alt="Foto de la solicitud"
                                    className="w-full h-20 sm:h-24 object-cover"
                                  />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {request.proposals.length > 0 ? (
                          <div className="border-t border-gray-100 pt-3 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-sm sm:text-base text-gray-900">Propuestas</h4>
                              <span className="text-xs text-gray-500">{request.proposals.length} disponibles</span>
                            </div>
                            {sortedProposals.map((proposal) => {
                              const IDENTITY_TYPES = ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP']
                              const EDUCATION_TYPES = ['DIPLOMA_BACHILLERATO', 'DIPLOMA_TECNICO', 'DIPLOMA_TECNOLOGO', 'DIPLOMA_PROFESIONAL', 'DIPLOMA_POSGRADO', 'CERTIFICADO_CURSO']

                              const hasIdentity = proposal.partner.documents?.some((d: any) =>
                                IDENTITY_TYPES.includes(d.type) && d.status === 'APPROVED'
                              )
                              const hasEducation = proposal.partner.documents?.some((d: any) =>
                                EDUCATION_TYPES.includes(d.type) && d.status === 'APPROVED'
                              )
                              const hasBackground = proposal.partner.documents?.some((d: any) =>
                                d.type === 'ANTECEDENTES' && d.status === 'APPROVED'
                              )
                              const isFullyVerified = hasIdentity && hasEducation && hasBackground
                              const totalAmount = proposal.price * (1 + clientCommissionRate / 100)
                              const canAccept = request.status === 'ACTIVE' && proposal.status === 'PENDING'
                              const canChat = proposal.status === 'ACCEPTED' || canAccept

                              return (
                                <div
                                  key={proposal.id}
                                  className={`rounded-xl border p-3 ${
                                    isFullyVerified
                                      ? 'border-emerald-200 bg-emerald-50/40'
                                      : 'border-gray-200 bg-white'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3 mb-2">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <p className="font-semibold text-sm sm:text-base text-gray-900 truncate">{proposal.partner.user.name}</p>
                                        {isFullyVerified && <ShieldCheck size={14} className="text-emerald-600 shrink-0" />}
                                        {proposal.status === 'ACCEPTED' && (
                                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                                            Aceptada
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {getVerificationBadges(proposal.partner.documents)}
                                      </div>
                                    </div>
                                    <p className="text-lg font-bold text-primary-600 shrink-0">{formatCurrency(totalAmount)}</p>
                                  </div>

                                  {proposal.notes && (
                                    <p className="text-xs sm:text-sm text-gray-600 mb-2">{proposal.notes}</p>
                                  )}

                                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                                    <div className="rounded-lg bg-gray-50 border border-gray-100 px-2 py-1.5">
                                      <p className="text-gray-500">Servicio</p>
                                      <p className="font-semibold text-gray-800">{formatCurrency(proposal.price)}</p>
                                    </div>
                                    <div className="rounded-lg bg-gray-50 border border-gray-100 px-2 py-1.5">
                                      <p className="text-gray-500">Tarifa ({clientCommissionRate}%)</p>
                                      <p className="font-semibold text-gray-800">{formatCurrency(proposal.price * (clientCommissionRate / 100))}</p>
                                    </div>
                                  </div>

                                  <div className="flex flex-col sm:flex-row gap-2">
                                    {canAccept && (
                                      <button
                                        onClick={() => acceptProposal(proposal.id, proposal.partner.user.name, proposal.price)}
                                        disabled={session?.user?.isActive === false}
                                        className="w-full sm:flex-1 bg-emerald-600 text-white px-3 py-2.5 rounded-full hover:bg-emerald-700 transition-colors font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-card"
                                      >
                                        <CheckCircle size={16} />
                                        Aceptar propuesta
                                      </button>
                                    )}
                                    {canChat && (
                                      <button
                                        onClick={() => setChatModal({
                                          isOpen: true,
                                          proposalId: proposal.id,
                                          partnerName: proposal.partner.user.name,
                                          serviceName: request.service.name
                                        })}
                                        disabled={session?.user?.isActive === false}
                                        className={`w-full ${canAccept ? 'sm:flex-1' : ''} bg-white border border-primary-200 text-primary-700 px-3 py-2.5 rounded-full hover:bg-primary-50 transition-colors font-medium text-sm flex items-center justify-center gap-2 relative disabled:opacity-50 disabled:cursor-not-allowed`}
                                      >
                                        <MessageCircle size={16} />
                                        Chat
                                        {unreadCounts[proposal.id] > 0 && (
                                          <span className="absolute -top-1.5 -right-1.5 bg-primary-600 text-white text-[10px] font-bold rounded-full h-5 min-w-5 px-1 flex items-center justify-center">
                                            {unreadCounts[proposal.id]}
                                          </span>
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="border-t border-gray-100 pt-3">
                            <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-3 text-center">
                              <p className="text-sm font-semibold text-blue-900">Esperando propuestas de socios</p>
                              <p className="text-xs text-blue-700 mt-1">Expira el {new Date(request.expiresAt).toLocaleDateString('es-ES')}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <Modal
        isOpen={modal.isOpen}
        onClose={() => setModal({ ...modal, isOpen: false })}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
      />

      {imageGallery.isOpen && (
        <ImageGalleryModal
          onClose={() => setImageGallery({ isOpen: false, photos: [], initialIndex: 0 })}
          photos={imageGallery.photos}
          initialIndex={imageGallery.initialIndex}
        />
      )}

      {favoriteServicePicker.isOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/45 flex items-end sm:items-center justify-center"
          onClick={() => setFavoriteServicePicker({ isOpen: false, partnerId: '', partnerName: '', services: [] })}
        >
          <div
            className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-gray-200 max-h-[82vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 sm:px-6 pt-3 pb-4 border-b border-gray-100">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3 sm:hidden" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base sm:text-lg font-bold text-gray-900">Elige el servicio</p>
                  <p className="text-sm text-gray-500">
                    {favoriteServicePicker.partnerName} presta {favoriteServicePicker.services.length} servicios
                  </p>
                </div>
                <button
                  onClick={() => setFavoriteServicePicker({ isOpen: false, partnerId: '', partnerName: '', services: [] })}
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
                  aria-label="Cerrar selector"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-3 sm:p-4 overflow-y-auto max-h-[62vh] space-y-2.5">
              {favoriteServicePicker.services.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => {
                    setFavoriteServicePicker({ isOpen: false, partnerId: '', partnerName: '', services: [] })
                    router.push(`/servicios/${service.slug}?partnerId=${favoriteServicePicker.partnerId}`)
                  }}
                  className="w-full rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50/40 transition-all px-3 py-3 text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0">
                        <ServiceIcon slug={service.slug} emoji={service.icon} size="sm" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm sm:text-base text-gray-900 truncate">{service.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {typeof service.price === 'number' && (
                            <span className="text-xs text-gray-600">{formatCurrency(service.price)}</span>
                          )}
                          {service.city && (
                            <span className="text-xs text-gray-500 truncate">{service.city}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-400 shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <RatingModal
        isOpen={ratingModal.isOpen}
        onClose={() => setRatingModal({ isOpen: false, bookingId: '', serviceName: '', partnerName: '', scheduledAt: '' })}
        bookingId={ratingModal.bookingId}
        serviceName={ratingModal.serviceName}
        scheduledAt={ratingModal.scheduledAt}
        reviewType="client"
        targetName={ratingModal.partnerName}
        onSuccess={() => {
          setModal({
            isOpen: true,
            title: 'Calificación Enviada',
            message: 'Tu calificación ha sido enviada exitosamente.',
            type: 'success'
          })
          fetchBookings()
        }}
      />

      {chatModal.isOpen && (
        <ChatModal
          proposalId={chatModal.proposalId}
          partnerName={chatModal.partnerName}
          serviceName={chatModal.serviceName}
          onClose={() => setChatModal({ isOpen: false, proposalId: '', partnerName: '', serviceName: '' })}
        />
      )}
    </div>
  )
}
