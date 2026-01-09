'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Star, MapPin, Clock, DollarSign, ArrowLeft } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { formatCurrency } from '@/lib/utils'

interface Service {
  id: string
  name: string
  slug: string
  description: string
  image: string
  basePrice: number
  duration: number
  category: {
    name: string
    slug: string
  }
  _count?: {
    bookings: number
    reviews: number
  }
  averageRating?: number
  city?: {
    name: string
  }
}

export default function ServiceDetailClient({ slug }: { slug: string }) {
  const router = useRouter()
  const [service, setService] = useState<Service | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchService = async () => {
      try {
        console.log('[ServiceDetail] Fetching service:', slug)
        const data = await apiClient.get<Service>(`/services/${slug}`)
        console.log('[ServiceDetail] Service loaded:', data)
        setService(data)
      } catch (error) {
        console.error('[ServiceDetail] Error fetching service:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchService()
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando servicio...</p>
        </div>
      </div>
    )
  }

  if (!service) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Servicio no encontrado</h1>
          <p className="text-gray-600 mb-6">El servicio que buscas no existe.</p>
          <button
            onClick={() => router.push('/servicios')}
            className="bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition"
          >
            Ver todos los servicios
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="relative h-64 md:h-96">
        <Image
          src={service.image || '/placeholder-service.jpg'}
          alt={service.name}
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm p-2 rounded-full hover:bg-white transition"
        >
          <ArrowLeft className="w-6 h-6 text-gray-900" />
        </button>

        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <div className="max-w-4xl mx-auto">
            <span className="inline-block bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium mb-3">
              {service.category.name}
            </span>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">{service.name}</h1>
            {service.averageRating && service._count?.reviews ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Star className="w-5 h-5 fill-current text-yellow-400" />
                  <span className="font-semibold">{service.averageRating.toFixed(1)}</span>
                </div>
                <span className="text-white/80">({service._count.reviews} reseñas)</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Descripción</h2>
          <p className="text-gray-600 leading-relaxed">{service.description}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Detalles del servicio</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <DollarSign className="w-8 h-8 text-primary-600" />
              <div>
                <p className="text-sm text-gray-600">Precio desde</p>
                <p className="font-bold text-lg">{formatCurrency(service.basePrice)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <Clock className="w-8 h-8 text-primary-600" />
              <div>
                <p className="text-sm text-gray-600">Duración</p>
                <p className="font-bold text-lg">{service.duration} min</p>
              </div>
            </div>
            {service.city && (
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <MapPin className="w-8 h-8 text-primary-600" />
                <div>
                  <p className="text-sm text-gray-600">Ubicación</p>
                  <p className="font-bold text-lg">{service.city.name}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => router.push(`/login?callbackUrl=/servicios/${service.slug}`)}
          className="w-full bg-primary-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-primary-700 transition shadow-lg"
        >
          Contratar servicio
        </button>
      </div>
    </div>
  )
}
