'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Calendar, Clock, MapPin, DollarSign, Package, User, CheckCircle, XCircle,
  Send, AlertCircle, TrendingUp, Activity, Filter, Search, Menu, X,
  Home, Briefcase, Bell, Settings, LogOut, ChevronRight, Eye, MessageSquare, Shield
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { DESIGN_SYSTEM, getStatusClasses, getStatusLabel } from '@/lib/design-system'
import Modal from '@/components/Modal'
import ConfirmModal from '@/components/ConfirmModal'
import ImageGalleryModal from '@/components/ImageGalleryModal'
import PartnerHeader from '@/components/partner/PartnerHeader'
import StatCard from '@/components/shared/StatCard'
import LoadingSpinner from '@/components/shared/LoadingSpinner'
import EmptyState from '@/components/shared/EmptyState'

interface Booking {
  id: string
  scheduledDate: string
  scheduledTime: string
  address: string
  notes: string
  status: string
  totalPrice: number
  createdAt: string
  service: {
    name: string
    icon: string
  }
  user: {
    name: string
    email: string
    phone: string
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
  service: {
    name: string
    icon: string
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
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'my-requests' | 'all-requests'>('overview')
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

  const fetchBookings = async () => {
    setLoading(true)
    try {
      let url = '/api/bookings'
      if (filter) url += `?status=${filter}`

      const res = await fetch(url)
      const data = await res.json()
      setBookings(data)
    } catch (error) {
      console.error('Error fetching bookings:', error)
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

  const fetchAllServiceRequests = async () => {
    try {
      const res = await fetch('/api/service-requests')
      if (res.ok) {
        const data = await res.json()
        setAllServiceRequests(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching all service requests:', error)
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
        if (activeTab === 'all-requests') {
          fetchAllServiceRequests()
        }
      }
    }
  }, [status, filter, session, activeTab])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && ['overview', 'bookings', 'my-requests', 'all-requests'].includes(tab)) {
      setActiveTab(tab as 'overview' | 'bookings' | 'my-requests' | 'all-requests')
    }
  }, [searchParams])

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

    try {
      const res = await fetch('/api/partner/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceRequestId: selectedRequest.id,
          price: parseFloat(proposalPrice),
          notes: proposalNotes
        })
      })

      if (res.ok) {
        setModal({
          isOpen: true,
          title: '¡Propuesta Enviada!',
          message: `Tu propuesta de ${formatCurrency(parseFloat(proposalPrice))} ha sido enviada exitosamente.`,
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

  const filteredAllRequests = allServiceRequests.filter(request =>
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

      {/* Main Content */}
      <div>
        <PartnerHeader
          title={
            activeTab === 'overview' ? 'Resumen General' :
            activeTab === 'bookings' ? 'Mis Reservas' :
            activeTab === 'my-requests' ? 'Solicitudes para Mí' :
            'Todas las Solicitudes'
          }
          subtitle={
            activeTab === 'overview' ? 'Vista general de tu actividad' :
            activeTab === 'bookings' ? 'Gestiona tus reservas confirmadas' :
            activeTab === 'my-requests' ? 'Solicitudes que coinciden con tus servicios' :
            'Explora nuevas oportunidades'
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
            <div className={DESIGN_SYSTEM.spacing.gap}>
              {/* Stats Grid */}
              <div className={`${DESIGN_SYSTEM.responsive.gridCols4} ${DESIGN_SYSTEM.spacing.gap}`}>
                <StatCard
                  label="Total Reservas"
                  value={bookings.length}
                  icon={Package}
                  iconColor="text-primary-600"
                  iconBgColor="bg-primary-100"
                  borderColor="border-primary-500"
                  trendIcon={<TrendingUp className="text-green-500" size={18} />}
                />

                <StatCard
                  label="Pendientes"
                  value={pendingCount}
                  icon={Clock}
                  iconColor="text-yellow-600"
                  iconBgColor="bg-yellow-100"
                  borderColor="border-yellow-500"
                />

                <StatCard
                  label="En Progreso"
                  value={inProgressCount}
                  icon={Activity}
                  iconColor="text-purple-600"
                  iconBgColor="bg-purple-100"
                  borderColor="border-purple-500"
                />

                <StatCard
                  label="Ganancias"
                  value={formatCurrency(partnerTotalEarnings)}
                  icon={DollarSign}
                  iconColor="text-green-600"
                  iconBgColor="bg-green-100"
                  borderColor="border-green-500"
                />
              </div>

              {/* Quick Actions */}
              <div className={`${DESIGN_SYSTEM.components.card.base} ${DESIGN_SYSTEM.spacing.card}`}>
                <h3 className={`${DESIGN_SYSTEM.typography.h3} mb-4 flex items-center gap-2`}>
                  <Activity className="text-primary-600" size={20} />
                  Acciones Rápidas
                </h3>
                <div className={`${DESIGN_SYSTEM.responsive.gridCols3} ${DESIGN_SYSTEM.spacing.gap}`}>
                  <button
                    onClick={() => setActiveTab('bookings')}
                    className={`${DESIGN_SYSTEM.components.card.base} ${DESIGN_SYSTEM.components.card.interactive} ${DESIGN_SYSTEM.spacing.cardSmall} flex items-center gap-3 border-2 border-gray-200 hover:border-primary-500 hover:bg-primary-50 group`}
                  >
                    <Package className="text-primary-600 group-hover:scale-110 transition flex-shrink-0" size={20} />
                    <div className="text-left min-w-0 flex-1">
                      <p className={`${DESIGN_SYSTEM.typography.h4}`}>Ver Reservas</p>
                      <p className={DESIGN_SYSTEM.typography.bodySmall}>{bookings.length} activas</p>
                    </div>
                    <ChevronRight className={`ml-auto text-gray-400 group-hover:text-primary-600 ${DESIGN_SYSTEM.responsive.hideOnMobile}`} size={18} />
                  </button>

                  <button
                    onClick={() => setActiveTab('my-requests')}
                    className={`${DESIGN_SYSTEM.components.card.base} ${DESIGN_SYSTEM.components.card.interactive} ${DESIGN_SYSTEM.spacing.cardSmall} flex items-center gap-3 border-2 border-gray-200 hover:border-orange-500 hover:bg-orange-50 group`}
                  >
                    <Bell className="text-orange-600 group-hover:scale-110 transition flex-shrink-0" size={20} />
                    <div className="text-left min-w-0 flex-1">
                      <p className={`${DESIGN_SYSTEM.typography.h4}`}>Solicitudes</p>
                      <p className={DESIGN_SYSTEM.typography.bodySmall}>{serviceRequests.length} nuevas</p>
                    </div>
                    <ChevronRight className={`ml-auto text-gray-400 group-hover:text-orange-600 ${DESIGN_SYSTEM.responsive.hideOnMobile}`} size={18} />
                  </button>

                  <button
                    onClick={() => router.push('/partner/services')}
                    className={`${DESIGN_SYSTEM.components.card.base} ${DESIGN_SYSTEM.components.card.interactive} ${DESIGN_SYSTEM.spacing.cardSmall} flex items-center gap-3 border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 group`}
                  >
                    <Settings className="text-blue-600 group-hover:scale-110 transition flex-shrink-0" size={20} />
                    <div className="text-left min-w-0 flex-1">
                      <p className={`${DESIGN_SYSTEM.typography.h4}`}>Mis Servicios</p>
                      <p className={DESIGN_SYSTEM.typography.bodySmall}>Gestionar</p>
                    </div>
                    <ChevronRight className={`ml-auto text-gray-400 group-hover:text-blue-600 ${DESIGN_SYSTEM.responsive.hideOnMobile}`} size={18} />
                  </button>
                </div>
              </div>

              {/* Recent Activity */}
              <div className={`${DESIGN_SYSTEM.components.card.base} ${DESIGN_SYSTEM.spacing.card}`}>
                <h3 className={`${DESIGN_SYSTEM.typography.h3} mb-4 flex items-center gap-2`}>
                  <Clock className="text-primary-600" size={20} />
                  Actividad Reciente
                </h3>
                {bookings.slice(0, 5).length === 0 ? (
                  <EmptyState
                    icon={Package}
                    title="No hay actividad reciente"
                    description="Cuando tengas reservas, aparecerán aquí"
                  />
                ) : (
                  <div className={DESIGN_SYSTEM.spacing.gapSmall}>
                    {bookings.slice(0, 5).map((booking) => (
                      <div key={booking.id} className={`${DESIGN_SYSTEM.components.card.base} ${DESIGN_SYSTEM.components.card.hover} ${DESIGN_SYSTEM.spacing.cardSmall} flex items-center gap-4 bg-gray-50`}>
                        <div className="text-3xl">{booking.service.icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className={`${DESIGN_SYSTEM.typography.h4} truncate`}>{booking.service.name}</p>
                          <p className={`${DESIGN_SYSTEM.typography.bodySmall} truncate`}>{booking.user.name}</p>
                        </div>
                        <span className={`${getStatusClasses(booking.status)} px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap`}>
                          {getStatusLabel(booking.status)}
                        </span>
                        <p className={`${DESIGN_SYSTEM.typography.h4} text-primary-600 whitespace-nowrap ${DESIGN_SYSTEM.responsive.hideOnMobile}`}>{formatCurrency(booking.totalPrice)}</p>
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
              <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="Buscar por servicio, cliente o dirección..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-3 py-3 sm:pr-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    <button
                      onClick={() => setFilter('')}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                        filter === ''
                          ? 'bg-primary-600 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Todas
                    </button>
                    {Object.entries(DESIGN_SYSTEM.statusLabels).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                          filter === key
                            ? 'bg-primary-600 text-white shadow-lg'
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
                <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                  <Package className="mx-auto text-gray-300 mb-4" size={64} />
                  <p className="text-gray-600 text-lg font-medium">No hay reservas</p>
                  <p className="text-gray-500 text-sm mt-2">Las reservas aparecerán aquí cuando los clientes las realicen</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {filteredBookings.map((booking) => (
                    <div key={booking.id} className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition overflow-hidden">
                      <div className="p-6">
                        <div className="flex items-start gap-4 mb-4">
                          <div className="text-4xl">{booking.service.icon}</div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-bold text-lg text-gray-900">{booking.service.name}</h3>
                              <span className={`text-xs font-medium px-3 py-1 rounded-full border ${getStatusClasses(booking.status)}`}>
                                {getStatusLabel(booking.status)}
                              </span>
                            </div>
                            <p className="text-2xl font-bold text-primary-600 mt-2">{formatCurrency(booking.totalPrice)}</p>
                          </div>
                        </div>

                        <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <User size={16} className="text-gray-600" />
                            <span className="font-semibold text-gray-900">{booking.user.name}</span>
                          </div>
                          <p className="text-sm text-gray-600">📧 {booking.user.email}</p>
                          {booking.user.phone && (
                            <p className="text-sm text-gray-600">📱 {booking.user.phone}</p>
                          )}
                        </div>

                        <div className="space-y-2 text-sm text-gray-600 mb-4">
                          <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-primary-600" />
                            <span>{new Date(booking.scheduledDate).toLocaleDateString('es-ES', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock size={16} className="text-primary-600" />
                            <span>{booking.scheduledTime}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin size={16} className="text-primary-600" />
                            <span>{booking.address}</span>
                          </div>
                        </div>

                        {booking.notes && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4">
                            <p className="text-sm text-gray-700"><strong>Notas:</strong> {booking.notes}</p>
                          </div>
                        )}

                        <div className="flex gap-2">
                          {booking.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => updateBookingStatus(booking.id, 'CONFIRMED', booking.service.name)}
                                className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-xl hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2"
                              >
                                <CheckCircle size={18} />
                                Confirmar
                              </button>
                              <button
                                onClick={() => updateBookingStatus(booking.id, 'CANCELLED', booking.service.name)}
                                className="flex-1 bg-red-600 text-white px-4 py-3 rounded-xl hover:bg-red-700 transition font-medium flex items-center justify-center gap-2"
                              >
                                <XCircle size={18} />
                                Rechazar
                              </button>
                            </>
                          )}
                          {booking.status === 'CONFIRMED' && (
                            <button
                              onClick={() => updateBookingStatus(booking.id, 'IN_PROGRESS', booking.service.name)}
                              className="w-full bg-purple-600 text-white px-4 py-3 rounded-xl hover:bg-purple-700 transition font-medium"
                            >
                              Iniciar Servicio
                            </button>
                          )}
                          {booking.status === 'IN_PROGRESS' && (
                            <button
                              onClick={() => updateBookingStatus(booking.id, 'COMPLETED', booking.service.name)}
                              className="w-full bg-green-600 text-white px-4 py-3 rounded-xl hover:bg-green-700 transition font-medium"
                            >
                              Marcar Completado
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* My Requests Tab */}
          {activeTab === 'my-requests' && (
            <div className={DESIGN_SYSTEM.spacing.gap}>
              <div className={`${DESIGN_SYSTEM.components.card.base} ${DESIGN_SYSTEM.spacing.card}`}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Buscar solicitudes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`${DESIGN_SYSTEM.components.input.base} pl-10`}
                  />
                </div>
              </div>

              {filteredRequests.length === 0 ? (
                <EmptyState
                  icon={AlertCircle}
                  title="No hay solicitudes para ti"
                  description="Las solicitudes que coincidan con tus servicios aparecerán aquí"
                />
              ) : (
                <div className={DESIGN_SYSTEM.responsive.gridCols1}>
                  {filteredRequests.map((request) => (
                    <div key={request.id} className={`${DESIGN_SYSTEM.components.card.base} ${DESIGN_SYSTEM.components.card.hover} overflow-hidden`}>
                      <div className={DESIGN_SYSTEM.spacing.card}>
                        <div className="flex items-start gap-4 mb-4">
                          <div className="text-4xl">{request.service.icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                              <h3 className={`${DESIGN_SYSTEM.typography.h3} truncate`}>{request.service.name}</h3>
                              {request.isUrgent && (
                                <span className={`${DESIGN_SYSTEM.components.badge.error} font-bold self-start`}>
                                  URGENTE
                                </span>
                              )}
                            </div>
                            <p className={DESIGN_SYSTEM.typography.bodySmall}>{request.service.category.name}</p>
                          </div>
                        </div>

                        <div className={`${DESIGN_SYSTEM.components.card.base} bg-gradient-to-r from-blue-50 to-blue-100 ${DESIGN_SYSTEM.spacing.cardSmall} mb-4`}>
                          <div className="flex items-center gap-2 mb-2">
                            <User size={16} className="text-blue-600 flex-shrink-0" />
                            <span className={`${DESIGN_SYSTEM.typography.h4} truncate`}>{request.user.name}</span>
                          </div>
                          <p className={`${DESIGN_SYSTEM.typography.bodySmall} truncate`}>📧 {request.user.email}</p>
                          {request.user.phone && (
                            <p className={DESIGN_SYSTEM.typography.bodySmall}>📱 {request.user.phone}</p>
                          )}
                        </div>

                        <div className={`${DESIGN_SYSTEM.spacing.gapSmall} mb-4`}>
                          <div className="flex items-center gap-2">
                            <MapPin size={16} className="text-primary-600 flex-shrink-0" />
                            <span className={`${DESIGN_SYSTEM.typography.bodySmall} truncate`}>{request.address}, {request.city}</span>
                          </div>
                          {request.preferredDate && (
                            <div className="flex items-center gap-2">
                              <Calendar size={16} className="text-primary-600 flex-shrink-0" />
                              <span className={DESIGN_SYSTEM.typography.bodySmall}>
                                Fecha preferida: {new Date(request.preferredDate).toLocaleDateString('es-ES')}
                                {request.preferredTime && ` a las ${request.preferredTime}`}
                              </span>
                            </div>
                          )}
                        </div>

                        {request.notes && (
                          <div className={`${DESIGN_SYSTEM.components.card.base} bg-gray-50 ${DESIGN_SYSTEM.spacing.cardSmall} mb-4`}>
                            <p className={DESIGN_SYSTEM.typography.bodySmall}><strong>Detalles:</strong> {request.notes}</p>
                          </div>
                        )}

                        {request.photos && request.photos.length > 0 && (
                          <div className="mb-4">
                            <h4 className={`${DESIGN_SYSTEM.typography.label} mb-3`}>Fotos adjuntas:</h4>
                            <div className={`${DESIGN_SYSTEM.responsive.gridCols4} ${DESIGN_SYSTEM.spacing.gapSmall}`}>
                              {request.photos.sort((a, b) => a.order - b.order).map((photo, index) => (
                                <div key={photo.id} className="relative group">
                                  <img
                                    src={photo.url}
                                    alt="Foto de la solicitud"
                                    className={`${DESIGN_SYSTEM.components.card.base} ${DESIGN_SYSTEM.components.card.hover} w-full h-32 object-cover cursor-pointer border-2`}
                                    onClick={() => setImageGallery({ isOpen: true, photos: request.photos || [], initialIndex: index })}
                                  />
                                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition rounded-lg flex items-center justify-center">
                                    <span className={`${DESIGN_SYSTEM.typography.bodySmall} text-white opacity-0 group-hover:opacity-100 transition font-medium`}>
                                      Ver imagen
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {request.proposals.length > 0 ? (
                          <div className={`${DESIGN_SYSTEM.components.card.base} ${DESIGN_SYSTEM.colors.success.bg} border-${DESIGN_SYSTEM.colors.success.border} ${DESIGN_SYSTEM.spacing.cardSmall}`}>
                            <p className={`${DESIGN_SYSTEM.typography.bodySmall} font-semibold ${DESIGN_SYSTEM.colors.success.text} flex items-center gap-2`}>
                              <CheckCircle size={16} />
                              Ya enviaste una propuesta
                            </p>
                          </div>
                        ) : (
                          <button
                            onClick={() => openProposalModal(request)}
                            className={`${DESIGN_SYSTEM.components.button.primary} w-full flex items-center justify-center gap-2`}
                          >
                            <Send size={18} />
                            Enviar Propuesta
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* All Requests Tab */}
          {activeTab === 'all-requests' && (
            <div className={DESIGN_SYSTEM.spacing.gap}>
              <div className={`${DESIGN_SYSTEM.components.card.base} ${DESIGN_SYSTEM.spacing.card}`}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Buscar todas las solicitudes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`${DESIGN_SYSTEM.components.input.base} pl-10`}
                  />
                </div>
              </div>

              {filteredAllRequests.length === 0 ? (
                <EmptyState
                  icon={AlertCircle}
                  title="No hay solicitudes disponibles"
                  description="Las solicitudes de servicio aparecerán aquí"
                />
              ) : (
                <div className={`${DESIGN_SYSTEM.responsive.gridCols2} ${DESIGN_SYSTEM.spacing.gap}`}>
                  {filteredAllRequests.map((request) => (
                    <div key={request.id} className={`${DESIGN_SYSTEM.components.card.base} ${DESIGN_SYSTEM.components.card.hover} overflow-hidden`}>
                      <div className={DESIGN_SYSTEM.spacing.card}>
                        <div className="flex items-start gap-4 mb-4">
                          <div className="text-4xl">{request.service.icon}</div>
                          <div className="flex-1 min-w-0">
                            <h3 className={`${DESIGN_SYSTEM.typography.h3} mb-1 truncate`}>{request.service.name}</h3>
                            <p className={DESIGN_SYSTEM.typography.bodySmall}>{request.service.category.name}</p>
                          </div>
                        </div>

                        <div className={`${DESIGN_SYSTEM.spacing.gapSmall} mb-4`}>
                          <div className="flex items-center gap-2">
                            <MapPin size={16} className="text-primary-600 flex-shrink-0" />
                            <span className={`${DESIGN_SYSTEM.typography.bodySmall} truncate`}>{request.city}</span>
                          </div>
                        </div>

                        {request.notes && (
                          <div className={`${DESIGN_SYSTEM.components.card.base} bg-gray-50 ${DESIGN_SYSTEM.spacing.cardSmall} mb-4`}>
                            <p className={`${DESIGN_SYSTEM.typography.bodySmall} line-clamp-2`}>{request.notes}</p>
                          </div>
                        )}

                        <button
                          onClick={() => openProposalModal(request)}
                          className={`${DESIGN_SYSTEM.components.button.primary} w-full flex items-center justify-center gap-2`}
                        >
                          <Eye size={18} />
                          Ver Detalles
                        </button>
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
                        <div key={photo.id} className="relative group">
                          <img
                            src={photo.url}
                            alt="Foto de la solicitud"
                            className={`${DESIGN_SYSTEM.components.card.base} ${DESIGN_SYSTEM.components.card.hover} w-full h-24 object-cover cursor-pointer border-2`}
                            onClick={() => setImageGallery({ isOpen: true, photos: selectedRequest.photos || [], initialIndex: index })}
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition rounded-lg flex items-center justify-center">
                            <span className={`${DESIGN_SYSTEM.typography.bodySmall} text-white opacity-0 group-hover:opacity-100 transition font-medium`}>
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
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="number"
                    value={proposalPrice}
                    onChange={(e) => setProposalPrice(e.target.value)}
                    placeholder="0.00"
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
                className={`${DESIGN_SYSTEM.components.button.secondary} flex-1`}
              >
                Cancelar
              </button>
              <button
                onClick={submitProposal}
                className={`${DESIGN_SYSTEM.components.button.primary} flex-1 flex items-center justify-center gap-2`}
              >
                <Send size={18} />
                Enviar Propuesta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
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
