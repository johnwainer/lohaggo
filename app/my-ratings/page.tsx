'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Star, Calendar, MessageSquare } from 'lucide-react'
import ServiceIcon from '@/components/ServiceIcon'
import { formatCurrency } from '@/lib/utils'
import AccountTopHeader from '@/components/shared/AccountTopHeader'
import AccountPanel from '@/components/shared/AccountPanel'
import { formatCalendarDay } from '@/lib/bookings/when'

interface Review {
  id: string
  booking: {
    id: string
    scheduledDate: string
    totalPrice: number
    service: {
      name: string
      slug: string
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
  const { status } = useSession()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<'CLIENT' | 'PARTNER' | null>(null)

  useEffect(() => {
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
      <div className="flex gap-1" role="img" aria-label={`${rating} de 5 estrellas`}>
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            size={20}
            aria-hidden="true"
            className={i < rating ? 'fill-yellow-400 text-yellow-500' : 'text-gray-400'}
          />
        ))}
      </div>
    )
  }

  /** When the review was written (an instant): its Bogotá day */
  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', year: 'numeric', month: 'long', day: 'numeric' })

  if (status === 'loading' || loading) {
    return (
      <div className="panel-page min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto" aria-hidden="true"></div>
          <p className="mt-4 text-gray-600" role="status">Cargando calificaciones...</p>
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
    <div className="account-shell">
      <AccountTopHeader
        role={userRole === 'PARTNER' ? 'PARTNER' : 'CLIENT'}
        title="Mis calificaciones"
        subtitle={
          userRole === 'PARTNER'
            ? 'Calificaciones que has recibido de los clientes'
            : 'Calificaciones que has recibido de los socios'
        }
      />

      <div className="account-main">
        {/* Stats Card */}
        {reviews.filter(r => userRole === 'CLIENT' ? r.partnerToClientRating : r.clientToPartnerRating).length > 0 && (
          <AccountPanel className="mb-8">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Star size={24} className="fill-yellow-400 text-yellow-500" aria-hidden="true" />
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
          </AccountPanel>
        )}

        {/* Reviews List */}
        {reviews.length === 0 ? (
          <AccountPanel className="text-center py-8">
            <Star size={64} className="mx-auto text-gray-400 mb-4" aria-hidden="true" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Aún no tienes calificaciones
            </h2>
            <p className="text-gray-600">
              {userRole === 'CLIENT' 
                ? 'Completa servicios para recibir calificaciones de los socios' 
                : 'Completa servicios para recibir calificaciones de los clientes'}
            </p>
          </AccountPanel>
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
                <div key={review.id} className="surface-card p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div aria-hidden="true" className="w-10 h-10 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-full flex items-center justify-center text-white font-semibold">
                          {reviewerName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h2 className="font-semibold text-gray-900">{reviewerName}</h2>
                          <p className="text-sm text-gray-600">
                            {userRole === 'CLIENT' ? 'Socio' : 'Cliente'}
                          </p>
                        </div>
                      </div>
                      {renderStars(rating)}
                    </div>
                    {reviewedAt && (
                      <div className="text-right text-sm text-gray-600">
                        <Calendar size={16} className="inline mr-1" aria-hidden="true" />
                        {formatDate(reviewedAt)}
                      </div>
                    )}
                  </div>

                  <div className="bg-gray-50 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-2 text-gray-700 mb-2">
                      <ServiceIcon slug={review.booking.service.slug} emoji={review.booking.service.icon} size="sm" />
                      <div>
                        <p className="font-medium">{review.booking.service.name}</p>
                        <p className="text-sm text-gray-600">
                          {formatCalendarDay(review.booking.scheduledDate, { year: 'numeric', month: 'long', day: 'numeric' })} • {formatCurrency(review.booking.totalPrice)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {comment && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <div className="flex items-start gap-2">
                        <MessageSquare size={18} className="text-blue-700 mt-1 flex-shrink-0" aria-hidden="true" />
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
