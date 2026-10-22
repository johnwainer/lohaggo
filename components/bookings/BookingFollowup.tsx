'use client'

import { useId, useState } from 'react'
import { CheckCircle2, Loader2, MapPinOff, RotateCcw, UserCheck } from 'lucide-react'
import { DESIGN_SYSTEM } from '@/lib/design-system'

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2'

type Action = 'rebook' | 'arrived' | 'no_show' | 'done'

const LABEL: Record<Action, string> = { rebook: 'Buscar otro socio', arrived: 'Ya llegó', no_show: 'El socio no llegó', done: 'Ya terminó' }
const ICON: Record<Action, typeof RotateCcw> = { rebook: RotateCcw, arrived: UserCheck, no_show: MapPinOff, done: CheckCircle2 }

/** The question of the moment for the booking, by what the client can answer. */
function questionFor(actions: Action[], status: string) {
  if (actions.includes('no_show')) return { title: '¿Ya llegó el socio?', text: 'Si no llega en 30 min, cancelamos sin costo y buscamos otro socio.' }
  if (actions.includes('done')) return { title: '¿Ya terminó el servicio?', text: 'Confírmalo para pagar y calificar.' }
  if (status === 'PENDING') return { title: 'El socio aún no confirma', text: 'Puedes esperar o pedir otro socio. Si no confirma antes de la hora, cancelamos sin costo.' }
  if (status === 'CONFIRMED') return { title: 'Reportaste que el socio no llegó', text: 'Si no quieres esperar más, buscamos otro socio ahora.' }
  return { title: '¿Buscamos otro socio?', text: 'Abrimos tu solicitud de nuevo para que otros socios te envíen propuestas, sin costo.' }
}

/** POST /api/bookings/{id}/followup with the action the client picks; the panel reloads after. */
export default function BookingFollowup({ bookingId, status, actions, onDone }: { bookingId: string; status: string; actions: string[]; onDone: () => void }) {
  const list = actions.filter((a): a is Action => a in LABEL)
  const [busy, setBusy] = useState<Action | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const titleId = useId()
  if (!list.length && !message) return null
  const q = questionFor(list, status)

  async function run(action: Action) {
    setBusy(action)
    setMessage(null)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/followup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
      const data = await res.json().catch(() => ({}))
      setMessage({ ok: res.ok, text: res.ok ? data.message : data.error || 'No pudimos registrar tu respuesta' })
      if (res.ok) onDone()
    } catch {
      setMessage({ ok: false, text: 'No pudimos conectar, intenta de nuevo' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-labelledby={list.length ? titleId : undefined} aria-live="polite" className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      {list.length > 0 && (
        <>
          <h3 id={titleId} className="font-bold text-amber-900">{q.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-amber-900">{q.text}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {list.map((a, i) => {
              const Icon = busy === a ? Loader2 : ICON[a]
              return (
                <button
                  key={a}
                  type="button"
                  disabled={busy !== null}
                  aria-busy={busy === a}
                  onClick={() => run(a)}
                  className={`inline-flex min-h-[44px] w-full items-center justify-center gap-2 text-sm sm:w-auto disabled:cursor-not-allowed disabled:opacity-60 ${focusRing} ${i === 0 ? DESIGN_SYSTEM.components.button.primary : 'rounded-full border border-amber-300 bg-white px-4 font-semibold text-amber-900 hover:bg-amber-100'}`}
                >
                  <Icon size={18} className={`shrink-0 ${busy === a ? 'animate-spin' : ''}`} aria-hidden="true" />
                  {LABEL[a]}
                </button>
              )
            })}
          </div>
          {busy && <span className="sr-only" role="status">Enviando…</span>}
        </>
      )}
      <p role={message && !message.ok ? 'alert' : 'status'} className={`${message && list.length ? 'mt-3' : ''} text-sm font-medium ${message?.ok ? 'text-green-800' : 'text-red-700'}`}>{message?.text ?? ''}</p>
    </section>
  )
}
