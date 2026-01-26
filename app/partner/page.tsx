'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Calendar, Clock, MapPin, DollarSign, Package, User, CheckCircle, XCircle,
  Send, AlertCircle, TrendingUp, Activity, Filter, Search, Menu, X,
  Home, Briefcase, Bell, Settings, LogOut, ChevronRight, Eye, MessageSquare, Shield, Star, MessageCircle, UserPlus
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { DESIGN_SYSTEM, getStatusClasses, getStatusLabel } from '@/lib/design-system'
import Modal from '@/components/Modal'
import ConfirmModal from '@/components/ConfirmModal'
import ImageGalleryModal from '@/components/ImageGalleryModal'
import RatingModal from '@/components/RatingModal'
import ChatModal from '@/components/ChatModal'
import PartnerHeader from '@/components/partner/PartnerHeader'
import StatCard from '@/components/shared/StatCard'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import EmptyState from '@/components/shared/EmptyState'
import PlatformTrustBanner from '@/components/PlatformTrustBanner'

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
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'my-requests'>('overview')
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
  }>({
    isOpen: false,
    bookingId: '',
    serviceName: '',
    clientName: ''
  })

  const fetchBookings = async () => {
    setLoading(true)
    try {
      let url = '/api/bookings'
      if (filter) url += `?status=${filter}`

      const res = await fetch(url)
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
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated') {
      if (session?.user?.role !== 'PARTNER') {
        router.push('/dashboard')
      } else {
        fetchBookings()
        fetchServiceRequests()
      }
    }
  }, [status, filter, session, activeTab])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && ['overview', 'bookings', 'my-requests'].includes(tab)) {
      setActiveTab(tab as 'overview' | 'bookings' | 'my-requests')
    }
  }, [searchParams])

  useEffect(() => {
    if (status === 'authenticated' && (bookings.length > 0 || serviceRequests.length > 0)) {
      fetchUnreadCounts()
      const interval = setInterval(fetchUnreadCounts, 5000)
      return () => clearInterval(interval)
    }
  }, [status, bookings, serviceRequests])

  const fetchUnreadCounts = async () => {
    try {
      const bookingsWithProposals = bookings.filter(b => b.proposalId)
      const proposalsFromRequests = serviceRequests
        .filter(r => r.proposals && r.proposals.length > 0)
        .map(r => r.proposals[0].id)

      const allProposalIds = [
        ...bookingsWithProposals.map(b => b.proposalId!),
        ...proposalsFromRequests
      ]

      const counts: Record<string, number> = {}

      await Promise.all(
        allProposalIds.map(async (proposalId) => {
          try {
            const res = await fetch(`/api/chat/unread-count?proposalId=${proposalId}`)
            if (res.ok) {
              const data = await res.json()
              counts[proposalId] = data.count || 0
            } else {
              try {
                const text = await res.text()
                console.error(`[PARTNER] Error response for ${proposalId}:`, res.status, text)
              } catch (readErr) {
                console.error(`[PARTNER] Error response for ${proposalId}:`, res.status, 'and failed to read body', readErr)
              }
            }
          } catch (error) {
            console.error(`[PARTNER] Error fetching unread count for ${proposalId}:`, error)
          }
        })
      )

      setUnreadCounts(counts)
    } catch (error) {
      console.error('[PARTNER] Error fetching unread counts:', error)
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

  const filteredBookings = bookings.filter(booking =>
    booking.service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    booking.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    booking.address.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredRequests = serviceRequests.filter(request =>
    request.service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.address.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
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
        onClose={() => setRatingModal({ isOpen: false, bookingId: '', serviceName: '', clientName: '' })}
        bookingId={ratingModal.bookingId}
        serviceName={ratingModal.serviceName}
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
            <div className="space-y-6 sm:space-y-8 mt-6">
              <PlatformTrustBanner
                variant="info"
                context="partner"
                className="mb-6"
              />
              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg border border-gray-200 p-4 sm:p-6 hover:shadow-xl transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-3 shadow-md">
                      <Package className="text-white" size={24} />
                    </div>
                    <TrendingUp className="text-emerald-500" size={20} />
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{bookings.length}</p>
                  <p className="text-sm text-gray-600 font-medium">Total Reservas</p>
                </div>

                <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg border border-gray-200 p-4 sm:p-6 hover:shadow-xl transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="bg-gray-600 rounded-xl p-3 shadow-md">
                      <Clock className="text-white" size={24} />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{pendingCount}</p>
                  <p className="text-sm text-gray-600 font-medium">Pendientes</p>
                </div>

                <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg border border-gray-200 p-4 sm:p-6 hover:shadow-xl transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="bg-gray-600 rounded-xl p-3 shadow-md">
                      <Activity className="text-white" size={24} />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{inProgressCount}</p>
                  <p className="text-sm text-gray-600 font-medium">En Progreso</p>
                </div>

                <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg border border-gray-200 p-4 sm:p-6 hover:shadow-xl transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-3 shadow-md">
                      <DollarSign className="text-white" size={24} />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">{formatCurrency(partnerTotalEarnings)}</p>
                  <p className="text-sm text-gray-600 font-medium">Ganancias</p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg border border-gray-100 p-6 sm:p-8">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-2 shadow-md">
                    <Activity className="text-white" size={24} />
                  </div>
                  Acciones Rápidas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => setActiveTab('bookings')}
                    className="bg-white rounded-2xl p-5 flex items-center gap-4 border-2 border-gray-200 hover:border-primary-500 hover:shadow-lg transition-all group"
                  >
                    <div className="bg-gray-100 rounded-xl p-3 group-hover:bg-primary-100 transition-colors">
                      <Package className="text-gray-600 group-hover:text-primary-600 transition-colors" size={24} />
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-bold text-base text-gray-900 mb-1">Ver Reservas</p>
                      <p className="text-sm text-gray-600">{bookings.length} activas</p>
                    </div>
                    <ChevronRight className="text-gray-400 group-hover:text-primary-600 transition-colors hidden sm:block" size={20} />
                  </button>

                  <button
                    onClick={() => setActiveTab('my-requests')}
                    className="bg-white rounded-2xl p-5 flex items-center gap-4 border-2 border-gray-200 hover:border-primary-500 hover:shadow-lg transition-all group"
                  >
                    <div className="bg-gray-100 rounded-xl p-3 group-hover:bg-primary-100 transition-colors">
                      <Bell className="text-gray-600 group-hover:text-primary-600 transition-colors" size={24} />
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-bold text-base text-gray-900 mb-1">Solicitudes</p>
                      <p className="text-sm text-gray-600">{serviceRequests.length} nuevas</p>
                    </div>
                    <ChevronRight className="text-gray-400 group-hover:text-primary-600 transition-colors hidden sm:block" size={20} />
                  </button>

                  <button
                    onClick={() => router.push('/partner/services')}
                    className="bg-white rounded-2xl p-5 flex items-center gap-4 border-2 border-gray-200 hover:border-primary-500 hover:shadow-lg transition-all group"
                  >
                    <div className="bg-gray-100 rounded-xl p-3 group-hover:bg-primary-100 transition-colors">
                      <Briefcase className="text-gray-600 group-hover:text-primary-600 transition-colors" size={24} />
                    </div>
                    <div className="text-left flex-1">
                      <p className="font-bold text-base text-gray-900 mb-1">Mis Servicios</p>
                      <p className="text-sm text-gray-600">Gestionar</p>
                    </div>
                    <ChevronRight className="text-gray-400 group-hover:text-primary-600 transition-colors hidden sm:block" size={20} />
                  </button>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg border border-gray-100 p-6 sm:p-8">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <div className="bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl p-2 shadow-md">
                    <Clock className="text-white" size={24} />
                  </div>
                  Actividad Reciente
                </h3>
                {bookings.slice(0, 5).length === 0 ? (
                  <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-12 text-center border-2 border-gray-200">
                    <div className="bg-gray-200 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                      <Package className="text-gray-400" size={40} />
                    </div>
                    <p className="text-gray-900 text-lg font-bold mb-2">No hay actividad reciente</p>
                    <p className="text-gray-500">Cuando tengas reservas, aparecerán aquí</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bookings.slice(0, 5).map((booking) => (
                      <div key={booking.id} className="bg-gray-50 rounded-xl p-4 flex items-center gap-4 border border-gray-200 hover:border-orange-400 hover:shadow-md transition-all">
                        <div className="text-4xl">{booking.service.icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-base text-gray-900 truncate">{booking.service.name}</p>
                          <p className="text-sm text-gray-600 truncate">{booking.user.name}</p>
                        </div>
                        <span className={`${getStatusClasses(booking.status)} px-3 py-1.5 rounded-full text-xs font-semibold border-2 whitespace-nowrap`}>
                          {getStatusLabel(booking.status)}
                        </span>
                        <p className="font-bold text-base text-primary-600 whitespace-nowrap hidden sm:block">{formatCurrency(booking.totalPrice)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bookings Tab */}
          {activeTab === 'bookings' && (
            <div className="space-y-4 sm:space-y-6">
              {/* Search and Filters */}
              <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-4 sm:p-6 border border-gray-100">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
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
                      Todas
                    </button>
                    {Object.entries(DESIGN_SYSTEM.statusLabels).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                          filter === key
                            ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bookings Grid */}
              {filteredBookings.length === 0 ? (
                <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-12 sm:p-16 text-center border border-gray-200">
                  <div className="bg-gray-200 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                    <Package className="text-gray-400" size={48} />
                  </div>
                  <p className="text-gray-900 text-xl font-bold mb-2">No hay reservas</p>
                  <p className="text-gray-500 text-base">Las reservas aparecerán aquí cuando los clientes las realicen</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {filteredBookings.map((booking) => (
                    <div key={booking.id} className="bg-white rounded-2xl sm:rounded-3xl shadow-lg hover:shadow-xl transition-all overflow-hidden border border-gray-200">
                      <div className="p-5 sm:p-6">
                        <div className="flex items-start gap-4 mb-5">
                          <div className="text-4xl sm:text-5xl">{booking.service.icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <h3 className="font-bold text-lg sm:text-xl text-gray-900">{booking.service.name}</h3>
                              <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border-2 ${getStatusClasses(booking.status)}`}>
                                {getStatusLabel(booking.status)}
                              </span>
                            </div>
                            <p className="text-2xl sm:text-3xl font-bold text-primary-600 mt-2">{formatCurrency(booking.totalPrice)}</p>
                          </div>
                        </div>

                        <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="bg-gray-200 rounded-lg p-1.5">
                              <User size={16} className="text-gray-600" />
                            </div>
                            <span className="font-bold text-gray-900">{booking.user.name}</span>
                          </div>
                          <p className="text-sm text-gray-600 flex items-center gap-2">📧 {booking.user.email}</p>
                          {booking.user.phone && (
                            <p className="text-sm text-gray-600 flex items-center gap-2 mt-1">📱 {booking.user.phone}</p>
                          )}
                        </div>

                        <div className="space-y-3 mb-4">
                          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border-2 border-gray-200">
                            <div className="bg-gray-200 rounded-lg p-2 flex-shrink-0">
                              <Calendar size={18} className="text-gray-600" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 font-semibold mb-1">Fecha programada</p>
                              <span className="text-sm font-medium text-gray-900">
                                {new Date(booking.scheduledDate).toLocaleDateString('es-ES', {
                                  weekday: 'long',
                                  day: 'numeric',
                                  month: 'long'
                                })}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border-2 border-gray-200">
                            <div className="bg-gray-200 rounded-lg p-2 flex-shrink-0">
                              <Clock size={18} className="text-gray-600" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 font-semibold mb-1">Hora</p>
                              <span className="text-sm font-medium text-gray-900">{booking.scheduledTime}</span>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border-2 border-gray-200">
                            <div className="bg-gray-200 rounded-lg p-2 flex-shrink-0">
                              <MapPin size={18} className="text-gray-600" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 font-semibold mb-1">Dirección</p>
                              <span className="text-sm font-medium text-gray-900">{booking.address}</span>
                            </div>
                          </div>
                        </div>

                        {booking.notes && (
                          <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4 mb-4">
                            <p className="text-xs font-semibold text-gray-700 mb-2">Notas del cliente:</p>
                            <p className="text-sm text-gray-800">{booking.notes}</p>
                          </div>
                        )}

                        {booking.status === 'COMPLETED' && !booking.review?.partnerToClientRating && (
                          <button
                            onClick={() => setRatingModal({
                              isOpen: true,
                              bookingId: booking.id,
                              serviceName: booking.service.name,
                              clientName: booking.user.name
                            })}
                            className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white px-4 py-3.5 rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all font-semibold flex items-center justify-center gap-2 mb-3 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-500"
                            disabled={session?.user?.isActive === false}
                          >
                            <Star size={20} />
                            Calificar Cliente
                          </button>
                        )}

                        {booking.status === 'COMPLETED' && booking.review?.partnerToClientRating && (
                          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 mb-3">
                            <div className="flex items-center gap-2 text-emerald-700">
                              <CheckCircle size={18} />
                              <span className="text-sm font-semibold">Cliente calificado</span>
                              <div className="flex ml-auto">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    size={16}
                                    className={i < (booking.review?.partnerToClientRating || 0) ? 'fill-emerald-500 text-emerald-500' : 'text-gray-300'}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {booking.proposalId && booking.payment?.status !== 'APPROVED' && (
                          <button
                            onClick={() => setChatModal({
                              isOpen: true,
                              proposalId: booking.proposalId!,
                              partnerName: session?.user?.name || 'Socio',
                              serviceName: booking.service.name
                            })}
                            className="w-full bg-white text-gray-700 border-2 border-gray-300 px-4 py-3.5 rounded-xl hover:bg-gray-50 transition-all font-semibold flex items-center justify-center gap-2 mb-3 relative shadow-md hover:shadow-lg"
                            disabled={session?.user?.isActive === false}
                          >
                            <MessageCircle size={20} />
                            Chat con el Cliente
                            {unreadCounts[booking.proposalId!] > 0 && (
                              <span className="absolute -top-2 -right-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white text-xs font-bold rounded-full h-7 w-7 flex items-center justify-center animate-pulse shadow-lg">
                                {unreadCounts[booking.proposalId!]}
                              </span>
                            )}
                          </button>
                        )}

                        {booking.payment?.status !== 'APPROVED' && booking.status !== 'COMPLETED' && (
                          <div className="flex gap-2">
                            {booking.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => updateBookingStatus(booking.id, 'CONFIRMED', booking.service.name)}
                                  className="flex-1 bg-gradient-to-r from-primary-500 to-primary-600 text-white px-4 py-3.5 rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                                  disabled={session?.user?.isActive === false}
                                >
                                  <CheckCircle size={20} />
                                  Confirmar
                                </button>
                                <button
                                  onClick={() => updateBookingStatus(booking.id, 'CANCELLED', booking.service.name)}
                                  className="flex-1 bg-white text-gray-700 border-2 border-gray-400 px-4 py-3.5 rounded-xl hover:bg-gray-50 transition-all font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                  disabled={session?.user?.isActive === false}
                                >
                                  <XCircle size={20} />
                                  Rechazar
                                </button>
                              </>
                            )}
                            {booking.status === 'CONFIRMED' && (
                              <button
                                onClick={() => updateBookingStatus(booking.id, 'IN_PROGRESS', booking.service.name)}
                                className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white px-4 py-3.5 rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={session?.user?.isActive === false}
                              >
                                Iniciar Servicio
                              </button>
                            )}
                            {booking.status === 'IN_PROGRESS' && (
                              <button
                                onClick={() => updateBookingStatus(booking.id, 'COMPLETED', booking.service.name)}
                                className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white px-4 py-3.5 rounded-xl hover:from-emerald-600 hover:to-green-700 transition-all font-semibold shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={session?.user?.isActive === false}
                              >
                                Marcar Completado
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* My Requests Tab */}
          {activeTab === 'my-requests' && (
            <div className="space-y-4 sm:space-y-6">
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
                          <div className="text-4xl sm:text-5xl">{request.service.icon}</div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-lg sm:text-xl text-gray-900 mb-2">{request.service.name}</h3>
                            <div className="flex items-center gap-2 flex-wrap">
                              {request.isUrgent && (
                                <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                                  ⚡ URGENTE
                                </span>
                              )}
                              {request.partnerId && (
                                <span className="bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 text-xs font-bold px-3 py-1.5 rounded-full border-2 border-purple-300 flex items-center gap-1.5">
                                  <UserPlus size={14} />
                                  SOLICITUD DIRECTA
                                </span>
                              )}
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
                  <div className="text-3xl">{selectedRequest.service.icon}</div>
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
