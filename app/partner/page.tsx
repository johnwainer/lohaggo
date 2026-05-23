'use client'

import { useEffect, useState, Suspense } from 'react'
import type { ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  Calendar, Clock, MapPin, DollarSign, Package, User, CheckCircle, XCircle,
  Send, AlertCircle, TrendingUp, Activity, Filter, Search, Menu, X,
  Home, Briefcase, Bell, Settings, LogOut, ChevronRight, Eye, MessageSquare, Shield, Star, MessageCircle, UserPlus,
  Zap, WifiOff, ArrowRight, Timer
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { DESIGN_SYSTEM, getStatusClasses, getStatusLabel } from '@/lib/design-system'
import Modal from '@/components/Modal'
import ConfirmModal from '@/components/ConfirmModal'
import ImageGalleryModal from '@/components/ImageGalleryModal'
import RatingModal from '@/components/RatingModal'
import UnifiedBookingCard from '@/components/shared/UnifiedBookingCard'
import PartnerHeader from '@/components/partner/PartnerHeader'
import StatCard from '@/components/shared/StatCard'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import EmptyState from '@/components/shared/EmptyState'
import PlatformTrustBanner from '@/components/PlatformTrustBanner'
import ServiceIcon from '@/components/ServiceIcon'
import { getBookingVisualState, type BookingVisualState } from '@/lib/booking-status'

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
  }
  user: {
    name: string
    email: string
    phone: string
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
  notes: string
  city: string
  status: string
  expiresAt: string
  createdAt: string
  isUrgent?: boolean
  preferredDate?: string
  preferredTime?: string
  partnerId?: string | null
  budget?: number
  service: {
    name: string
    slug: string
    icon: string
    basePrice: number
    category: {
      name: string
    }
  }
  user: {
    name: string
    email: string
    phone: string
  }
  photos?: Array<{
    id: string
    url: string
    order: number
  }>
  proposals: Array<{
    id: string
    price: number
    notes: string
    status: string
  }>
  _count?: {
    proposals: number
  }
}

function RequestCountdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState('')
  const [urgent, setUrgent] = useState(false)

  useEffect(() => {
    const calc = () => {
      const diff = new Date(expiresAt).getTime() - Date.now()
      if (diff <= 0) { setRemaining('Expirada'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setUrgent(diff < 3600000)
      setRemaining(h > 0 ? `${h}h ${m}m` : `${m} min`)
    }
    calc()
    const id = setInterval(calc, 30000)
    return () => clearInterval(id)
  }, [expiresAt])

  if (!remaining) return null
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
      urgent ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
    }`}>
      <Timer className="w-3 h-3" />
      {remaining}
    </span>
  )
}

function PartnerDashboardContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([])
  const [allServiceRequests, setAllServiceRequests] = useState<ServiceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [mobileStatusSheetOpen, setMobileStatusSheetOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'my-requests'>('overview')
  const [isAvailable, setIsAvailable] = useState(true)
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [showPwaBanner, setShowPwaBanner] = useState(false)
  const [pwaDeferredPrompt, setPwaDeferredPrompt] = useState<any>(null)
  const [showProposalModal, setShowProposalModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null)
  const [proposalPrice, setProposalPrice] = useState('')
  const [proposalNotes, setProposalNotes] = useState('')
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [imageGallery, setImageGallery] = useState<{
    isOpen: boolean
    photos: Array<{ id: string; url: string; order: number }>
    initialIndex: number
  }>({
    isOpen: false,
    photos: [],
    initialIndex: 0
  })

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

  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})

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
    clientName: string
    scheduledAt: string
  }>({
    isOpen: false,
    bookingId: '',
    serviceName: '',
    clientName: '',
    scheduledAt: ''
  })

  const [verificationAlert, setVerificationAlert] = useState<{
    isOpen: boolean
    missingDocs: boolean
    missingEducation: boolean
  }>({
    isOpen: false,
    missingDocs: false,
    missingEducation: false
  })

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone
    const dismissed = localStorage.getItem('partner-pwa-banner-dismissed')
    if (isStandalone || dismissed) return
    const handler = (e: Event) => {
      e.preventDefault()
      setPwaDeferredPrompt(e)
      setShowPwaBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const fetchAvailability = async () => {
    try {
      const res = await fetch('/api/partner/public-profile')
      if (res.ok) {
        const data = await res.json()
        setIsAvailable(data.partner?.isAvailable ?? true)
      }
    } catch {}
  }

  const toggleAvailability = async () => {
    setAvailabilityLoading(true)
    try {
      const next = !isAvailable
      const res = await fetch('/api/partner/availability', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: next }),
      })
      if (res.ok) setIsAvailable(next)
    } finally {
      setAvailabilityLoading(false)
    }
  }

  const fetchVerificationStatus = async () => {
    try {
      const res = await fetch('/api/partner/documents')
      if (res.ok) {
        const documents = await res.json()

        const hasApprovedIdentity = documents.some((d: any) =>
          ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP'].includes(d.type) &&
          d.status === 'APPROVED'
        )

        const hasApprovedEducation = documents.some((d: any) =>
          ['DIPLOMA_BACHILLERATO', 'DIPLOMA_TECNICO', 'DIPLOMA_TECNOLOGO', 'DIPLOMA_PROFESIONAL', 'DIPLOMA_POSGRADO', 'CERTIFICADO_CURSO'].includes(d.type) &&
          d.status === 'APPROVED'
        )

        if (!hasApprovedIdentity || !hasApprovedEducation) {
          setVerificationAlert({
            isOpen: true,
            missingDocs: !hasApprovedIdentity,
            missingEducation: !hasApprovedEducation
          })
        }
      }
    } catch (error) {
      console.error('Error fetching verification status:', error)
    }
  }

  const fetchBookings = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/bookings')
      const data = await res.json()
      setBookings(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching bookings:', error)
      setBookings([])
    } finally {
      setLoading(false)
    }
  }

  const fetchServiceRequests = async () => {
    try {
      const res = await fetch('/api/partner/service-requests')
      if (res.ok) {
        const data = await res.json()
        setServiceRequests(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching service requests:', error)
    }
  }

  useEffect(() => {
    if (status === 'authenticated') {
      if (session?.user?.role !== 'PARTNER') {
        router.push('/dashboard')
      } else {
        fetchBookings()
        fetchServiceRequests()
        fetchVerificationStatus()
        fetchAvailability()
      }
    }
  }, [status, session, activeTab])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && ['overview', 'bookings', 'my-requests'].includes(tab)) {
      setActiveTab(tab as 'overview' | 'bookings' | 'my-requests')
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
        ...serviceRequests
          .filter((r) => r.proposals && r.proposals.length > 0)
          .map((r) => r.proposals[0].id),
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

  const updateBookingStatus = async (id: string, newStatus: string, serviceName: string) => {
    const statusMessages: Record<string, { title: string, message: string }> = {
      CONFIRMED: {
        title: 'Confirmar Reserva',
        message: `¿Confirmar la reserva de "${serviceName}"? El cliente será notificado.`
      },
      IN_PROGRESS: {
        title: 'Iniciar Servicio',
        message: `¿Marcar como "En Progreso" la reserva de "${serviceName}"?`
      },
      COMPLETED: {
        title: 'Completar Servicio',
        message: `¿Marcar como completada la reserva de "${serviceName}"?`
      },
      CANCELLED: {
        title: 'Cancelar Reserva',
        message: `¿Cancelar la reserva de "${serviceName}"? El cliente será notificado.`
      }
    }

    const statusInfo = statusMessages[newStatus] || {
      title: 'Actualizar Estado',
      message: `¿Actualizar el estado de la reserva?`
    }

    setConfirmModal({
      isOpen: true,
      title: statusInfo.title,
      message: statusInfo.message,
      type: newStatus === 'CANCELLED' ? 'danger' : 'info',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/bookings/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
          })

          if (res.ok) {
            setModal({
              isOpen: true,
              title: 'Estado Actualizado',
              message: `El estado de la reserva "${serviceName}" ha sido actualizado exitosamente.`,
              type: 'success'
            })
            fetchBookings()
          } else {
            setModal({
              isOpen: true,
              title: 'Error al Actualizar',
              message: 'No se pudo actualizar el estado de la reserva.',
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

  const openProposalModal = (request: ServiceRequest) => {
    setSelectedRequest(request)
    setProposalPrice('')
    setProposalNotes('')
    setShowProposalModal(true)
  }

  const submitProposal = async () => {
    if (!selectedRequest || !proposalPrice) {
      setModal({
        isOpen: true,
        title: 'Datos Incompletos',
        message: 'Por favor ingresa un precio para tu propuesta.',
        type: 'warning'
      })
      return
    }

    const priceValue = parseFloat(proposalPrice)
    const basePrice = selectedRequest.service.basePrice

    if (priceValue < basePrice) {
      setModal({
        isOpen: true,
        title: 'Precio Inválido',
        message: `El precio de tu propuesta no puede ser menor al precio base del servicio (${formatCurrency(basePrice)}).`,
        type: 'warning'
      })
      return
    }

    try {
      const res = await fetch('/api/partner/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceRequestId: selectedRequest.id,
          price: priceValue,
          notes: proposalNotes
        })
      })

      if (res.ok) {
        setModal({
          isOpen: true,
          title: '¡Propuesta Enviada!',
          message: `Tu propuesta de ${formatCurrency(priceValue)} ha sido enviada exitosamente.`,
          type: 'success'
        })
        setShowProposalModal(false)
        fetchServiceRequests()
      } else {
        const error = await res.json()
        setModal({
          isOpen: true,
          title: 'Error al Enviar',
          message: error.error || 'No se pudo enviar la propuesta.',
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

  if (status === 'loading' || loading) {
    return <LoadingSpinner message="Cargando panel..." />
  }

  const partnerTotalEarnings = bookings
    .filter(b => b.status === 'COMPLETED')
    .reduce((sum, b) => sum + b.totalPrice, 0)

  const pendingCount = bookings.filter(b => b.status === 'PENDING').length
  const completedCount = bookings.filter(b => b.status === 'COMPLETED').length
  const inProgressCount = bookings.filter(b => b.status === 'IN_PROGRESS').length

  const filteredBookings = bookings
    .filter(booking =>
      booking.service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.address.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .filter((booking) => {
      if (!filter) return true
      const visualState = getBookingVisualState('PARTNER', booking)
      return visualState === filter
    })
    .sort((a, b) => {
      const rank: Record<BookingVisualState, number> = {
        PENDING: 1,
        CONFIRMED: 2,
        IN_PROGRESS: 3,
        COMPLETED: 4,
        PAID: 5,
        RATED: 6,
        CANCELLED: 7,
      }
      const aState = getBookingVisualState('PARTNER', a)
      const bState = getBookingVisualState('PARTNER', b)
      const rankDiff = rank[aState] - rank[bState]
      if (rankDiff !== 0) return rankDiff
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

  const bookingFilterCounts = bookings.reduce<Record<string, number>>((acc, booking) => {
    const visualState = getBookingVisualState('PARTNER', booking)
    acc[visualState] = (acc[visualState] || 0) + 1
    return acc
  }, {})

  const filteredRequests = serviceRequests.filter(request =>
    request.service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.address.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
        confirmText={confirmModal.type === 'danger' ? 'Sí, cancelar' : 'Sí, actualizar'}
      />

      {imageGallery.isOpen && (
        <ImageGalleryModal
          photos={imageGallery.photos}
          initialIndex={imageGallery.initialIndex}
          onClose={() => setImageGallery({ isOpen: false, photos: [], initialIndex: 0 })}
        />
      )}

      <RatingModal
        isOpen={ratingModal.isOpen}
        onClose={() => setRatingModal({ isOpen: false, bookingId: '', serviceName: '', clientName: '', scheduledAt: '' })}
        bookingId={ratingModal.bookingId}
        serviceName={ratingModal.serviceName}
        scheduledAt={ratingModal.scheduledAt}
        reviewType="partner"
        targetName={ratingModal.clientName}
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

      {/* Main Content */}
      <div>
        <PartnerHeader
          title={
            activeTab === 'overview' ? 'Resumen General' :
            activeTab === 'bookings' ? 'Mis Reservas' :
            'Solicitudes para Mí'
          }
          subtitle={
            activeTab === 'overview' ? 'Vista general de tu actividad' :
            activeTab === 'bookings' ? 'Gestiona tus reservas confirmadas' :
            'Solicitudes que coinciden con tus servicios'
          }
          activeTab={activeTab}
          bookingsCount={bookings.length}
          requestsCount={serviceRequests.length}
          onTabChange={(tab) => setActiveTab(tab as any)}
        />

        {/* Content Area */}
        <main className={`${DESIGN_SYSTEM.layout.container} ${DESIGN_SYSTEM.spacing.container} ${DESIGN_SYSTEM.spacing.section}`}>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-4 mt-4 pb-24 md:pb-6">

              {/* ── Availability toggle ── */}
              <div className={`rounded-2xl p-4 flex items-center justify-between gap-4 border-2 transition-all ${
                isAvailable
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isAvailable ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                  <div>
                    <p className={`font-bold text-base ${isAvailable ? 'text-emerald-800' : 'text-gray-700'}`}>
                      {isAvailable ? 'Estás disponible' : 'No estás disponible'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {isAvailable ? 'Recibirás solicitudes de clientes' : 'No apareces en búsquedas de clientes'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={toggleAvailability}
                  disabled={availabilityLoading}
                  className={`relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-60 ${
                    isAvailable ? 'bg-emerald-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${isAvailable ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {/* ── Earnings hero ── */}
              <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl p-5 text-white">
                <p className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-1">Ganancias totales</p>
                <p className="text-3xl sm:text-4xl font-black mb-4">{formatCurrency(partnerTotalEarnings)}</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/10 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold">{bookings.length}</p>
                    <p className="text-white/70 text-xs">Reservas</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold">{inProgressCount}</p>
                    <p className="text-white/70 text-xs">En progreso</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold">{completedCount}</p>
                    <p className="text-white/70 text-xs">Completados</p>
                  </div>
                </div>
              </div>

              {/* ── Urgent: new requests ── */}
              {serviceRequests.length > 0 && (
                <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-orange-500" />
                      <span className="font-bold text-orange-800">
                        {serviceRequests.length} {serviceRequests.length === 1 ? 'solicitud nueva' : 'solicitudes nuevas'}
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveTab('my-requests')}
                      className="text-xs font-bold text-orange-600 flex items-center gap-1"
                    >
                      Ver todas <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {serviceRequests.slice(0, 2).map((req) => (
                      <button
                        key={req.id}
                        onClick={() => setActiveTab('my-requests')}
                        className="w-full bg-white rounded-xl p-3 flex items-center gap-3 border border-orange-100 hover:border-orange-300 transition text-left"
                      >
                        <ServiceIcon slug={req.service.slug} emoji={req.service.icon} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm text-gray-900 truncate">{req.service.name}</p>
                            {req.isUrgent && (
                              <span className="flex-shrink-0 text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">URGENTE</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{req.address}</p>
                        </div>
                        <p className="text-sm font-bold text-emerald-600 whitespace-nowrap">{formatCurrency(req.service.basePrice)}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Active bookings ── */}
              {inProgressCount > 0 && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-5 h-5 text-blue-600" />
                    <span className="font-bold text-blue-800">En progreso ahora</span>
                  </div>
                  <div className="space-y-2">
                    {bookings.filter(b => b.status === 'IN_PROGRESS').map((booking) => (
                      <button
                        key={booking.id}
                        onClick={() => setActiveTab('bookings')}
                        className="w-full bg-white rounded-xl p-3 flex items-center gap-3 border border-blue-100 hover:border-blue-300 transition text-left"
                      >
                        <ServiceIcon slug={booking.service.slug} emoji={booking.service.icon} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900 truncate">{booking.service.name}</p>
                          <p className="text-xs text-gray-500 truncate">{booking.user.name}</p>
                        </div>
                        <span className="text-xs font-bold bg-blue-600 text-white px-2 py-1 rounded-full">En curso</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Pending confirmations ── */}
              {pendingCount > 0 && (
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-yellow-600" />
                      <span className="font-bold text-yellow-800">{pendingCount} {pendingCount === 1 ? 'reserva por confirmar' : 'reservas por confirmar'}</span>
                    </div>
                    <button onClick={() => setActiveTab('bookings')} className="text-xs font-bold text-yellow-700 flex items-center gap-1">
                      Ver <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Upcoming bookings ── */}
              {bookings.filter(b => ['CONFIRMED'].includes(b.status)).length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary-600" />
                    Próximas reservas
                  </h3>
                  <div className="space-y-2">
                    {bookings.filter(b => b.status === 'CONFIRMED').slice(0, 3).map((booking) => (
                      <button
                        key={booking.id}
                        onClick={() => setActiveTab('bookings')}
                        className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition text-left"
                      >
                        <ServiceIcon slug={booking.service.slug} emoji={booking.service.icon} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900 truncate">{booking.service.name}</p>
                          <p className="text-xs text-gray-500">{booking.scheduledDate} · {booking.scheduledTime}</p>
                        </div>
                        <p className="text-sm font-bold text-primary-600 whitespace-nowrap">{formatCurrency(booking.totalPrice)}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Empty state ── */}
              {bookings.length === 0 && serviceRequests.length === 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Package className="text-gray-400" size={32} />
                  </div>
                  <p className="font-bold text-gray-900 mb-1">Todo tranquilo por ahora</p>
                  <p className="text-sm text-gray-500 mb-4">Cuando lleguen solicitudes o reservas aparecerán aquí</p>
                  <button
                    onClick={() => router.push('/partner/services')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition"
                  >
                    <Briefcase className="w-4 h-4" /> Configurar servicios
                  </button>
                </div>
              )}

              {/* PWA install banner */}
              {showPwaBanner && (
                <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl p-4 flex items-center gap-3">
                  <img src="/icon-512.png" alt="LoHaggo" className="w-10 h-10 rounded-xl flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm">Instala la app</p>
                    <p className="text-white/70 text-xs">Recibe solicitudes al instante, incluso con el navegador cerrado</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (pwaDeferredPrompt) {
                        pwaDeferredPrompt.prompt()
                        await pwaDeferredPrompt.userChoice
                      }
                      setShowPwaBanner(false)
                      localStorage.setItem('partner-pwa-banner-dismissed', '1')
                    }}
                    className="flex-shrink-0 bg-white text-primary-700 text-xs font-bold px-3 py-2 rounded-lg hover:bg-white/90 transition whitespace-nowrap"
                  >
                    Instalar
                  </button>
                  <button
                    onClick={() => { setShowPwaBanner(false); localStorage.setItem('partner-pwa-banner-dismissed', '1') }}
                    className="flex-shrink-0 text-white/60 hover:text-white transition"
                    aria-label="Cerrar"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              )}

              <PlatformTrustBanner variant="info" context="partner" />
            </div>
          )}

          {/* Bookings Tab */}
          {activeTab === 'bookings' && (
            <div className="space-y-4 sm:space-y-6 pb-24 md:pb-6">
              {/* Search and Filters */}
              <div className="sticky top-14 sm:top-16 z-20 bg-white rounded-2xl sm:rounded-3xl shadow-lg p-3 sm:p-6 border border-gray-100">
                <div className="hidden sm:flex sm:flex-row gap-3 sm:gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="Buscar por servicio, cliente o dirección..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all text-base"
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap sm:flex-nowrap items-center">
                    <button
                      onClick={() => setFilter('')}
                      className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                        filter === ''
                          ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Todas ({bookings.length})
                    </button>
                    {(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'RATED', 'CANCELLED'] as const).map((key) => (
                      <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                          filter === key
                            ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {DESIGN_SYSTEM.statusLabels[key]} ({bookingFilterCounts[key] || 0})
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:hidden space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      placeholder="Buscar servicio, cliente o dirección..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-gray-600">
                      {filteredBookings.length} resultados {filter ? `· ${DESIGN_SYSTEM.statusLabels[filter as keyof typeof DESIGN_SYSTEM.statusLabels]}` : '· Todas'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setMobileStatusSheetOpen(true)}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-primary-200 bg-white px-3 text-xs font-semibold text-primary-700"
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
                    className="absolute inset-0 bg-black/40"
                  />
                  <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-white p-4 shadow-2xl">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-sm font-bold text-gray-900">Filtrar por estado</h4>
                      <button
                        type="button"
                        onClick={() => setMobileStatusSheetOpen(false)}
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-gray-600"
                      >
                        Cerrar
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
                      <button
                        type="button"
                        onClick={() => {
                          setFilter('')
                          setMobileStatusSheetOpen(false)
                        }}
                        className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                          filter === '' ? 'bg-primary-600 text-white' : 'border border-gray-200 bg-gray-50 text-gray-700'
                        }`}
                      >
                        Todas ({bookings.length})
                      </button>
                      {(['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'RATED', 'CANCELLED'] as const).map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setFilter(key)
                            setMobileStatusSheetOpen(false)
                          }}
                          className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                            filter === key ? 'bg-primary-600 text-white' : 'border border-gray-200 bg-gray-50 text-gray-700'
                          }`}
                        >
                          {DESIGN_SYSTEM.statusLabels[key]} ({bookingFilterCounts[key] || 0})
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Bookings Grid */}
              {filteredBookings.length === 0 ? (
                <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-12 sm:p-16 text-center border border-gray-200">
                  <div className="bg-gray-200 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                    <Package className="text-gray-400" size={48} />
                  </div>
                  <p className="text-gray-900 text-xl font-bold mb-2">No hay reservas</p>
                  <p className="text-gray-500 text-base">Las reservas aparecerán aquí cuando los clientes las realicen</p>
                  <button
                    type="button"
                    onClick={() => router.push('/partner/services')}
                    className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
                  >
                    Configurar servicios
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {filteredBookings.map((booking) => {
                    const visualState = getBookingVisualState('PARTNER', booking)
                    const priorityBadges: string[] = []
                    if (booking.status === 'PENDING') priorityBadges.push('ACCION REQUERIDA')
                    if (booking.status === 'IN_PROGRESS') priorityBadges.push('TIEMPO ESTIMADO')

                    const primaryAction =
                      booking.status === 'PENDING'
                        ? {
                            label: 'Confirmar',
                            onClick: () => updateBookingStatus(booking.id, 'CONFIRMED', booking.service.name),
                            icon: <CheckCircle size={18} />,
                            variant: 'primary' as const,
                            disabled: session?.user?.isActive === false,
                          }
                        : booking.status === 'CONFIRMED'
                        ? {
                            label: 'Iniciar servicio',
                            onClick: () => updateBookingStatus(booking.id, 'IN_PROGRESS', booking.service.name),
                            icon: <Activity size={18} />,
                            variant: 'primary' as const,
                            disabled: session?.user?.isActive === false,
                          }
                        : booking.status === 'IN_PROGRESS'
                        ? {
                            label: 'Marcar completado',
                            onClick: () => updateBookingStatus(booking.id, 'COMPLETED', booking.service.name),
                            icon: <CheckCircle size={18} />,
                            variant: 'primary' as const,
                            disabled: session?.user?.isActive === false,
                          }
                        : visualState === 'COMPLETED'
                        ? {
                            label: 'Calificar cliente',
                            onClick: () =>
                              setRatingModal({
                                isOpen: true,
                                bookingId: booking.id,
                                serviceName: booking.service.name,
                                clientName: booking.user.name,
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
                            partnerName: session?.user?.name || 'Socio',
                            serviceName: booking.service.name,
                          }),
                        icon: <MessageCircle size={16} />,
                        variant: 'secondary',
                        disabled: session?.user?.isActive === false,
                        badge: unreadCounts[booking.proposalId!] || 0,
                      })
                    }

                    if (booking.status === 'PENDING') {
                      secondaryActions.push({
                        label: 'Rechazar',
                        onClick: () => updateBookingStatus(booking.id, 'CANCELLED', booking.service.name),
                        icon: <XCircle size={16} />,
                        variant: 'secondary',
                        disabled: session?.user?.isActive === false,
                      })
                    }

                    return (
                      <UnifiedBookingCard
                        key={booking.id}
                        role="PARTNER"
                        serviceName={booking.service.name}
                        serviceIcon={booking.service.icon}
                        serviceSlug={booking.service.slug}
                        counterpartName={booking.user.name}
                        counterpartLabel="Cliente"
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

          {/* My Requests Tab */}
          {activeTab === 'my-requests' && (
            <div className="space-y-4 sm:space-y-6 pb-24 md:pb-6">
              <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-4 sm:p-6 border border-gray-100">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Buscar solicitudes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all text-base"
                  />
                </div>
              </div>

              {filteredRequests.length === 0 ? (
                <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-12 sm:p-16 text-center border border-gray-100">
                  <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="text-gray-400" size={48} />
                  </div>
                  <p className="text-gray-900 text-xl font-bold mb-2">No hay solicitudes para ti</p>
                  <p className="text-gray-500 text-base">Las solicitudes que coincidan con tus servicios aparecerán aquí</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {filteredRequests.map((request) => (
                    <div key={request.id} className="bg-white rounded-2xl sm:rounded-3xl shadow-lg hover:shadow-xl transition-all overflow-hidden border border-gray-100">
                      <div className="p-5 sm:p-6">
                        <div className="flex items-start gap-4 mb-5">
                          <ServiceIcon slug={request.service.slug} emoji={request.service.icon} size="xl" />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-lg sm:text-xl text-gray-900 mb-2">{request.service.name}</h3>
                            <div className="flex items-center gap-2 flex-wrap">
                              {request.isUrgent && (
                                <span className="bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md animate-pulse">
                                  ⚡ URGENTE
                                </span>
                              )}
                              {request.partnerId && (
                                <span className="bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 text-xs font-bold px-3 py-1 rounded-full border border-purple-300 flex items-center gap-1">
                                  <UserPlus size={12} />
                                  DIRECTA
                                </span>
                              )}
                              {request.expiresAt && <RequestCountdown expiresAt={request.expiresAt} />}
                            </div>
                            <p className="text-sm text-gray-600 mt-2">{request.service.category.name}</p>
                          </div>
                        </div>

                        <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="bg-gray-200 rounded-lg p-1.5">
                              <User size={16} className="text-gray-600" />
                            </div>
                            <span className="font-bold text-gray-900 truncate">{request.user.name}</span>
                          </div>
                          <p className="text-sm text-gray-600 truncate">📧 {request.user.email}</p>
                          {request.user.phone && (
                            <p className="text-sm text-gray-600">📱 {request.user.phone}</p>
                          )}
                        </div>

                        <div className="space-y-3 mb-4">
                          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border-2 border-gray-200">
                            <div className="bg-gray-200 rounded-lg p-2 flex-shrink-0">
                              <MapPin size={18} className="text-gray-600" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 font-semibold mb-1">Ubicación</p>
                              <span className="text-sm font-medium text-gray-900">{request.address}, {request.city}</span>
                            </div>
                          </div>
                          {request.preferredDate && (
                            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border-2 border-gray-200">
                              <div className="bg-gray-200 rounded-lg p-2 flex-shrink-0">
                                <Calendar size={18} className="text-gray-600" />
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 font-semibold mb-1">Fecha preferida</p>
                                <span className="text-sm font-medium text-gray-900">
                                  {new Date(request.preferredDate).toLocaleDateString('es-ES', {
                                    weekday: 'long',
                                    day: 'numeric',
                                    month: 'long'
                                  })}
                                  {request.preferredTime && ` a las ${request.preferredTime}`}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {request.notes && (
                          <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 mb-4">
                            <p className="text-xs font-semibold text-gray-700 mb-2">Detalles:</p>
                            <p className="text-sm text-gray-800">{request.notes}</p>
                          </div>
                        )}

                        {request.budget && (
                          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mb-4">
                            <div className="flex items-start gap-3">
                              <div className="bg-green-200 rounded-lg p-2 flex-shrink-0">
                                <DollarSign size={18} className="text-green-600" />
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-green-700 mb-1">Presupuesto del cliente</p>
                                <span className="text-lg font-bold text-green-800">{formatCurrency(request.budget)}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {request.photos && request.photos.length > 0 && (
                          <div className="mb-4">
                            <h4 className="font-semibold mb-3 text-sm text-gray-700 flex items-center gap-2">
                              <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-lg text-xs">
                                {request.photos.length} fotos
                              </span>
                              Fotos adjuntas
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                              {request.photos.sort((a, b) => a.order - b.order).map((photo, index) => (
                                <div
                                  key={photo.id}
                                  className="relative group cursor-pointer"
                                  onClick={() => setImageGallery({ isOpen: true, photos: request.photos || [], initialIndex: index })}
                                >
                                  <img
                                    src={photo.url}
                                    alt="Foto de la solicitud"
                                    className="w-full h-32 object-cover rounded-xl border-2 border-gray-200 hover:border-primary-500 transition-all shadow-md hover:shadow-lg"
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-all rounded-xl flex items-end justify-center pb-3">
                                    <span className="text-white text-sm font-semibold">
                                      Ver imagen
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {request.proposals.length > 0 ? (
                          <div className="space-y-3">
                            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
                              <p className="text-sm font-bold text-emerald-700 flex items-center gap-2">
                                <CheckCircle size={18} />
                                Ya enviaste una propuesta
                              </p>
                            </div>
                            {(request.proposals[0].status === 'ACCEPTED' || (request.status === 'ACTIVE' && request.proposals[0].status === 'PENDING')) && (
                              <button
                                onClick={() => setChatModal({
                                  isOpen: true,
                                  proposalId: request.proposals[0].id,
                                  partnerName: request.user.name,
                                  serviceName: request.service.name
                                })}
                                className="w-full bg-white border-2 border-gray-300 text-gray-700 px-4 py-3.5 rounded-xl hover:border-primary-500 hover:text-primary-600 transition-all font-semibold flex items-center justify-center gap-2 relative shadow-md hover:shadow-lg"
                              >
                                <MessageCircle size={20} />
                                Chat con Cliente
                                {unreadCounts[request.proposals[0].id] > 0 && (
                                  <span className="absolute -top-2 -right-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white text-xs font-bold rounded-full h-7 w-7 flex items-center justify-center animate-pulse shadow-lg">
                                    {unreadCounts[request.proposals[0].id]}
                                  </span>
                                )}
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => openProposalModal(request)}
                            className="bg-gradient-to-r from-primary-500 to-primary-600 text-white px-4 py-3.5 rounded-xl font-semibold hover:from-primary-600 hover:to-primary-700 transition-all w-full flex items-center justify-center gap-2 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={session?.user?.isActive === false}
                          >
                            <Send size={20} />
                            Enviar propuesta
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}


        </main>
      </div>

      {/* Proposal Modal */}
      {showProposalModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${DESIGN_SYSTEM.components.card.base} max-w-2xl w-full max-h-[90vh] overflow-y-auto`}>
            <div className={`${DESIGN_SYSTEM.spacing.card} border-b bg-gradient-to-r from-primary-600 to-primary-700`}>
              <h3 className={`${DESIGN_SYSTEM.typography.h2} text-white`}>Enviar Propuesta</h3>
              <p className="text-primary-100 text-sm mt-1">Completa los detalles de tu oferta</p>
            </div>

            <div className={`${DESIGN_SYSTEM.spacing.card} ${DESIGN_SYSTEM.spacing.gap}`}>
              <div className={`${DESIGN_SYSTEM.components.card.base} bg-gray-50 ${DESIGN_SYSTEM.spacing.cardSmall}`}>
                <div className="flex items-center gap-3 mb-3">
                  <ServiceIcon slug={selectedRequest.service.slug} emoji={selectedRequest.service.icon} size="md" />
                  <div className="min-w-0 flex-1">
                    <h4 className={`${DESIGN_SYSTEM.typography.h4} truncate`}>{selectedRequest.service.name}</h4>
                    <p className={`${DESIGN_SYSTEM.typography.bodySmall} truncate`}>{selectedRequest.service.category.name}</p>
                  </div>
                </div>
                <div className={`${DESIGN_SYSTEM.spacing.gapSmall} ${DESIGN_SYSTEM.typography.bodySmall}`}>
                  <p><strong>Cliente:</strong> {selectedRequest.user.name}</p>
                  <p className="truncate"><strong>Ubicación:</strong> {selectedRequest.address}, {selectedRequest.city}</p>
                  {selectedRequest.preferredDate && (
                    <p>
                      <strong>Fecha preferida:</strong> {new Date(selectedRequest.preferredDate).toLocaleDateString('es-ES')}
                      {selectedRequest.preferredTime && ` a las ${selectedRequest.preferredTime}`}
                    </p>
                  )}
                  {selectedRequest.notes && (
                    <p><strong>Detalles:</strong> {selectedRequest.notes}</p>
                  )}
                </div>

                {selectedRequest.photos && selectedRequest.photos.length > 0 && (
                  <div className="mt-4">
                    <p className={`${DESIGN_SYSTEM.typography.label} mb-2`}>Fotos adjuntas:</p>
                    <div className={`${DESIGN_SYSTEM.responsive.gridCols3} ${DESIGN_SYSTEM.spacing.gapSmall}`}>
                      {selectedRequest.photos.sort((a, b) => a.order - b.order).map((photo, index) => (
                        <div
                          key={photo.id}
                          className="relative group cursor-pointer"
                          onClick={() => setImageGallery({ isOpen: true, photos: selectedRequest.photos || [], initialIndex: index })}
                        >
                          <img
                            src={photo.url}
                            alt="Foto de la solicitud"
                            className={`${DESIGN_SYSTEM.components.card.base} ${DESIGN_SYSTEM.components.card.hover} w-full h-24 object-cover border-2 pointer-events-none`}
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition rounded-lg flex items-center justify-center pointer-events-none">
                            <span className={`${DESIGN_SYSTEM.typography.bodySmall} text-white opacity-0 group-hover:opacity-100 transition font-medium pointer-events-none`}>
                              Ver
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className={`${DESIGN_SYSTEM.typography.label} mb-2 block`}>
                  Precio de tu Propuesta *
                </label>
                <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 mb-3">
                  <p className="text-sm text-primary-800">
                    <span className="font-semibold">Precio base mínimo:</span> {formatCurrency(selectedRequest.service.basePrice)}
                  </p>
                  <p className="text-xs text-primary-600 mt-1">
                    Tu propuesta debe ser igual o mayor a este valor
                  </p>
                </div>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="number"
                    value={proposalPrice}
                    onChange={(e) => setProposalPrice(e.target.value)}
                    placeholder={selectedRequest.service.basePrice.toString()}
                    min={selectedRequest.service.basePrice}
                    step="0.01"
                    required
                    className={`${DESIGN_SYSTEM.components.input.base} pl-10`}
                  />
                </div>
              </div>

              <div>
                <label className={`${DESIGN_SYSTEM.typography.label} mb-2 block`}>
                  Notas Adicionales (Opcional)
                </label>
                <textarea
                  value={proposalNotes}
                  onChange={(e) => setProposalNotes(e.target.value)}
                  placeholder="Describe tu experiencia, tiempo estimado, materiales incluidos, etc."
                  rows={4}
                  className={`${DESIGN_SYSTEM.components.input.base} resize-none`}
                />
              </div>
            </div>

            <div className={`${DESIGN_SYSTEM.spacing.card} border-t bg-gray-50 flex gap-3`}>
              <button
                onClick={() => setShowProposalModal(false)}
                className="bg-white text-gray-700 border-2 border-gray-400 px-4 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-all flex-1"
              >
                Cancelar
              </button>
              <button
                onClick={submitProposal}
                className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-3 rounded-xl font-semibold hover:from-primary-700 hover:to-primary-800 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed flex-1 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                disabled={session?.user?.isActive === false}
              >
                <Send size={20} />
                Enviar Propuesta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}

      {chatModal.isOpen && (
        <ChatModal
          proposalId={chatModal.proposalId}
          partnerName={chatModal.partnerName}
          serviceName={chatModal.serviceName}
          onClose={() => setChatModal({ isOpen: false, proposalId: '', partnerName: '', serviceName: '' })}
        />
      )}

      {verificationAlert.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-red-600 to-orange-600 p-6 rounded-t-2xl">
              <div className="flex items-center gap-4">
                <div className="bg-white bg-opacity-20 p-3 rounded-full">
                  <Shield className="text-white" size={32} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">¡Verificación Pendiente!</h2>
                  <p className="text-white text-opacity-90 mt-1">Completa tu perfil para poder trabajar</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-red-600 flex-shrink-0 mt-1" size={24} />
                  <div>
                    <h3 className="font-bold text-red-900 text-lg mb-2">Acción Requerida</h3>
                    <p className="text-red-800 mb-3">
                      Para poder recibir solicitudes de servicios y trabajar en la plataforma, debes completar tu verificación:
                    </p>
                    <ul className="space-y-2">
                      {verificationAlert.missingDocs && (
                        <li className="flex items-center gap-2 text-red-800">
                          <XCircle className="text-red-600 flex-shrink-0" size={20} />
                          <span className="font-semibold">Documento de identidad no verificado</span>
                        </li>
                      )}
                      {verificationAlert.missingEducation && (
                        <li className="flex items-center gap-2 text-red-800">
                          <XCircle className="text-red-600 flex-shrink-0" size={20} />
                          <span className="font-semibold">Estudios no verificados</span>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="text-blue-600 flex-shrink-0 mt-1" size={24} />
                  <div>
                    <h3 className="font-bold text-blue-900 mb-2">¿Qué necesitas hacer?</h3>
                    <ol className="space-y-2 text-blue-800">
                      {verificationAlert.missingDocs && (
                        <li className="flex items-start gap-2">
                          <span className="font-bold">1.</span>
                          <span>Sube tu documento de identidad (Cédula, Pasaporte o PEP)</span>
                        </li>
                      )}
                      {verificationAlert.missingEducation && (
                        <li className="flex items-start gap-2">
                          <span className="font-bold">{verificationAlert.missingDocs ? '2' : '1'}.</span>
                          <span>Sube tus certificados de estudios (Diploma o certificados de cursos)</span>
                        </li>
                      )}
                      <li className="flex items-start gap-2">
                        <span className="font-bold">{verificationAlert.missingDocs && verificationAlert.missingEducation ? '3' : '2'}.</span>
                        <span>Espera la aprobación del equipo de Haggo (generalmente 24-48 horas)</span>
                      </li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setVerificationAlert({ ...verificationAlert, isOpen: false })}
                  className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all"
                >
                  Recordar más tarde
                </button>
                <button
                  onClick={() => {
                    setVerificationAlert({ ...verificationAlert, isOpen: false })
                    router.push('/partner/verification')
                  }}
                  className="flex-1 bg-gradient-to-r from-primary-600 to-primary-700 text-white px-6 py-3 rounded-xl font-semibold hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  <Shield size={20} />
                  Completar Verificación
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PartnerDashboard() {
  return (
    <Suspense fallback={<LoadingSpinner message="Cargando..." />}>
      <PartnerDashboardContent />
    </Suspense>
  )
}
