'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { MapPin, User, DollarSign, Send, MessageSquare } from 'lucide-react'
import PlatformTrustBanner from '@/components/PlatformTrustBanner'

interface ServiceRequest {
  id: string
  address: string
  notes?: string
  city: string
  status: string
  expiresAt: string
  createdAt: string
  budget?: number
  service: {
    id: string
    name: string
    icon: string
    basePrice: number
    category: {
      name: string
    }
  }
  user: {
    name: string
    phone: string
  }
  proposals: Array<{
    id: string
    status: string
  }>
  _count: {
    proposals: number
  }
}

export default function PartnerRequestsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showProposalModal, setShowProposalModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null)
  const [proposalData, setProposalData] = useState({
    price: '',
    notes: ''
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    fetchActiveRequests()
  }, [session, status])

  const fetchActiveRequests = async () => {
    try {
      const res = await fetch('/api/service-requests/active')
      if (res.ok) {
        const data = await res.json()
        setRequests(data)
      }
    } catch (error) {
      console.error('Error fetching requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSendProposal = (request: ServiceRequest) => {
    setSelectedRequest(request)
    setProposalData({
      price: '',
      notes: ''
    })
    setShowProposalModal(true)
  }

  const submitProposal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRequest) return

    const priceValue = parseFloat(proposalData.price)
    const basePrice = selectedRequest.service.basePrice

    if (priceValue < basePrice) {
      alert(`El precio de tu propuesta no puede ser menor al precio base del servicio ($${basePrice})`)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceRequestId: selectedRequest.id,
          price: priceValue,
          notes: proposalData.notes
        })
      })

      if (res.ok) {
        alert('¡Propuesta enviada exitosamente!')
        setShowProposalModal(false)
        fetchActiveRequests()
      } else {
        const error = await res.json()
        alert(error.error || 'Error al enviar propuesta')
      }
    } catch (error) {
      console.error('Error sending proposal:', error)
      alert('Error al enviar propuesta')
    } finally {
      setSubmitting(false)
    }
  }

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date()
    const expiry = new Date(expiresAt)
    const diff = expiry.getTime() - now.getTime()

    if (diff <= 0) return 'Expirada'

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 0) {
      return `${hours}h ${minutes}m restantes`
    }
    return `${minutes}m restantes`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Solicitudes activas</h1>
          <p className="text-gray-600">
            Solicitudes de servicio disponibles para enviar propuestas
          </p>
        </div>

        <PlatformTrustBanner
          variant="info"
          context="partner"
          className="mb-8"
        />

        {/* Requests List */}
        {requests.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <MessageSquare className="mx-auto h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No hay solicitudes activas
            </h3>
            <p className="text-gray-600">
              Cuando los clientes soliciten servicios que ofreces, aparecerán aquí para que puedas enviar propuestas.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {requests.map((request) => (
              <div key={request.id} className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">{request.service.icon}</div>
                    <div>
                      <h3 className="font-semibold text-lg">{request.service.name}</h3>
                      <p className="text-gray-600 text-sm">{request.service.category.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">
                      {getTimeRemaining(request.expiresAt)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {request._count.proposals} propuestas
                    </div>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-start gap-2">
                    <User className="text-gray-400 mt-0.5" size={16} />
                    <div>
                      <div className="font-medium">{request.user.name}</div>
                      <div className="text-gray-600 text-sm">{request.user.phone}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <MapPin className="text-gray-400 mt-0.5" size={16} />
                    <span className="text-gray-700 text-sm">{request.address}</span>
                  </div>

                  {request.notes && (
                    <div className="flex items-start gap-2">
                      <MessageSquare className="text-gray-400 mt-0.5" size={16} />
                      <span className="text-gray-700 text-sm">{request.notes}</span>
                    </div>
                  )}

                  {request.budget && (
                    <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
                      <DollarSign className="text-green-600 mt-0.5" size={16} />
                      <div>
                        <p className="text-xs font-semibold text-green-600 mb-0.5">Presupuesto del cliente</p>
                        <span className="text-sm font-medium text-green-700">${request.budget.toLocaleString('en-US')}</span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleSendProposal(request)}
                  className="w-full bg-primary-600 text-white px-4 py-3 rounded-lg hover:bg-primary-700 transition font-medium flex items-center justify-center gap-2"
                >
                  <Send size={18} />
                  Enviar propuesta
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Proposal Modal */}
      {showProposalModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-4">
              Enviar propuesta para {selectedRequest.service.name}
            </h2>
            <form onSubmit={submitProposal}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Precio *
                  </label>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                    <p className="text-sm text-blue-800">
                      <span className="font-semibold">Precio base mínimo:</span> ${selectedRequest.service.basePrice}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Tu propuesta debe ser igual o mayor a este valor
                    </p>
                  </div>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="number"
                      required
                      min={selectedRequest.service.basePrice}
                      step="0.01"
                      placeholder={selectedRequest.service.basePrice.toString()}
                      value={proposalData.price}
                      onChange={(e) => setProposalData({ ...proposalData, price: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notas adicionales (opcional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe tu propuesta, experiencia, materiales incluidos, etc."
                    value={proposalData.notes}
                    onChange={(e) => setProposalData({ ...proposalData, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Información del cliente:</h3>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div><strong>Nombre:</strong> {selectedRequest.user.name}</div>
                    <div><strong>Teléfono:</strong> {selectedRequest.user.phone}</div>
                    <div><strong>Dirección:</strong> {selectedRequest.address}</div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowProposalModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-4 py-2 rounded-lg hover:from-primary-600 hover:to-secondary-600 transition disabled:opacity-50"
                >
                  {submitting ? 'Enviando...' : 'Enviar propuesta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}