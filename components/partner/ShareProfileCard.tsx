'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, Download, Loader2, MessageCircle, Share2 } from 'lucide-react'
import { partnerShareUrl, type ShareMedium } from '@/lib/partners/share-url'

type Profile = { slug: string | null; isPublicProfile: boolean; verified: boolean }

const shareText = (url: string) => `¡Hola! Ahora puedes pedirme mis servicios por LoHaggo, con chat y confirmación de pago en la app. Mira mi perfil y escríbeme: ${url}`

/**
 * «Consigue más clientes»: the partner's public profile link ready to share (WhatsApp, native share,
 * copy) and a 9:16 image for statuses. Every link carries the partner-share tag for analytics.
 * `moment` turns the title into the ask right after a finished job.
 */
export default function ShareProfileCard({ moment, className = '' }: { moment?: { clientName?: string | null } | null; className?: string }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sharingImage, setSharingImage] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/partner/public-profile', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d?.partner) setProfile({ slug: d.partner.slug ?? null, isPublicProfile: d.partner.isPublicProfile !== false, verified: !!d.partner.verified }) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  if (!profile || !profile.verified || !profile.isPublicProfile) return null

  const url = (m: ShareMedium) => (profile.slug ? partnerShareUrl(profile.slug, m) : '')

  const createLink = async () => {
    setCreating(true)
    try {
      const r = await fetch('/api/partner/public-profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const d = await r.json().catch(() => null)
      if (d?.partner?.slug) setProfile({ ...profile, slug: d.partner.slug })
    } finally {
      setCreating(false)
    }
  }

  const copy = async () => {
    await navigator.clipboard?.writeText(url('enlace')).catch(() => null)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2500)
  }

  const nativeShare = async () => {
    const link = url('compartir')
    if (navigator.share) {
      await navigator.share({ title: 'Mi perfil en LoHaggo', text: shareText(link).replace(link, '').trim(), url: link }).catch(() => {})
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText(url('whatsapp')))}`, '_blank', 'noopener')
    }
  }

  const shareImage = async () => {
    if (!profile.slug) return
    const imageUrl = `/pro/${profile.slug}/imagen`
    setSharingImage(true)
    try {
      const blob = await fetch(imageUrl).then((r) => (r.ok ? r.blob() : null))
      const file = blob ? new File([blob], 'mi-perfil-lohaggo.png', { type: 'image/png' }) : null
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: shareText(url('imagen')) }).catch(() => {})
      } else if (blob) {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'mi-perfil-lohaggo.png'
        a.click()
        window.setTimeout(() => URL.revokeObjectURL(a.href), 5000)
      }
    } finally {
      setSharingImage(false)
    }
  }

  const title = moment ? '¡Servicio terminado! Pide que te recomienden' : 'Consigue más clientes'
  const text = moment
    ? `Comparte tu perfil${moment.clientName ? ` con ${moment.clientName.split(' ')[0]}` : ''} y con quien te conozca: las solicitudes que lleguen desde tu enlace son para ti.`
    : 'Comparte tu perfil con clientes, amigos y vecinos o en tus estados. Las solicitudes que lleguen desde tu enlace son para ti.'

  return (
    <section aria-labelledby="share-profile-title" className={`rounded-3xl border-2 border-secondary-200 bg-gradient-to-br from-secondary-50 to-amber-50 p-4 sm:p-5 ${className}`}>
      <h2 id="share-profile-title" className="text-base font-bold text-secondary-900">{title}</h2>
      <p className="mt-1 text-sm text-secondary-900/90">{text}</p>

      {!profile.slug ? (
        <button
          type="button"
          onClick={createLink}
          disabled={creating}
          className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-secondary-700 px-5 text-sm font-semibold text-white hover:bg-secondary-800 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-600 focus-visible:ring-offset-2"
        >
          {creating ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Share2 size={16} aria-hidden="true" />}
          Crear mi enlace para compartir
        </button>
      ) : (
        <>
          <p className="mt-2 truncate font-mono text-xs text-secondary-900" title={`lohaggo.com/pro/${profile.slug}`}>lohaggo.com/pro/{profile.slug}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText(url('whatsapp')))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="col-span-2 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#128C4A] px-4 text-sm font-semibold text-white hover:bg-[#0F7A40] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#128C4A] focus-visible:ring-offset-2"
            >
              <MessageCircle size={16} aria-hidden="true" /> Compartir por WhatsApp
              <span className="sr-only"> (se abre en otra pestaña)</span>
            </a>
            <button
              type="button"
              onClick={shareImage}
              disabled={sharingImage}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border-2 border-secondary-300 bg-white px-3 text-sm font-semibold text-secondary-900 hover:bg-secondary-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-600"
            >
              {sharingImage ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
              Imagen para estados
            </button>
            <button
              type="button"
              onClick={typeof navigator !== 'undefined' && 'share' in navigator ? nativeShare : copy}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border-2 border-secondary-300 bg-white px-3 text-sm font-semibold text-secondary-900 hover:bg-secondary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary-600"
            >
              {typeof navigator !== 'undefined' && 'share' in navigator
                ? <><Share2 size={16} aria-hidden="true" /> Compartir</>
                : copied ? <><Check size={16} aria-hidden="true" /> Copiado</> : <><Copy size={16} aria-hidden="true" /> Copiar enlace</>}
            </button>
          </div>
          <span className="sr-only" role="status">{copied ? 'Enlace copiado' : ''}</span>
        </>
      )}
    </section>
  )
}
