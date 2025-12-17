'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { User, Mail, Camera, Save, AlertCircle, CheckCircle, Home, Package, MessageSquare, Activity, Star, MapPin, Shield, Briefcase, ChevronRight, CreditCard, GraduationCap, Heart } from 'lucide-react'
import ClientDashboardNav from '@/components/ClientDashboardNav'

export default function ProfilePage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [bookingsCount, setBookingsCount] = useState(0)
  const [requestsCount, setRequestsCount] = useState(0)
  const [partnerData, setPartnerData] = useState<any>(null)
  const [addressesCount, setAddressesCount] = useState(0)
  const [clientRating, setClientRating] = useState(0)
  const [clientReviews, setClientReviews] = useState(0)
  const [favoritesCount, setFavoritesCount] = useState(0)

  const isPartner = session?.user?.role === 'PARTNER'

  const fetchCounts = async () => {
    try {
      const [bookingsRes, requestsRes] = await Promise.all([
        fetch('/api/bookings'),
        fetch('/api/service-requests')
      ])

      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json()
        setBookingsCount(Array.isArray(bookingsData) ? bookingsData.length : 0)
      }

      if (requestsRes.ok) {
        const requestsData = await requestsRes.json()
        const requests = Array.isArray(requestsData) ? requestsData : Array.isArray(requestsData?.serviceRequests) ? requestsData.serviceRequests : []
        setRequestsCount(requests.length)
      }
    } catch (error) {
      console.error('Error fetching counts:', error)
    }
  }

  const fetchPartnerData = async () => {
    try {
      const res = await fetch('/api/partner/profile')
      if (res.ok) {
        const data = await res.json()
        setPartnerData(data)
      }
    } catch (error) {
      console.error('Error fetching partner data:', error)
    }
  }

  const fetchClientData = async () => {
    try {
      const addressesRes = await fetch('/api/addresses')
      if (addressesRes.ok) {
        const addresses = await addressesRes.json()
        setAddressesCount(Array.isArray(addresses) ? addresses.length : 0)
      }

      const favoritesRes = await fetch('/api/favorites')
      if (favoritesRes.ok) {
        const favorites = await favoritesRes.json()
        setFavoritesCount(Array.isArray(favorites) ? favorites.length : 0)
      }

      if (session?.user) {
        setClientRating(session.user.clientRating || 0)
        setClientReviews(session.user.clientTotalReviews || 0)
      }
    } catch (error) {
      console.error('Error fetching client data:', error)
    }
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
    if (session?.user) {
      setName(session.user.name || '')
      setEmail(session.user.email || '')
      setImage(session.user.image || null)
      fetchCounts()

      if (session.user.role === 'PARTNER') {
        fetchPartnerData()
      } else {
        fetchClientData()
      }
    }
  }, [session, status, router])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'La imagen no debe superar 5MB' })
      return
    }

    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Solo se permiten archivos de imagen' })
      return
    }

    setUploadingImage(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('photos', file)

      const uploadResponse = await fetch('/api/upload-photos', {
        method: 'POST',
        body: formData,
      })

      if (!uploadResponse.ok) {
        throw new Error('Error al subir la imagen')
      }

      const { urls } = await uploadResponse.json()
      const imageUrl = urls[0]

      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, image: imageUrl }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al actualizar el perfil')
      }

      setImage(imageUrl)
      await update({ image: imageUrl })
      setMessage({ type: 'success', text: 'Foto de perfil actualizada exitosamente' })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al actualizar el perfil')
      }

      await update({ name: data.name, image: data.image })
      setMessage({ type: 'success', text: 'Perfil actualizado exitosamente' })

      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">Mi Perfil</h1>
                <p className="text-xs sm:text-sm text-gray-600 truncate hidden sm:block">Administra tu información personal</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 bg-gray-50">
          <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
            <nav className="flex gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hide">
              {isPartner ? (
                <>
                  <button
                    onClick={() => router.push('/partner')}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
                  >
                    <Home size={20} className="sm:w-[22px] sm:h-[22px]" />
                    <span className="hidden sm:inline">Resumen</span>
                  </button>

                  <button
                    onClick={() => router.push('/partner?tab=bookings')}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
                  >
                    <Package size={20} className="sm:w-[22px] sm:h-[22px]" />
                    <span className="hidden sm:inline">Mis Reservas</span>
                    {bookingsCount > 0 && (
                      <span className="bg-primary-600 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                        {bookingsCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => router.push('/partner?tab=my-requests')}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
                  >
                    <MessageSquare size={20} className="sm:w-[22px] sm:h-[22px]" />
                    <span className="hidden sm:inline">Para Mí</span>
                    {requestsCount > 0 && (
                      <span className="bg-primary-500 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                        {requestsCount}
                      </span>
                    )}
                  </button>


                </>
              ) : (
                <ClientDashboardNav
                  bookingsCount={bookingsCount}
                  requestsCount={requestsCount}
                  favoritesCount={favoritesCount}
                />
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-primary-500 to-secondary-500 px-6 py-8">
                <h2 className="text-2xl sm:text-3xl font-bold text-white">Información Personal</h2>
                <p className="text-white/90 mt-2">Actualiza tus datos de perfil</p>
              </div>

              <div className="p-6 sm:p-8">
                {message && (
                  <div
                    className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
                      message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                    }`}
                  >
                    {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                    <span>{message.text}</span>
                  </div>
                )}

                <div className="flex justify-center mb-8">
                  <div className="relative group">
                    <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                      {image ? (
                        <img src={image} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <User size={48} className="text-gray-400" />
                      )}
                    </div>
                    <label
                      htmlFor="avatar-upload"
                      className="absolute bottom-0 right-0 bg-secondary-500 text-white p-3 rounded-full cursor-pointer hover:bg-primary-500 transition-colors shadow-lg"
                    >
                      <Camera size={20} />
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={uploadingImage}
                      />
                    </label>
                    {uploadingImage && (
                      <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                      </div>
                    )}
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                      Nombre completo
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                      <input
                        type="text"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                      Correo electrónico
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                      <input
                        type="email"
                        id="email"
                        value={email}
                        disabled
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                      />
                    </div>
                    <p className="mt-2 text-sm text-gray-500">El correo electrónico no se puede modificar</p>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={loading}
                      className={`flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-secondary-500 text-white font-medium rounded-lg hover:shadow-lg transition-all ${
                        loading ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <Save size={20} />
                      {loading ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <aside className="lg:w-80 space-y-4">
            {isPartner ? (
              <>
                <button
                  onClick={() => router.push('/partner/services')}
                  className="w-full bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 text-left group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
                      <Briefcase className="text-white" size={24} />
                    </div>
                    <ChevronRight className="text-gray-400 group-hover:text-secondary-600 transition-colors" size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Mis Servicios</h3>
                  <p className="text-3xl font-bold text-blue-600 mb-2">
                    {partnerData?.services?.length || 0}
                  </p>
                  <p className="text-sm text-gray-600">Servicios activos</p>
                </button>

                <button
                  onClick={() => router.push('/partner')}
                  className="w-full bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 text-left group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl">
                      <Star className="text-white" size={24} />
                    </div>
                    <ChevronRight className="text-gray-400 group-hover:text-secondary-600 transition-colors" size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Calificación</h3>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-3xl font-bold text-yellow-600">
                      {partnerData?.rating?.toFixed(1) || '0.0'}
                    </p>
                    <Star className="text-yellow-500 fill-yellow-500" size={20} />
                  </div>
                  <p className="text-sm text-gray-600">{partnerData?.totalReviews || 0} reseñas</p>
                </button>

                <button
                  onClick={() => router.push('/partner/verification')}
                  className="w-full bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 text-left group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl ${
                      partnerData?.documents?.some((d: any) =>
                        ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP'].includes(d.type) &&
                        d.status === 'APPROVED'
                      ) &&
                      partnerData?.documents?.some((d: any) =>
                        ['DIPLOMA_BACHILLERATO', 'DIPLOMA_TECNICO', 'DIPLOMA_TECNOLOGO', 'DIPLOMA_PROFESIONAL', 'DIPLOMA_POSGRADO', 'CERTIFICADO_CURSO'].includes(d.type) &&
                        d.status === 'APPROVED'
                      ) &&
                      partnerData?.documents?.some((d: any) => d.type === 'ANTECEDENTES' && d.status === 'APPROVED')
                        ? 'bg-gradient-to-br from-green-500 to-green-600'
                        : 'bg-gradient-to-br from-gray-400 to-gray-500'
                    }`}>
                      <Shield className="text-white" size={24} />
                    </div>
                    <ChevronRight className="text-gray-400 group-hover:text-secondary-600 transition-colors" size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Estado de Verificación</h3>

                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        partnerData?.documents?.some((d: any) =>
                          ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP'].includes(d.type) &&
                          d.status === 'APPROVED'
                        ) ? 'bg-green-500' : 'bg-gray-300'
                      }`} />
                      <CreditCard size={16} className={
                        partnerData?.documents?.some((d: any) =>
                          ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP'].includes(d.type) &&
                          d.status === 'APPROVED'
                        ) ? 'text-green-600' : 'text-gray-400'
                      } />
                      <span className={`text-sm ${
                        partnerData?.documents?.some((d: any) =>
                          ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP'].includes(d.type) &&
                          d.status === 'APPROVED'
                        ) ? 'text-green-600 font-medium' : 'text-gray-500'
                      }`}>
                        Documento de Identidad
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        partnerData?.documents?.some((d: any) =>
                          ['DIPLOMA_BACHILLERATO', 'DIPLOMA_TECNICO', 'DIPLOMA_TECNOLOGO', 'DIPLOMA_PROFESIONAL', 'DIPLOMA_POSGRADO', 'CERTIFICADO_CURSO'].includes(d.type) &&
                          d.status === 'APPROVED'
                        ) ? 'bg-purple-500' : 'bg-gray-300'
                      }`} />
                      <GraduationCap size={16} className={
                        partnerData?.documents?.some((d: any) =>
                          ['DIPLOMA_BACHILLERATO', 'DIPLOMA_TECNICO', 'DIPLOMA_TECNOLOGO', 'DIPLOMA_PROFESIONAL', 'DIPLOMA_POSGRADO', 'CERTIFICADO_CURSO'].includes(d.type) &&
                          d.status === 'APPROVED'
                        ) ? 'text-purple-600' : 'text-gray-400'
                      } />
                      <span className={`text-sm ${
                        partnerData?.documents?.some((d: any) =>
                          ['DIPLOMA_BACHILLERATO', 'DIPLOMA_TECNICO', 'DIPLOMA_TECNOLOGO', 'DIPLOMA_PROFESIONAL', 'DIPLOMA_POSGRADO', 'CERTIFICADO_CURSO'].includes(d.type) &&
                          d.status === 'APPROVED'
                        ) ? 'text-purple-600 font-medium' : 'text-gray-500'
                      }`}>
                        Estudios
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        partnerData?.documents?.some((d: any) => d.type === 'ANTECEDENTES' && d.status === 'APPROVED')
                          ? 'bg-emerald-500' : 'bg-gray-300'
                      }`} />
                      <Shield size={16} className={
                        partnerData?.documents?.some((d: any) => d.type === 'ANTECEDENTES' && d.status === 'APPROVED')
                          ? 'text-emerald-600' : 'text-gray-400'
                      } />
                      <span className={`text-sm ${
                        partnerData?.documents?.some((d: any) => d.type === 'ANTECEDENTES' && d.status === 'APPROVED')
                          ? 'text-emerald-600 font-medium' : 'text-gray-500'
                      }`}>
                        Antecedentes
                      </span>
                    </div>
                  </div>

                  {partnerData?.documents?.some((d: any) =>
                    ['CEDULA_CIUDADANIA', 'CEDULA_EXTRANJERIA', 'PASAPORTE', 'PEP'].includes(d.type) &&
                    d.status === 'APPROVED'
                  ) &&
                  partnerData?.documents?.some((d: any) =>
                    ['DIPLOMA_BACHILLERATO', 'DIPLOMA_TECNICO', 'DIPLOMA_TECNOLOGO', 'DIPLOMA_PROFESIONAL', 'DIPLOMA_POSGRADO', 'CERTIFICADO_CURSO'].includes(d.type) &&
                    d.status === 'APPROVED'
                  ) &&
                  partnerData?.documents?.some((d: any) => d.type === 'ANTECEDENTES' && d.status === 'APPROVED') ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-sm font-semibold text-green-700 flex items-center gap-2">
                        <CheckCircle size={16} />
                        Full Verificado
                      </p>
                      <p className="text-xs text-green-600 mt-1">
                        Te destacarás en las propuestas
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">
                      Haz clic para completar tu verificación
                    </p>
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="w-full bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 text-left group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl">
                      <Star className="text-white" size={24} />
                    </div>
                    <ChevronRight className="text-gray-400 group-hover:text-secondary-600 transition-colors" size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Mis Calificaciones</h3>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-3xl font-bold text-yellow-600">
                      {clientRating?.toFixed(1) || '0.0'}
                    </p>
                    <Star className="text-yellow-500 fill-yellow-500" size={20} />
                  </div>
                  <p className="text-sm text-gray-600">{clientReviews || 0} reseñas recibidas</p>
                </button>

                <button
                  onClick={() => router.push('/dashboard/addresses')}
                  className="w-full bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 text-left group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl">
                      <MapPin className="text-white" size={24} />
                    </div>
                    <ChevronRight className="text-gray-400 group-hover:text-secondary-600 transition-colors" size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Mis Direcciones</h3>
                  <p className="text-3xl font-bold text-purple-600 mb-2">
                    {addressesCount}
                  </p>
                  <p className="text-sm text-gray-600">Direcciones guardadas</p>
                </button>
              </>
            )}
          </aside>
        </div>
      </main>
    </div>
  )
}
