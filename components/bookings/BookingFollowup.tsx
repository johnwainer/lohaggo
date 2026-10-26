'use client'

import { useId, useState } from 'react'
import { CalendarCheck, CalendarX, CheckCircle2, DollarSign, Loader2, MapPinOff, RotateCcw, UserCheck, XCircle } from 'lucide-react'
import { DESIGN_SYSTEM } from '@/lib/design-system'
import { formatCurrency } from '@/lib/utils'

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2'

type Action = 'rebook' | 'arrived' | 'no_show' | 'done' | 'reschedule_ok' | 'reschedule_no' | 'price_ok' | 'price_no' | 'client_here' | 'client_cancel' | 'reconfirm_yes' | 'reconfirm_cancel' | 'here_yes' | 'here_later'

export type FollowupInfo = {
  reschedule?: { date: string; time: string; when: string }
  price?: { amount: number; previous: number; note: string }
  clientAbsent?: boolean
  appointment?: { state: 'confirmed' | 'pending' | 'on_hold' | 'not_asked'; departure?: { at: string; answer: 'waiting' | 'later' | 'no_answer' | null } }
}

const LABEL: Record<Action, string> = {
  rebook: 'Buscar otro socio', arrived: 'Ya llegó', no_show: 'El socio no llegó', done: 'Ya terminó',
  reschedule_ok: 'Sí, me sirve', reschedule_no: 'No me sirve', price_ok: 'Acepto el precio', price_no: 'No acepto',
  client_here: 'Ya estoy aquí', client_cancel: 'Cancelar servicio',
  reconfirm_yes: 'Confirmo mi cita', reconfirm_cancel: 'Cancelar cita', here_yes: 'Sí, aquí estaré', here_later: 'Necesito otra hora',
}
const ICON: Record<Action, typeof RotateCcw> = {
  rebook: RotateCcw, arrived: UserCheck, no_show: MapPinOff, done: CheckCircle2, reschedule_ok: CalendarCheck, reschedule_no: CalendarX,
  price_ok: DollarSign, price_no: XCircle, client_here: UserCheck, client_cancel: XCircle,
  reconfirm_yes: CalendarCheck, reconfirm_cancel: XCircle, here_yes: UserCheck, here_later: CalendarX,
}

type Group = { key: string; title: string; text: string; actions: Action[] }

/** Answers that cancel or report someone: asked once more before sending */
const CONFIRM: Partial<Record<Action, string>> = {
  no_show: '¿Confirmas que el socio no ha llegado? Le avisaremos y, si no inicia en 30 minutos, cancelamos sin costo.',
  client_cancel: '¿Seguro que quieres cancelar el servicio? El socio ya está en el lugar.',
  reconfirm_cancel: '¿Seguro que quieres cancelar tu cita? Le avisaremos al socio.',
}
const SECONDARY: Action[] = ['no_show', 'client_cancel', 'price_no', 'reschedule_no', 'reconfirm_cancel', 'here_later']

