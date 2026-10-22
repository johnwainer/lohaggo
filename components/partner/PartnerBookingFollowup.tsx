'use client'

import { useId, useState } from 'react'
import { CalendarClock, DollarSign, Loader2, Navigation, UserX } from 'lucide-react'
import { DESIGN_SYSTEM } from '@/lib/design-system'
import { formatCurrency } from '@/lib/utils'
import type { FollowupInfo } from '@/components/bookings/BookingFollowup'

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2'
const field = 'w-full rounded-2xl border border-gray-200 px-4 py-3 text-base focus:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500'

type Action = 'partner_on_way' | 'client_absent' | 'propose_price'

/**
 * The partner's follow-up on a booking card: «Voy en camino», «El cliente no estaba», the final price, and
 * what is waiting for the client (a new date or price they proposed). POST /api/bookings/{id}/followup.
 */
export default function PartnerBookingFollowup({ bookingId, actions, info = {}, totalPrice, onDone }: { bookingId: string; actions: string[]; info?: FollowupInfo; totalPrice: number; onDone: () => void }) {
  const list = actions.filter((a): a is Action => a === 'partner_on_way' || a === 'client_absent' || a === 'propose_price')
  const [busy, setBusy] = useState<Action | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [priceOpen, setPriceOpen] = useState(false)
  const [confirmAbsent, setConfirmAbsent] = useState(false)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const amountId = useId()
  const noteId = useId()
  const hintId = useId()
  const waiting = Boolean(info.reschedule || info.price || info.clientAbsent)
  if (!list.length && !waiting && !message) return null

  async function run(action: Action, extra: Record<string, unknown> = {}) {
    setConfirmAbsent(false)
    setBusy(action)
    setMessage(null)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/followup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }) })
      const data = await res.json().catch(() => ({}))
      setMessage({ ok: res.ok, text: res.ok ? data.message : data.error || 'No pudimos registrar tu respuesta' })
      if (res.ok) {
        setPriceOpen(false)
        onDone()
      }
    } catch {
      setMessage({ ok: false, text: 'No pudimos conectar, intenta de nuevo' })
    } finally {
      setBusy(null)
    }
  }

  const value = Math.round(Number(amount.replace(/\D/g, '')))
  const priceReady = value > 0 && value !== totalPrice && note.trim().length >= 5
  const secondary = `inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50 sm:w-auto disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`

  return (
    <div className="space-y-2">
      {info.reschedule && (
        <p className="flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <CalendarClock size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>Esperando que el cliente acepte la nueva fecha: <strong>{info.reschedule.when}</strong>. Mientras tanto sigue la fecha actual.</span>
        </p>
      )}
      {info.price && (
        <p className="flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <DollarSign size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>Esperando que el cliente acepte el precio final de <strong>{formatCurrency(info.price.amount)}</strong>.</span>
        </p>
      )}
      {info.clientAbsent && (
        <p className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <UserX size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>Le avisamos al cliente que no lo encontraste. Si no responde en 30 minutos, cancelamos la reserva y no se te penaliza.</span>
        </p>
      )}
      {list.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {list.includes('partner_on_way') && (
            <button type="button" disabled={busy !== null} aria-busy={busy === 'partner_on_way'} onClick={() => run('partner_on_way')} className={`inline-flex min-h-[44px] w-full items-center justify-center gap-2 text-sm sm:w-auto disabled:cursor-not-allowed disabled:opacity-60 ${focusRing} ${DESIGN_SYSTEM.components.button.primary}`}>
              {busy === 'partner_on_way' ? <Loader2 size={18} className="shrink-0 animate-spin" aria-hidden="true" /> : <Navigation size={18} className="shrink-0" aria-hidden="true" />}
              Voy en camino
            </button>
          )}
          {list.includes('client_absent') && !confirmAbsent && (
            <button type="button" disabled={busy !== null} aria-busy={busy === 'client_absent'} onClick={() => setConfirmAbsent(true)} className={secondary}>
              {busy === 'client_absent' ? <Loader2 size={18} className="shrink-0 animate-spin" aria-hidden="true" /> : <UserX size={18} className="shrink-0" aria-hidden="true" />}
              El cliente no estaba
            </button>
          )}
          {list.includes('propose_price') && !priceOpen && (
            <button type="button" disabled={busy !== null} onClick={() => setPriceOpen(true)} className={secondary}>
              <DollarSign size={18} className="shrink-0" aria-hidden="true" /> Ajustar precio final
            </button>
          )}
        </div>
      )}
      {confirmAbsent && (
        <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">¿Ya estás en la dirección y el cliente no aparece? Le avisaremos ahora; si no responde en 30 minutos, cancelamos la reserva.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" autoFocus disabled={busy !== null} onClick={() => run('client_absent')} className={`inline-flex min-h-[44px] w-full items-center justify-center gap-2 text-sm sm:w-auto disabled:opacity-60 ${focusRing} ${DESIGN_SYSTEM.components.button.primary}`}>
              {busy === 'client_absent' && <Loader2 size={18} className="shrink-0 animate-spin" aria-hidden="true" />} Sí, avisar al cliente
            </button>
            <button type="button" disabled={busy !== null} onClick={() => setConfirmAbsent(false)} className={secondary}>Volver</button>
          </div>
        </div>
      )}
      {priceOpen && (
        <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-700">Precio acordado: <strong>{formatCurrency(totalPrice)}</strong>. El cliente debe aceptar el nuevo precio antes de pagar.</p>
          <label htmlFor={amountId} className="block text-sm font-medium text-gray-700">Precio final</label>
          <input id={amountId} autoFocus inputMode="numeric" pattern="[0-9]*" autoComplete="off" aria-describedby={hintId} className={field} placeholder="Ej.: 150000" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, '').slice(0, 9))} />
          <p id={hintId} className="text-xs text-gray-600">{value > 0 ? `Nuevo precio: ${formatCurrency(value)}. ` : ''}Escribe también el motivo (mínimo 5 caracteres).</p>
          <label htmlFor={noteId} className="block text-sm font-medium text-gray-700">¿Por qué cambia? (lo verá el cliente)</label>
          <textarea id={noteId} rows={2} className={field} placeholder="Ej.: hubo que cambiar también el sifón" value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" disabled={busy !== null || !priceReady} onClick={() => run('propose_price', { amount: value, note: note.trim() })} className={`inline-flex min-h-[44px] w-full items-center justify-center gap-2 text-sm sm:w-auto disabled:cursor-not-allowed disabled:opacity-60 ${focusRing} ${DESIGN_SYSTEM.components.button.primary}`}>
              {busy === 'propose_price' && <Loader2 size={18} className="shrink-0 animate-spin" aria-hidden="true" />} Enviar al cliente
            </button>
            <button type="button" disabled={busy !== null} onClick={() => setPriceOpen(false)} className={secondary}>Volver</button>
          </div>
        </div>
      )}
      <span className="sr-only" role="status">{busy ? 'Enviando…' : message?.ok ? message.text : ''}</span>
      {message && <p role={message.ok ? undefined : 'alert'} className={`text-sm font-medium ${message.ok ? 'text-green-800' : 'text-red-700'}`}>{message.text}</p>}
    </div>
  )
}
