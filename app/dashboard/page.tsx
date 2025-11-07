'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  MessageSquare, Calendar, Clock, MapPin, Package, CheckCircle, DollarSign,
  TrendingUp, Activity, Search, Menu, X, Home, Bell,
  Settings, LogOut, ChevronRight, Plus, AlertCircle, User, XCircle, Star,
  Shield, CreditCard, GraduationCap, ShieldCheck, MessageCircle
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

const requestStatusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 border-green-200',
  ACCEPTED: 'bg-blue-100 text-blue-800 border-blue-200',
  EXPIRED: 'bg-gray-100 text-gray-800 border-gray-200',
  CANCELLED: 'bg-red-100 text-red-800 border-red-200',
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
  const [clientCommissionRate, setClientCommissionRate] = useState<number>(5.0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'requests'>('overview')
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
    }
  }, [status])

  useEffect(() => {
    fetchBookings()
  }, [filter])

  useEffect(() => {
    if (status === 'authenticated' && bookings.length > 0) {
      fetchUnreadCounts()
      const interval = setInterval(fetchUnreadCounts, 5000)
      return () => clearInterval(interval)
    }
  }, [status, bookings])

  const fetchUnreadCounts = async () => {
    try {
      const bookingsWithProposals = bookings.filter(b => b.proposalId)
      const counts: Record<string, number> = {}

      await Promise.all(
        bookingsWithProposals.map(async (booking) => {
          try {
            const res = await fetch(`/api/chat/unread-count?proposalId=${booking.proposalId}`)
            if (res.ok) {
              const data = await res.json()
              counts[booking.proposalId!] = data.count || 0
            }
          } catch (error) {
            console.error(`Error fetching unread count for ${booking.proposalId}:`, error)
          }
        })
      )

      setUnreadCounts(counts)
    } catch (error) {
      console.error('Error fetching unread counts:', error)
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
      console.error('Error fetching bookings:', error)
      setBookings([])
    } finally {
      setLoading(false)
    }
  }

  const fetchServiceRequests = async () => {
    try {
      const res = await fetch('/api/service-requests')
      const data = await res.json()

      console.log('📊 Service Requests Response:', data)

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
        console.log('💰 Client Commission Rate from API:', data.clientCommissionRate)
        setClientCommissionRate(data.clientCommissionRate)
      } else {
        console.warn('⚠️ No clientCommissionRate in response, using default:', clientCommissionRate)
      }
    } catch (error) {
      console.error('Error fetching service requests:', error)
      setServiceRequests([])
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
      console.error('Error loading payment methods:', error)
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
      console.error('Error loading payment breakdown:', error)
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
            <CreditCard size={16} className="text-blue-600" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Identidad verificada
            </span>
          </div>
        )}
        {hasEducation && (
          <div className="group relative">
            <GraduationCap size={16} className="text-purple-600" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Educación verificada
            </span>
          </div>
        )}
        {hasBackground && (
          <div className="group relative">
            <Shield size={16} className="text-green-600" />
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

      {imageGallery.isOpen && <ImageGalleryModal photos={imageGallery.photos} initialIndex={imageGallery.initialIndex} onClose={() => setImageGallery({ isOpen: false, photos: [], initialIndex: 0 })} />}

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
                <p className="text-sm text-yellow-800">No tienes métodos de pago guardados. Se procesará con Mercado Pago.</p>
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
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-600 truncate hidden sm:block">
                    {activeTab === 'overview' && 'Vista general de tu actividad'}
                    {activeTab === 'bookings' && 'Gestiona tus reservas de servicios'}
                    {activeTab === 'requests' && 'Solicitudes y propuestas recibidas'}
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

              </nav>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
          {activeTab === 'overview' && (
            <div className="space-y-4 sm:space-y-6">
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

                <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 border-l-4 border-blue-500 hover:shadow-xl transition">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg sm:rounded-xl flex items-center justify-center">
                      <CheckCircle className="text-blue-600" size={20} />
                    </div>
                  </div>
                  <p className="text-gray-600 text-xs sm:text-sm font-medium mb-1">Confirmadas</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">{confirmedCount}</p>
                </div>

                <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 border-l-4 border-green-500 hover:shadow-xl transition">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg sm:rounded-xl flex items-center justify-center">
                      <DollarSign className="text-green-600" size={20} />
                    </div>
                  </div>
                  <p className="text-gray-600 text-xs sm:text-sm font-medium mb-1">Total Gastado</p>
                  <p className="text-xl sm:text-3xl font-bold text-gray-900">{formatCurrency(totalSpent)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
                <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 border-l-4 border-green-500 hover:shadow-xl transition">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg sm:rounded-xl flex items-center justify-center">
                      <Activity className="text-green-600" size={20} />
                    </div>
                  </div>
                  <p className="text-gray-600 text-xs sm:text-sm font-medium mb-1">Solicitudes Activas</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">{activeRequestsCount}</p>
                </div>

                <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 border-l-4 border-blue-500 hover:shadow-xl transition">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-lg sm:rounded-xl flex items-center justify-center">
                      <MessageSquare className="text-blue-600" size={20} />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">{totalProposals}</p>
                </div>

                <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 border-l-4 border-purple-500 hover:shadow-xl transition">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg sm:rounded-xl flex items-center justify-center">
                      <TrendingUp className="text-purple-600" size={20} />
                    </div>
                  </div>
                  <p className="text-gray-600 text-xs sm:text-sm font-medium mb-1">Servicios Favoritos</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900">0</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2">
                  <Activity className="text-primary-600" size={18} />
                  Acciones Rápidas
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <button
                    onClick={() => setActiveTab('bookings')}
                    className="flex items-center gap-3 p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition group"
                  >
                    <Package className="text-blue-600 group-hover:scale-110 transition flex-shrink-0" size={20} />
                    <div className="text-left min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-sm sm:text-base">Ver Reservas</p>
                      <p className="text-xs sm:text-sm text-gray-600">{bookings.length} activas</p>
                    </div>
                    <ChevronRight className="ml-auto text-gray-400 group-hover:text-blue-600 flex-shrink-0" size={18} />
                  </button>

                  <button
                    onClick={() => setActiveTab('requests')}
                    className="flex items-center gap-3 p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 border-gray-200 hover:border-orange-500 hover:bg-orange-50 transition group"
                  >
                    <Bell className="text-orange-600 group-hover:scale-110 transition flex-shrink-0" size={20} />
                    <div className="text-left min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 text-sm sm:text-base">Mis Solicitudes</p>
                      <p className="text-xs sm:text-sm text-gray-600">{totalProposals} propuestas</p>
                    </div>
                    <ChevronRight className="ml-auto text-gray-400 group-hover:text-orange-600 flex-shrink-0" size={18} />
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2">
                  <Clock className="text-primary-600" size={18} />
                  Actividad Reciente
                </h3>
                {bookings.slice(0, 5).length === 0 ? (
                  <div className="text-center py-8 sm:py-12">
                    <Package className="mx-auto text-gray-300 mb-3" size={40} />
                    <p className="text-gray-500 text-sm sm:text-base">No hay actividad reciente</p>
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-3">
                    {bookings.slice(0, 5).map((booking) => (
                      <div key={booking.id} className="flex items-start sm:items-center gap-2 sm:gap-4 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-gray-50 hover:bg-gray-100 transition">
                        <div className="text-2xl sm:text-3xl flex-shrink-0">{booking.service.icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">{booking.service.name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <p className="text-xs sm:text-sm text-gray-600">{new Date(booking.scheduledDate).toLocaleDateString('es-ES')}</p>
                            <span className={`text-[10px] sm:text-xs font-medium px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border whitespace-nowrap ${statusColors[booking.status]}`}>
                              {statusLabels[booking.status]}
                            </span>
                          </div>
                        </div>
                        <p className="font-bold text-primary-600 text-xs sm:text-base whitespace-nowrap flex-shrink-0">{formatCurrency(booking.totalPrice)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'bookings' && (
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="Buscar por servicio o dirección..."
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
                    {Object.entries(statusLabels).map(([key, label]) => (
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

              {filteredBookings.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                  <Package className="mx-auto text-gray-300 mb-4" size={64} />
                  <p className="text-gray-600 text-lg font-medium">No hay reservas</p>
                  <p className="text-gray-500 text-sm mt-2">Aquí aparecerán tus reservas cuando realices alguna</p>
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
                            <p className="text-sm text-gray-600">{booking.service.category.name}</p>
                            <p className="text-2xl font-bold text-primary-600 mt-2">{formatCurrency(booking.totalPrice)}</p>
                          </div>
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

                        {booking.status === 'COMPLETED' && booking.payment?.status === 'APPROVED' && !booking.review?.clientToPartnerRating && (
                          <button
                            onClick={() => setRatingModal({
                              isOpen: true,
                              bookingId: booking.id,
                              serviceName: booking.service.name,
                              partnerName: booking.partner?.user.name || 'el socio'
                            })}
                            className="w-full bg-yellow-500 text-white px-4 py-3 rounded-xl hover:bg-yellow-600 transition font-medium flex items-center justify-center gap-2 mb-3"
                          >
                            <Star size={18} />
                            Calificar Servicio
                          </button>
                        )}

                        {booking.status === 'COMPLETED' && booking.payment?.status === 'APPROVED' && booking.review?.clientToPartnerRating && (
                          <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-3">
                            <div className="flex items-center gap-2 text-green-700">
                              <CheckCircle size={16} />
                              <span className="text-sm font-medium">Servicio calificado</span>
                              <div className="flex ml-auto">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    size={14}
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
                            className="w-full bg-green-600 text-white px-4 py-3 rounded-xl hover:bg-green-700 transition font-medium flex items-center justify-center gap-2 mb-3"
                          >
                            <DollarSign size={18} />
                            Pagar Servicio
                          </button>
                        )}

                        {booking.status === 'COMPLETED' && booking.payment?.status === 'APPROVED' && (
                          <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-3">
                            <div className="flex items-center gap-2 text-green-700">
                              <CheckCircle size={16} />
                              <span className="text-sm font-medium">Servicio pagado - {formatCurrency(booking.payment.totalAmount)}</span>
                            </div>
                          </div>
                        )}

                        {booking.status === 'COMPLETED' && booking.payment?.status === 'PENDING' && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-3">
                            <div className="flex items-center gap-2 text-yellow-700">
                              <Clock size={16} />
                              <span className="text-sm font-medium">Pago pendiente</span>
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
                            className="w-full bg-blue-600 text-white px-4 py-3 rounded-xl hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2 mb-3 relative"
                          >
                            <MessageCircle size={18} />
                            Chat con el Socio
                            {unreadCounts[booking.proposalId] > 0 && (
                              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center animate-pulse shadow-lg">
                                {unreadCounts[booking.proposalId]}
                              </span>
                            )}
                          </button>
                        )}

                        {(booking.status === 'PENDING' || booking.status === 'CONFIRMED') && booking.payment?.status !== 'APPROVED' && (
                          <button
                            onClick={() => cancelBooking(booking.id, booking.service.name)}
                            className="w-full bg-red-600 text-white px-4 py-3 rounded-xl hover:bg-red-700 transition font-medium flex items-center justify-center gap-2"
                          >
                            <XCircle size={18} />
                            Cancelar Reserva
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'requests' && (
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
                  <p className="text-gray-600 text-lg font-medium">No hay solicitudes</p>
                  <p className="text-gray-500 text-sm mt-2">Crea una solicitud para recibir propuestas de socios</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {filteredRequests.map((request) => (
                    <div key={request.id} className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition overflow-hidden">
                      <div className="p-6">
                        <div className="flex flex-col sm:flex-row items-start gap-4 mb-4">
                          <div className="text-4xl">{request.service.icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <h3 className="font-bold text-lg text-gray-900">{request.service.name}</h3>
                              <span className={`text-xs font-medium px-3 py-1 rounded-full border ${requestStatusColors[request.status]}`}>
                                {requestStatusLabels[request.status]}
                              </span>
                              {request.isUrgent && (
                                <span className="bg-red-100 text-red-800 text-xs font-bold px-3 py-1 rounded-full border border-red-200">
                                  URGENTE
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 truncate">{request.service.category.name}</p>
                          </div>
                          <div className="text-left sm:text-right flex-shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                            <p className="text-sm text-gray-500 truncate">{new Date(request.createdAt).toLocaleDateString('es-ES')}</p>
                            <p className="text-xs text-gray-400 mt-1">{request.proposals.length} propuestas</p>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm text-gray-600 mb-4">
                          <div className="flex items-center gap-2">
                            <MapPin size={16} className="text-primary-600" />
                            <span>{request.address}, {request.city}</span>
                          </div>
                          {request.preferredDate && (
                            <div className="flex items-center gap-2">
                              <Calendar size={16} className="text-blue-600" />
                              <span className="text-blue-600 font-medium">
                                Fecha preferida: {new Date(request.preferredDate).toLocaleDateString('es-ES', {
                                  weekday: 'long',
                                  day: 'numeric',
                                  month: 'long'
                                })}
                                {request.preferredTime && ` a las ${request.preferredTime}`}
                              </span>
                            </div>
                          )}
                          {request.isUrgent && (
                            <div className="flex items-center gap-2">
                              <AlertCircle size={16} className="text-red-600" />
                              <span className="text-red-600 font-medium">⚡ Urgente - Lo más pronto posible</span>
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

                        {request.proposals.length > 0 && (
                          <div className="border-t pt-4">
                            <h4 className="font-semibold mb-3 flex items-center gap-2">
                              <MessageSquare size={18} className="text-primary-600" />
                              Propuestas Recibidas ({request.proposals.length})
                            </h4>
                            <div className="space-y-3">
                              {request.proposals.map((proposal) => (
                                <div key={proposal.id} className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4">
                                  <div className="flex flex-col gap-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <div className="flex items-center gap-2">
                                        <User size={16} className="text-gray-600" />
                                        <span className="font-semibold text-gray-900">{proposal.partner.user.name}</span>
                                        {proposal.partner.verified && (
                                          <div className="group relative">
                                            <ShieldCheck size={16} className="text-green-600" />
                                            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                              Socio verificado
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                      {getVerificationBadges(proposal.partner.documents)}
                                      {proposal.status === 'ACCEPTED' && (
                                        <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded-full border border-green-200">
                                          ✓ Aceptada
                                        </span>
                                      )}
                                    </div>

                                    <div className="bg-white rounded-lg p-3 border-2 border-primary-200">
                                      <div className="space-y-2">
                                        <div className="flex justify-between items-center text-sm">
                                          <span className="text-gray-600">Precio del servicio:</span>
                                          <span className="font-semibold text-gray-900">{formatCurrency(proposal.price)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                          <span className="text-gray-600">Tarifa de servicio ({clientCommissionRate}%):</span>
                                          <span className="font-semibold text-gray-900">{formatCurrency(proposal.price * (clientCommissionRate / 100))}</span>
                                        </div>
                                        <div className="border-t pt-2 flex justify-between items-center">
                                          <span className="font-bold text-gray-900">Total a pagar:</span>
                                          <span className="text-xl sm:text-2xl font-bold text-primary-600">{formatCurrency(proposal.price * (1 + clientCommissionRate / 100))}</span>
                                        </div>
                                      </div>
                                    </div>

                                    {proposal.notes && (
                                      <p className="text-sm text-gray-600 bg-white rounded-lg p-3">{proposal.notes}</p>
                                    )}

                                    <div className="flex flex-col sm:flex-row gap-2">
                                      {(proposal.status === 'ACCEPTED' || (request.status === 'ACTIVE' && proposal.status === 'PENDING')) && (
                                        <button
                                          onClick={() => setChatModal({
                                            isOpen: true,
                                            proposalId: proposal.id,
                                            partnerName: proposal.partner.user.name,
                                            serviceName: request.service.name
                                          })}
                                          className="w-full bg-white border-2 border-[#FF2D55] text-[#FF2D55] px-4 py-3 rounded-xl hover:bg-[#FF2D55] hover:text-white transition font-medium flex items-center justify-center gap-2 relative"
                                        >
                                          <MessageCircle size={18} />
                                          Chat con el Socio
                                          {unreadCounts[proposal.id] > 0 && (
                                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center animate-pulse shadow-lg">
                                              {unreadCounts[proposal.id]}
                                            </span>
                                          )}
                                        </button>
                                      )}
                                      {request.status === 'ACTIVE' && proposal.status === 'PENDING' && (
                                        <button
                                          onClick={() => acceptProposal(proposal.id, proposal.partner.user.name, proposal.price)}
                                          className="w-full bg-primary-600 text-white px-4 py-3 rounded-xl hover:bg-primary-700 transition font-medium flex items-center justify-center gap-2"
                                        >
                                          <CheckCircle size={18} />
                                          Aceptar Propuesta
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {request.proposals.length === 0 && request.status === 'ACTIVE' && (
                          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                            <Clock className="mx-auto text-blue-600 mb-2" size={32} />
                            <p className="text-sm text-blue-800 font-medium">Esperando propuestas de socios</p>
                            <p className="text-xs text-blue-600 mt-1">Expira: {new Date(request.expiresAt).toLocaleDateString('es-ES')}</p>
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
