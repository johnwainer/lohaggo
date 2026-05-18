'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  MapPin, Star, CheckCircle, Share2, Copy, Check, MessageCircle,
  Briefcase, Calendar, X, ChevronRight, ExternalLink,
} from 'lucide-react'
import QrCode from '@/components/QrCode'

type Service = { id: string; name: string; icon: string; slug: string; price: number }
type WorkPhoto = { id: string; url: string; caption: string | null }
type Achievement = { id: string; name: string; icon: string; type: string; unlockedAt: string }
type Review = {
  id: string
  rating: number
  comment: string | null
  reviewedAt: string | null
  service: string | null
  reviewer: { name: string; image: string | null }
}

type Partner = {
  id: string
  slug: string
  name: string
  image: string | null
  city: string
  cityName: string
  bio: string | null
  profileHeadline: string | null
  rating: number
  totalReviews: number
  completedServicesCount: number
  verified: boolean
  createdAt: string
  services: Service[]
  workPhotos: WorkPhoto[]
  achievements: Achievement[]
  reviews: Review[]
}

function Stars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'w-6 h-6' : 'w-4 h-4'
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={`${cls} ${i <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-300'} fill-current`}
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

function Avatar({
  name,
  image,
  size = 'md',
}: {
  name: string
  image: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-28 h-28 text-4xl',
  }
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
  if (image)
    return (
      <img
        src={image}
        alt={name}
        className={`${sizes[size]} rounded-full object-cover flex-shrink-0`}
      />
    )
  return (
    <div
      className={`${sizes[size]} rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold flex-shrink-0`}
    >
      {initials}
    </div>
  )
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(price)
}

function formatDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-CO', { year: 'numeric', month: 'short' })
}

