'use client'

import { CountBadge } from '@/components/ui/count-badge'
import { useEffect, useMemo, useState, Suspense } from 'react'
import { useDialog } from '@/components/ui/use-dialog'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { refreshPartnerNavCounts } from '@/hooks/usePartnerNavCounts'
import { useChatRealtime } from '@/hooks/useChatRealtime'
import type { ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  Calendar, Clock, MapPin, DollarSign, Package, User, CheckCircle, XCircle,
  Send, AlertCircle, TrendingUp, Activity, Filter, Search, Menu, X,
  Home, Briefcase, Bell, Settings, LogOut, ChevronRight, Eye, MessageSquare, Shield, Star, MessageCircle, UserPlus,
  Zap, WifiOff, ArrowRight, Timer, CalendarClock, Loader2
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { DESIGN_SYSTEM, getStatusClasses, getStatusLabel } from '@/lib/design-system'
import Modal from '@/components/Modal'
import ConfirmModal from '@/components/ConfirmModal'
import ImageGalleryModal from '@/components/ImageGalleryModal'
import RatingModal from '@/components/RatingModal'
import UnifiedBookingCard from '@/components/shared/UnifiedBookingCard'
import OriginBadge from '@/components/shared/OriginBadge'
import OfflinePaymentActions from '@/components/payments/OfflinePaymentActions'
import PartnerHeader from '@/components/partner/PartnerHeader'
import StatCard from '@/components/shared/StatCard'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import EmptyState from '@/components/shared/EmptyState'
import PlatformTrustBanner from '@/components/PlatformTrustBanner'
import ServiceIcon from '@/components/ServiceIcon'
import {
  getBookingVisualState, getBookingVisualLabel, getNextStep, bookingStatusColor,
  BOOKING_FILTER_ORDER, BOOKING_STATUS_COLORS, type BookingVisualState,
} from '@/lib/booking-status'
import { opportunitiesFromResponse } from '@/lib/partners/opportunities'
import WorkPhotosEditor from '@/components/bookings/WorkPhotosEditor'
import { RescheduleSheet, CancelReasonSheet } from '@/components/partner/BookingActionSheets'
import { formatBookingWhen, formatCalendarDay } from '@/lib/bookings/when'

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
  partnerCommissionRate?: number | null
  origin?: string | null
  originChannel?: string | null
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
    confirmationStatus?: string | null
    clientReportedMethod?: string | null
  } | null
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
  origin?: string | null
  originChannel?: string | null
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
  /** Other partners' proposals (own one excluded) */
  competitors?: number
}

const VERIFICATION_LATER_KEY = 'partner-verification-later-until'
const VERIFICATION_LATER_MS = 7 * 24 * 60 * 60 * 1000

/** What the partner receives after LoHaggo's commission, rounded to whole pesos. */
function netForPartner(amount: number, ratePct: number) {
  return Math.round(amount * (1 - ratePct / 100))
}

/** The push prompt (NotificationPermissionPrompt) would show now: the install banner waits so both never stack. */
function notificationPromptPending() {
  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return false
    if (Notification.permission !== 'default') return false
    const dismissed = localStorage.getItem('notification-prompt-dismissed')
    const lastShown = Number(localStorage.getItem('notification-prompt-last-shown') || 0)
    if (dismissed === 'true' && Date.now() - lastShown < 3 * 24 * 60 * 60 * 1000) return false
    return true
  } catch {
    return false
  }
}

/** An instant (not a service day) in Bogotá, e.g. «mié 8 oct 14:30». */
function formatBogotaMoment(value: string) {
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
    .format(new Date(value))
    .replace(/\./g, '')
}

const PROPOSAL_STATUS_CHIP: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Pendiente', className: 'bg-amber-50 border-amber-200 text-amber-900' },
  ACCEPTED: { label: 'Aceptada', className: 'bg-primary-50 border-primary-200 text-primary-800' },
  REJECTED: { label: 'No elegida', className: 'bg-gray-100 border-gray-200 text-gray-700' },
}

