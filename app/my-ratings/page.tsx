'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Star, ArrowLeft, Calendar, MessageSquare, User, MapPin } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import PartnerHeader from '@/components/partner/PartnerHeader'

interface Review {
  id: string
  booking: {
    id: string
    scheduledDate: string
    totalPrice: number
    service: {
      name: string
      icon: string
    }
    user: {
      name: string
      email: string
    }
    partner: {
      user: {
        name: string
        email: string
      }
    }
  }
  clientToPartnerRating: number | null
  clientToPartnerComment: string | null
  clientReviewedAt: string | null
  partnerToClientRating: number | null
  partnerToClientComment: string | null
  partnerReviewedAt: string | null
}

export default function MyRatingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<'CLIENT' | 'PARTNER' | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }

    if (status === 'authenticated') {
      fetchReviews()
    }
  }, [status])

  const fetchReviews = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/my-ratings')
      const data = await res.json()

      if (res.ok) {
        setReviews(data.reviews)
        setUserRole(data.userRole)
      }
    } catch (error) {
      console.error('Error fetching reviews:', error)
    } finally {
      setLoading(false)
    }
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            size={20}
            className={i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
          />
        ))}
      </div>
    )
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando calificaciones...</p>
        </div>
      </div>
    )
  }

  const averageRating = reviews.length > 0
    ? reviews.reduce((acc, review) => {
        const rating = userRole === 'CLIENT'
          ? review.partnerToClientRating
          : review.clientToPartnerRating
        return acc + (rating || 0)
      }, 0) / reviews.filter(r =>
        userRole === 'CLIENT' ? r.partnerToClientRating : r.clientToPartnerRating
      ).length
    : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {userRole === 'PARTNER' ? (
        <PartnerHeader
          title="Mis Calificaciones"
          subtitle="Calificaciones que has recibido de los clientes"
          showNavigation={true}
        />
      ) : (
        <header className="bg-white shadow-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                    Mis Calificaciones
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-600 truncate hidden sm:block">
                    Calificaciones que has recibido de los socios
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 bg-gray-50">
            <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
              <nav className="flex gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hide">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
                >
                  <User size={20} className="sm:w-[22px] sm:h-[22px]" />
                  <span className="hidden sm:inline">Resumen</span>
                </button>

                <button
                  onClick={() => router.push('/notifications')}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
                >
                  <MessageSquare size={20} className="sm:w-[22px] sm:h-[22px]" />
                  <span className="hidden sm:inline">Notificaciones</span>
                </button>

                <button
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-primary-600 text-primary-600 transition whitespace-nowrap"
                >
                  <Star size={20} className="sm:w-[22px] sm:h-[22px]" />
                  <span className="hidden sm:inline">Mis Calificaciones</span>
                </button>

                <button
                  onClick={() => router.push('/dashboard/addresses')}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
                >
                  <MapPin size={20} className="sm:w-[22px] sm:h-[22px]" />
                  <span className="hidden sm:inline">Mis Direcciones</span>
                </button>
              </nav>
            </div>
          </div>
        </header>
      )}

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Card */}
        {reviews.filter(r => userRole === 'CLIENT' ? r.partnerToClientRating : r.clientToPartnerRating).length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Star size={24} className="fill-yellow-400 text-yellow-400" />
                <span className="text-3xl font-bold text-gray-900">
                  {averageRating.toFixed(1)}
                </span>
              </div>
              <div className="text-gray-600">
                <p className="font-medium">Promedio general</p>
                <p className="text-sm">
                  {reviews.filter(r => userRole === 'CLIENT' ? r.partnerToClientRating : r.clientToPartnerRating).length} calificaciones
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Reviews List */}
        {reviews.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <Star size={64} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Aún no tienes calificaciones
            </h3>
            <p className="text-gray-600">
              {userRole === 'CLIENT' 
                ? 'Completa servicios para recibir calificaciones de los socios' 
                : 'Completa servicios para recibir calificaciones de los clientes'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => {
              const rating = userRole === 'CLIENT' 
                ? review.partnerToClientRating 
                : review.clientToPartnerRating
              const comment = userRole === 'CLIENT' 
                ? review.partnerToClientComment 
                : review.clientToPartnerComment
              const reviewedAt = userRole === 'CLIENT' 
                ? review.partnerReviewedAt 
                : review.clientReviewedAt
              const reviewerName = userRole === 'CLIENT' 
                ? review.booking.partner.user.name 
                : review.booking.user.name

              if (!rating) return null

              return (
                <div key={review.id} className="bg-white rounded-2xl shadow-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {reviewerName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{reviewerName}</h3>
                          <p className="text-sm text-gray-500">
                            {userRole === 'CLIENT' ? 'Socio' : 'Cliente'}
                          </p>
                        </div>
                      </div>
                      {renderStars(rating)}
                    </div>
                    {reviewedAt && (
                      <div className="text-right text-sm text-gray-500">
                        <Calendar size={16} className="inline mr-1" />
                        {formatDate(reviewedAt)}
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-2 text-gray-700 mb-2">
                      <span className="text-2xl">{review.booking.service.icon}</span>
                      <div>
                        <p className="font-medium">{review.booking.service.name}</p>
                        <p className="text-sm text-gray-500">
                          {formatDate(review.booking.scheduledDate)} • {formatCurrency(review.booking.totalPrice)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {comment && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <div className="flex items-start gap-2">
                        <MessageSquare size={18} className="text-blue-600 mt-1 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-blue-900 mb-1">Comentario:</p>
                          <p className="text-gray-700">{comment}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