export default function ProfileClient({ partner }: { partner: Partner }) {
  const profileUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/pro/${partner.slug}`
      : `https://www.lohaggo.com/pro/${partner.slug}`

  const [copied, setCopied] = useState(false)
  const [lightbox, setLightbox] = useState<WorkPhoto | null>(null)
  const [shareOpen, setShareOpen] = useState(false)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const waLink = `https://wa.me/?text=${encodeURIComponent(
    `¡Mira el perfil de ${partner.name} en LoHaggo! ${profileUrl}`
  )}`
const ratingDist = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: partner.reviews.filter((r) => r.rating === stars).length,
  }))
  const joinYear = new Date(partner.createdAt).getFullYear()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HERO */}
      <div className="bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        <div className="relative max-w-4xl mx-auto px-4 py-10 pb-16">
          {/* Back */}
          <Link
            href="/servicios"
            className="inline-flex items-center gap-1 text-primary-200 hover:text-white text-sm mb-8 transition-colors"
          >
            ← Explorar servicios
          </Link>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Photo */}
            <div className="relative flex-shrink-0">
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full ring-4 ring-white ring-offset-4 ring-offset-primary-800 overflow-hidden bg-primary-200">
                {partner.image ? (
                  <img
                    src={partner.image}
                    alt={partner.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-primary-700">
                    {partner.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                )}
              </div>
              {partner.verified && (
                <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-1.5 ring-2 ring-primary-800">
                  <CheckCircle className="w-4 h-4 text-white fill-white" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                {partner.verified && (
                  <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                    <CheckCircle className="w-3 h-3" /> Verificado
                  </span>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">{partner.name}</h1>
              {partner.profileHeadline && (
                <p className="text-primary-200 text-lg mb-3 font-medium">
                  {partner.profileHeadline}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-4">
                <div className="flex items-center gap-1.5">
                  <Stars rating={partner.rating} />
                  <span className="text-white font-bold">{partner.rating.toFixed(1)}</span>
                  <span className="text-primary-300 text-sm">({partner.totalReviews} reseñas)</span>
                </div>
                <span className="text-primary-400">·</span>
                <div className="flex items-center gap-1 text-primary-200">
                  <MapPin className="w-4 h-4" />
                  <span>{partner.cityName}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <Link
                  href="/servicios"
                  className="inline-flex items-center gap-2 bg-white text-primary-700 hover:bg-primary-50 font-bold px-5 py-2.5 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95"
                >
                  Contratar <ChevronRight className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => setShareOpen(true)}
                  className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold px-5 py-2.5 rounded-xl transition-all backdrop-blur-sm"
                >
                  <Share2 className="w-4 h-4" /> Compartir
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* STATS BAR */}
      <div className="max-w-4xl mx-auto px-4 -mt-6 mb-6 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 grid grid-cols-3 divide-x divide-gray-100 overflow-hidden">
          {[
            { icon: Briefcase, label: 'Servicios', value: partner.completedServicesCount },
            { icon: Star, label: 'Calificación', value: `${partner.rating.toFixed(1)}★` },
            { icon: Calendar, label: 'Miembro desde', value: joinYear },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex flex-col items-center py-4 px-3">
              <Icon className="w-5 h-5 text-primary-500 mb-1" />
              <span className="text-xl font-black text-gray-900">{value}</span>
              <span className="text-xs text-gray-500 mt-0.5">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-24 space-y-6">
        {/* BIO */}
        {partner.bio && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Sobre mí</h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{partner.bio}</p>
          </section>
        )}

        {/* SERVICES */}
        {partner.services.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Servicios que ofrezco</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {partner.services.map((s) => (
                <Link
                  key={s.id}
                  href={`/servicios/${s.slug}`}
                  className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-primary-200 hover:bg-primary-50 transition-all group"
                >
                  <span className="text-2xl">{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{s.name}</p>
                    <p className="text-primary-600 font-bold text-sm">desde {formatPrice(s.price)}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-primary-500 transition-colors flex-shrink-0" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* PORTFOLIO */}
        {partner.workPhotos.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Mis trabajos</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {partner.workPhotos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => setLightbox(photo)}
                  className="relative aspect-square rounded-xl overflow-hidden group focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <img
                    src={photo.url}
                    alt={photo.caption ?? 'Trabajo'}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {photo.caption && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                      <span className="text-white text-xs font-medium line-clamp-2">
                        {photo.caption}
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* REVIEWS */}
        {partner.reviews.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Reseñas</h2>
              <span className="text-sm text-gray-500">{partner.totalReviews} en total</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-6">
              {/* Rating breakdown */}
              <div className="sm:w-44 flex-shrink-0">
                <div className="text-center mb-3">
                  <span className="text-5xl font-black text-gray-900">
                    {partner.rating.toFixed(1)}
                  </span>
                  <div className="flex justify-center mt-1">
                    <Stars rating={partner.rating} size="sm" />
                  </div>
                </div>
                <div className="space-y-1">
                  {ratingDist.map(({ stars, count }) => (
                    <div key={stars} className="flex items-center gap-2 text-xs">
                      <span className="text-gray-600 w-3">{stars}</span>
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-400 rounded-full transition-all"
                          style={{
                            width: `${
                              partner.reviews.length
                                ? (count / partner.reviews.length) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-gray-500 w-4 text-right">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Review cards */}
              <div className="flex-1 space-y-4 min-w-0">
                {partner.reviews.map((r) => (
                  <div key={r.id} className="border border-gray-100 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <Avatar name={r.reviewer.name} image={r.reviewer.image} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-semibold text-sm text-gray-900 truncate">
                            {r.reviewer.name}
                          </span>
                          {r.service && (
                            <span className="text-xs text-gray-500 truncate">· {r.service}</span>
                          )}
                          {r.reviewedAt && (
                            <span className="text-xs text-gray-400 ml-auto">
                              {formatDate(r.reviewedAt)}
                            </span>
                          )}
                        </div>
                        <div className="mb-2">
                          <Stars rating={r.rating} />
                        </div>
                        {r.comment && (
                          <p className="text-sm text-gray-700 leading-relaxed">{r.comment}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ACHIEVEMENTS */}
        {partner.achievements.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Logros</h2>
            <div className="flex flex-wrap gap-3">
              {partner.achievements.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2"
                >
                  <span className="text-xl">{a.icon}</span>
                  <div>
                    <p className="text-xs font-bold text-amber-900">{a.name}</p>
                    <p className="text-xs text-amber-600">{formatDate(a.unlockedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SHARE */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Compartir perfil</h2>
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                <span className="flex-1 text-sm text-gray-700 truncate font-mono">
                  lohaggo.com/pro/{partner.slug}
                </span>
                <button
                  onClick={copyLink}
                  className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" /> Copiar
                    </>
                  )}
                </button>
              </div>
              <div className="flex gap-2">
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20b558] text-white font-semibold px-4 py-2.5 rounded-xl transition-colors"
                >
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </a>
                <button
                  onClick={copyLink}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" /> ¡Copiado!
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4" /> Copiar link
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-400 text-center">
                Comparte tu perfil y atrae nuevos clientes directamente
              </p>
            </div>
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <QrCode url={profileUrl} size={128} className="rounded-xl border border-gray-200 overflow-hidden" />
            </div>
          </div>
        </section>
      </div>

      {/* LIGHTBOX */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
            onClick={() => setLightbox(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-2xl max-h-[85vh] flex flex-col gap-3"
          >
            <img
              src={lightbox.url}
              alt={lightbox.caption ?? ''}
              className="max-h-[75vh] object-contain rounded-xl"
            />
            {lightbox.caption && (
              <p className="text-white text-center text-sm">{lightbox.caption}</p>
            )}
          </div>
        </div>
      )}

      {/* SHARE MODAL */}
      {shareOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShareOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Compartir perfil</h3>
              <button
                onClick={() => setShareOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 border rounded-xl px-3 py-2.5">
              <span className="flex-1 text-sm text-gray-700 truncate">
                lohaggo.com/pro/{partner.slug}
              </span>
              <button
                onClick={copyLink}
                className="text-xs font-semibold text-primary-600"
              >
                {copied ? 'Copiado ✓' : 'Copiar'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-[#25D366] text-white font-semibold py-3 rounded-xl text-sm"
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
              <button
                onClick={copyLink}
                className="flex items-center justify-center gap-2 bg-primary-600 text-white font-semibold py-3 rounded-xl text-sm"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" /> Copiar link
                  </>
                )}
              </button>
            </div>
            <div className="flex flex-col items-center gap-2 pt-2">
              <QrCode url={profileUrl} size={144} className="rounded-xl border border-gray-200 overflow-hidden" />
            </div>
          </div>
        </div>
      )}

      {/* MOBILE STICKY CTA */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-xl z-40">
        <Link
          href="/servicios"
          className="flex items-center justify-center gap-2 w-full bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 rounded-xl transition-colors text-base"
        >
          Contratar a {partner.name.split(' ')[0]} <ChevronRight className="w-5 h-5" />
        </Link>
      </div>
    </div>
  )
}
