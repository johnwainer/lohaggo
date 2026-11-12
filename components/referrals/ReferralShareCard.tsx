'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, MessageCircle, Share2, Users } from 'lucide-react'

type Me = { code: string; audience: 'CLIENT' | 'PARTNER'; link: string; shareText: string; qualified: number; pending: number; priority: boolean }

/** «Invita y gana»: the person's referral link ready to share, with how many referrals already completed a service. */
export default function ReferralShareCard({ className = '' }: { className?: string }) {
  const [me, setMe] = useState<Me | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/referrals/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d?.code) setMe(d) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  if (!me) return null
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator
  const copy = async () => {
    try { await navigator.clipboard.writeText(me.link); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* sin portapapeles */ }
  }
  const nativeShare = async () => {
    try { await navigator.share({ text: me.shareText }) } catch { /* cancelado */ }
  }
  const who = me.audience === 'PARTNER' ? 'otros profesionales' : 'amigos y familia'

  return (
    <section className={`rounded-3xl border border-primary-100 bg-primary-50/60 p-4 sm:p-5 ${className}`} aria-label="Invita y gana">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700"><Users size={18} aria-hidden="true" /></span>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900">Invita a {who}</h2>
          <p className="mt-0.5 text-sm text-gray-600">Cuando tu invitado complete su primer servicio te avisamos.{me.audience === 'PARTNER' ? ' Los socios que más recomiendan reciben las novedades primero.' : ''}</p>
          <p className="mt-2 text-xs font-semibold text-gray-700">{me.qualified} {me.qualified === 1 ? 'referido completó' : 'referidos completaron'} su primer servicio{me.pending ? ` · ${me.pending} en camino` : ''}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(me.shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="col-span-2 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#128C4A] px-4 text-sm font-semibold text-white hover:bg-[#0F7A40]"
        >
          <MessageCircle size={16} aria-hidden="true" /> Compartir por WhatsApp
          <span className="sr-only"> (se abre en otra pestaña)</span>
        </a>
        <button type="button" onClick={copy} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border-2 border-primary-200 bg-white px-3 text-sm font-semibold text-gray-900 hover:bg-primary-50">
          {copied ? <><Check size={16} aria-hidden="true" /> Copiado</> : <><Copy size={16} aria-hidden="true" /> Copiar enlace</>}
        </button>
        {canShare && (
          <button type="button" onClick={nativeShare} className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border-2 border-primary-200 bg-white px-3 text-sm font-semibold text-gray-900 hover:bg-primary-50">
            <Share2 size={16} aria-hidden="true" /> Compartir
          </button>
        )}
      </div>
      <span className="sr-only" role="status">{copied ? 'Enlace copiado' : ''}</span>
    </section>
  )
}
