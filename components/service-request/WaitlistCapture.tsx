'use client'

import { useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Loader2, X } from 'lucide-react'
import { useDialog } from '@/components/ui/use-dialog'
import WhatsAppIcon from './WhatsAppIcon'

type CaptureProps = {
  citySlug: string
  cityName: string
  /** Set on a service page: the interest is saved with the service it was for */
  serviceSlug?: string
  serviceName?: string
  submitLabel?: string
}

/**
 * WhatsApp-only sign-up to the waitlist (POST /api/public/waitlist). The number has its own consent line;
 * errors show inline, next to the field.
 */
export function WaitlistCapture({ citySlug, cityName, serviceSlug, serviceName, submitLabel = 'Avísame por WhatsApp' }: CaptureProps) {
  const id = useId()
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (phone.replace(/\D/g, '').length < 10) { setError('Escribe tu número de WhatsApp (10 dígitos).'); return }
    if (!consent) { setError('Autoriza el aviso por WhatsApp para continuar.'); return }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/public/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ citySlug, role: 'client', phone, phoneConsent: true, consent: true, serviceSlug: serviceSlug || undefined, website: '' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'No pudimos guardar tu número. Intenta de nuevo.')
        return
      }
      setDone(true)
    } catch {
      setError('No pudimos conectarnos. Revisa tu conexión e intenta de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-900" role="status">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <p className="text-sm font-medium">
          Listo. Te escribimos por WhatsApp apenas {serviceName ? `haya ${serviceName} en` : 'abramos'} {cityName}.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <div>
        <label htmlFor={`${id}-phone`} className="mb-1 block text-sm font-semibold text-gray-700">Tu WhatsApp</label>
        <input
          id={`${id}-phone`}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="300 123 4567"
          value={phone}
          onChange={(e) => { setPhone(e.target.value); setError(null) }}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-err` : undefined}
          className="w-full rounded-2xl border-2 border-gray-200 px-4 py-3 text-base outline-none focus:border-secondary-500 focus:ring-2 focus:ring-secondary-500/20"
        />
      </div>
      <label className="flex min-h-[44px] cursor-pointer items-start gap-3 text-xs text-gray-600">
        <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setError(null) }} className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 text-primary-600" />
        <span>Acepto que LoHaggo me escriba por WhatsApp para avisarme y el tratamiento de mis datos según la política de privacidad.</span>
      </label>
      {error && <p id={`${id}-err`} role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-[#128C7E] px-4 py-3 text-base font-bold text-white disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <WhatsAppIcon className="h-5 w-5" />}
        {submitLabel}
      </button>
    </form>
  )
}

type SheetProps = {
  cityName: string
  citySlug: string
  serviceSlug?: string
  serviceName?: string
  /** The closest city that is live: «Pedir en {ciudad}» switches to it */
  nearest: { slug: string; name: string } | null
  onUseNearest: (slug: string) => void
  onClose: () => void
}

/** «Pronto en {ciudad}»: the city cannot take requests yet, so the client leaves a WhatsApp or goes to a live city. */
export function ComingSoonSheet({ cityName, citySlug, serviceSlug, serviceName, nearest, onUseNearest, onClose }: SheetProps) {
  const { dialogProps, titleId } = useDialog(true, onClose)
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={onClose} />
      <div
        {...dialogProps}
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl focus:outline-none sm:rounded-3xl"
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-xl font-bold text-gray-900">Pronto en {cityName}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="-mr-2 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <p className="mb-4 text-sm text-gray-600">
          Todavía estamos sumando profesionales verificados en {cityName}. Déjanos tu WhatsApp y eres de los primeros en enterarte.
        </p>
        <WaitlistCapture citySlug={citySlug} cityName={cityName} serviceSlug={serviceSlug} serviceName={serviceName} />
        {nearest && (
          <div className="mt-5 border-t border-gray-100 pt-4">
            <p className="mb-2 text-sm text-gray-600">¿Lo necesitas ya? Pídelo en la ciudad más cercana con servicio.</p>
            <button
              type="button"
              onClick={() => onUseNearest(nearest.slug)}
              className="flex min-h-[48px] w-full items-center justify-center rounded-full border-2 border-primary-500 px-4 py-3 text-base font-bold text-primary-700 hover:bg-primary-50"
            >
              Pedir en {nearest.name}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
