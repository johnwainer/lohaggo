'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  MessageSquare, Calendar, Clock, MapPin, Package, CheckCircle, DollarSign,
  TrendingUp, Activity, Search, Menu, X, Home, Bell,
  Settings, LogOut, ChevronRight, Plus, AlertCircle, User, XCircle, Star,
  Shield, CreditCard, GraduationCap, ShieldCheck, MessageCircle, Heart
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import Modal from '@/components/Modal'
import ConfirmModal from '@/components/ConfirmModal'
import ImageGalleryModal from '@/components/ImageGalleryModal'
import RatingModal from '@/components/RatingModal'
import ChatModal from '@/components/ChatModal'

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
  service: {
    name: string
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
  const [bookings, setBookings] = useState<Booking[]>([])
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([])
  const [favoritePartners, setFavoritePartners] = useState<any[]>([])
  const [clientCommissionRate, setClientCommissionRate] = useState<number>(5.0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
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
  }>({
    isOpen: false,
    bookingId: '',
    serviceName: '',
    partnerName: ''
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
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated') {
      fetchBookings()
      fetchServiceRequests()
      fetchFavorites()
    }
  }, [status])

  useEffect(() => {
    fetchBookings()
  }, [filter])

  useEffect(() => {
    if (status === 'authenticated' && (bookings.length > 0 || serviceRequests.length > 0)) {
      fetchUnreadCounts()
      const interval = setInterval(fetchUnreadCounts, 5000)
      return () => clearInterval(interval)
    }
  }, [status, bookings, serviceRequests])

  const fetchUnreadCounts = async () => {
    try {
      const counts: Record<string, number> = {}

      // Get unread counts for bookings
      const bookingsWithProposals = bookings.filter(b => b.proposalId)
      await Promise.all(
        bookingsWithProposals.map(async (booking) => {
          try {
            const res = await fetch(`/api/chat/unread-count?proposalId=${booking.proposalId}`)
            if (res.ok) {
              const data = await res.json()
              counts[booking.proposalId!] = data.count || 0
            }
          } catch (error) {
            // Handle error silently
          }
        })
      )

      // Get unread counts for proposals
      const allProposals = serviceRequests.flatMap(request => request.proposals || [])
      await Promise.all(
        allProposals.map(async (proposal) => {
          try {
            const res = await fetch(`/api/chat/unread-count?proposalId=${proposal.id}`)
            if (res.ok) {
              const data = await res.json()
              counts[proposal.id] = data.count || 0
            }
          } catch (error) {
            // Handle error silently
          }
        })
      )

      setUnreadCounts(counts)
    } catch (error) {
      // Handle error silently
    }
  }

  const fetchBookings = async () => {
    setLoading(true)
    try {
      let url = '/api/bookings'
      if (filter) url += `?status=${filter}`

      const res = await fetch(url)
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
      const res = await fetch('/api/favorites')
      if (res.ok) {
        const data = await res.json()
        setFavoritePartners(data)
      }
    } catch (error) {
      console.error('Error fetching favorites:', error)
      setFavoritePartners([])
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
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

  const filteredBookings = bookings.filter(booking =>
    booking.service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    booking.address.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredRequests = serviceRequests.filter(request =>
    request.service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.address.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
          <div className="group relative">
            <CreditCard size={16} className="text-primary-600" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Identidad verificada
            </span>
          </div>
        )}
        {hasEducation && (
          <div className="group relative">
            <GraduationCap size={16} className="text-secondary-600" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Educación verificada
            </span>
          </div>
        )}
        {hasBackground && (
          <div className="group relative">
            <Shield size={16} className="text-emerald-600" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Antecedentes verificados
            </span>
          </div>
        )}
      </div>
    )
  }

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
        confirmText={confirmModal.type === 'danger' ? 'Sí, cancelar' : 'Sí, aceptar'}
      />

      {paymentModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Pagar Servicio</h3>
            <p className="text-gray-600 mb-4">Servicio: <span className="font-semibold">{paymentModal.serviceName}</span></p>

            {loadingBreakdown ? (
              <div className="bg-gray-50 rounded-xl p-6 mb-6 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : paymentBreakdown ? (
              <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Precio del servicio</span>
                  <span className="font-medium text-gray-900">
                    ${paymentBreakdown.serviceAmount.toLocaleString('es-CO')} COP
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm pb-3 border-b border-gray-200">
                  <span className="text-gray-600">
                    Tarifa de servicio ({paymentBreakdown.clientCommissionRate}%)
                  </span>
                  <span className="font-medium text-gray-600">
                    +${paymentBreakdown.clientCommission.toLocaleString('es-CO')} COP
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <span className="text-lg font-bold text-gray-900">Total a Pagar</span>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Método de Pago</label>
                <select
                  value={selectedPaymentMethod}
                  onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.cardBrand} •••• {method.lastFourDigits} {method.isDefault ? '(Predeterminada)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
                <p className="text-sm text-secondary-800">No tienes métodos de pago guardados. Se procesará con Mercado Pago.</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setPaymentModal({ isOpen: false, bookingId: '', serviceName: '', amount: 0 })
                  setPaymentBreakdown(null)
                }}
                disabled={processingPayment}
                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={processPayment}
                disabled={processingPayment || loadingBreakdown}
                className="flex-1 bg-primary-600 text-white px-4 py-3 rounded-xl hover:bg-primary-700 transition font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processingPayment ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
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
        <header className="bg-white shadow-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                    {activeTab === 'overview' && 'Resumen General'}
                    {activeTab === 'bookings' && 'Mis Reservas'}
                    {activeTab === 'requests' && 'Mis Solicitudes'}
                    {activeTab === 'favorites' && 'Mis Favoritos'}
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-600 truncate hidden sm:block">
                    {activeTab === 'overview' && 'Vista general de tu actividad'}
                    {activeTab === 'bookings' && 'Gestiona tus reservas de servicios'}
                    {activeTab === 'requests' && 'Solicitudes y propuestas recibidas'}
                    {activeTab === 'favorites' && 'Tus profesionales favoritos'}
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
                    <span className="bg-primary-600 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                      {bookings.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('requests')}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap ${
                    activeTab === 'requests'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <MessageSquare size={20} className="sm:w-[22px] sm:h-[22px]" />
                  <span className="hidden sm:inline">Mis Solicitudes</span>
                  {serviceRequests.length > 0 && (
                    <span className="bg-orange-500 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                      {serviceRequests.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setActiveTab('favorites')}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap ${
                    activeTab === 'favorites'
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <Heart size={20} className="sm:w-[22px] sm:h-[22px]" />
                  <span className="hidden sm:inline">Favoritos</span>
                  {favoritePartners.length > 0 && (
                    <span className="bg-red-500 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                      {favoritePartners.length}
                    </span>
                  )}
                </button>

              </nav>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
          {activeTab === 'overview' && (
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24"></div>
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <p className="text-primary-100 text-sm sm:text-base mb-2">Bienvenido de nuevo</p>
                      <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">{session?.user?.name || 'Usuario'}</h2>
                      <p className="text-primary-100 text-sm sm:text-base">Aquí está tu resumen de actividad</p>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 sm:p-4">
                      <User className="w-8 h-8 sm:w-10 sm:h-10" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6">
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/20">
                      <Package className="w-6 h-6 sm:w-8 sm:h-8 mb-2 opacity-90" />
                      <p className="text-2xl sm:text-3xl font-bold mb-1">{bookings.length}</p>
                      <p className="text-xs sm:text-sm text-primary-100">Reservas</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/20">
                      <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 mb-2 opacity-90" />
                      <p className="text-2xl sm:text-3xl font-bold mb-1">{serviceRequests.length}</p>
                      <p className="text-xs sm:text-sm text-primary-100">Solicitudes</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/20">
                      <Heart className="w-6 h-6 sm:w-8 sm:h-8 mb-2 opacity-90" />
                      <p className="text-2xl sm:text-3xl font-bold mb-1">{favoritePartners.length}</p>
                      <p className="text-xs sm:text-sm text-primary-100">Favoritos</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-white/20">
                      <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 mb-2 opacity-90" />
                      <p className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1">{formatCurrency(totalSpent)}</p>
                      <p className="text-xs sm:text-sm text-primary-100">Gastado</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                  <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="bg-gradient-to-r from-gray-50 to-white p-4 sm:p-6 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                            <Activity className="text-primary-600 w-5 h-5 sm:w-6 sm:h-6" />
                            Estado de Reservas
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">Resumen de tus servicios</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 sm:p-6">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                        <div className="group hover:scale-105 transition-transform">
                          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl sm:rounded-2xl p-4 sm:p-5 border-2 border-blue-200 hover:border-blue-400 transition-colors">
                            <div className="flex items-center justify-between mb-3">
                              <div className="bg-blue-500 rounded-lg p-2">
                                <Clock className="text-white w-4 h-4 sm:w-5 sm:h-5" />
                              </div>
                              <span className="text-xs font-semibold text-blue-600 bg-blue-200 px-2 py-1 rounded-full">Activas</span>
                            </div>
                            <p className="text-3xl sm:text-4xl font-bold text-blue-900 mb-1">{pendingCount}</p>
                            <p className="text-xs sm:text-sm text-blue-700 font-medium">Pendientes</p>
                          </div>
                        </div>
                        <div className="group hover:scale-105 transition-transform">
                          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl sm:rounded-2xl p-4 sm:p-5 border-2 border-green-200 hover:border-green-400 transition-colors">
                            <div className="flex items-center justify-between mb-3">
                              <div className="bg-green-500 rounded-lg p-2">
                                <CheckCircle className="text-white w-4 h-4 sm:w-5 sm:h-5" />
                              </div>
                              <span className="text-xs font-semibold text-green-600 bg-green-200 px-2 py-1 rounded-full">OK</span>
                            </div>
                            <p className="text-3xl sm:text-4xl font-bold text-green-900 mb-1">{confirmedCount}</p>
                            <p className="text-xs sm:text-sm text-green-700 font-medium">Confirmadas</p>
                          </div>
                        </div>
                        <div className="group hover:scale-105 transition-transform">
                          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl sm:rounded-2xl p-4 sm:p-5 border-2 border-purple-200 hover:border-purple-400 transition-colors">
                            <div className="flex items-center justify-between mb-3">
                              <div className="bg-purple-500 rounded-lg p-2">
                                <Activity className="text-white w-4 h-4 sm:w-5 sm:h-5" />
                              </div>
                              <span className="text-xs font-semibold text-purple-600 bg-purple-200 px-2 py-1 rounded-full">En curso</span>
                            </div>
                            <p className="text-3xl sm:text-4xl font-bold text-purple-900 mb-1">{bookings.filter(b => b.status === 'IN_PROGRESS').length}</p>
                            <p className="text-xs sm:text-sm text-purple-700 font-medium">En Progreso</p>
                          </div>
                        </div>
                        <div className="group hover:scale-105 transition-transform">
                          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl sm:rounded-2xl p-4 sm:p-5 border-2 border-emerald-200 hover:border-emerald-400 transition-colors">
                            <div className="flex items-center justify-between mb-3">
                              <div className="bg-emerald-500 rounded-lg p-2">
                                <Star className="text-white w-4 h-4 sm:w-5 sm:h-5" />
                              </div>
                              <span className="text-xs font-semibold text-emerald-600 bg-emerald-200 px-2 py-1 rounded-full">Listo</span>
                            </div>
                            <p className="text-3xl sm:text-4xl font-bold text-emerald-900 mb-1">{bookings.filter(b => b.status === 'COMPLETED').length}</p>
                            <p className="text-xs sm:text-sm text-emerald-700 font-medium">Completadas</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="bg-gradient-to-r from-gray-50 to-white p-4 sm:p-6 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                            <Clock className="text-primary-600 w-5 h-5 sm:w-6 sm:h-6" />
                            Actividad Reciente
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">Últimas reservas y solicitudes</p>
                        </div>
                        <button
                          onClick={() => setActiveTab('bookings')}
                          className="text-primary-600 hover:text-primary-700 text-sm font-semibold flex items-center gap-1 hover:gap-2 transition-all"
                        >
                          Ver todo
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="p-4 sm:p-6">
                      {bookings.slice(0, 4).length === 0 ? (
                        <div className="text-center py-12">
                          <div className="bg-gray-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                            <Package className="text-gray-400 w-10 h-10" />
                          </div>
                          <p className="text-gray-500 font-medium mb-2">No hay actividad reciente</p>
                          <p className="text-sm text-gray-400">Tus reservas aparecerán aquí</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {bookings.slice(0, 4).map((booking) => (
                            <div key={booking.id} className="group flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-gray-50 hover:bg-gradient-to-r hover:from-primary-50 hover:to-transparent border border-gray-100 hover:border-primary-200 transition-all cursor-pointer">
                              <div className="text-3xl sm:text-4xl flex-shrink-0 group-hover:scale-110 transition-transform">{booking.service.icon}</div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 text-sm sm:text-base truncate group-hover:text-primary-700 transition-colors">{booking.service.name}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="text-xs text-gray-600 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(booking.scheduledDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                                  </span>
                                  <span className="text-xs text-gray-400">•</span>
                                  <span className="text-xs text-gray-600 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {booking.scheduledTime}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                                  booking.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                                  booking.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-700' :
                                  booking.status === 'IN_PROGRESS' ? 'bg-purple-100 text-purple-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {statusLabels[booking.status]}
                                </span>
                                <p className="text-sm font-bold text-gray-900">{formatCurrency(booking.totalPrice)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 sm:space-y-6">
                  <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 rounded-2xl sm:rounded-3xl shadow-xl p-5 sm:p-6 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                    <div className="relative z-10">
                      <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 w-fit mb-4">
                        <MessageSquare className="w-6 h-6" />
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold mb-2">Solicitudes</h3>
                      <p className="text-orange-100 text-sm mb-4">Gestiona tus peticiones</p>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-orange-100">Activas</span>
                          <span className="text-2xl font-bold">{activeRequestsCount}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-orange-100">Propuestas</span>
                          <span className="text-2xl font-bold">{totalProposals}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setActiveTab('requests')}
                        className="mt-4 w-full bg-white text-orange-600 font-semibold py-3 rounded-xl hover:bg-orange-50 transition-colors flex items-center justify-center gap-2"
                      >
                        Ver Solicitudes
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="bg-gradient-to-r from-gray-50 to-white p-4 sm:p-5 border-b border-gray-100">
                      <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Heart className="text-red-500 w-5 h-5" />
                        Favoritos
                      </h3>
                    </div>
                    <div className="p-4 sm:p-5">
                      {favoritePartners.length === 0 ? (
                        <div className="text-center py-8">
                          <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                            <Heart className="text-gray-400 w-8 h-8" />
                          </div>
                          <p className="text-sm text-gray-500 mb-3">No tienes favoritos</p>
                          <button
                            onClick={() => router.push('/servicios')}
                            className="text-primary-600 hover:text-primary-700 text-sm font-semibold"
                          >
                            Explorar servicios
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {favoritePartners.slice(0, 3).map((fav) => (
                            <div key={fav.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-red-50 border border-gray-100 hover:border-red-200 transition-all cursor-pointer group">
                              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                {fav.partner?.user?.name?.charAt(0) || 'P'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-gray-900 truncate group-hover:text-red-600 transition-colors">{fav.partner?.user?.name}</p>
                                <p className="text-xs text-gray-600 truncate">{fav.service?.name}</p>
                              </div>
                              <Heart className="w-4 h-4 text-red-500 fill-red-500 flex-shrink-0" />
                            </div>
                          ))}
                          {favoritePartners.length > 3 && (
                            <button
                              onClick={() => setActiveTab('favorites')}
                              className="w-full text-center text-sm text-primary-600 hover:text-primary-700 font-semibold py-2"
                            >
                              Ver todos ({favoritePartners.length})
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 rounded-2xl sm:rounded-3xl shadow-xl p-5 sm:p-6 text-white relative overflow-hidden">
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mb-16"></div>
                    <div className="relative z-10">
                      <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 w-fit mb-4">
                        <Plus className="w-6 h-6" />
                      </div>
                      <h3 className="text-xl sm:text-2xl font-bold mb-2">Acciones Rápidas</h3>
                      <p className="text-primary-100 text-sm mb-4">Gestiona tu cuenta</p>
                      <div className="space-y-2">
                        <button
                          onClick={() => router.push('/servicios')}
                          className="w-full bg-white/20 backdrop-blur-sm hover:bg-white/30 border border-white/30 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-between px-4"
                        >
                          <span className="flex items-center gap-2">
                            <Search className="w-4 h-4" />
                            Buscar Servicios
                          </span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => router.push('/profile')}
                          className="w-full bg-white/20 backdrop-blur-sm hover:bg-white/30 border border-white/30 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-between px-4"
                        >
                          <span className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Mi Perfil
                          </span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => router.push('/dashboard/addresses')}
                          className="w-full bg-white/20 backdrop-blur-sm hover:bg-white/30 border border-white/30 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-between px-4"
                        >
                          <span className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            Direcciones
                          </span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'bookings' && (
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-gradient-to-r from-primary-50 via-white to-primary-50 rounded-2xl sm:rounded-3xl shadow-lg border border-primary-100 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="Buscar por servicio o dirección..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all bg-white"
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    <button
                      onClick={() => setFilter('')}
                      className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        filter === ''
                          ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg shadow-primary-200'
                          : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200'
                      }`}
                    >
                      Todas
                    </button>
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                          filter === key
                            ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg shadow-primary-200'
                            : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filteredBookings.length === 0 ? (
                <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-12 sm:p-16 text-center border border-gray-100">
                  <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                    <Package className="text-gray-400 w-12 h-12" />
                  </div>
                  <p className="text-gray-900 text-xl font-bold mb-2">No hay reservas</p>
                  <p className="text-gray-500 text-base">Aquí aparecerán tus reservas cuando realices alguna</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {filteredBookings.map((booking) => (
                    <div key={booking.id} className="group bg-white rounded-2xl sm:rounded-3xl shadow-lg hover:shadow-2xl transition-all overflow-hidden border border-gray-100 hover:border-primary-200">
                      <div className={`h-2 ${
                        booking.status === 'COMPLETED' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' :
                        booking.status === 'CONFIRMED' ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
                        booking.status === 'IN_PROGRESS' ? 'bg-gradient-to-r from-purple-500 to-purple-600' :
                        'bg-gradient-to-r from-gray-400 to-gray-500'
                      }`}></div>
                      <div className="p-5 sm:p-6">
                        <div className="flex items-start gap-4 mb-5">
                          <div className="text-4xl sm:text-5xl group-hover:scale-110 transition-transform">{booking.service.icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <h3 className="font-bold text-lg sm:text-xl text-gray-900 group-hover:text-primary-600 transition-colors">{booking.service.name}</h3>
                              <span className={`text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap ${
                                booking.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-200' :
                                booking.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-700 border-2 border-blue-200' :
                                booking.status === 'IN_PROGRESS' ? 'bg-purple-100 text-purple-700 border-2 border-purple-200' :
                                'bg-gray-100 text-gray-700 border-2 border-gray-200'
                              }`}>
                                {statusLabels[booking.status]}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-3">{booking.service.category.name}</p>
                            <div className="bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl px-4 py-2 inline-block">
                              <p className="text-2xl sm:text-3xl font-bold text-primary-700">{formatCurrency(booking.totalPrice)}</p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 mb-5">
                          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                            <div className="bg-primary-100 rounded-lg p-2">
                              <Calendar size={18} className="text-primary-600" />
                            </div>
                            <span className="text-sm font-medium text-gray-900">{new Date(booking.scheduledDate).toLocaleDateString('es-ES', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}</span>
                          </div>
                          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                            <div className="bg-blue-100 rounded-lg p-2">
                              <Clock size={18} className="text-blue-600" />
                            </div>
                            <span className="text-sm font-medium text-gray-900">{booking.scheduledTime}</span>
                          </div>
                          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                            <div className="bg-green-100 rounded-lg p-2 flex-shrink-0">
                              <MapPin size={18} className="text-green-600" />
                            </div>
                            <span className="text-sm font-medium text-gray-900 break-words">{booking.address}</span>
                          </div>
                        </div>

                        {booking.notes && (
                          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-xl p-4 mb-4">
                            <p className="text-sm text-gray-800"><strong className="text-yellow-700">Notas:</strong> {booking.notes}</p>
                          </div>
                        )}

                        <div className="space-y-2">
                          {booking.status === 'COMPLETED' && !booking.review?.clientToPartnerRating && (
                            <button
                              onClick={() => setRatingModal({
                                isOpen: true,
                                bookingId: booking.id,
                                serviceName: booking.service.name,
                                partnerName: booking.partner?.user.name || 'el socio'
                              })}
                              className="w-full bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-4 py-3.5 rounded-xl hover:from-yellow-500 hover:to-orange-500 transition-all font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                            >
                              <Star size={20} />
                              Calificar Servicio
                            </button>
                          )}

                          {booking.status === 'COMPLETED' && booking.review?.clientToPartnerRating && (
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4">
                              <div className="flex items-center gap-2 text-green-700">
                                <CheckCircle size={18} />
                                <span className="text-sm font-semibold">Servicio calificado</span>
                                <div className="flex ml-auto">
                                  {[...Array(5)].map((_, i) => (
                                    <Star
                                      key={i}
                                      size={16}
                                      className={i < (booking.review?.clientToPartnerRating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {booking.status === 'COMPLETED' && !booking.payment && (
                            <button
                              onClick={() => openPaymentModal(booking.id, booking.service.name, booking.totalPrice)}
                              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white px-4 py-3.5 rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                            >
                              <DollarSign size={20} />
                              Pagar Servicio
                            </button>
                          )}

                          {booking.status === 'COMPLETED' && booking.payment?.status === 'APPROVED' && (
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4">
                              <div className="flex items-center gap-2 text-green-700">
                                <CheckCircle size={18} />
                                <span className="text-sm font-semibold">Servicio pagado - {formatCurrency(booking.payment.totalAmount)}</span>
                              </div>
                            </div>
                          )}

                          {booking.status === 'COMPLETED' && booking.payment?.status === 'PENDING' && (
                            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-xl p-4">
                              <div className="flex items-center gap-2 text-yellow-700">
                                <Clock size={18} />
                                <span className="text-sm font-semibold">Pago pendiente</span>
                              </div>
                            </div>
                          )}

                          {booking.proposalId && booking.payment?.status !== 'APPROVED' && (
                            <button
                              onClick={() => setChatModal({
                                isOpen: true,
                                proposalId: booking.proposalId!,
                                partnerName: booking.partner?.user.name || 'Socio',
                                serviceName: booking.service.name
                              })}
                              className="w-full bg-white text-secondary-600 border-2 border-secondary-500 px-4 py-3.5 rounded-xl hover:bg-secondary-50 transition-all font-semibold flex items-center justify-center gap-2 relative shadow-md hover:shadow-lg"
                            >
                              <MessageCircle size={20} />
                              Chat con el Socio
                              {unreadCounts[booking.proposalId] > 0 && (
                                <span className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-bold rounded-full h-7 w-7 flex items-center justify-center animate-pulse shadow-lg">
                                  {unreadCounts[booking.proposalId]}
                                </span>
                              )}
                            </button>
                          )}

                          {(booking.status === 'PENDING' || booking.status === 'CONFIRMED') && booking.payment?.status !== 'APPROVED' && (
                            <button
                              onClick={() => cancelBooking(booking.id, booking.service.name)}
                              className="w-full bg-white text-red-600 border-2 border-red-500 px-4 py-3.5 rounded-xl hover:bg-red-50 transition-all font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                            >
                              <XCircle size={20} />
                              Cancelar Reserva
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

          {activeTab === 'favorites' && (
            <div className="space-y-4 sm:space-y-6">
              {favoritePartners.length === 0 ? (
                <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-12 sm:p-16 text-center border border-gray-100">
                  <div className="bg-gradient-to-br from-red-100 to-pink-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                    <Heart size={48} className="text-red-400" />
                  </div>
                  <p className="text-gray-900 text-xl font-bold mb-2">No tienes favoritos aún</p>
                  <p className="text-gray-500 text-base mb-6">Marca como favoritos a los profesionales que más te gusten</p>
                  <button
                    onClick={() => router.push('/servicios')}
                    className="bg-gradient-to-r from-primary-600 to-primary-700 text-white px-8 py-3.5 rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all font-semibold shadow-lg hover:shadow-xl"
                  >
                    Explorar Servicios
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {favoritePartners.map((favorite) => {
                    const partner = favorite.partner
                    const IDENTITY_TYPES = ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP']
                    const EDUCATION_TYPES = ['DIPLOMA_BACHILLERATO', 'DIPLOMA_TECNICO', 'DIPLOMA_TECNOLOGO', 'DIPLOMA_PROFESIONAL', 'DIPLOMA_POSGRADO', 'CERTIFICADO_CURSO']

                    const hasIdentity = partner.documents?.some((d: any) => IDENTITY_TYPES.includes(d.type) && d.status === 'APPROVED')
                    const hasEducation = partner.documents?.some((d: any) => EDUCATION_TYPES.includes(d.type) && d.status === 'APPROVED')
                    const hasBackground = partner.documents?.some((d: any) => d.type === 'ANTECEDENTES' && d.status === 'APPROVED')
                    const fullyVerified = hasIdentity && hasEducation && hasBackground

                    return (
                      <div
                        key={favorite.id}
                        className={`group bg-white rounded-2xl sm:rounded-3xl shadow-lg hover:shadow-2xl transition-all overflow-hidden border-2 ${
                          fullyVerified
                            ? 'border-emerald-400 bg-gradient-to-br from-emerald-50 via-white to-green-50'
                            : 'border-gray-200 hover:border-primary-200'
                        }`}
                      >
                        {fullyVerified && (
                          <div className="bg-gradient-to-r from-emerald-500 to-green-600 text-white px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-bold">
                            <ShieldCheck size={18} />
                            <span>SOCIO VERIFICADO PLUS</span>
                          </div>
                        )}

                        <div className="p-5 sm:p-6">
                          <div className="flex items-start justify-between mb-5">
                            <div className="flex items-start gap-4 flex-1">
                              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center text-white font-bold text-2xl sm:text-3xl shadow-lg flex-shrink-0 group-hover:scale-110 transition-transform">
                                {partner.user.name?.charAt(0) || 'P'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="font-bold text-lg sm:text-xl text-gray-900 truncate group-hover:text-primary-600 transition-colors">{partner.user.name}</h3>
                                  {partner.verified && (
                                    <ShieldCheck size={20} className="text-green-600 flex-shrink-0" />
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="flex items-center gap-1 text-yellow-500">
                                    <Star size={18} fill="currentColor" />
                                    <span className="font-bold text-lg">{partner.rating.toFixed(1)}</span>
                                  </div>
                                  <span className="text-gray-500 text-sm">
                                    ({partner.totalReviews} reseñas)
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {hasIdentity && (
                                    <div className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-semibold border border-blue-200">
                                      <CreditCard size={14} />
                                      <span>Identidad</span>
                                    </div>
                                  )}
                                  {hasEducation && (
                                    <div className="flex items-center gap-1 bg-purple-100 text-purple-700 px-2.5 py-1 rounded-lg text-xs font-semibold border border-purple-200">
                                      <GraduationCap size={14} />
                                      <span>Educación</span>
                                    </div>
                                  )}
                                  {hasBackground && (
                                    <div className="flex items-center gap-1 bg-green-100 text-green-700 px-2.5 py-1 rounded-lg text-xs font-semibold border border-green-200">
                                      <Shield size={14} />
                                      <span>Antecedentes</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => removeFavorite(partner.id)}
                              className="p-3 rounded-xl bg-gradient-to-br from-red-100 to-pink-100 text-red-600 hover:from-red-200 hover:to-pink-200 transition-all shadow-md hover:shadow-lg flex-shrink-0"
                            >
                              <Heart size={22} fill="currentColor" />
                            </button>
                          </div>

                          <div className="mb-5">
                            <p className="text-sm font-semibold text-gray-700 mb-3">Servicios que ofrece:</p>
                            <div className="flex flex-wrap gap-2">
                              {partner.services.map((ps: any) => (
                                <span
                                  key={ps.service.id}
                                  className="inline-flex items-center gap-2 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 px-3 py-2 rounded-xl text-sm font-medium border border-gray-300 hover:from-primary-50 hover:to-primary-100 hover:border-primary-300 transition-all"
                                >
                                  <span className="text-lg">{ps.service.icon}</span>
                                  <span>{ps.service.name}</span>
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-2">
                            {partner.services.map((ps: any) => (
                              <button
                                key={ps.service.id}
                                onClick={() => router.push(`/servicios/${ps.service.slug}`)}
                                className="w-full bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold py-3.5 px-4 rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                              >
                                <span>{ps.service.icon}</span>
                                <span>Solicitar {ps.service.name}</span>
                                <ChevronRight size={18} />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'requests' && (
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-gradient-to-r from-orange-50 via-white to-orange-50 rounded-2xl sm:rounded-3xl shadow-lg border border-orange-100 p-4 sm:p-6">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Buscar solicitudes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all bg-white"
                  />
                </div>
              </div>

              {filteredRequests.length === 0 ? (
                <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg p-12 sm:p-16 text-center border border-gray-100">
                  <div className="bg-gradient-to-br from-orange-100 to-orange-200 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="text-orange-500 w-12 h-12" />
                  </div>
                  <p className="text-gray-900 text-xl font-bold mb-2">No hay solicitudes</p>
                  <p className="text-gray-500 text-base">Crea una solicitud para recibir propuestas de socios</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:gap-6">
                  {filteredRequests.map((request) => (
                    <div key={request.id} className="group bg-white rounded-2xl sm:rounded-3xl shadow-lg hover:shadow-2xl transition-all overflow-hidden border border-gray-100 hover:border-orange-200">
                      <div className={`h-2 ${
                        request.status === 'ACTIVE' ? 'bg-gradient-to-r from-emerald-500 to-green-600' :
                        request.status === 'ACCEPTED' ? 'bg-gradient-to-r from-blue-500 to-blue-600' :
                        'bg-gradient-to-r from-gray-400 to-gray-500'
                      }`}></div>
                      <div className="p-5 sm:p-6">
                        <div className="flex flex-col sm:flex-row items-start gap-4 mb-5">
                          <div className="text-4xl sm:text-5xl group-hover:scale-110 transition-transform">{request.service.icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <h3 className="font-bold text-lg sm:text-xl text-gray-900 group-hover:text-orange-600 transition-colors">{request.service.name}</h3>
                              <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                                request.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-200' :
                                request.status === 'ACCEPTED' ? 'bg-blue-100 text-blue-700 border-2 border-blue-200' :
                                'bg-gray-100 text-gray-700 border-2 border-gray-200'
                              }`}>
                                {requestStatusLabels[request.status]}
                              </span>
                              {request.isUrgent && (
                                <span className="bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg animate-pulse">
                                  ⚡ URGENTE
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-3">{request.service.category.name}</p>
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl px-4 py-2 border border-orange-200">
                                <p className="text-sm text-gray-600">Propuestas recibidas</p>
                                <p className="text-2xl font-bold text-orange-600">{request.proposals.length}</p>
                              </div>
                              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl px-4 py-2 border border-gray-200">
                                <p className="text-sm text-gray-600">Fecha de creación</p>
                                <p className="text-sm font-semibold text-gray-900">{new Date(request.createdAt).toLocaleDateString('es-ES')}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3 mb-5">
                          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                            <div className="bg-green-100 rounded-lg p-2 flex-shrink-0">
                              <MapPin size={18} className="text-green-600" />
                            </div>
                            <div>
                              <p className="text-xs text-gray-600 font-semibold mb-1">Ubicación</p>
                              <span className="text-sm font-medium text-gray-900">{request.address}, {request.city}</span>
                            </div>
                          </div>
                          {request.preferredDate && (
                            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
                              <div className="bg-blue-100 rounded-lg p-2 flex-shrink-0">
                                <Calendar size={18} className="text-blue-600" />
                              </div>
                              <div>
                                <p className="text-xs text-blue-600 font-semibold mb-1">Fecha preferida</p>
                                <span className="text-sm font-medium text-blue-700">
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
                          {request.isUrgent && (
                            <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-red-50 to-orange-50 rounded-xl border-2 border-red-200">
                              <div className="bg-red-100 rounded-lg p-2 flex-shrink-0">
                                <AlertCircle size={18} className="text-red-600" />
                              </div>
                              <div>
                                <p className="text-xs text-red-600 font-semibold mb-1">Urgente</p>
                                <span className="text-sm font-medium text-red-700">⚡ Lo más pronto posible</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {request.notes && (
                          <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl p-4 mb-5">
                            <p className="text-xs font-semibold text-gray-700 mb-2">Detalles adicionales:</p>
                            <p className="text-sm text-gray-800">{request.notes}</p>
                          </div>
                        )}

                        {request.photos && request.photos.length > 0 && (
                          <div className="mb-5">
                            <h4 className="font-semibold mb-3 text-sm text-gray-700 flex items-center gap-2">
                              <span className="bg-primary-100 text-primary-700 px-2 py-1 rounded-lg text-xs">
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
                        {request.proposals.length > 0 && (
                          <div className="border-t-2 border-gray-100 pt-5">
                            <h4 className="font-bold text-base sm:text-lg mb-4 flex items-center gap-2 text-gray-900">
                              <MessageSquare className="text-orange-600 w-5 h-5" />
                              Propuestas Recibidas ({request.proposals.length})
                            </h4>
                            <div className="space-y-3">
                              {request.proposals
                                .sort((a, b) => {
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
                                .map((proposal) => {
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

                                  return (
                                    <div
                                      key={proposal.id}
                                      className={`rounded-xl sm:rounded-2xl p-4 sm:p-5 border-2 transition-all ${
                                        isFullyVerified
                                          ? 'bg-gradient-to-br from-emerald-50 via-green-50 to-emerald-50 border-emerald-300 shadow-md'
                                          : 'bg-gradient-to-br from-gray-50 to-white border-gray-200 hover:border-gray-300'
                                      }`}
                                    >
                                      <div className="flex flex-col gap-4">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="flex items-center gap-3 flex-wrap flex-1">
                                            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md">
                                              {proposal.partner.user.name?.charAt(0) || 'P'}
                                            </div>
                                            <div>
                                              <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-base text-gray-900">{proposal.partner.user.name}</span>
                                                {isFullyVerified && (
                                                  <div className="group relative">
                                                    <div className="bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full p-1">
                                                      <Star size={14} className="text-white fill-white" />
                                                    </div>
                                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-lg">
                                                      Socio 100% Verificado
                                                    </span>
                                                  </div>
                                                )}
                                                {proposal.partner.verified && (
                                                  <ShieldCheck size={18} className="text-green-600" />
                                                )}
                                              </div>
                                              <div className="flex items-center gap-2 flex-wrap">
                                                {getVerificationBadges(proposal.partner.documents)}
                                                {isFullyVerified && (
                                                  <span className="bg-gradient-to-r from-emerald-500 to-green-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-md flex items-center gap-1">
                                                    <ShieldCheck size={12} />
                                                    Verificación Completa
                                                  </span>
                                                )}
                                                {proposal.status === 'ACCEPTED' && (
                                                  <span className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-md">
                                                    ✓ Aceptada
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>

                                        {isFullyVerified && (
                                          <div className="bg-white border-2 border-emerald-200 rounded-xl p-3 flex items-start gap-3 shadow-sm">
                                            <div className="bg-emerald-100 rounded-lg p-2 flex-shrink-0">
                                              <ShieldCheck size={18} className="text-emerald-600" />
                                            </div>
                                            <p className="text-xs text-gray-700 leading-relaxed">
                                              <span className="font-bold text-emerald-700">Socio completamente verificado:</span> Identidad, educación y antecedentes verificados por nuestro equipo.
                                            </p>
                                          </div>
                                        )}

                                        <div className="bg-white rounded-xl p-4 border-2 border-primary-200 shadow-sm">
                                          <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                              <span className="text-sm text-gray-600">Precio del servicio:</span>
                                              <span className="font-bold text-gray-900">{formatCurrency(proposal.price)}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                              <span className="text-sm text-gray-600">Tarifa de servicio ({clientCommissionRate}%):</span>
                                              <span className="font-bold text-gray-900">{formatCurrency(proposal.price * (clientCommissionRate / 100))}</span>
                                            </div>
                                            <div className="border-t-2 border-gray-200 pt-3 flex justify-between items-center">
                                              <span className="font-bold text-gray-900">Total a pagar:</span>
                                              <span className="text-2xl sm:text-3xl font-bold text-primary-600">{formatCurrency(proposal.price * (1 + clientCommissionRate / 100))}</span>
                                            </div>
                                          </div>
                                        </div>

                                        {proposal.notes && (
                                          <div className="bg-white rounded-xl p-4 border-2 border-gray-200 shadow-sm">
                                            <p className="text-xs font-semibold text-gray-700 mb-2">Notas del socio:</p>
                                            <p className="text-sm text-gray-800">{proposal.notes}</p>
                                          </div>
                                        )}

                                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                          {(proposal.status === 'ACCEPTED' || (request.status === 'ACTIVE' && proposal.status === 'PENDING')) && (
                                            <button
                                              onClick={() => setChatModal({
                                                isOpen: true,
                                                proposalId: proposal.id,
                                                partnerName: proposal.partner.user.name,
                                                serviceName: request.service.name
                                              })}
                                              className="w-full bg-white border-2 border-orange-500 text-orange-600 px-4 py-3.5 rounded-xl hover:bg-orange-50 transition-all font-semibold flex items-center justify-center gap-2 relative shadow-md hover:shadow-lg"
                                            >
                                              <MessageCircle size={20} />
                                              Chat con el Socio
                                              {unreadCounts[proposal.id] > 0 && (
                                                <span className="absolute -top-2 -right-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-bold rounded-full h-7 w-7 flex items-center justify-center animate-pulse shadow-lg">
                                                  {unreadCounts[proposal.id]}
                                                </span>
                                              )}
                                            </button>
                                          )}
                                          {request.status === 'ACTIVE' && proposal.status === 'PENDING' && (
                                            <button
                                              onClick={() => acceptProposal(proposal.id, proposal.partner.user.name, proposal.price)}
                                              className="w-full bg-gradient-to-r from-secondary-500 to-secondary-600 text-white px-4 py-3.5 rounded-xl hover:from-secondary-600 hover:to-secondary-700 transition-all font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                                            >
                                              <CheckCircle size={20} />
                                              Aceptar Propuesta
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
                            </div>
                          </div>
                        )}
                        {!request.proposals.length && (
                          <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl sm:rounded-2xl p-6 text-center">
                            <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                              <Clock className="text-blue-600" size={32} />
                            </div>
                            <p className="text-base text-blue-900 font-bold mb-1">Esperando propuestas de socios</p>
                            <p className="text-sm text-blue-700">Expira: {new Date(request.expiresAt).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                          </div>
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

      <RatingModal
        isOpen={ratingModal.isOpen}
        onClose={() => setRatingModal({ isOpen: false, bookingId: '', serviceName: '', partnerName: '' })}
        bookingId={ratingModal.bookingId}
        serviceName={ratingModal.serviceName}
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