/** The questions waiting for the client, one per topic, each with its own buttons. */
function groupsFor(actions: Action[], status: string, info: FollowupInfo): Group[] {
  const has = (a: Action) => actions.includes(a)
  const out: Group[] = []
  if (has('here_yes')) out.push({ key: 'depart', title: 'Tu socio va a salir hacia tu dirección', text: 'Confírmale que estarás en el lugar para que salga. Si no puedes recibirlo ahora, pide otra hora.', actions: ['here_yes', 'here_later'] })
  if (has('reconfirm_yes')) {
    const hold = info.appointment?.state === 'on_hold'
    out.push({ key: 'reconfirm', title: hold ? 'Tu cita está en espera' : 'Confirma tu cita', text: hold ? 'No la confirmaste a tiempo y el socio no saldrá. Confírmala ya si aún necesitas el servicio; si no, se cancela una hora después de la hora acordada.' : 'El socio solo sale hacia tu dirección cuando confirmes. Si necesitas otra hora, usa «Reprogramar».', actions: ['reconfirm_yes', 'reconfirm_cancel'] })
  }
  if (info.clientAbsent && has('client_here')) out.push({ key: 'absent', title: 'El socio llegó y no te encontró', text: 'Avísale si ya estás en el lugar. Si no respondes en 30 minutos, la reserva se cancela.', actions: ['client_here', 'client_cancel'] })
  if (info.reschedule && has('reschedule_ok')) out.push({ key: 'reschedule', title: 'El socio propone otra fecha', text: `Nueva fecha: ${info.reschedule.when}. Si no te sirve, sigue la fecha actual.`, actions: ['reschedule_ok', 'reschedule_no'] })
  if (info.price && has('price_ok')) out.push({ key: 'price', title: `Precio final propuesto: ${formatCurrency(info.price.amount)}`, text: `Antes: ${formatCurrency(info.price.previous)}. Motivo del socio: «${info.price.note}».`, actions: ['price_ok', 'price_no'] })
  const rest = actions.filter((a) => !['client_here', 'client_cancel', 'reschedule_ok', 'reschedule_no', 'price_ok', 'price_no', 'reconfirm_yes', 'reconfirm_cancel', 'here_yes', 'here_later'].includes(a))
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
  const [confirming, setConfirming] = useState<Action | null>(null)
  const baseId = useId()
  const groups = groupsFor(list, status, info)
  const confirmed = info.appointment?.state === 'confirmed' && !groups.some((g) => g.key === 'depart')
  if (!groups.length && !message && !confirmed) return null

  async function run(action: Action) {
    setConfirming(null)
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
    <div className="space-y-2">
      {confirmed && (
        <p className="flex items-start gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>Cita confirmada. Te avisamos cuando el socio salga hacia tu dirección.</span>
        </p>
      )}
      {groups.map((g, gi) => (
        <section key={g.key} aria-labelledby={`${baseId}-${g.key}`} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <h3 id={`${baseId}-${g.key}`} className="font-bold text-amber-900">{g.title}</h3>
          <p className="mt-1 break-words text-sm leading-relaxed text-amber-900">{g.text}</p>
          {confirming && g.actions.includes(confirming) ? (
            <div className="mt-3 rounded-2xl bg-white p-3">
              <p className="text-sm font-medium text-gray-900">{CONFIRM[confirming]}</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button type="button" autoFocus disabled={busy !== null} onClick={() => run(confirming)} className={`inline-flex min-h-[44px] w-full items-center justify-center gap-2 text-sm sm:w-auto disabled:opacity-60 ${focusRing} ${DESIGN_SYSTEM.components.button.primary}`}>
                  {busy === confirming && <Loader2 size={18} className="shrink-0 animate-spin" aria-hidden="true" />} Sí, {LABEL[confirming].toLowerCase()}
                </button>
                <button type="button" disabled={busy !== null} onClick={() => setConfirming(null)} className={`inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800 sm:w-auto ${focusRing}`}>Volver</button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {g.actions.map((a, i) => {
                const Icon = busy === a ? Loader2 : ICON[a]
                // One primary per card: the first safe answer of the first question
                const primary = gi === 0 && i === 0 && !SECONDARY.includes(a)
                return (
                  <button
                    key={a}
                    type="button"
                    disabled={busy !== null}
                    aria-busy={busy === a}
                    onClick={() => (CONFIRM[a] ? setConfirming(a) : run(a))}
                    className={`inline-flex min-h-[44px] w-full items-center justify-center gap-2 text-sm sm:w-auto disabled:cursor-not-allowed disabled:opacity-60 ${focusRing} ${primary ? DESIGN_SYSTEM.components.button.primary : 'rounded-full border border-amber-300 bg-white px-4 font-semibold text-amber-900 hover:bg-amber-100'}`}
                  >
                    <Icon size={18} className={`shrink-0 ${busy === a ? 'animate-spin' : ''}`} aria-hidden="true" />
                    {LABEL[a]}
                  </button>
                )
              })}
            </div>
          )}
        </section>
      ))}
      <span className="sr-only" role="status">{busy ? 'Enviando…' : message?.ok ? message.text : ''}</span>
      {message && <p role={message.ok ? undefined : 'alert'} className={`text-sm font-medium ${message.ok ? 'text-green-800' : 'text-red-700'}`}>{message.text}</p>}
    </div>
  )
}
