'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { User, Mail, Camera, Save, AlertCircle, CheckCircle, Star, MapPin, Shield, Briefcase, ChevronRight, CreditCard, GraduationCap, Phone, Landmark, Bell, Globe, Eye, EyeOff, Copy, Check, MessageCircle, ExternalLink, Upload, Trash2, RefreshCw, Link2 } from 'lucide-react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import AccountTopHeader from '@/components/shared/AccountTopHeader'
import AccountPanel from '@/components/shared/AccountPanel'
import QrCode from '@/components/QrCode'
import { normalizeSlug } from '@/lib/slug'

type NotificationPreference = {
  channel: 'PUSH' | 'EMAIL' | 'WHATSAPP' | 'SMS'
  enabledByAdmin: boolean
  enabledByUser: boolean
  effectiveEnabled: boolean
}

export default function ProfilePage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
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
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreference[]>([])
  const [loadingPrefs, setLoadingPrefs] = useState(false)
  const [savingChannel, setSavingChannel] = useState<NotificationPreference['channel'] | null>(null)
  const [prefsMessage, setPrefsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Public profile state (partners only)
  const [pubSlug, setPubSlug] = useState('')
  const [pubHeadline, setPubHeadline] = useState('')
  const [pubBio, setPubBio] = useState('')
  const [pubIsPublic, setPubIsPublic] = useState(true)
  const [pubPhotos, setPubPhotos] = useState<{ id: string; url: string }[]>([])
  const [pubCopied, setPubCopied] = useState(false)
  const [pubSaving, setPubSaving] = useState(false)
  const [pubFeedback, setPubFeedback] = useState<{ type: 'ok' | 'error'; msg: string } | null>(null)
  const [pubSlugError, setPubSlugError] = useState<string | null>(null)
  const [pubUploadingPhoto, setPubUploadingPhoto] = useState(false)
  const [pubQrKey, setPubQrKey] = useState(0)
  const [pubLoaded, setPubLoaded] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const isPartner = session?.user?.role === 'PARTNER'
  const pubProfileUrl = pubSlug ? `https://www.lohaggo.com/pro/${pubSlug}` : null
  const {
    isSupported: pushSupported,
    isSubscribed: pushSubscribed,
    subscribeToPush,
    unsubscribeFromPush,
  } = usePushNotifications()

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

  const fetchPublicProfile = async () => {
    try {
      const [pRes, phRes] = await Promise.all([
        fetch('/api/partner/public-profile'),
        fetch('/api/partner/work-photos'),
      ])
      const [pData, phData] = await Promise.all([pRes.json(), phRes.json()])
      const p = pData.partner
      setPubSlug(p.slug ?? '')
      setPubHeadline(p.profileHeadline ?? '')
      setPubBio(p.bio ?? '')
      setPubIsPublic(p.isPublicProfile)
      setPubPhotos(phData.photos ?? [])
      setPubLoaded(true)
      if (!p.slug) {
        const res = await fetch('/api/partner/public-profile', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
        })
        const data = await res.json()
        if (data.partner?.slug) setPubSlug(data.partner.slug)
      }
    } catch { /* ignore */ }
  }

  const fetchNotificationPreferences = async () => {
    setLoadingPrefs(true)
    try {
      const res = await fetch('/api/notifications/preferences', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setNotificationPrefs(Array.isArray(data?.channels) ? data.channels : [])
    } catch (error) {
      console.error('Error fetching notification preferences:', error)
    } finally {
      setLoadingPrefs(false)
    }
  }

  const updateChannelPreference = async (
    channel: NotificationPreference['channel'],
    enabled: boolean
  ) => {
    setSavingChannel(channel)
    setPrefsMessage(null)

    try {
      if (channel === 'PUSH' && enabled) {
        const subscribed = await subscribeToPush()
        if (!subscribed) {
          setPrefsMessage({ type: 'error', text: 'No se pudo activar push. Verifica permisos del navegador.' })
          return
        }
      }

      if (channel === 'PUSH' && !enabled) {
        await unsubscribeFromPush()
      }

      const response = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, enabled }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        setPrefsMessage({ type: 'error', text: payload?.error || 'No se pudo actualizar este canal.' })
        return
      }

      setNotificationPrefs(Array.isArray(payload?.channels) ? payload.channels : [])
      setPrefsMessage({ type: 'success', text: 'Preferencias actualizadas.' })
    } catch (error) {
      console.error('Error updating notification channel preference:', error)
      setPrefsMessage({ type: 'error', text: 'Error al actualizar preferencias.' })
    } finally {
      setSavingChannel(null)
    }
  }

  useEffect(() => {
    if (session?.user) {
      setName(session.user.name || '')
      setEmail(session.user.email || '')
      setPhone(session.user.phone || '')
      setImage(session.user.image || null)
      fetchCounts()
      fetchNotificationPreferences()

      if (session.user.role === 'PARTNER') {
        fetchPartnerData()
        fetchPublicProfile()
      } else {
        fetchClientData()
      }
    }
  }, [session, status, router])

  const savePubProfile = async () => {
    setPubSaving(true)
    setPubFeedback(null)
    setPubSlugError(null)
    const normalized = normalizeSlug(pubSlug)
    if (pubSlug && normalized.length < 3) {
      setPubSlugError('El slug debe tener al menos 3 caracteres')
      setPubSaving(false)
      return
    }
    try {
      const res = await fetch('/api/partner/public-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileHeadline: pubHeadline, bio: pubBio, slug: normalized || pubSlug, isPublicProfile: pubIsPublic }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409) setPubSlugError(data.error)
        else setPubFeedback({ type: 'error', msg: data.error ?? 'Error al guardar' })
        return
      }
      setPubSlug(data.partner.slug ?? pubSlug)
      setPubQrKey((k) => k + 1)
      setPubFeedback({ type: 'ok', msg: 'Perfil público actualizado' })
      setTimeout(() => setPubFeedback(null), 3000)
    } finally {
      setPubSaving(false)
    }
  }

  const togglePubPublic = async () => {
    const next = !pubIsPublic
    setPubIsPublic(next)
    await fetch('/api/partner/public-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublicProfile: next }),
    })
  }

  const regeneratePubSlug = async () => {
    const res = await fetch('/api/partner/public-profile', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: '' }),
    })
    const data = await res.json()
    if (data.partner?.slug) { setPubSlug(data.partner.slug); setPubQrKey((k) => k + 1) }
  }

  const uploadPubPhoto = async (file: File) => {
    if (pubPhotos.length >= 10) return
    setPubUploadingPhoto(true)
    try {
      const fd = new FormData()
      fd.append('photo', file)
      const res = await fetch('/api/partner/work-photos', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) setPubPhotos((prev) => [...prev, data.photo])
    } finally {
      setPubUploadingPhoto(false)
    }
  }

  const deletePubPhoto = async (id: string) => {
    const res = await fetch(`/api/partner/work-photos/${id}`, { method: 'DELETE' })
    if (res.ok) setPubPhotos((prev) => prev.filter((p) => p.id !== id))
  }

  const copyPubLink = async () => {
    if (!pubProfileUrl) return
    await navigator.clipboard.writeText(pubProfileUrl).catch(() => null)
    setPubCopied(true)
    setTimeout(() => setPubCopied(false), 2500)
  }

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
        body: JSON.stringify({ name, phone, image: imageUrl }),
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
        body: JSON.stringify({ name, phone }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al actualizar el perfil')
      }

      await update({ name: data.name, phone: data.phone, image: data.image })
      setMessage({ type: 'success', text: 'Perfil actualizado exitosamente' })
      setName(data.name || name)
      setPhone(data.phone || phone)
      setImage(data.image ?? image)
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="panel-page min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary-500"></div>
      </div>
    )
  }

  return (
    <div className="account-shell">
      <AccountTopHeader
        role={isPartner ? 'PARTNER' : 'CLIENT'}
        title="Mi Perfil"
        subtitle="Administra tu información personal"
        counts={
          isPartner
            ? {
                bookings: bookingsCount,
                requests: requestsCount
              }
            : {
                bookings: bookingsCount,
                requests: requestsCount,
                favorites: favoritesCount
              }
        }
      />

      <main className="account-main">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-6">
            <AccountPanel noPadding>
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
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                      Teléfono
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                      <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel-national"
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+57 300 123 4567"
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-secondary-500 focus:border-transparent"
                      />
                    </div>
                    <p className="mt-2 text-sm text-gray-500">Formato: +57 seguido del número (ej: +57 300 123 4567)</p>
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

                <div className="mt-10 border-t border-gray-100 pt-8">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
                      <Bell size={18} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Canales de notificación</h3>
                      <p className="text-sm text-gray-600">
                        Activa o desactiva cómo quieres recibir avisos. Solo se pueden modificar canales habilitados por administración.
                      </p>
                    </div>
                  </div>

                  {prefsMessage && (
                    <div
                      className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
                        prefsMessage.type === 'success'
                          ? 'border-green-200 bg-green-50 text-green-700'
                          : 'border-red-200 bg-red-50 text-red-700'
                      }`}
                    >
                      {prefsMessage.text}
                    </div>
                  )}

                  <div className="space-y-3">
                    {loadingPrefs ? (
                      <div className="text-sm text-gray-500">Cargando preferencias...</div>
                    ) : (
                      notificationPrefs.map((pref) => {
                        const isPushChannel = pref.channel === 'PUSH'
                        const channelName =
                          pref.channel === 'PUSH'
                            ? 'Push'
                            : pref.channel === 'EMAIL'
                            ? 'Email'
                            : pref.channel === 'WHATSAPP'
                            ? 'WhatsApp'
                            : 'SMS'
                        const helper =
                          pref.channel === 'PUSH'
                            ? pushSupported
                              ? pushSubscribed
                                ? 'Suscripción push activa en este dispositivo.'
                                : 'Activa push para recibir alertas en tiempo real.'
                              : 'Tu navegador no soporta notificaciones push.'
                            : pref.enabledByAdmin
                            ? 'Canal habilitado para tu tipo de cuenta.'
                            : 'Canal desactivado por LoHaggo.'

                        const disabled = !pref.enabledByAdmin || savingChannel === pref.channel || (isPushChannel && !pushSupported)

                        return (
                          <div key={pref.channel} className="rounded-xl border border-gray-200 px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-medium text-gray-900">{channelName}</p>
                                <p className="text-xs text-gray-500">{helper}</p>
                              </div>
                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() => updateChannelPreference(pref.channel, !pref.enabledByUser)}
                                className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                                  pref.enabledByUser ? 'bg-secondary-500' : 'bg-gray-300'
                                } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                              >
                                <span
                                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                                    pref.enabledByUser ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            </div>
                            {!pref.enabledByAdmin && (
                              <p className="mt-2 text-xs text-amber-700">Este canal no está disponible para tu cuenta por configuración de LoHaggo.</p>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            </AccountPanel>

            {/* Public profile section — partners only */}
            {isPartner && pubLoaded && (
              <AccountPanel noPadding>
                <div className="bg-gradient-to-r from-primary-600 to-primary-800 px-6 py-6">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Globe className="w-5 h-5" /> Perfil Público
                      </h2>
                      <p className="text-white/80 text-sm mt-0.5">Tu página personal para compartir con clientes</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={togglePubPublic}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                          pubIsPublic ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-white/10 text-white/60 hover:bg-white/20'
                        }`}
                      >
                        {pubIsPublic ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        {pubIsPublic ? 'Visible' : 'Oculto'}
                      </button>
                      {pubSlug && (
                        <a
                          href={`/pro/${pubSlug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-white text-primary-700 hover:bg-white/90 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" /> Ver perfil
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-6 space-y-5">

                  {/* QR + share — mobile: full width card at top; desktop: floats right via grid */}
                  {pubProfileUrl && (
                    <div className="lg:float-right lg:ml-6 lg:mb-2 lg:w-64">
                      <div className="bg-gray-50 rounded-2xl border border-gray-100 p-4 flex flex-col items-center gap-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tu código QR</p>
                        <QrCode key={pubQrKey} url={pubProfileUrl} size={180} />
                        <button
                          onClick={() => setPubQrKey((k) => k + 1)}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600 transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" /> Regenerar
                        </button>
                      </div>

                      {/* Share actions */}
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                          <Link2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="flex-1 text-xs text-gray-700 truncate font-mono min-w-0">lohaggo.com/pro/{pubSlug}</span>
                          <button onClick={copyPubLink} className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 ml-1">
                            {pubCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(`¡Mira mi perfil en LoHaggo y contrata mis servicios! ${pubProfileUrl}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" /> WhatsApp
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Form fields */}
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">Titular</label>
                      <input
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400 outline-none"
                        placeholder="Ej: Electricista certificado con 10 años de experiencia"
                        value={pubHeadline}
                        maxLength={120}
                        onChange={(e) => setPubHeadline(e.target.value)}
                      />
                      <p className="text-xs text-gray-400 text-right">{pubHeadline.length}/120</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">Sobre mí</label>
                      <textarea
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400 outline-none resize-none min-h-[90px]"
                        placeholder="Cuéntales sobre tu experiencia y especialidades…"
                        value={pubBio}
                        maxLength={800}
                        onChange={(e) => setPubBio(e.target.value)}
                      />
                      <p className="text-xs text-gray-400 text-right">{pubBio.length}/800</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">URL personalizada</label>
                      <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary-400 focus-within:border-primary-400">
                        <span className="px-2.5 py-2.5 bg-gray-50 text-gray-500 text-xs border-r border-gray-200 select-none whitespace-nowrap">lohaggo.com/pro/</span>
                        <input
                          className="flex-1 px-3 py-2.5 text-sm outline-none bg-white min-w-0"
                          placeholder="tu-nombre"
                          value={pubSlug}
                          onChange={(e) => { setPubSlug(e.target.value); setPubSlugError(null) }}
                          onBlur={(e) => setPubSlug(normalizeSlug(e.target.value) || pubSlug)}
                        />
                        <button onClick={regeneratePubSlug} title="Generar URL automática" className="px-3 py-2.5 text-gray-400 hover:text-primary-600 transition-colors border-l border-gray-200">
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>
                      {pubSlugError && <p className="text-xs text-red-600">{pubSlugError}</p>}
                    </div>

                    {pubFeedback && (
                      <div className={`rounded-xl px-4 py-3 text-sm font-medium ${pubFeedback.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {pubFeedback.msg}
                      </div>
                    )}

                    <button
                      onClick={savePubProfile}
                      disabled={pubSaving}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-700 text-white font-semibold rounded-xl transition hover:shadow-lg disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {pubSaving ? 'Guardando…' : 'Guardar perfil público'}
                    </button>
                  </div>

                  {/* Work photos — full width below, clears float */}
                  <div className="clear-both pt-4 border-t border-gray-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-700">
                        Fotos de mis trabajos <span className="text-gray-400 font-normal">({pubPhotos.length}/10)</span>
                      </p>
                      <button
                        onClick={() => photoInputRef.current?.click()}
                        disabled={pubUploadingPhoto || pubPhotos.length >= 10}
                        className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 disabled:opacity-50 transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" /> Agregar
                      </button>
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={async (e) => {
                          const files = Array.from(e.target.files ?? [])
                          for (const file of files.slice(0, 10 - pubPhotos.length)) await uploadPubPhoto(file)
                          e.target.value = ''
                        }}
                      />
                    </div>
                    {pubPhotos.length === 0 && !pubUploadingPhoto ? (
                      <button
                        onClick={() => photoInputRef.current?.click()}
                        className="w-full border-2 border-dashed border-gray-200 rounded-xl py-8 flex flex-col items-center gap-1.5 text-gray-400 hover:border-primary-300 hover:text-primary-500 transition-colors text-sm"
                      >
                        <Camera className="w-6 h-6" /> Sube fotos de tus trabajos
                      </button>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                        {pubPhotos.map((photo) => (
                          <div key={photo.id} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-100">
                            <img src={photo.url} alt="Trabajo" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button onClick={() => deletePubPhoto(photo.id)} className="bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-lg">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                        {pubUploadingPhoto && (
                          <div className="aspect-square rounded-lg border-2 border-dashed border-primary-200 bg-primary-50 flex items-center justify-center">
                            <RefreshCw className="w-4 h-4 text-primary-400 animate-spin" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </AccountPanel>
            )}
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
                  onClick={() => router.push('/partner/bank-accounts')}
                  className="w-full bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 text-left group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl">
                      <Landmark className="text-white" size={24} />
                    </div>
                    <ChevronRight className="text-gray-400 group-hover:text-secondary-600 transition-colors" size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Datos Bancarios</h3>
                  <p className="text-sm text-gray-600 mb-3">Registra y administra tus cuentas para recibir pagos.</p>
                  <div className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                    Configurar ahora
                  </div>
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
                  onClick={() => router.push('/my-ratings?view=client')}
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
