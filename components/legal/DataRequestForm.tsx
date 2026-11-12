'use client'

import { useState } from 'react'
import { DATA_REQUEST_LABEL, DATA_REQUEST_TYPES, type DataRequestKind } from '@/lib/privacy/data-requests-core'

export default function DataRequestForm() {
  const [type, setType] = useState<DataRequestKind>('ACCESS')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (state === 'sending') return
    setError('')
    setState('sending')
    try {
      const res = await fetch('/api/data-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, email, name, message, honeypot }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No pudimos registrar tu solicitud. Inténtalo de nuevo.')
      setState('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
      setState('idle')
    }
  }

  if (state === 'done') {
    return (
      <div role="status" className="rounded-3xl border border-green-200 bg-green-50 p-5 text-sm text-green-900">
        <p className="font-semibold">Recibimos tu solicitud.</p>
        <p className="mt-1">Te responderemos al correo {email} dentro de los 15 días hábiles siguientes. Para proteger tus datos, podemos pedirte que confirmes tu identidad antes de actuar.</p>
      </div>
    )
  }

  const field = 'mt-1 block w-full rounded-2xl border border-gray-300 px-4 py-3 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500'
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <fieldset>
        <legend className="text-sm font-semibold text-gray-900">¿Qué quieres hacer?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {DATA_REQUEST_TYPES.map((t) => (
            <label key={t} className={`flex min-h-[48px] cursor-pointer items-center gap-2 rounded-2xl border-2 px-3 text-sm font-medium ${type === t ? 'border-primary-500 bg-primary-50 text-primary-900' : 'border-gray-200 text-gray-700'}`}>
              <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="h-4 w-4" />
              {DATA_REQUEST_LABEL[t]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-semibold text-gray-900">Correo de tu cuenta
        <input type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} placeholder="tu@correo.com" />
      </label>
      <label className="block text-sm font-semibold text-gray-900">Tu nombre (opcional)
        <input type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={field} maxLength={120} />
      </label>
      <label className="block text-sm font-semibold text-gray-900">Cuéntanos más (opcional)
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} className={`${field} min-h-[100px]`} maxLength={2000} placeholder={type === 'CORRECT' ? '¿Qué dato está mal y cuál es el correcto?' : ''} />
      </label>
      <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
      {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={state === 'sending'} className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-primary-600 px-6 text-base font-semibold text-white hover:bg-primary-700 disabled:opacity-60 sm:w-auto">
        {state === 'sending' ? 'Enviando…' : 'Enviar solicitud'}
      </button>
    </form>
  )
}
