'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * Accounts created in a chat (WhatsApp, Messenger, Instagram) have no recorded acceptance of the terms: on the first
 * login in the app a small bottom sheet asks for it (Ley 1581). Renders nothing for everyone else.
 */
export default function TermsAcceptBanner() {
  const [needed, setNeeded] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/me/terms', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d?.needed) setNeeded(true) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  if (!needed) return null

  const accept = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/me/terms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ marketing }) })
      if (res.ok) setNeeded(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div role="dialog" aria-label="Términos y privacidad" className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:left-auto sm:right-4 sm:max-w-sm sm:p-4" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
      <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-2xl">
        <p className="text-sm font-semibold text-gray-900">Tu cuenta se creó desde el chat</p>
        <p className="mt-1 text-sm text-gray-600">Para seguir usando LoHaggo confirma que aceptas los <Link href="/terms" target="_blank" className="font-semibold text-primary-600 underline">Términos</Link> y la <Link href="/privacy" target="_blank" className="font-semibold text-primary-600 underline">Política de privacidad</Link>.</p>
        <label className="mt-3 flex items-start gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300" />
          <span>Quiero recibir novedades y ofertas por WhatsApp o SMS (opcional).</span>
        </label>
        <button type="button" onClick={accept} disabled={saving} className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
          {saving ? 'Guardando…' : 'Acepto'}
        </button>
      </div>
    </div>
  )
}
