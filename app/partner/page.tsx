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
import Modal from '@/components/Modal'
import ConfirmModal from '@/components/ConfirmModal'
import ImageGalleryModal from '@/components/ImageGalleryModal'

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

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-200',
  IN_PROGRESS: 'bg-purple-100 text-purple-800 border-purple-200',
  COMPLETED: 'bg-green-100 text-green-800 border-green-200',
  CANCELLED: 'bg-red-100 text-red-800 border-red-200',
}

const statusLabels: Record<string, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Cargando panel...</p>
        </div>
      </div>
    )
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
        {/* Top Bar */}
        <header className="bg-white shadow-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                    {activeTab === 'overview' && 'Resumen General'}
                    {activeTab === 'bookings' && 'Mis Reservas'}
                    {activeTab === 'my-requests' && 'Solicitudes para Mí'}
                    {activeTab === 'all-requests' && 'Todas las Solicitudes'}
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-600 truncate hidden sm:block">
                    {activeTab === 'overview' && 'Vista general de tu actividad'}
                    {activeTab === 'bookings' && 'Gestiona tus reservas confirmadas'}
                    {activeTab === 'my-requests' && 'Solicitudes que coinciden con tus servicios'}
                    {activeTab === 'all-requests' && 'Explora nuevas oportunidades'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 bg-gray-50">
            <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
              <nav className="flex gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap ${
                    activeTab === 'overview'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <Home size={20} className="sm:w-[22px] sm:h-[22px]" />
                  <span className="hidden sm:inline">Resumen</span>
                </button>

                <button
                  onClick={() => setActiveTab('bookings')}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap ${
                    activeTab === 'bookings'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <Package size={20} className="sm:w-[22px] sm:h-[22px]" />
                  <span className="hidden sm:inline">Mis Reservas</span>
                  {bookings.length > 0 && (
                    <span className="bg-primary-600 text-white text-[10px] px-2 py-0.5 rounded-full ml-2">
                      {bookings.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('my-requests')}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap ${
                    activeTab === 'my-requests'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <MessageSquare size={20} className="sm:w-[22px] sm:h-[22px]" />
                  <span className="hidden sm:inline">Para Mí</span>
                  {serviceRequests.length > 0 && (
                    <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full ml-2">
                      {serviceRequests.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('all-requests')}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap ${
                    activeTab === 'all-requests'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <Activity size={20} className="sm:w-[22px] sm:h-[22px]" />
                  <span className="hidden sm:inline">Todas</span>
                </button>

                <button
                  onClick={() => router.push('/partner/notifications')}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
                >
                  <Bell size={20} className="sm:w-[22px] sm:h-[22px]" />
                  <span className="hidden sm:inline">Notificaciones</span>
                </button>

                <button
                  onClick={() => router.push('/partner/services')}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
                >
                  <Settings size={20} className="sm:w-[22px] sm:h-[22px]" />
                  <span className="hidden sm:inline">Mis Servicios</span>
                </button>

                <button
                  onClick={() => router.push('/partner/verification')}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
                >
                  <Shield size={20} className="sm:w-[22px] sm:h-[22px]" />
                  <span className="hidden sm:inline">Verificación</span>
                </button>
              </nav>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-4 sm:space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 border-l-4 border-primary-500 hover:shadow-xl transition">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary-100 rounded-lg sm:rounded-xl flex items-center justify-center">
                      <Package className="text-primary-600" size={20} />
                    </div>
                    <TrendingUp className="text-green-500" size={18} />
                  </div>
                  <p className="text-gray-600 text-xs sm:text-sm font-medium mb-1">Total Reservas</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">{bookings.length}</p>
                </div>

                <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 border-l-4 border-yellow-500 hover:shadow-xl transition">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-100 rounded-lg sm:rounded-xl flex items-center justify-center">
                      <Clock className="text-yellow-600" size={20} />
                    </div>
                  </div>
                  <p className="text-gray-600 text-xs sm:text-sm font-medium mb-1">Pendientes</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">{pendingCount}</p>
                </div>

                <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 border-l-4 border-purple-500 hover:shadow-xl transition">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg sm:rounded-xl flex items-center justify-center">
                      <Activity className="text-purple-600" size={20} />
                    </div>
                  </div>
                  <p className="text-gray-600 text-xs sm:text-sm font-medium mb-1">En Progreso</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">{inProgressCount}</p>
                </div>

                <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 border-l-4 border-green-500 hover:shadow-xl transition">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg sm:rounded-xl flex items-center justify-center">
                      <DollarSign className="text-green-600" size={20} />
                    </div>
                  </div>
                  <p className="text-gray-600 text-xs sm:text-sm font-medium mb-1">Ganancias</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">{formatCurrency(partnerTotalEarnings)}</p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2">
                  <Activity className="text-primary-600" size={18} />
                  Acciones Rápidas
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  <button
                    onClick={() => setActiveTab('bookings')}
                    className="flex items-center gap-3 p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 border-gray-200 hover:border-primary-500 hover:bg-primary-50 transition group"
                  >
                    <Package className="text-primary-600 group-hover:scale-110 transition flex-shrink-0" size={20} />
                    <div className="text-left min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-sm sm:text-base">Ver Reservas</p>
                      <p className="text-xs sm:text-sm text-gray-600">{bookings.length} activas</p>
                    </div>
                    <ChevronRight className="ml-auto text-gray-400 group-hover:text-primary-600 hidden sm:inline" size={18} />
                  </button>

                  <button
                    onClick={() => setActiveTab('my-requests')}
                    className="flex items-center gap-3 p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 border-gray-200 hover:border-orange-500 hover:bg-orange-50 transition group"
                  >
                    <Bell className="text-orange-600 group-hover:scale-110 transition flex-shrink-0" size={20} />
                    <div className="text-left min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-sm sm:text-base">Solicitudes</p>
                      <p className="text-xs sm:text-sm text-gray-600">{serviceRequests.length} nuevas</p>
                    </div>
                    <ChevronRight className="ml-auto text-gray-400 group-hover:text-orange-600 hidden sm:inline" size={18} />
                  </button>

                  <button
                    onClick={() => router.push('/partner/services')}
                    className="flex items-center gap-3 p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition group"
                  >
                    <Settings className="text-blue-600 group-hover:scale-110 transition flex-shrink-0" size={20} />
                    <div className="text-left min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-sm sm:text-base">Mis Servicios</p>
                      <p className="text-xs sm:text-sm text-gray-600">Gestionar</p>
                    </div>
                    <ChevronRight className="ml-auto text-gray-400 group-hover:text-blue-600 hidden sm:inline" size={18} />
                  </button>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Clock className="text-primary-600" size={20} />
                  Actividad Reciente
                </h3>
                {bookings.slice(0, 5).length === 0 ? (
                  <div className="text-center py-12">
                    <Package className="mx-auto text-gray-300 mb-3" size={48} />
                    <p className="text-gray-500">No hay actividad reciente</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bookings.slice(0, 5).map((booking) => (
                      <div key={booking.id} className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition">
                        <div className="text-3xl">{booking.service.icon}</div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{booking.service.name}</p>
                          <p className="text-sm text-gray-600">{booking.user.name}</p>
                        </div>
                        <span className={`text-xs font-medium px-3 py-1 rounded-full border ${statusColors[booking.status]}`}>
                          {statusLabels[booking.status]}
                        </span>
                        <p className="font-bold text-primary-600">{formatCurrency(booking.totalPrice)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bookings Tab */}
          {activeTab === 'bookings' && (
            <div className="space-y-6">
              {/* Search and Filters */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="Buscar por servicio, cliente o dirección..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setFilter('')}
                      className={`px-4 py-2 rounded-xl font-medium transition ${
                        filter === ''
                          ? 'bg-primary-600 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Todas
                    </button>
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className={`px-4 py-2 rounded-xl font-medium transition ${
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
                              <span className={`text-xs font-medium px-3 py-1 rounded-full border ${statusColors[booking.status]}`}>
                                {statusLabels[booking.status]}
                              </span>
                            </div>
                            <p className="text-2xl font-bold text-primary-600">{formatCurrency(booking.totalPrice)}</p>
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
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Buscar solicitudes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              {filteredRequests.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                  <AlertCircle className="mx-auto text-gray-300 mb-4" size={64} />
                  <p className="text-gray-600 text-lg font-medium">No hay solicitudes para ti</p>
                  <p className="text-gray-500 text-sm mt-2">Las solicitudes que coincidan con tus servicios aparecerán aquí</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {filteredRequests.map((request) => (
                    <div key={request.id} className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition overflow-hidden">
                      <div className="p-6">
                        <div className="flex items-start gap-4 mb-4">
                          <div className="text-4xl">{request.service.icon}</div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-bold text-lg text-gray-900">{request.service.name}</h3>
                              {request.isUrgent && (
                                <span className="bg-red-100 text-red-800 text-xs font-bold px-3 py-1 rounded-full border border-red-200">
                                  URGENTE
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{request.service.category.name}</p>
                          </div>
                        </div>

                        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4 mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <User size={16} className="text-blue-600" />
                            <span className="font-semibold text-gray-900">{request.user.name}</span>
                          </div>
                          <p className="text-sm text-gray-600">📧 {request.user.email}</p>
                          {request.user.phone && (
                            <p className="text-sm text-gray-600">📱 {request.user.phone}</p>
                          )}
                        </div>

                        <div className="space-y-2 text-sm text-gray-600 mb-4">
                          <div className="flex items-center gap-2">
                            <MapPin size={16} className="text-primary-600" />
                            <span>{request.address}, {request.city}</span>
                          </div>
                          {request.preferredDate && (
                            <div className="flex items-center gap-2">
                              <Calendar size={16} className="text-primary-600" />
                              <span>
                                Fecha preferida: {new Date(request.preferredDate).toLocaleDateString('es-ES')}
                                {request.preferredTime && ` a las ${request.preferredTime}`}
                              </span>
                            </div>
                          )}
                        </div>

                        {request.notes && (
                          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4">
                            <p className="text-sm text-gray-700"><strong>Detalles:</strong> {request.notes}</p>
                          </div>
                        )}

                        {request.photos && request.photos.length > 0 && (
                          <div className="mb-4">
                            <h4 className="font-semibold mb-3 text-sm text-gray-700">Fotos adjuntas:</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                              {request.photos.sort((a, b) => a.order - b.order).map((photo, index) => (
                                <div key={photo.id} className="relative group">
                                  <img
                                    src={photo.url}
                                    alt="Foto de la solicitud"
                                    className="w-full h-32 object-cover rounded-lg border-2 border-gray-200 hover:border-primary-500 transition cursor-pointer"
                                    onClick={() => setImageGallery({ isOpen: true, photos: request.photos || [], initialIndex: index })}
                                  />
                                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition rounded-lg flex items-center justify-center">
                                    <span className="text-white opacity-0 group-hover:opacity-100 transition text-sm font-medium">
                                      Ver imagen
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {request.proposals.length > 0 ? (
                          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                            <p className="text-sm font-semibold text-green-800 flex items-center gap-2">
                              <CheckCircle size={16} />
                              Ya enviaste una propuesta
                            </p>
                          </div>
                        ) : (
                          <button
                            onClick={() => openProposalModal(request)}
                            className="w-full bg-primary-600 text-white px-6 py-3 rounded-xl hover:bg-primary-700 transition font-medium flex items-center justify-center gap-2"
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
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Buscar todas las solicitudes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              {filteredAllRequests.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                  <AlertCircle className="mx-auto text-gray-300 mb-4" size={64} />
                  <p className="text-gray-600 text-lg font-medium">No hay solicitudes disponibles</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {filteredAllRequests.map((request) => (
                    <div key={request.id} className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition overflow-hidden">
                      <div className="p-6">
                        <div className="flex items-start gap-4 mb-4">
                          <div className="text-4xl">{request.service.icon}</div>
                          <div className="flex-1">
                            <h3 className="font-bold text-lg text-gray-900 mb-1">{request.service.name}</h3>
                            <p className="text-sm text-gray-600">{request.service.category.name}</p>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm text-gray-600 mb-4">
                          <div className="flex items-center gap-2">
                            <MapPin size={16} className="text-primary-600" />
                            <span>{request.city}</span>
                          </div>
                        </div>

                        {request.notes && (
                          <div className="bg-gray-50 rounded-xl p-3 mb-4">
                            <p className="text-sm text-gray-700 line-clamp-2">{request.notes}</p>
                          </div>
                        )}

                        <button
                          onClick={() => openProposalModal(request)}
                          className="w-full bg-primary-600 text-white px-6 py-3 rounded-xl hover:bg-primary-700 transition font-medium flex items-center justify-center gap-2"
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b bg-gradient-to-r from-primary-600 to-primary-700">
              <h3 className="text-2xl font-bold text-white">Enviar Propuesta</h3>
              <p className="text-primary-100 text-sm mt-1">Completa los detalles de tu oferta</p>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-3xl">{selectedRequest.service.icon}</div>
                  <div>
                    <h4 className="font-bold text-gray-900">{selectedRequest.service.name}</h4>
                    <p className="text-sm text-gray-600">{selectedRequest.service.category.name}</p>
                  </div>
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  <p><strong>Cliente:</strong> {selectedRequest.user.name}</p>
                  <p><strong>Ubicación:</strong> {selectedRequest.address}, {selectedRequest.city}</p>
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
                    <p className="text-sm font-semibold text-gray-700 mb-2">Fotos adjuntas:</p>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedRequest.photos.sort((a, b) => a.order - b.order).map((photo, index) => (
                        <div key={photo.id} className="relative group">
                          <img
                            src={photo.url}
                            alt="Foto de la solicitud"
                            className="w-full h-24 object-cover rounded-lg border-2 border-gray-200 hover:border-primary-500 transition cursor-pointer"
                            onClick={() => setImageGallery({ isOpen: true, photos: selectedRequest.photos || [], initialIndex: index })}
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition rounded-lg flex items-center justify-center">
                            <span className="text-white opacity-0 group-hover:opacity-100 transition text-xs font-medium">
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
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Precio de tu Propuesta *
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="number"
                    value={proposalPrice}
                    onChange={(e) => setProposalPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notas Adicionales (Opcional)
                </label>
                <textarea
                  value={proposalNotes}
                  onChange={(e) => setProposalNotes(e.target.value)}
                  placeholder="Describe tu experiencia, tiempo estimado, materiales incluidos, etc."
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex gap-3">
              <button
                onClick={() => setShowProposalModal(false)}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={submitProposal}
                className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition font-medium flex items-center justify-center gap-2"
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
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Cargando...</div>}>
      <PartnerDashboardContent />
    </Suspense>
  )
}