function competitionText(n: number) {
  if (n <= 0) return 'Aún no compites con nadie: sé el primero'
  return `Compites con ${n} ${n === 1 ? 'socio' : 'socios'}`
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
  const [requestsNeedVerification, setRequestsNeedVerification] = useState(false)
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
  const [proposalDate, setProposalDate] = useState('')
  const [proposalTime, setProposalTime] = useState('')
  const [submittingProposal, setSubmittingProposal] = useState(false)
  const [partnerRate, setPartnerRate] = useState<number | null>(null)
  const [notifPromptPending, setNotifPromptPending] = useState(true)
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [rescheduleFor, setRescheduleFor] = useState<Booking | null>(null)
  const [cancelFor, setCancelFor] = useState<Booking | null>(null)
  const [afterPhotosFor, setAfterPhotosFor] = useState<{ id: string; serviceName: string } | null>(null)
  const [photosVersion, setPhotosVersion] = useState(0)
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
    contextLine?: string
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
    confirmText?: string
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

  const proposalDialog = useDialog(showProposalModal && !!selectedRequest, () => setShowProposalModal(false), { dismissible: !submittingProposal })

  const [verificationAlert, setVerificationAlert] = useState<{
    isOpen: boolean
    missingDocs: boolean
  }>({
    isOpen: false,
    missingDocs: false,
  })

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone
    let dismissed: string | null = null
    try { dismissed = localStorage.getItem('partner-pwa-banner-dismissed') } catch {}
    if (isStandalone || dismissed) return
    const handler = (e: Event) => {
      e.preventDefault()
      setPwaDeferredPrompt(e)
      setShowPwaBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // The install banner waits while the push prompt is due; re-check because that prompt can be closed at any time
  useEffect(() => {
    if (!showPwaBanner) return
    const check = () => setNotifPromptPending(notificationPromptPending())
    check()
    const id = setInterval(check, 5000)
    return () => clearInterval(id)
  }, [showPwaBanner])

  const dismissPwaBanner = () => {
    setShowPwaBanner(false)
    try { localStorage.setItem('partner-pwa-banner-dismissed', '1') } catch {}
  }

  const fetchCommissionRate = async () => {
    try {
      const res = await fetch('/api/payment-config/public')
      if (!res.ok) return
      const data = await res.json()
      if (typeof data.partnerCommissionRate === 'number') setPartnerRate(data.partnerCommissionRate)
    } catch {}
  }

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

        let laterUntil = 0
        try { laterUntil = Number(localStorage.getItem(VERIFICATION_LATER_KEY) || 0) } catch {}
        if (!hasApprovedIdentity && laterUntil > Date.now()) {
          setVerificationAlert({ isOpen: false, missingDocs: true })
        } else if (!hasApprovedIdentity) {
          setVerificationAlert({
            isOpen: true,
            missingDocs: true,
          })
        }
      }
    } catch (error) {
      console.error('Error fetching verification status:', error)
    }
  }

  // Only the first load shows the full-page spinner; later refreshes swap the data silently (no scroll jump)
  const fetchBookings = async () => {
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
        const { requests, requiresVerification } = opportunitiesFromResponse<ServiceRequest>(await res.json())
        setServiceRequests(requests)
        setRequestsNeedVerification(requiresVerification)
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
        fetchCommissionRate()
      }
    }
  }, [status, session?.user?.role, activeTab])

  const refreshAfterAction = () => {
    fetchBookings()
    refreshPartnerNavCounts()
  }

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && ['bookings', 'my-requests'].includes(tab)) {
      setActiveTab(tab as 'bookings' | 'my-requests')
    } else {
      // Sin query (?tab=…) → overview. Sin este reset, navegar de /partner?tab=bookings
      // a /partner dejaba el tab anterior pegado y el click en Inicio "no hacía nada".
      setActiveTab('overview')
    }
  }, [searchParams])

  // ?booking=<id> (from a notification) scrolls to that booking and outlines it for a few seconds
  const focusBookingId = searchParams.get('booking')
  useEffect(() => {
    if (!focusBookingId || activeTab !== 'bookings' || loading) return
    const el = document.getElementById(`booking-${focusBookingId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [focusBookingId, activeTab, loading])

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
    intervalId = setInterval(tick, 60000)

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

  const proposalIdsForRealtime = useMemo(
    () => [
      ...bookings.map((b) => b.proposalId).filter((id): id is string => !!id),
      ...serviceRequests
        .filter((r) => r.proposals && r.proposals.length > 0)
        .map((r) => r.proposals[0].id),
    ],
    [bookings, serviceRequests]
  )

  useChatRealtime(proposalIdsForRealtime, () => {
    fetchUnreadCounts()
  })

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
            if (newStatus === 'COMPLETED') {
              setAfterPhotosFor({ id, serviceName })
            } else {
              setModal({
                isOpen: true,
                title: 'Estado Actualizado',
                message: `El estado de la reserva "${serviceName}" ha sido actualizado exitosamente.`,
                type: 'success'
              })
            }
            refreshAfterAction()
          } else {
            const data = await res.json().catch(() => ({}))
            setModal({
              isOpen: true,
              title: 'Error al Actualizar',
              message: data.error || 'No se pudo actualizar el estado de la reserva.',
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
    setProposalDate('')
    setProposalTime('')
    setShowProposalModal(true)
  }

  const submitProposal = async () => {
    if (submittingProposal) return
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

    setSubmittingProposal(true)
    try {
      const res = await fetch('/api/partner/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceRequestId: selectedRequest.id,
          price: priceValue,
          notes: proposalNotes,
          proposedDate: proposalDate || null,
          proposedTime: proposalDate && proposalTime ? proposalTime : null
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
        refreshPartnerNavCounts()
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
    } finally {
      setSubmittingProposal(false)
    }
  }

  const confirmPaymentReceived = (booking: Booking) => {
    const method = booking.payment?.clientReportedMethod === 'DIRECT_TRANSFER' ? 'DIRECT_TRANSFER' : 'CASH'
    const amount = formatCurrency(booking.totalPrice)
    setConfirmModal({
      isOpen: true,
      title: 'Confirmar pago recibido',
      message: `¿Recibiste ${amount} de ${booking.user.name} por «${booking.service.name}» (${method === 'CASH' ? 'efectivo' : 'transferencia'})? Si no te llegó, recházalo abajo de la tarjeta.`,
      type: 'info',
      confirmText: 'Sí, lo recibí',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/bookings/${booking.id}/payment/confirm-partner`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ method }),
          })
          if (res.ok) {
            setModal({ isOpen: true, title: 'Pago confirmado', message: `Registramos que recibiste ${amount}.`, type: 'success' })
            refreshAfterAction()
          } else {
            const data = await res.json().catch(() => ({}))
            setModal({ isOpen: true, title: 'No se pudo confirmar', message: data.error || 'Intenta de nuevo en un momento.', type: 'error' })
          }
        } catch {
          setModal({ isOpen: true, title: 'Error de conexión', message: 'No se pudo conectar con el servidor.', type: 'error' })
        }
      },
    })
  }

  if (status === 'loading' || loading) {
    return <LoadingSpinner message="Cargando panel..." />
  }

  const completedBookings = bookings.filter(b => b.status === 'COMPLETED')
  const partnerBilled = completedBookings.reduce((sum, b) => sum + b.totalPrice, 0)
  const rateFor = (b: Booking) => (typeof b.partnerCommissionRate === 'number' ? b.partnerCommissionRate : partnerRate)
  const partnerNet = completedBookings.every(b => rateFor(b) !== null)
    ? completedBookings.reduce((sum, b) => sum + netForPartner(b.totalPrice, rateFor(b) as number), 0)
    : null

  const pendingCount = bookings.filter(b => b.status === 'PENDING').length
  const completedCount = completedBookings.length
  const inProgressCount = bookings.filter(b => b.status === 'IN_PROGRESS').length
  const confirmedCount = bookings.filter(b => b.status === 'CONFIRMED').length
  const paymentReportedBookings = bookings.filter(b => getBookingVisualState('PARTNER', b) === 'PAYMENT_REPORTED')

  const newRequests = serviceRequests.filter(r => r.proposals.length === 0)
  const proposedRequestsCount = serviceRequests.length - newRequests.length

  const searchLower = searchTerm.toLowerCase()
  const filteredBookings = bookings
    .filter(booking =>
      booking.service.name.toLowerCase().includes(searchLower) ||
      booking.user.name.toLowerCase().includes(searchLower) ||
      booking.address.toLowerCase().includes(searchLower)
    )
    .filter((booking) => {
      if (!filter) return true
      const visualState = getBookingVisualState('PARTNER', booking)
      return visualState === filter
    })
    .sort((a, b) => {
      // What needs the partner first: to confirm, payments to confirm, today's work, then the rest
      const rank: Record<BookingVisualState, number> = {
        PENDING: 1,
        PAYMENT_REPORTED: 2,
        IN_PROGRESS: 3,
        CONFIRMED: 4,
        COMPLETED: 5,
        PAID: 6,
        RATED: 7,
        REFUNDED: 8,
        CANCELLED: 9,
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
  // Every state in the order a booking moves; REFUNDED only when there is one
  const bookingFilterStates = BOOKING_FILTER_ORDER.concat(bookingFilterCounts.REFUNDED ? ['REFUNDED'] : [])
  const filterLabel = (state: string) => getBookingVisualLabel(state as BookingVisualState, 'PARTNER')

  const filteredRequests = serviceRequests.filter(request =>
    request.service.name.toLowerCase().includes(searchLower) ||
    request.address.toLowerCase().includes(searchLower)
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
        confirmText={confirmModal.confirmText || (confirmModal.type === 'danger' ? 'Sí, cancelar' : 'Sí, actualizar')}
      />

      {rescheduleFor && (
        <RescheduleSheet
          booking={{ id: rescheduleFor.id, serviceName: rescheduleFor.service.name, scheduledDate: rescheduleFor.scheduledDate, scheduledTime: rescheduleFor.scheduledTime }}
          onClose={() => setRescheduleFor(null)}
          onDone={() => {
            setRescheduleFor(null)
            setModal({ isOpen: true, title: 'Reserva reprogramada', message: 'Le avisamos al cliente la nueva fecha y hora.', type: 'success' })
            refreshAfterAction()
          }}
        />
      )}

      {cancelFor && (
        <CancelReasonSheet
          booking={{ id: cancelFor.id, serviceName: cancelFor.service.name }}
          title={cancelFor.status === 'PENDING' ? 'Rechazar reserva' : 'Cancelar reserva'}
          onClose={() => setCancelFor(null)}
          onDone={() => {
            const wasPending = cancelFor.status === 'PENDING'
            setCancelFor(null)
            setModal({ isOpen: true, title: wasPending ? 'Reserva rechazada' : 'Reserva cancelada', message: 'Le avisamos al cliente con el motivo que escribiste.', type: 'success' })
            refreshAfterAction()
          }}
        />
      )}

      {afterPhotosFor && (
        <Modal
          isOpen
          title="¡Servicio completado!"
          type="success"
          onClose={() => { setAfterPhotosFor(null); setPhotosVersion((v) => v + 1) }}
        >
          <p className="mb-3 text-sm text-gray-700">
            Sube fotos de cómo quedó «{afterPhotosFor.serviceName}». Las fotos respaldan tu trabajo ante la garantía.
          </p>
          <WorkPhotosEditor bookingId={afterPhotosFor.id} status="COMPLETED" only="after" />
          <button
            type="button"
            onClick={() => { setAfterPhotosFor(null); setPhotosVersion((v) => v + 1) }}
            className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-full border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Listo
          </button>
        </Modal>
      )}

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
          refreshAfterAction()
        }}
      />

      {/* Main Content */}
      <div>
        <PartnerHeader
          title={
            activeTab === 'overview' ? 'Resumen General' :
            activeTab === 'bookings' ? 'Mis Reservas' :
            'Oportunidades'
          }
          subtitle={
            activeTab === 'overview' ? 'Vista general de tu actividad' :
            activeTab === 'bookings' ? 'Gestiona tus reservas confirmadas' :
            'Solicitudes de clientes que coinciden con tus servicios'
          }
          activeTab={activeTab}
          bookingsCount={bookings.length}
          requestsCount={serviceRequests.length}
          onTabChange={(tab) => setActiveTab(tab as any)}
        />

        {/* Content Area (the shell's <main> wraps the page; bottom padding comes from the shell) */}
        <div className={`${DESIGN_SYSTEM.layout.container} ${DESIGN_SYSTEM.spacing.container} ${DESIGN_SYSTEM.spacing.section}`}>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-4 mt-4">

              {/* ── Verification banner (no bloqueante) ── */}
              {verificationAlert.isOpen && (
                <div className="rounded-2xl border-2 border-red-200 bg-gradient-to-br from-red-50 to-orange-50 p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className="bg-red-100 p-2 rounded-xl flex-shrink-0">
                      <Shield className="text-red-600" size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-red-900 text-base">Verificación pendiente</h3>
                      <p className="text-sm text-red-800/90 mt-0.5">
                        Para recibir solicitudes necesitas verificar tu <span className="font-semibold">documento de identidad</span>.
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button
                          onClick={() => router.push('/partner/verification')}
                          className="min-h-[44px] bg-red-600 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-red-700 transition shadow-sm"
                        >
                          Completar verificación
                        </button>
                        <button
                          onClick={() => {
                            try { localStorage.setItem(VERIFICATION_LATER_KEY, String(Date.now() + VERIFICATION_LATER_MS)) } catch {}
                            setVerificationAlert({ ...verificationAlert, isOpen: false })
                          }}
                          className="min-h-[44px] text-red-700 hover:text-red-900 px-4 py-2 rounded-full text-sm font-medium hover:bg-red-100/50 transition"
                        >
                          Más tarde
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Availability toggle ── */}
              <div className={`rounded-2xl p-4 flex items-center justify-between gap-4 border-2 transition-all ${
                isAvailable
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-gray-50 border-gray-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isAvailable ? 'bg-emerald-500 animate-pulse motion-reduce:animate-none' : 'bg-gray-400'}`} aria-hidden="true" />
                  <div>
                    <p className={`font-bold text-base ${isAvailable ? 'text-emerald-800' : 'text-gray-700'}`}>
                      {isAvailable ? 'Estás disponible' : 'No estás disponible'}
                    </p>
                    <p className="text-xs text-gray-600">
                      {isAvailable ? 'Recibirás solicitudes de clientes' : 'No apareces en búsquedas de clientes'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isAvailable}
                  aria-label="Disponible para recibir solicitudes"
                  onClick={toggleAvailability}
                  disabled={availabilityLoading}
                  className="relative -m-1 inline-flex h-11 w-14 flex-shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 disabled:opacity-60"
                >
                  <span className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 ${isAvailable ? 'bg-emerald-600' : 'bg-gray-300'}`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${isAvailable ? 'translate-x-6' : 'translate-x-1'}`} />
                  </span>
                </button>
              </div>

              {/* ── Earnings hero ── */}
              <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl p-5 text-white">
                <p className="text-white/80 text-xs font-semibold uppercase tracking-wide mb-1">Facturado</p>
                <p className="text-3xl sm:text-4xl font-black">{formatCurrency(partnerBilled)}</p>
                <p className="text-white/80 text-xs mt-1 mb-4">
                  {partnerNet !== null && partnerNet !== partnerBilled
                    ? `Suma de servicios completados · recibes ${formatCurrency(partnerNet)} tras la comisión de LoHaggo`
                    : 'Suma de servicios completados'}
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/10 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold">{pendingCount + confirmedCount}</p>
                    <p className="text-white/80 text-xs">Por atender</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold">{inProgressCount}</p>
                    <p className="text-white/80 text-xs">En progreso</p>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold">{completedCount}</p>
                    <p className="text-white/80 text-xs">Completadas</p>
                  </div>
                </div>
              </div>

              {/* ── Payments the client reported: the partner confirms ── */}
              {paymentReportedBookings.length > 0 && (
                <div className={`border-2 rounded-2xl p-4 ${BOOKING_STATUS_COLORS.PAYMENT_REPORTED.full}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">
                      {paymentReportedBookings.length} {paymentReportedBookings.length === 1 ? 'pago por confirmar' : 'pagos por confirmar'}
                    </span>
                    <button
                      onClick={() => { setFilter('PAYMENT_REPORTED'); setActiveTab('bookings') }}
                      className="inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 text-xs font-bold hover:bg-white/50"
                    >
                      Ver <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── New requests ── */}
              {serviceRequests.length > 0 && (
                <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Zap className="w-5 h-5 text-orange-600 flex-shrink-0" aria-hidden="true" />
                      <span className="font-bold text-orange-900">
                        {newRequests.length} {newRequests.length === 1 ? 'nueva' : 'nuevas'}
                        {proposedRequestsCount > 0 && (
                          <span className="font-semibold"> · {proposedRequestsCount} con tu propuesta</span>
                        )}
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveTab('my-requests')}
                      className="inline-flex min-h-[44px] flex-shrink-0 items-center gap-1 rounded-full px-3 text-xs font-bold text-orange-800 hover:bg-orange-100"
                    >
                      Ver todas <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(newRequests.length > 0 ? newRequests : serviceRequests).slice(0, 2).map((req) => (
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
                              <span className="flex-shrink-0 text-xs font-bold uppercase bg-red-700 text-white px-2 py-0.5 rounded-full">Urgente</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 truncate">{req.address || 'Zona por confirmar'}</p>
                        </div>
                        {req.budget ? (
                          <div className="text-right flex-shrink-0">
                            <p className="text-[11px] text-gray-600 leading-none">Presupuesto</p>
                            <p className="text-sm font-bold text-emerald-700 whitespace-nowrap">{formatCurrency(req.budget)}</p>
                          </div>
                        ) : (
                          <p className="text-xs font-semibold text-gray-600 whitespace-nowrap flex-shrink-0">
                            {req.proposals.length > 0 ? 'Ya propusiste' : competitionText(req.competitors ?? req._count?.proposals ?? 0).replace(': sé el primero', '')}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Active bookings ── */}
              {inProgressCount > 0 && (
                <div className={`border-2 rounded-2xl p-4 ${bookingStatusColor('IN_PROGRESS').full}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="w-5 h-5" aria-hidden="true" />
                    <span className="font-bold">En progreso ahora</span>
                  </div>
                  <div className="space-y-2">
                    {bookings.filter(b => b.status === 'IN_PROGRESS').map((booking) => (
                      <button
                        key={booking.id}
                        onClick={() => setActiveTab('bookings')}
                        className="w-full bg-white rounded-xl p-3 flex items-center gap-3 border border-sky-100 hover:border-sky-300 transition text-left"
                      >
                        <ServiceIcon slug={booking.service.slug} emoji={booking.service.icon} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900 truncate">{booking.service.name}</p>
                          <p className="text-xs text-gray-600 truncate">{booking.user.name}</p>
                        </div>
                        <span className={`text-xs font-bold border px-2 py-1 rounded-full ${bookingStatusColor('IN_PROGRESS').full}`}>
                          {getBookingVisualLabel('IN_PROGRESS', 'PARTNER')}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Pending confirmations ── */}
              {pendingCount > 0 && (
                <div className={`border-2 rounded-2xl p-4 ${bookingStatusColor('PENDING').full}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5" aria-hidden="true" />
                      <span className="font-bold">{pendingCount} {pendingCount === 1 ? 'reserva por confirmar' : 'reservas por confirmar'}</span>
                    </div>
                    <button
                      onClick={() => { setFilter('PENDING'); setActiveTab('bookings') }}
                      className="inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 text-xs font-bold hover:bg-white/50"
                    >
                      Ver <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Upcoming bookings ── */}
              {confirmedCount > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary-600" aria-hidden="true" />
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
                          <p className="text-xs text-gray-600">{formatBookingWhen({ scheduledDate: new Date(booking.scheduledDate), scheduledTime: booking.scheduledTime })}</p>
                        </div>
                        <p className="text-sm font-bold text-primary-700 whitespace-nowrap">{formatCurrency(booking.totalPrice)}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Empty state contextual ── */}
              {bookings.length === 0 && serviceRequests.length === 0 && (() => {
                if (verificationAlert.isOpen) {
                  // Ya hay banner arriba; aquí solo mostrar empty visual sin CTA duplicado
                  return (
                    <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Shield className="text-gray-400" size={32} />
                      </div>
                      <p className="font-bold text-gray-900 mb-1">Sin solicitudes todavía</p>
                      <p className="text-sm text-gray-600">Completa la verificación de arriba para empezar a recibir.</p>
                    </div>
                  )
                }
                if (!isAvailable) {
                  return (
                    <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Package className="text-gray-400" size={32} />
                      </div>
                      <p className="font-bold text-gray-900 mb-1">No estás disponible</p>
                      <p className="text-sm text-gray-600 mb-4">Activa tu disponibilidad para aparecer en las búsquedas de clientes.</p>
                      <button
                        onClick={toggleAvailability}
                        disabled={availabilityLoading}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition disabled:opacity-60"
                      >
                        Activar disponibilidad
                      </button>
                    </div>
                  )
                }
                return (
                  <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Package className="text-gray-400" size={32} />
                    </div>
                    <p className="font-bold text-gray-900 mb-1">Todo tranquilo por ahora</p>
                    <p className="text-sm text-gray-600 mb-4">Asegúrate de tener servicios activos y un perfil público completo para recibir más solicitudes.</p>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        onClick={() => router.push('/partner/services')}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition"
                      >
                        <Briefcase className="w-4 h-4" /> Configurar servicios
                      </button>
                      <button
                        onClick={() => router.push('/profile#perfil-publico')}
                        className="inline-flex items-center gap-2 px-4 py-2 border border-primary-200 text-primary-700 bg-white text-sm font-semibold rounded-xl hover:bg-primary-50 transition"
                      >
                        Compartir mi perfil
                      </button>
                    </div>
                  </div>
                )
              })()}

              {/* PWA install banner: waits while the push-notifications prompt is due, so they never stack */}
              {showPwaBanner && !notifPromptPending && (
                <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl p-4 flex items-center gap-3">
                  <img src="/icon-512.png" alt="" className="w-10 h-10 rounded-xl flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-sm">Instala la app</p>
                    <p className="text-white/80 text-xs">Recibe solicitudes al instante, incluso con el navegador cerrado</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (pwaDeferredPrompt) {
                        pwaDeferredPrompt.prompt()
                        await pwaDeferredPrompt.userChoice
                      }
                      dismissPwaBanner()
                    }}
                    className="flex-shrink-0 min-h-[44px] bg-white text-primary-700 text-xs font-bold px-4 py-2 rounded-full hover:bg-white/90 transition whitespace-nowrap"
                  >
                    Instalar
                  </button>
                  <button
                    onClick={dismissPwaBanner}
                    className="flex-shrink-0 inline-flex h-11 w-11 items-center justify-center rounded-full text-white/80 hover:text-white transition"
                    aria-label="Cerrar aviso de instalar la app"
                  >
                    <XCircle className="w-5 h-5" aria-hidden="true" />
                  </button>
                </div>
              )}

              <PlatformTrustBanner variant="info" context="partner" dismissKey="partner-overview" />
            </div>
          )}

          {/* Bookings Tab */}
          {activeTab === 'bookings' && (
            <div className="space-y-4 sm:space-y-6">
              {/* Search and Filters */}
              <div className="sticky top-20 z-20 bg-white rounded-2xl sm:rounded-3xl shadow-lg p-3 sm:p-6 border border-gray-100">
                <div className="hidden sm:flex sm:flex-col gap-3 sm:gap-4">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} aria-hidden="true" />
                    <input
                      type="search"
                      aria-label="Buscar reservas por servicio, cliente o dirección"
                      placeholder="Buscar por servicio, cliente o dirección..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all text-base"
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap items-center" role="group" aria-label="Filtrar por estado">
                    <button
                      type="button"
                      onClick={() => setFilter('')}
                      aria-pressed={filter === ''}
                      className={`min-h-[44px] px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                        filter === ''
                          ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Todas ({bookings.length})
                    </button>
                    {bookingFilterStates.map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFilter(key)}
                        aria-pressed={filter === key}
                        className={`min-h-[44px] px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                          filter === key
                            ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {filterLabel(key)} ({bookingFilterCounts[key] || 0})
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:hidden space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} aria-hidden="true" />
                    <input
                      type="search"
                      aria-label="Buscar reservas por servicio, cliente o dirección"
                      placeholder="Buscar servicio, cliente o dirección..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-base focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-gray-600" aria-live="polite">
                      {filteredBookings.length} resultados {filter ? `· ${filterLabel(filter)}` : '· Todas'}
                    </p>
                    <button
                      type="button"
                      onClick={() => setMobileStatusSheetOpen(true)}
                      aria-haspopup="dialog"
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-primary-200 bg-white px-4 text-xs font-semibold text-primary-700"
                    >
                      <Filter className="h-4 w-4" aria-hidden="true" />
                      Estados
                    </button>
                  </div>
                </div>
              </div>

              <BottomSheet
                open={mobileStatusSheetOpen}
                onClose={() => setMobileStatusSheetOpen(false)}
                title="Filtrar por estado"
              >
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Estados">
                  <button
                    type="button"
                    aria-pressed={filter === ''}
                    onClick={() => {
                      setFilter('')
                      setMobileStatusSheetOpen(false)
                    }}
                    className={`min-h-[44px] rounded-full px-3 py-2 text-sm font-semibold ${
                      filter === '' ? 'bg-primary-600 text-white' : 'border border-gray-200 bg-gray-50 text-gray-700'
                    }`}
                  >
                    Todas ({bookings.length})
                  </button>
                  {bookingFilterStates.map((key) => (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={filter === key}
                      onClick={() => {
                        setFilter(key)
                        setMobileStatusSheetOpen(false)
                      }}
                      className={`min-h-[44px] rounded-full px-3 py-2 text-sm font-semibold ${
                        filter === key ? 'bg-primary-600 text-white' : 'border border-gray-200 bg-gray-50 text-gray-700'
                      }`}
                    >
                      {filterLabel(key)} ({bookingFilterCounts[key] || 0})
                    </button>
                  ))}
                </div>
              </BottomSheet>

              {/* Bookings Grid */}
              {filteredBookings.length === 0 ? (
                <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-12 sm:p-16 text-center border border-gray-200">
                  <div className="bg-gray-200 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                    <Package className="text-gray-400" size={48} aria-hidden="true" />
                  </div>
                  {bookings.length > 0 ? (
                    <>
                      <p className="text-gray-900 text-xl font-bold mb-2">Nada con este filtro</p>
                      <p className="text-gray-600 text-base">Prueba con otro estado o borra la búsqueda.</p>
                      <button
                        type="button"
                        onClick={() => { setFilter(''); setSearchTerm('') }}
                        className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
                      >
                        Ver todas
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-900 text-xl font-bold mb-2">No hay reservas</p>
                      <p className="text-gray-600 text-base">Las reservas aparecerán aquí cuando los clientes las realicen</p>
                      <button
                        type="button"
                        onClick={() => router.push('/partner?tab=my-requests')}
                        className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
                      >
                        Ver oportunidades
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {filteredBookings.map((booking) => {
                    const visualState = getBookingVisualState('PARTNER', booking)
                    const inactive = session?.user?.isActive === false
                    const priorityBadges: string[] = []
                    if (booking.status === 'PENDING' || visualState === 'PAYMENT_REPORTED') priorityBadges.push('Acción requerida')
                    const when = formatBookingWhen({ scheduledDate: new Date(booking.scheduledDate), scheduledTime: booking.scheduledTime })
                    const rate = rateFor(booking)
                    const priceDetail = rate !== null && rate > 0
                      ? `Recibes ${formatCurrency(netForPartner(booking.totalPrice, rate))} · comisión ${rate} %`
                      : undefined
                    const openRating = () =>
                      setRatingModal({
                        isOpen: true,
                        bookingId: booking.id,
                        serviceName: booking.service.name,
                        clientName: booking.user.name,
                        scheduledAt: when,
                      })
                    const canRate = ['COMPLETED', 'PAYMENT_REPORTED', 'PAID'].includes(visualState) && !booking.review?.partnerToClientRating

                    const primaryAction =
                      booking.status === 'PENDING'
                        ? {
                            label: 'Confirmar',
                            onClick: () => updateBookingStatus(booking.id, 'CONFIRMED', booking.service.name),
                            icon: <CheckCircle size={18} />,
                            variant: 'primary' as const,
                            disabled: inactive,
                          }
                        : booking.status === 'CONFIRMED'
                        ? {
                            label: 'Iniciar servicio',
                            onClick: () => updateBookingStatus(booking.id, 'IN_PROGRESS', booking.service.name),
                            icon: <Activity size={18} />,
                            variant: 'primary' as const,
                            disabled: inactive,
                          }
                        : booking.status === 'IN_PROGRESS'
                        ? {
                            label: 'Marcar completado',
                            onClick: () => updateBookingStatus(booking.id, 'COMPLETED', booking.service.name),
                            icon: <CheckCircle size={18} />,
                            variant: 'primary' as const,
                            disabled: inactive,
                          }
                        : visualState === 'PAYMENT_REPORTED'
                        ? {
                            label: `Confirmar que recibiste ${formatCurrency(booking.totalPrice)}`,
                            onClick: () => confirmPaymentReceived(booking),
                            icon: <DollarSign size={18} />,
                            variant: 'primary' as const,
                            disabled: inactive,
                          }
                        : canRate
                        ? {
                            label: 'Calificar cliente',
                            onClick: openRating,
                            icon: <Star size={18} />,
                            variant: 'primary' as const,
                            disabled: inactive,
                          }
                        : undefined

                    const secondaryActions: Array<{
                      label: string
                      onClick: () => void
                      icon?: ReactNode
                      variant?: 'primary' | 'secondary' | 'ghost'
                      disabled?: boolean
                      badge?: number
                      badgeLabel?: string
                    }> = []

                    if (visualState === 'PAYMENT_REPORTED' && canRate) {
                      secondaryActions.push({
                        label: 'Calificar cliente',
                        onClick: openRating,
                        icon: <Star size={16} />,
                        variant: 'secondary',
                        disabled: inactive,
                      })
                    }

                    if (booking.proposalId && booking.status !== 'CANCELLED') {
                      secondaryActions.push({
                        label: 'Chat',
                        onClick: () =>
                          setChatModal({
                            isOpen: true,
                            proposalId: booking.proposalId!,
                            partnerName: booking.user.name,
                            serviceName: booking.service.name,
                            contextLine: `Reserva · ${when} · #${booking.id.slice(-6)}`,
                          }),
                        icon: <MessageCircle size={16} />,
                        variant: 'secondary',
                        disabled: inactive,
                        badge: unreadCounts[booking.proposalId!] || 0,
                        badgeLabel: 'mensajes sin leer',
                      })
                    }

                    if (booking.status === 'PENDING' || booking.status === 'CONFIRMED') {
                      secondaryActions.push({
                        label: 'Reprogramar',
                        onClick: () => setRescheduleFor(booking),
                        icon: <CalendarClock size={16} />,
                        variant: 'secondary',
                        disabled: inactive,
                      })
                      secondaryActions.push({
                        label: booking.status === 'PENDING' ? 'Rechazar' : 'Cancelar',
                        onClick: () => setCancelFor(booking),
                        icon: <XCircle size={16} />,
                        variant: 'secondary',
                        disabled: inactive,
                      })
                    }

                    return (
                      <div key={booking.id} id={`booking-${booking.id}`} className={`space-y-2 scroll-mt-28 rounded-2xl ${focusBookingId === booking.id ? 'ring-2 ring-primary-500 ring-offset-2' : ''}`}>
                        <UnifiedBookingCard
                          role="PARTNER"
                          serviceName={booking.service.name}
                          serviceIcon={booking.service.icon}
                          serviceSlug={booking.service.slug}
                          counterpartName={booking.user.name}
                          counterpartLabel="Cliente"
                          visualState={visualState}
                          totalPrice={formatCurrency(booking.totalPrice)}
                          priceLabel="Valor del servicio"
                          priceDetail={priceDetail}
                          nextStep={getNextStep('PARTNER', booking)}
                          scheduledDate={booking.scheduledDate}
                          scheduledTime={booking.scheduledTime}
                          address={booking.address}
                          notes={booking.notes}
                          priorityBadges={priorityBadges}
                          primaryAction={primaryAction}
                          secondaryActions={secondaryActions}
                          metadataInline={`${when} · ${booking.address}`}
                          origin={booking.origin}
                          originChannel={booking.originChannel}
                        />
                        {['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(booking.status) && (
                          <WorkPhotosEditor key={`${booking.id}-${photosVersion}`} bookingId={booking.id} status={booking.status} />
                        )}
                        {booking.status === 'COMPLETED' && (
                          <OfflinePaymentActions
                            bookingId={booking.id}
                            role="PARTNER"
                            bookingStatus={booking.status}
                            payment={(booking as any).payment}
                            onChange={refreshAfterAction}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* My Requests Tab */}
          {activeTab === 'my-requests' && (
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-4 sm:p-6 border border-gray-100">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} aria-hidden="true" />
                  <input
                    type="search"
                    aria-label="Buscar oportunidades por servicio o zona"
                    placeholder="Buscar solicitudes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all text-base"
                  />
                </div>
              </div>

              {requestsNeedVerification ? (
                <div className="bg-white rounded-3xl shadow-lg p-8 sm:p-12 text-center border border-gray-100">
                  <div className="bg-primary-50 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-5">
                    <Shield className="text-primary-600" size={40} aria-hidden="true" />
                  </div>
                  <p className="text-gray-900 text-lg sm:text-xl font-bold mb-2">Verifica tu identidad para ver oportunidades</p>
                  <p className="text-gray-600 text-sm sm:text-base mb-6">Sube tu documento de identidad; cuando lo aprobemos verás las solicitudes de tu zona.</p>
                  <button
                    onClick={() => router.push('/partner/verification')}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-6 py-3 rounded-full transition w-full sm:w-auto"
                  >
                    Verificar mi identidad <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </div>
              ) : filteredRequests.length === 0 ? (
                <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-12 sm:p-16 text-center border border-gray-100">
                  <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="text-gray-400" size={48} aria-hidden="true" />
                  </div>
                  <p className="text-gray-900 text-xl font-bold mb-2">No hay solicitudes para ti</p>
                  <p className="text-gray-600 text-base">Las solicitudes que coincidan con tus servicios aparecerán aquí</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {filteredRequests.map((request) => {
                    const photos = [...(request.photos || [])].sort((a, b) => a.order - b.order)
                    const own = request.proposals[0]
                    const ownChip = own ? (PROPOSAL_STATUS_CHIP[own.status] || PROPOSAL_STATUS_CHIP.PENDING) : null
                    return (
                    <div key={request.id} className="bg-white rounded-2xl sm:rounded-3xl shadow-lg hover:shadow-xl transition-all overflow-hidden border border-gray-100">
                      <div className="p-5 sm:p-6">
                        <div className="flex items-start gap-4 mb-5">
                          <ServiceIcon slug={request.service.slug} emoji={request.service.icon} size="xl" />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-lg sm:text-xl text-gray-900 mb-2">{request.service.name}</h3>
                            <div className="flex items-center gap-2 flex-wrap">
                              {request.isUrgent && (
                                <span className="bg-red-700 text-white text-xs font-bold uppercase px-3 py-1 rounded-full shadow-md animate-pulse motion-reduce:animate-none">
                                  <span aria-hidden="true">⚡ </span>Urgente
                                </span>
                              )}
                              {request.partnerId && (
                                <span className="bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 text-xs font-bold px-3 py-1 rounded-full border border-purple-300 flex items-center gap-1">
                                  <UserPlus size={12} aria-hidden="true" />
                                  DIRECTA
                                </span>
                              )}
                              {request.expiresAt && <RequestCountdown expiresAt={request.expiresAt} />}
                            </div>
                            <p className="text-sm text-gray-600 mt-2">{request.service.category.name}</p>
                            <OriginBadge variant="user" origin={request.origin} originChannel={request.originChannel} className="mt-1" />
                          </div>
                        </div>

                        <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="bg-gray-200 rounded-lg p-1.5">
                              <User size={16} className="text-gray-600" aria-hidden="true" />
                            </div>
                            <span className="font-bold text-gray-900 truncate">{request.user.name}</span>
                          </div>
                          <p className="text-sm text-gray-600">
                            {competitionText(request.competitors ?? Math.max(0, (request._count?.proposals ?? 0) - request.proposals.length))}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">Verás el contacto y la dirección exacta cuando el cliente acepte tu propuesta.</p>
                        </div>

                        <div className="space-y-3 mb-4">
                          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border-2 border-gray-200">
                            <div className="bg-gray-200 rounded-lg p-2 flex-shrink-0">
                              <MapPin size={18} className="text-gray-600" aria-hidden="true" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-600 font-semibold mb-1">Zona aproximada</p>
                              <span className="text-sm font-medium text-gray-900">{[request.address, request.city].filter(Boolean).join(', ')}</span>
                            </div>
                          </div>
                          {request.preferredDate && (
                            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border-2 border-gray-200">
                              <div className="bg-gray-200 rounded-lg p-2 flex-shrink-0">
                                <Calendar size={18} className="text-gray-600" aria-hidden="true" />
                              </div>
                              <div>
                                <p className="text-xs text-gray-600 font-semibold mb-1">Fecha preferida</p>
                                <span className="text-sm font-medium text-gray-900">
                                  {formatCalendarDay(request.preferredDate, { weekday: 'long', day: 'numeric', month: 'long' })}
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

                        {!!request.budget && (
                          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mb-4">
                            <div className="flex items-start gap-3">
                              <div className="bg-green-200 rounded-lg p-2 flex-shrink-0">
                                <DollarSign size={18} className="text-green-700" aria-hidden="true" />
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-green-800 mb-1">Presupuesto del cliente</p>
                                <span className="text-lg font-bold text-green-800">{formatCurrency(request.budget)}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {photos.length > 0 && (
                          <div className="mb-4">
                            <h4 className="font-semibold mb-3 text-sm text-gray-700 flex items-center gap-2">
                              <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-lg text-xs">
                                {photos.length} {photos.length === 1 ? 'foto' : 'fotos'}
                              </span>
                              Fotos adjuntas
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                              {photos.map((photo, index) => (
                                <button
                                  key={photo.id}
                                  type="button"
                                  aria-label={`Ver foto ${index + 1} de ${photos.length}`}
                                  className="relative group rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                                  onClick={() => setImageGallery({ isOpen: true, photos, initialIndex: index })}
                                >
                                  <img
                                    src={photo.url}
                                    alt=""
                                    className="w-full h-32 object-cover rounded-xl border-2 border-gray-200 group-hover:border-primary-500 transition-all shadow-md group-hover:shadow-lg"
                                  />
                                  <span className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-all rounded-xl flex items-end justify-center pb-3" aria-hidden="true">
                                    <span className="text-white text-sm font-semibold">
                                      Ver imagen
                                    </span>
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {own && ownChip ? (
                          <div className="space-y-3">
                            <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full border px-4 py-2.5 text-sm font-semibold ${ownChip.className}`}>
                              <span>Tu propuesta: {formatCurrency(own.price)}</span>
                              <span aria-hidden="true">·</span>
                              <span>{ownChip.label}</span>
                            </div>
                            {(own.status === 'ACCEPTED' || (request.status === 'ACTIVE' && own.status === 'PENDING')) && (
                              <button
                                onClick={() => setChatModal({
                                  isOpen: true,
                                  proposalId: own.id,
                                  partnerName: request.user.name,
                                  serviceName: request.service.name,
                                  contextLine: request.expiresAt
                                    ? `Solicitud · expira ${formatBogotaMoment(request.expiresAt)}`
                                    : 'Solicitud',
                                })}
                                className="w-full min-h-[44px] bg-white border-2 border-gray-300 text-gray-700 px-4 py-3 rounded-full hover:border-primary-500 hover:text-primary-700 transition-all font-semibold flex items-center justify-center gap-2 relative shadow-md hover:shadow-lg"
                              >
                                <MessageCircle size={20} aria-hidden="true" />
                                Chat con Cliente
                                <CountBadge count={unreadCounts[own.id] ?? 0} size="lg" pulse label="mensajes sin leer" className="absolute -right-2 -top-2 shadow-lg ring-2 ring-white" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => openProposalModal(request)}
                            className="bg-gradient-to-r from-primary-500 to-primary-600 text-white min-h-[44px] px-4 py-3 rounded-full font-semibold hover:from-primary-600 hover:to-primary-700 transition-all w-full flex items-center justify-center gap-2 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={session?.user?.isActive === false}
                          >
                            <Send size={20} aria-hidden="true" />
                            Enviar propuesta
                          </button>
                        )}
                      </div>
                    </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}


        </div>
      </div>

      {/* Proposal Modal */}
      {showProposalModal && selectedRequest && (() => {
        const req = selectedRequest
        const photos = [...(req.photos || [])].sort((a, b) => a.order - b.order)
        const priceValue = parseFloat(proposalPrice)
        const competitors = req.competitors ?? Math.max(0, (req._count?.proposals ?? 0) - req.proposals.length)
        return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
          <button
            type="button"
            aria-label="Cerrar"
            tabIndex={-1}
            onClick={() => { if (!submittingProposal) setShowProposalModal(false) }}
            className="absolute inset-0 bg-black/50 cursor-default"
          />
          <div
            {...proposalDialog.dialogProps}
            className={`${DESIGN_SYSTEM.components.card.base} relative max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-b-none sm:rounded-3xl outline-none`}
          >
            <div className={`${DESIGN_SYSTEM.spacing.card} sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-gradient-to-r from-primary-600 to-primary-700`}>
              <div className="min-w-0">
                <h2 id={proposalDialog.titleId} className={`${DESIGN_SYSTEM.typography.h2} text-white`}>Enviar Propuesta</h2>
                <p className="text-white/90 text-sm mt-1">Completa los detalles de tu oferta</p>
              </div>
              <button
                type="button"
                onClick={() => { if (!submittingProposal) setShowProposalModal(false) }}
                aria-label="Cerrar"
                className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className={`${DESIGN_SYSTEM.spacing.card} ${DESIGN_SYSTEM.spacing.gap}`}>
              <div className={`${DESIGN_SYSTEM.components.card.base} bg-gray-50 ${DESIGN_SYSTEM.spacing.cardSmall}`}>
                <div className="flex items-center gap-3 mb-3">
                  <ServiceIcon slug={req.service.slug} emoji={req.service.icon} size="md" />
                  <div className="min-w-0 flex-1">
                    <h3 className={`${DESIGN_SYSTEM.typography.h4} truncate`}>{req.service.name}</h3>
                    <p className={`${DESIGN_SYSTEM.typography.bodySmall} truncate`}>{req.service.category.name}</p>
                  </div>
                </div>
                <div className={`${DESIGN_SYSTEM.spacing.gapSmall} ${DESIGN_SYSTEM.typography.bodySmall}`}>
                  <p><strong>Cliente:</strong> {req.user.name}</p>
                  <p className="truncate"><strong>Zona aproximada:</strong> {[req.address, req.city].filter(Boolean).join(', ')}</p>
                  {req.budget ? (
                    <p><strong>Presupuesto del cliente:</strong> {formatCurrency(req.budget)}</p>
                  ) : null}
                  <p><strong>Competencia:</strong> {competitionText(competitors)}</p>
                  {req.preferredDate && (
                    <p>
                      <strong>Fecha preferida:</strong> {formatCalendarDay(req.preferredDate, { weekday: 'long', day: 'numeric', month: 'long' })}
                      {req.preferredTime && ` a las ${req.preferredTime}`}
                    </p>
                  )}
                  {req.notes && (
                    <p><strong>Detalles:</strong> {req.notes}</p>
                  )}
                </div>

                {photos.length > 0 && (
                  <div className="mt-4">
                    <p className={`${DESIGN_SYSTEM.typography.label} mb-2`}>Fotos adjuntas:</p>
                    <div className={`${DESIGN_SYSTEM.responsive.gridCols3} ${DESIGN_SYSTEM.spacing.gapSmall}`}>
                      {photos.map((photo, index) => (
                        <button
                          key={photo.id}
                          type="button"
                          aria-label={`Ver foto ${index + 1} de ${photos.length}`}
                          className="relative group rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                          onClick={() => setImageGallery({ isOpen: true, photos, initialIndex: index })}
                        >
                          <img
                            src={photo.url}
                            alt=""
                            className={`${DESIGN_SYSTEM.components.card.base} ${DESIGN_SYSTEM.components.card.hover} w-full h-24 object-cover border-2 pointer-events-none`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="proposal-price" className={`${DESIGN_SYSTEM.typography.label} mb-2 block`}>
                  Precio de tu Propuesta *
                </label>
                <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 mb-3" id="proposal-price-hint">
                  <p className="text-sm text-primary-800">
                    <span className="font-semibold">Precio base mínimo:</span> {formatCurrency(req.service.basePrice)}
                  </p>
                  <p className="text-xs text-primary-800 mt-1">
                    Tu propuesta debe ser igual o mayor a este valor
                  </p>
                </div>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} aria-hidden="true" />
                  <input
                    id="proposal-price"
                    type="number"
                    inputMode="numeric"
                    value={proposalPrice}
                    onChange={(e) => setProposalPrice(e.target.value)}
                    placeholder={req.service.basePrice.toString()}
                    min={req.service.basePrice}
                    step="any"
                    required
                    aria-describedby="proposal-price-hint proposal-price-net"
                    className={`${DESIGN_SYSTEM.components.input.base} pl-10`}
                  />
                </div>
                <p id="proposal-price-net" className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 empty:hidden" aria-live="polite">
                  {partnerRate === null
                    ? null
                    : partnerRate > 0
                      ? (priceValue > 0
                          ? <>Comisión LoHaggo {partnerRate} % → recibes <strong>{formatCurrency(netForPartner(priceValue, partnerRate))}</strong></>
                          : <>Comisión LoHaggo {partnerRate} %: escribe el precio para ver cuánto recibes</>)
                      : 'Sin comisión de LoHaggo: recibes el valor completo'}
                </p>
              </div>

              <div>
                <p id="proposal-when-label" className={`${DESIGN_SYSTEM.typography.label} mb-1 block`}>
                  ¿Cuándo puedes ir? (opcional)
                </p>
                <p className="mb-2 text-xs text-gray-600">Si propones fecha y hora, al aceptar tu propuesta la reserva queda para ese momento.</p>
                <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="proposal-when-label">
                  <div>
                    <label htmlFor="proposal-date" className="mb-1 block text-xs font-medium text-gray-700">Fecha</label>
                    <input
                      id="proposal-date"
                      type="date"
                      value={proposalDate}
                      min={new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())}
                      onChange={(e) => setProposalDate(e.target.value)}
                      className={DESIGN_SYSTEM.components.input.base}
                    />
                  </div>
                  <div>
                    <label htmlFor="proposal-time" className="mb-1 block text-xs font-medium text-gray-700">Hora</label>
                    <input
                      id="proposal-time"
                      type="time"
                      value={proposalTime}
                      step={1800}
                      disabled={!proposalDate}
                      aria-describedby={!proposalDate ? 'proposal-time-hint' : undefined}
                      onChange={(e) => setProposalTime(e.target.value)}
                      className={`${DESIGN_SYSTEM.components.input.base} disabled:bg-gray-100`}
                    />
                    {!proposalDate && <p id="proposal-time-hint" className="mt-1 text-xs text-gray-600">Elige primero la fecha</p>}
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="proposal-notes" className={`${DESIGN_SYSTEM.typography.label} mb-2 block`}>
                  Notas Adicionales (Opcional)
                </label>
                <textarea
                  id="proposal-notes"
                  value={proposalNotes}
                  onChange={(e) => setProposalNotes(e.target.value)}
                  placeholder="Describe tu experiencia, tiempo estimado, materiales incluidos, etc."
                  rows={4}
                  className={`${DESIGN_SYSTEM.components.input.base} resize-none`}
                />
              </div>
            </div>

            <div className={`${DESIGN_SYSTEM.spacing.card} sticky bottom-0 z-10 border-t bg-gray-50 flex gap-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]`}>
              <button
                type="button"
                onClick={() => setShowProposalModal(false)}
                disabled={submittingProposal}
                className="min-h-[44px] bg-white text-gray-700 border-2 border-gray-400 px-5 py-3 rounded-full font-semibold hover:bg-gray-50 transition-all flex-none disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitProposal}
                aria-busy={submittingProposal}
                className="min-h-[44px] bg-gradient-to-r from-primary-600 to-primary-700 text-white px-4 py-3 rounded-full font-semibold hover:from-primary-700 hover:to-primary-800 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex-1 whitespace-nowrap flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                disabled={session?.user?.isActive === false || submittingProposal}
              >
                {submittingProposal
                  ? <Loader2 size={20} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  : <Send size={20} aria-hidden="true" />}
                {submittingProposal ? 'Enviando…' : 'Enviar Propuesta'}
              </button>
            </div>
          </div>
        </div>
        )
      })()}

      {chatModal.isOpen && (
        <ChatModal
          proposalId={chatModal.proposalId}
          partnerName={chatModal.partnerName}
          counterpartName={chatModal.partnerName}
          contextLine={chatModal.contextLine}
          serviceName={chatModal.serviceName}
          onClose={() => setChatModal({ isOpen: false, proposalId: '', partnerName: '', serviceName: '' })}
        />
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
