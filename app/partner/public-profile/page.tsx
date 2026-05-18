'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Copy, Check, Share2, ExternalLink, Trash2, Upload, Eye, EyeOff,
  MessageCircle, Loader2, Camera, RefreshCw, Globe, Link2,
} from 'lucide-react'
import { normalizeSlug } from '@/lib/slug'
import QrCode from '@/components/QrCode'
import PartnerHeader from '@/components/partner/PartnerHeader'

type WorkPhoto = { id: string; url: string; caption: string | null; order: number }
type Profile = {
  id: string
  slug: string | null
  isPublicProfile: boolean
  profileHeadline: string | null
  bio: string | null
  user?: { name: string | null; image: string | null }
  workPhotos: WorkPhoto[]
}

export default function PartnerPublicProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [photos, setPhotos] = useState<WorkPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; msg: string } | null>(null)
  const [photoFeedback, setPhotoFeedback] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [qrKey, setQrKey] = useState(0)

  const [headline, setHeadline] = useState('')
  const [bio, setBio] = useState('')
  const [slug, setSlug] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [slugError, setSlugError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const profileUrl = slug ? `https://www.lohaggo.com/pro/${slug}` : null
  const waShareUrl = profileUrl
    ? `https://wa.me/?text=${encodeURIComponent(`¡Mira mi perfil en LoHaggo y contrata mis servicios! ${profileUrl}`)}`
    : null

  const load = async () => {
    setLoading(true)
    try {
      const [pRes, phRes] = await Promise.all([
        fetch('/api/partner/public-profile'),
        fetch('/api/partner/work-photos'),
      ])
      const [pData, phData] = await Promise.all([pRes.json(), phRes.json()])
      const p: Profile = pData.partner
      setProfile(p)
      setHeadline(p.profileHeadline ?? '')
      setBio(p.bio ?? '')
      setSlug(p.slug ?? '')
      setIsPublic(p.isPublicProfile)
      setPhotos(phData.photos ?? [])

      if (!p.slug) {
        const res = await fetch('/api/partner/public-profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        const data = await res.json()
        if (data.partner?.slug) setSlug(data.partner.slug)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const save = async () => {
    setSaving(true)
    setFeedback(null)
    setSlugError(null)
    const normalized = normalizeSlug(slug)
    if (slug && normalized.length < 3) {
      setSlugError('El slug debe tener al menos 3 caracteres')
      setSaving(false)
      return
    }
    try {
      const res = await fetch('/api/partner/public-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileHeadline: headline, bio, slug: normalized || slug, isPublicProfile: isPublic }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409) setSlugError(data.error)
        else setFeedback({ type: 'error', msg: data.error ?? 'Error al guardar' })
        return
      }
      setSlug(data.partner.slug ?? slug)
      setQrKey((k) => k + 1)
      setFeedback({ type: 'ok', msg: 'Perfil actualizado' })
      setTimeout(() => setFeedback(null), 3000)
    } finally {
      setSaving(false)
    }
  }

  const togglePublic = async () => {
    const next = !isPublic
    setIsPublic(next)
    await fetch('/api/partner/public-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPublicProfile: next }),
    })
  }

  const regenerateSlug = async () => {
    const res = await fetch('/api/partner/public-profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: '' }),
    })
    const data = await res.json()
    if (data.partner?.slug) {
      setSlug(data.partner.slug)
      setQrKey((k) => k + 1)
    }
  }

  const uploadPhoto = async (file: File) => {
    if (photos.length >= 10) { setPhotoFeedback('Máximo 10 fotos'); return }
    setUploadingPhoto(true)
    setPhotoFeedback(null)
    try {
      const fd = new FormData()
      fd.append('photo', file)
      const res = await fetch('/api/partner/work-photos', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setPhotoFeedback(data.error ?? 'Error al subir foto'); return }
      setPhotos((prev) => [...prev, data.photo])
    } finally {
      setUploadingPhoto(false)
    }
  }

  const deletePhoto = async (id: string) => {
    const res = await fetch(`/api/partner/work-photos/${id}`, { method: 'DELETE' })
    if (res.ok) setPhotos((prev) => prev.filter((p) => p.id !== id))
  }

  const copyLink = async () => {
    if (!profileUrl) return
    await navigator.clipboard.writeText(profileUrl).catch(() => null)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PartnerHeader
        title="Mi perfil público"
        subtitle="Comparte tu link y atrae nuevos clientes"
        activeTab="public-profile"
        showNavigation={true}
      />

      {loading ? (
        <div className="flex items-center justify-center py-32 text-gray-400">
          <Loader2 className="animate-spin mr-3" /> Cargando perfil…
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">

            {/* LEFT COLUMN */}
            <div className="space-y-5">

              {/* Visibility + preview bar */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${isPublic ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                  <span className="text-sm font-semibold text-gray-700">
                    {isPublic ? 'Perfil visible al público' : 'Perfil oculto'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={togglePublic}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                      isPublic
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {isPublic ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    {isPublic ? 'Visible' : 'Oculto'}
                  </button>
                  {slug && (
                    <a
                      href={`/pro/${slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" /> Ver mi perfil
                    </a>
                  )}
                </div>
              </div>

              {/* Profile info */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
                <h2 className="font-bold text-gray-900 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary-500" /> Información del perfil
                </h2>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Titular</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400 outline-none"
                    placeholder="Ej: Electricista certificado con 10 años de experiencia"
                    value={headline}
                    maxLength={120}
                    onChange={(e) => setHeadline(e.target.value)}
                  />
                  <p className="text-xs text-gray-400 text-right">{headline.length}/120</p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Sobre mí</label>
                  <textarea
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400 outline-none resize-none min-h-[120px]"
                    placeholder="Cuéntales a tus clientes sobre tu experiencia, especialidades y por qué deben contratarte…"
                    value={bio}
                    maxLength={800}
                    onChange={(e) => setBio(e.target.value)}
                  />
                  <p className="text-xs text-gray-400 text-right">{bio.length}/800</p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">URL personalizada</label>
                  <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary-400 focus-within:border-primary-400">
                    <span className="px-3 py-2.5 bg-gray-50 text-gray-500 text-sm border-r border-gray-200 select-none whitespace-nowrap">
                      lohaggo.com/pro/
                    </span>
                    <input
                      className="flex-1 px-3 py-2.5 text-sm outline-none bg-white min-w-0"
                      placeholder="tu-nombre-ciudad"
                      value={slug}
                      onChange={(e) => { setSlug(e.target.value); setSlugError(null) }}
                      onBlur={(e) => setSlug(normalizeSlug(e.target.value) || slug)}
                    />
                    <button
                      onClick={regenerateSlug}
                      title="Generar URL automática"
                      className="px-3 py-2.5 text-gray-400 hover:text-primary-600 transition-colors border-l border-gray-200"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                  {slugError && <p className="text-xs text-red-600">{slugError}</p>}
                  <p className="text-xs text-gray-400">
                    Solo letras, números y guiones. Usa <RefreshCw className="w-3 h-3 inline" /> para generar automáticamente.
                  </p>
                </div>

                {feedback && (
                  <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
                    feedback.type === 'ok'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {feedback.msg}
                  </div>
                )}

                <button
                  onClick={save}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
                >
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</> : 'Guardar cambios'}
                </button>
              </div>

              {/* Work photos */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-gray-900 flex items-center gap-2">
                      <Camera className="w-4 h-4 text-primary-500" /> Fotos de mis trabajos
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">{photos.length}/10 · Los clientes ven la calidad de tu trabajo</p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto || photos.length >= 10}
                    className="flex items-center gap-2 bg-primary-50 hover:bg-primary-100 text-primary-700 font-semibold px-4 py-2 rounded-xl text-sm transition-colors disabled:opacity-50"
                  >
                    {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {uploadingPhoto ? 'Subiendo…' : 'Agregar'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    multiple
                    onChange={async (e) => {
                      const files = Array.from(e.target.files ?? [])
                      for (const file of files.slice(0, 10 - photos.length)) await uploadPhoto(file)
                      e.target.value = ''
                    }}
                  />
                </div>

                {photoFeedback && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{photoFeedback}</p>
                )}

                {photos.length === 0 && !uploadingPhoto ? (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-200 rounded-xl py-12 flex flex-col items-center gap-2 text-gray-400 hover:border-primary-300 hover:text-primary-500 transition-colors"
                  >
                    <Camera className="w-8 h-8" />
                    <span className="text-sm font-medium">Sube fotos de tus trabajos</span>
                    <span className="text-xs">JPG, PNG · máx 8MB</span>
                  </button>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {photos.map((photo) => (
                      <div key={photo.id} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-100">
                        <img src={photo.url} alt={photo.caption ?? 'Trabajo'} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            onClick={() => deletePhoto(photo.id)}
                            className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-xl transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {uploadingPhoto && (
                      <div className="aspect-square rounded-xl border-2 border-dashed border-primary-200 bg-primary-50 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN — share / QR */}
            <div className="space-y-5">

              {/* QR card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-gray-900">Código QR</h2>
                  {profileUrl && (
                    <button
                      onClick={() => setQrKey((k) => k + 1)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-primary-600 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Regenerar
                    </button>
                  )}
                </div>

                {profileUrl ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                      <QrCode key={qrKey} url={profileUrl} size={200} />
                    </div>
                    <p className="text-xs text-gray-500 text-center">
                      Imprime o comparte este código para que los clientes lleguen directo a tu perfil.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
                    <Globe className="w-10 h-10" />
                    <p className="text-sm">Guarda tu perfil para generar el QR</p>
                  </div>
                )}
              </div>

              {/* Share card */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <h2 className="font-bold text-gray-900 flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-primary-500" /> Compartir mi perfil
                </h2>

                {profileUrl ? (
                  <>
                    {/* Link bar */}
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                      <Link2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="flex-1 text-sm text-gray-700 truncate font-mono">lohaggo.com/pro/{slug}</span>
                      <button
                        onClick={copyLink}
                        className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors"
                      >
                        {copied ? <><Check className="w-4 h-4 text-emerald-500" /> Copiado</> : <><Copy className="w-4 h-4" /> Copiar</>}
                      </button>
                    </div>

                    {/* Action buttons */}
                    <div className="space-y-2">
                      <a
                        href={waShareUrl!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold py-3 rounded-xl text-sm transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" /> Compartir por WhatsApp
                      </a>
                      <button
                        onClick={copyLink}
                        className="flex items-center justify-center gap-2 w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl text-sm transition-colors"
                      >
                        {copied ? <><Check className="w-4 h-4 text-emerald-500" /> Link copiado</> : <><Copy className="w-4 h-4" /> Copiar link</>}
                      </button>
                      {slug && (
                        <a
                          href={`/pro/${slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 w-full bg-primary-50 hover:bg-primary-100 text-primary-700 font-semibold py-3 rounded-xl text-sm transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" /> Ver como cliente
                        </a>
                      )}
                    </div>

                    <div className="text-xs text-gray-400 text-center">
                      Comparte tu perfil en redes sociales, WhatsApp o imprime el QR para atraer nuevos clientes.
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">
                    Guarda tu perfil para obtener tu link de compartir.
                  </p>
                )}
              </div>

              {/* Stats hint */}
              {profile && (
                <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-2xl border border-primary-200 p-5 space-y-2">
                  <p className="text-sm font-bold text-primary-800">Consejos para destacar</p>
                  <ul className="space-y-1.5 text-xs text-primary-700">
                    <li className="flex items-start gap-1.5">
                      <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0" />
                      Sube al menos 5 fotos de tus trabajos terminados
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0" />
                      Escribe un titular claro con tu especialidad
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0" />
                      Comparte tu link en tu estado de WhatsApp
                    </li>
                    <li className="flex items-start gap-1.5">
                      <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0" />
                      Imprime el QR y pégalo en tu negocio o vehículo
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
