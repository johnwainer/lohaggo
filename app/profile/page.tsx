'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { User, Mail, Camera, Save, AlertCircle, CheckCircle, Home, Package, MessageSquare, Activity, Star, MapPin, Shield, Briefcase, Award, ChevronRight } from 'lucide-react'

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF6900]"></div>
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
                      <span className="bg-orange-500 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                        {requestsCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => router.push('/partner?tab=all-requests')}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
                  >
                    <Activity size={20} className="sm:w-[22px] sm:h-[22px]" />
                    <span className="hidden sm:inline">Todas</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
                  >
                    <Home size={20} className="sm:w-[22px] sm:h-[22px]" />
                    <span className="hidden sm:inline">Resumen</span>
                  </button>

                  <button
                    onClick={() => router.push('/dashboard')}
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
                    onClick={() => router.push('/dashboard')}
                    className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300 transition whitespace-nowrap"
                  >
                    <MessageSquare size={20} className="sm:w-[22px] sm:h-[22px]" />
                    <span className="hidden sm:inline">Mis Solicitudes</span>
                    {requestsCount > 0 && (
                      <span className="bg-orange-500 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                        {requestsCount}
                      </span>
                    )}
                  </button>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
          <aside className="w-full lg:w-80 flex-shrink-0 order-2 lg:order-2">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 bg-gray-200 rounded-full flex items-center justify-center text-xl text-gray-500">
                  {session?.user?.name ? session.user.name.charAt(0) : 'U'}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{session?.user?.name || 'Usuario'}</p>
                  <p className="text-sm text-gray-500">{session?.user?.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{bookingsCount || 0}</p>
                  <p className="text-xs text-gray-500">Reservas</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{requestsCount || 0}</p>
                  <p className="text-xs text-gray-500">Solicitudes</p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button onClick={() => router.push('/dashboard')} className="text-sm text-left text-[#FF6900] font-medium">
                  Ver mi dashboard
                </button>
                <button onClick={() => router.push('/dashboard/addresses')} className="text-sm text-left text-gray-600">
                  Mis direcciones
                </button>
                {isPartner && (
                  <button onClick={() => router.push('/partner')} className="text-sm text-left text-gray-600">
                    Panel de partner
                  </button>
                )}
              </div>
            </div>
          </aside>

          <div className="flex-1 order-1 lg:order-1">

          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-[#FF2D55] to-[#FF6900] px-6 py-8">
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
                <div className="relative">
                  {image ? (
                    <img
                      src={image}
                      alt="Profile"
                      className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-[#FF2D55] to-[#FF6900] rounded-full flex items-center justify-center text-white text-3xl sm:text-4xl font-bold">
                      {name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  )}
                  <input
                    type="file"
                    id="profile-image"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploadingImage}
                  />
                  <label
                    htmlFor="profile-image"
                    className={`absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-lg border-2 border-gray-200 hover:bg-gray-50 transition cursor-pointer ${
                      uploadingImage ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    title="Cambiar foto"
                  >
                    {uploadingImage ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#FF6900]"></div>
                    ) : (
                      <Camera size={20} className="text-gray-600" />
                    )}
                  </label>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre completo
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User size={20} className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF6900] focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail size={20} className="text-gray-400" />
                    </div>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      disabled
                      className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                    />
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    El correo electrónico no se puede modificar
                  </p>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className={`flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#FF2D55] to-[#FF6900] text-white rounded-lg hover:from-[#FF1D45] hover:to-[#FF5900] transition font-medium shadow-lg ${
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
                    <ChevronRight className="text-gray-400 group-hover:text-[#FF6900] transition-colors" size={20} />
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
                    <ChevronRight className="text-gray-400 group-hover:text-[#FF6900] transition-colors" size={20} />
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
                    <div className={`p-3 rounded-xl ${partnerData?.verified ? 'bg-gradient-to-br from-green-500 to-green-600' : 'bg-gradient-to-br from-gray-400 to-gray-500'}`}>
                      <Shield className="text-white" size={24} />
                    </div>
                    <ChevronRight className="text-gray-400 group-hover:text-[#FF6900] transition-colors" size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Verificación</h3>
                  <p className={`text-2xl font-bold mb-2 ${partnerData?.verified ? 'text-green-600' : 'text-gray-600'}`}>
                    {partnerData?.verified ? 'Verificado' : 'Pendiente'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {partnerData?.verified ? 'Perfil verificado' : 'Completa tu verificación'}
                  </p>
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
                    <ChevronRight className="text-gray-400 group-hover:text-[#FF6900] transition-colors" size={20} />
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
                    <ChevronRight className="text-gray-400 group-hover:text-[#FF6900] transition-colors" size={20} />
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
