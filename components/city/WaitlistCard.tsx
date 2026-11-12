'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Bell, Gift, MessageCircle, CheckCircle2, Loader2 } from 'lucide-react'

/** Waitlist of a coming-soon city: the only interactive part of the page (the rest is server-rendered). */
export function WaitlistCard({
  citySlug,
  cityName,
  whatsappPhone,
  launchBenefits,
}: {
  citySlug: string
  cityName: string
  whatsappPhone: string | null
  launchBenefits: string[]
}) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'client' | 'partner'>('client')
  const [consent, setConsent] = useState(false)
  const [phone, setPhone] = useState('')
  const [phoneConsent, setPhoneConsent] = useState(false)
  const [website, setWebsite] = useState('')
  const [formState, setFormState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!consent) {
      setFormState('error')
      setFormError('Para avisarte necesitamos tu autorización.')
      return
    }
    if (phone.trim() && !phoneConsent) {
      setFormState('error')
      setFormError('Marca la autorización para avisarte por WhatsApp, o deja el número vacío.')
      return
    }
    setFormState('sending')
    setFormError(null)
    try {
      const res = await fetch('/api/public/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ citySlug, email, name: name || undefined, role, consent, website, phone: phone.trim() || undefined, phoneConsent: phone.trim() ? phoneConsent : undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No pudimos guardar tu registro. Intenta de nuevo.')
      setFormState('done')
    } catch (err: any) {
      setFormState('error')
      setFormError(err.message || 'No pudimos guardar tu registro. Intenta de nuevo.')
    }
  }

  const notifyText = `Hola, quiero que me avisen cuando LoHaggo llegue a ${cityName}.`
  const notifyHref = whatsappPhone
    ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(notifyText)}`
    : `mailto:hola@lohaggo.com?subject=${encodeURIComponent(`Avísenme cuando lleguen a ${cityName}`)}&body=${encodeURIComponent(notifyText)}`

  return (
    <div className="mx-auto max-w-md">
      {formState === 'done' ? (
        <div className="rounded-3xl border-2 border-green-200 bg-white p-6 text-center" role="status">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-500" />
          <p className="text-lg font-bold text-gray-900">¡Listo! Te avisaremos</p>
          <p className="mt-1 text-sm text-gray-600">Te escribiremos a {email.trim().toLowerCase()} cuando LoHaggo llegue a {cityName}.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-2 rounded-full border-2 border-primary-100 bg-white p-1" role="radiogroup" aria-label="Quién eres">
            {([
              ['client', 'Soy cliente'],
              ['partner', 'Quiero ser socio'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={role === value}
                onClick={() => setRole(value)}
                className={`rounded-full px-3 py-2.5 text-sm font-bold transition-all ${
                  role === value ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white shadow' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="waitlist-email" className="mb-1 block text-sm font-semibold text-gray-700">Correo electrónico</label>
            <input
              id="waitlist-email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
              className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-base focus:border-primary-400 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="waitlist-name" className="mb-1 block text-sm font-semibold text-gray-700">
              Nombre <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <input
              id="waitlist-name"
              type="text"
              autoComplete="name"
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-base focus:border-primary-400 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="waitlist-phone" className="mb-1 block text-sm font-semibold text-gray-700">
              WhatsApp <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <input
              id="waitlist-phone"
              type="tel"
              autoComplete="tel-national"
              inputMode="tel"
              maxLength={30}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="300 123 4567"
              className="w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-base focus:border-primary-400 focus:outline-none"
            />
            {phone.trim() && (
              <label className="mt-2 flex items-start gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={phoneConsent} onChange={(e) => setPhoneConsent(e.target.checked)} className="mt-1" />
                <span>Autorizo que me avisen por WhatsApp cuando LoHaggo abra en {cityName}. Solo ese aviso.</span>
              </label>
            )}
          </div>

          <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
            <label htmlFor="waitlist-website">Sitio web</label>
            <input id="waitlist-website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>

          <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-700">
            <input
              type="checkbox"
              required
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span>
              Acepto que LoHaggo me contacte sobre el lanzamiento según la{' '}
              <Link href="/privacy" className="font-semibold text-primary-600 underline" target="_blank">política de privacidad</Link>.
            </span>
          </label>

          {formState === 'error' && formError && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{formError}</p>
          )}

          <button
            type="submit"
            disabled={formState === 'sending' || !email.trim() || !consent}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary-500 to-secondary-500 px-8 py-4 font-bold text-white transition-all hover:shadow-2xl disabled:cursor-not-allowed disabled:opacity-60"
          >
            {formState === 'sending' ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Enviando…
              </>
            ) : (
              <>
                Avísame
                <Bell className="h-5 w-5" />
              </>
            )}
          </button>
        </form>
      )}

      <a
        href={notifyHref}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border-2 border-primary-200 bg-white px-6 py-3 font-semibold text-primary-700 transition-all hover:bg-primary-50"
      >
        {whatsappPhone ? 'O escríbenos por WhatsApp' : 'O escríbenos por correo'}
        <MessageCircle className="h-5 w-5" />
      </a>
      {launchBenefits.length > 0 && (
        <div className="mt-6 rounded-2xl border-2 border-primary-200 bg-gradient-to-r from-primary-100 to-secondary-100 p-4">
          <div className="flex items-start gap-3">
            <Gift className="mt-1 h-6 w-6 flex-shrink-0 text-primary-600" />
            <div>
              <p className="mb-1 font-bold text-primary-900">Beneficios de lanzamiento:</p>
              <ul className="space-y-1 text-sm text-primary-800">
                {launchBenefits.map((b) => <li key={b}>{b}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
