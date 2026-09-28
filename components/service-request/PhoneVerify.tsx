'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Loader2, ShieldCheck, X } from 'lucide-react'

type Props = {
  /** request: last step of a service request (name asked); login: sign in from /login (name only if the number is new) */
  mode?: 'request' | 'login'
  /** Where «Ya tengo cuenta con correo» goes (login with the draft kept); omitted on /login itself */
  loginHref?: string
  onVerified: () => void
  onClose: () => void
}

/**
 * Request without an account: name and phone, a 6-digit code by WhatsApp, and the person is signed in (a
 * client account is created when the number has none). The draft stays in the form while this is open.
 */
export default function PhoneVerify({ mode = 'request', loginHref, onVerified, onClose }: Props) {
  const login = mode === 'login'
  const [needName, setNeedName] = useState(!login)
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function post(url: string, body: unknown) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return { res, data: await res.json().catch(() => ({})) }
  }

  async function sendCode() {
    setBusy(true)
    setError(null)
    const { res, data } = await post('/api/auth/phone/code', { phone })
    setBusy(false)
    if (!res.ok) return setError(data.error || 'No pudimos enviar el código')
    setSentTo(data.sentTo || phone)
    setCode('')
    setStep('code')
  }

  async function verify() {
    setBusy(true)
    setError(null)
    const { res, data } = await post('/api/auth/phone/verify', { phone, code, name, email })
    setBusy(false)
    if (res.ok) return onVerified()
    if (data.code === 'email_link') return setInfo(data.error)
    if (data.code === 'need_name') setNeedName(true)
    setError(data.error || 'No pudimos confirmar el código')
  }

  async function sendLink() {
    setBusy(true)
    setError(null)
    const { res, data } = await post('/api/auth/access-link', { phone })
    setBusy(false)
    if (!res.ok) return setError(data.error || 'No pudimos enviar el enlace')
    setInfo(data.message)
  }

  // Rendered on <body>: inside a transformed card a fixed sheet would sit under the bottom nav
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const phoneDigits = phone.replace(/\D/g, '')
  const canSend = (!needName || name.trim().length >= 2) && phoneDigits.length >= 10
  const field = 'w-full rounded-2xl border border-gray-200 px-4 py-3 text-base outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30'

  if (!mounted) return null
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="phone-verify-title">
      <div className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="phone-verify-title" className="text-lg font-bold text-gray-900">{step === 'code' ? 'Escribe el código' : login ? 'Entrar con WhatsApp' : 'Último paso: tu celular'}</h2>
            <p className="mt-1 text-sm text-gray-600">
              {step === 'phone' ? 'Te enviamos un código por WhatsApp para confirmar tu número. No necesitas contraseña.' : `Lo enviamos por WhatsApp a ${sentTo}. Vence en 10 minutos.`}
            </p>
          </div>
          <button onClick={onClose} className="-mr-1 rounded-full p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Cerrar"><X size={20} /></button>
        </div>

        {info ? (
          <div className="space-y-4">
            <p className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-900">{info}</p>
            {!login && <p className="text-sm text-gray-600">Tu solicitud queda guardada en este dispositivo: al entrar la envías con un toque.</p>}
            {loginHref ? <Link href={loginHref} className="flex w-full items-center justify-center rounded-full bg-primary-600 py-3.5 font-semibold text-white">Entrar con mi correo</Link> : <button onClick={onClose} className="flex w-full items-center justify-center rounded-full bg-primary-600 py-3.5 font-semibold text-white">Entendido</button>}
          </div>
        ) : step === 'phone' ? (
          <div className="space-y-3">
            {needName && (
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-800">Tu nombre</span>
                <input className={field} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" />
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-800">Celular con WhatsApp</span>
              <input className={field} type="tel" inputMode="tel" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="300 123 4567" />
            </label>
            {!login && (
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-800">Correo <span className="font-normal text-gray-500">(opcional)</span></span>
                <input className={field} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="para recibir los recibos" />
              </label>
            )}
            {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
            <button onClick={sendCode} disabled={!canSend || busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary-500 to-secondary-500 py-3.5 font-semibold text-white disabled:opacity-50">
              {busy && <Loader2 size={18} className="animate-spin" />} Enviarme el código
            </button>
            <p className="flex items-start gap-1.5 text-xs text-gray-500"><ShieldCheck size={14} className="mt-0.5 shrink-0" /><span>{login ? 'Usamos tu número solo para entrar y para los avisos de tus servicios.' : 'Solo usamos tu número para esta solicitud y sus avisos.'} Al continuar aceptas los <Link href="/terms" className="underline">términos</Link> y la <Link href="/privacy" className="underline">política de privacidad</Link>.</span></p>
            {loginHref && <Link href={loginHref} className="block text-center text-sm font-medium text-primary-700 hover:underline">Ya tengo cuenta con correo</Link>}
            {login && <button onClick={sendLink} disabled={phoneDigits.length < 10 || busy} className="block w-full text-center text-sm font-medium text-primary-700 hover:underline disabled:opacity-50">Prefiero que me envíen un enlace de acceso</button>}
          </div>
        ) : (
          <div className="space-y-3">
            {needName && step === 'code' && login && (
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-800">Este número no tiene cuenta: escribe tu nombre para crearla</span>
                <input className={field} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" />
              </label>
            )}
            <input
              className={`${field} text-center text-2xl tracking-[0.5em]`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              aria-label="Código de 6 números"
              autoFocus
            />
            {error && <p className="text-sm text-rose-600" role="alert">{error}</p>}
            <button onClick={verify} disabled={code.length !== 6 || busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary-500 to-secondary-500 py-3.5 font-semibold text-white disabled:opacity-50">
              {busy && <Loader2 size={18} className="animate-spin" />} {login ? 'Confirmar y entrar' : 'Confirmar y enviar solicitud'}
            </button>
            <div className="flex justify-between text-sm">
              <button onClick={() => { setStep('phone'); setError(null) }} className="text-gray-600 hover:underline">Cambiar número</button>
              <button onClick={sendCode} disabled={busy} className="font-medium text-primary-700 hover:underline disabled:opacity-50">Reenviar código</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
