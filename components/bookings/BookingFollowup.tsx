'use client'

import { useId, useState } from 'react'
import { CalendarCheck, CalendarX, CheckCircle2, DollarSign, Loader2, MapPinOff, RotateCcw, UserCheck, XCircle } from 'lucide-react'
import { DESIGN_SYSTEM } from '@/lib/design-system'
import { formatCurrency } from '@/lib/utils'

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2'

type Action = 'rebook' | 'arrived' | 'no_show' | 'done' | 'reschedule_ok' | 'reschedule_no' | 'price_ok' | 'price_no' | 'client_here' | 'client_cancel'

export type FollowupInfo = {
  reschedule?: { date: string; time: string; when: string }
  price?: { amount: number; previous: number; note: string }
  clientAbsent?: boolean
}

const LABEL: Record<Action, string> = {
  rebook: 'Buscar otro socio', arrived: 'Ya llegó', no_show: 'El socio no llegó', done: 'Ya terminó',
  reschedule_ok: 'Sí, me sirve', reschedule_no: 'No me sirve', price_ok: 'Acepto el precio', price_no: 'No acepto',
  client_here: 'Ya estoy aquí', client_cancel: 'Cancelar servicio',
}
const ICON: Record<Action, typeof RotateCcw> = {
  rebook: RotateCcw, arrived: UserCheck, no_show: MapPinOff, done: CheckCircle2, reschedule_ok: CalendarCheck, reschedule_no: CalendarX,
  price_ok: DollarSign, price_no: XCircle, client_here: UserCheck, client_cancel: XCircle,
}

type Group = { key: string; title: string; text: string; actions: Action[] }

/** The questions waiting for the client, one per topic, each with its own buttons. */
function groupsFor(actions: Action[], status: string, info: FollowupInfo): Group[] {
  const has = (a: Action) => actions.includes(a)
  const out: Group[] = []
  if (info.clientAbsent && has('client_here')) out.push({ key: 'absent', title: 'El socio llegó y no te encontró', text: 'Avísale si ya estás en el lugar. Si no respondes en 30 minutos, la reserva se cancela.', actions: ['client_here', 'client_cancel'] })
  if (info.reschedule && has('reschedule_ok')) out.push({ key: 'reschedule', title: 'El socio propone otra fecha', text: `Nueva fecha: ${info.reschedule.when}. Si no te sirve, sigue la fecha actual.`, actions: ['reschedule_ok', 'reschedule_no'] })
  if (info.price && has('price_ok')) out.push({ key: 'price', title: `Precio final propuesto: ${formatCurrency(info.price.amount)}`, text: `Antes: ${formatCurrency(info.price.previous)}. Motivo del socio: «${info.price.note}».`, actions: ['price_ok', 'price_no'] })
  const rest = actions.filter((a) => !['client_here', 'client_cancel', 'reschedule_ok', 'reschedule_no', 'price_ok', 'price_no'].includes(a))
  if (!rest.length) return out
  if (rest.includes('no_show')) out.push({ key: 'arrival', title: '¿Ya llegó el socio?', text: 'Si no llega en 30 min, cancelamos sin costo y buscamos otro socio.', actions: rest })
  else if (rest.includes('done')) out.push({ key: 'done', title: '¿Ya terminó el servicio?', text: 'Confírmalo para pagar y calificar.', actions: rest })
  else if (status === 'PENDING') out.push({ key: 'pending', title: 'El socio aún no confirma', text: 'Puedes esperar o pedir otro socio. Si no confirma antes de la hora, cancelamos sin costo.', actions: rest })
  else if (status === 'CONFIRMED') out.push({ key: 'noshow', title: 'Reportaste que el socio no llegó', text: 'Si no quieres esperar más, buscamos otro socio ahora.', actions: rest })
  else out.push({ key: 'rebook', title: '¿Buscamos otro socio?', text: 'Abrimos tu solicitud de nuevo para que otros socios te envíen propuestas, sin costo.', actions: rest })
  return out
}

/** POST /api/bookings/{id}/followup with the action the client picks; the panel reloads after. */
export default function BookingFollowup({ bookingId, status, actions, info = {}, onDone }: { bookingId: string; status: string; actions: string[]; info?: FollowupInfo; onDone: () => void }) {
  const list = actions.filter((a): a is Action => a in LABEL)
  const [busy, setBusy] = useState<Action | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const baseId = useId()
  const groups = groupsFor(list, status, info)
  if (!groups.length && !message) return null

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
    <div className="space-y-2" aria-live="polite">
      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`${baseId}-${g.key}`} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h3 id={`${baseId}-${g.key}`} className="font-bold text-amber-900">{g.title}</h3>
          <p className="mt-1 break-words text-sm leading-relaxed text-amber-900">{g.text}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {g.actions.map((a, i) => {
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
        </section>
      ))}
      {busy && <span className="sr-only" role="status">Enviando…</span>}
      <p role={message && !message.ok ? 'alert' : 'status'} className={`text-sm font-medium ${message?.ok ? 'text-green-800' : 'text-red-700'}`}>{message?.text ?? ''}</p>
    </div>
  )
}
