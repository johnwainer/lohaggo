'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { CalendarCheck, CheckCircle2, Loader2 } from 'lucide-react'

type Info = { service: string; partner: string; when: string; status: string; action: 'here_yes' | 'reconfirm_yes' | null; confirmed: boolean }

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2'

/** One-tap appointment confirmation from email or SMS: shows the booking and confirms only on a tap. */
export default function AppointmentLinkPage() {
  const { token } = useParams<{ token: string }>()
  const [info, setInfo] = useState<Info | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/public/appointment?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error || 'No pudimos abrir tu cita')
        setInfo(d)
      })
      .catch((e: Error) => setError(e.message))
  }, [token])

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      const r = await fetch('/api/public/appointment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'No pudimos confirmar tu cita')
      setDone(d.message)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos confirmar tu cita')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
          <CalendarCheck size={24} aria-hidden="true" />
        </div>
        {!info && !error && <p className="flex items-center gap-2 text-gray-600" role="status"><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Cargando tu cita…</p>}
        {info && (
          <>
            <h1 className="text-xl font-bold text-gray-900">{info.action === 'here_yes' ? `${info.partner} va a salir hacia tu dirección` : 'Confirma tu cita'}</h1>
            <p className="mt-2 text-gray-700"><strong>{info.service}</strong> con {info.partner}</p>
            <p className="text-gray-700">{info.when}</p>
            {done ? (
              <p className="mt-5 flex items-start gap-2 rounded-2xl bg-green-50 p-4 text-sm font-medium text-green-800" role="status"><CheckCircle2 size={18} className="mt-0.5 shrink-0" aria-hidden="true" /> {done}</p>
            ) : info.action ? (
              <>
                <p className="mt-4 text-sm text-gray-600">{info.action === 'here_yes' ? 'Confírmale que estarás en el lugar para que salga.' : 'El socio solo sale hacia tu dirección cuando confirmes.'}</p>
                <button type="button" onClick={confirm} disabled={busy} className={`mt-5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-primary-600 px-5 font-semibold text-white hover:bg-primary-700 disabled:opacity-60 ${focusRing}`}>
                  {busy && <Loader2 size={18} className="animate-spin" aria-hidden="true" />} {info.action === 'here_yes' ? 'Sí, aquí estaré' : 'Confirmo mi cita'}
                </button>
              </>
            ) : (
              <p className="mt-5 rounded-2xl bg-gray-50 p-4 text-sm text-gray-700" role="status">{info.confirmed ? 'Tu cita ya está confirmada.' : 'Esta cita ya no necesita confirmación.'}</p>
            )}
            <Link href="/dashboard?tab=bookings" className={`mt-3 flex min-h-[44px] w-full items-center justify-center rounded-full border border-gray-300 px-5 text-sm font-semibold text-gray-800 hover:bg-gray-50 ${focusRing}`}>
              Cambiar hora o cancelar en mis reservas
            </Link>
          </>
        )}
        {error && <p className="mt-4 text-sm font-medium text-red-700" role="alert">{error}</p>}
      </div>
    </main>
  )
}
