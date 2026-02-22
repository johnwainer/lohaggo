'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Star, Calendar, MessageSquare } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import AccountTopHeader from '@/components/shared/AccountTopHeader'
import AccountPanel from '@/components/shared/AccountPanel'

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
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<'CLIENT' | 'PARTNER' | null>(null)
  const [bookingsCount, setBookingsCount] = useState(0)
  const [requestsCount, setRequestsCount] = useState(0)
  const [clientBookings, setClientBookings] = useState<any[]>([])
  const [clientServiceRequests, setClientServiceRequests] = useState<any[]>([])
  const [favoritesCount, setFavoritesCount] = useState(0)

  useEffect(() => {
    if (status === 'authenticated') {
      fetchReviews()
      if (session?.user?.role === 'PARTNER') {
        fetchPartnerData()
      } else if (session?.user?.role === 'CLIENT') {
        fetchClientData()
      }
    }
  }, [status])

  const fetchPartnerData = async () => {
    try {
      const [bookingsRes, requestsRes] = await Promise.all([
        fetch('/api/bookings'),
        fetch('/api/partner/service-requests')
      ])

      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json()
        setBookingsCount(Array.isArray(bookingsData) ? bookingsData.length : 0)
      }

      if (requestsRes.ok) {
        const requestsData = await requestsRes.json()
        setRequestsCount(Array.isArray(requestsData) ? requestsData.length : 0)
      }
    } catch (error) {
      console.error('Error fetching partner data:', error)
    }
  }

  const fetchClientData = async () => {
    try {
      const [bookingsRes, requestsRes, favoritesRes] = await Promise.all([
        fetch('/api/bookings'),
        fetch('/api/service-requests'),
        fetch('/api/favorites')
      ])

      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json()
        setClientBookings(Array.isArray(bookingsData) ? bookingsData : [])
      }

      if (requestsRes.ok) {
        const requestsData = await requestsRes.json()
        // Normalize possible different shapes from the API
        const rawRequests = Array.isArray(requestsData)
          ? requestsData
          : Array.isArray(requestsData?.serviceRequests)
          ? requestsData.serviceRequests
          : []
        setClientServiceRequests(rawRequests)
      }

      if (favoritesRes.ok) {
        const favoritesData = await favoritesRes.json()
        setFavoritesCount(Array.isArray(favoritesData) ? favoritesData.length : 0)
      }
    } catch (error) {
      console.error('Error fetching client data:', error)
    }
  }

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
      <div className="panel-page min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
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
    <div className="account-shell">
      <AccountTopHeader
        role={userRole === 'PARTNER' ? 'PARTNER' : 'CLIENT'}
        title="Mis Calificaciones"
        subtitle={
          userRole === 'PARTNER'
            ? 'Calificaciones que has recibido de los clientes'
            : 'Calificaciones que has recibido de los socios'
        }
        counts={
          userRole === 'PARTNER'
            ? {
                bookings: bookingsCount,
                requests: requestsCount
              }
            : {
                bookings: clientBookings.length,
                requests: clientServiceRequests.length,
                favorites: favoritesCount
              }
        }
      />

      <div className="account-main">
        {/* Stats Card */}
        {reviews.filter(r => userRole === 'CLIENT' ? r.partnerToClientRating : r.clientToPartnerRating).length > 0 && (
          <AccountPanel className="mb-8">
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
          </AccountPanel>
        )}

        {/* Reviews List */}
        {reviews.length === 0 ? (
          <AccountPanel className="text-center py-8">
            <Star size={64} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Aún no tienes calificaciones
            </h3>
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
