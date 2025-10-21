'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DollarSign, Clock, Star, CheckCircle } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { formatCurrency } from '@/lib/utils'

interface Service {
  id: string
  name: string
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
      verified: boolean
      user: {
        name: string
        phone: string
      }
    }
  }>
}

export default function ServiceDetailPage({ params }: { params: { slug: string } }) {
  const { data: session } = useSession()
  const router = useRouter()
  const [service, setService] = useState<Service | null>(null)
  const [loading, setLoading] = useState(true)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [requestData, setRequestData] = useState({
    address: '',
    notes: '',
    preferredDate: '',
    isUrgent: false
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchService()
  }, [params.slug])

  const fetchService = async () => {
    try {
      const res = await fetch(`/api/services/${params.slug}`)
      const data = await res.json()
      setService(data)
    } catch (error) {
      console.error('Error fetching service:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBooking = () => {
    if (!session) {
      router.push('/login?redirect=/servicios/' + params.slug)
      return
    }
    // Open the new request modal
    setShowRequestModal(true)
  }

  // New function name for handling requests (kept for clarity/compatibility)
  const handleRequest = () => {
    if (!session) {
      router.push('/login?redirect=/servicios/' + params.slug)
      return
    }
    setShowRequestModal(true)
  }

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!service) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/service-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: service.id,
          ...requestData,
          city: 'MEDELLIN' // TODO: Hacer esto dinámico basado en la ubicación del usuario
        })
      })

      if (res.ok) {
        alert('¡Solicitud creada exitosamente! Los profesionales disponibles recibirán tu solicitud.')
        router.push('/dashboard')
      } else {
        const error = await res.json()
        alert(error.error || 'Error al crear solicitud')
      }
    } catch (error) {
      console.error('Error creating booking:', error)
      alert('Error al crear reserva')
    } finally {
      setSubmitting(false)
    }
  }

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Service Header */}
        <div className="bg-white rounded-xl shadow-md p-8 mb-8">
          <div className="flex items-start gap-6">
            <div className="text-6xl">{service.icon}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-3xl font-bold">{service.name}</h1>
                <span className="bg-primary-100 text-primary-700 text-sm font-medium px-3 py-1 rounded-full">
                  {service.category.name}
                </span>
              </div>
              <p className="text-gray-600 text-lg mb-6">{service.description}</p>
              
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <DollarSign className="text-primary-600" size={20} />
                  <span className="text-gray-700">
                    Desde <span className="font-bold text-primary-600">{formatCurrency(service.basePrice)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="text-primary-600" size={20} />
                  <span className="text-gray-700">
                    Duración: <span className="font-semibold">{service.duration} min</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="text-primary-600" size={20} />
                  <span className="text-gray-700">
                    <span className="font-semibold">{service.partners.length}</span> profesionales disponibles
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Booking Button */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold mb-2">¿Listo para solicitar?</h2>
              <p className="text-gray-600">Envía tu solicitud a múltiples profesionales</p>
            </div>
            <button
              onClick={handleRequest}
              className="bg-primary-600 text-white px-8 py-3 rounded-lg hover:bg-primary-700 transition font-medium"
            >
              Solicitar servicio
            </button>
          </div>
        </div>

        {/* Available Professionals */}
        {service.partners.length > 0 && (
          <div className="bg-white rounded-xl shadow-md p-8">
            <h2 className="text-2xl font-bold mb-6">Profesionales disponibles</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {service.partners.map((partnerService) => (
                <div key={partnerService.id} className="border rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{partnerService.partner.user.name}</h3>
                      {partnerService.partner.verified && (
                        <span className="text-green-600 text-sm">✓ Verificado</span>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-yellow-500">
                        <Star size={16} fill="currentColor" />
                        <span className="font-semibold">{partnerService.partner.rating.toFixed(1)}</span>
                      </div>
                      <span className="text-gray-500 text-sm">
                        ({partnerService.partner.totalReviews} reseñas)
                      </span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-primary-600 font-bold text-xl">{formatCurrency(partnerService.price)}</p>
                  </div>


                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold mb-4">Solicitar {service.name}</h2>
            <p className="text-gray-600 mb-6">
              Tu solicitud será enviada a todos los profesionales disponibles. Recibirás propuestas con diferentes precios y podrás elegir la que más te convenga.
            </p>
            <form onSubmit={submitRequest}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Dirección *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Calle, número, barrio, ciudad"
                    value={requestData.address}
                    onChange={(e) => setRequestData({ ...requestData, address: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                </div>

                {/* Fecha preferida o urgente */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    ¿Cuándo necesitas el servicio? *
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                      <input
                        type="radio"
                        name="urgency"
                        checked={requestData.isUrgent}
                        onChange={() => setRequestData({ ...requestData, isUrgent: true, preferredDate: '' })}
                        className="w-4 h-4 text-primary-600"
                      />
                      <div>
                        <div className="font-medium text-gray-900">Lo más pronto posible</div>
                        <div className="text-sm text-gray-500">Necesito el servicio urgentemente</div>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                      <input
                        type="radio"
                        name="urgency"
                        checked={!requestData.isUrgent}
                        onChange={() => setRequestData({ ...requestData, isUrgent: false })}
                        className="w-4 h-4 text-primary-600"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 mb-2">Tengo una fecha preferida</div>
                        {!requestData.isUrgent && (
                          <input
                            type="date"
                            required={!requestData.isUrgent}
                            min={new Date().toISOString().split('T')[0]}
                            value={requestData.preferredDate}
                            onChange={(e) => setRequestData({ ...requestData, preferredDate: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                      </div>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Detalles adicionales (opcional)
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Describe los detalles específicos de tu solicitud, medidas, materiales, etc."
                    value={requestData.notes}
                    onChange={(e) => setRequestData({ ...requestData, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="text-blue-600 mt-0.5" size={20} />
                    <div>
                      <h3 className="font-semibold text-blue-900 mb-1">¿Cómo funciona?</h3>
                      <ul className="text-blue-800 text-sm space-y-1">
                        <li>• Tu solicitud llega a todos los profesionales disponibles</li>
                        <li>• Recibirás propuestas con diferentes precios</li>
                        <li>• Elige la propuesta que más te convenga</li>
                        <li>• Coordina fecha y hora directamente con el profesional</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
                >
                  {submitting ? 'Enviando...' : 'Enviar solicitud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
