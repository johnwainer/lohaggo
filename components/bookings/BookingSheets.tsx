'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X } from 'lucide-react'
import { useDialog } from '@/components/ui/use-dialog'

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2'

function Sheet({ title, subtitle, onClose, dismissible = true, children }: { title: string; subtitle?: string; onClose: () => void; dismissible?: boolean; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const { dialogProps, titleId } = useDialog(mounted, onClose, { dismissible })
  if (!mounted) return null
  const subtitleId = `${titleId}-sub`
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" onClick={dismissible ? onClose : undefined} />
      <div
        {...dialogProps}
        aria-describedby={subtitle ? subtitleId : undefined}
        className="relative max-h-[90dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] focus:outline-none sm:max-w-md sm:rounded-3xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-lg font-bold text-gray-900">{title}</h2>
            {subtitle && <p id={subtitleId} className="mt-1 text-sm text-gray-600">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className={`-mr-2 -mt-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 ${focusRing}`} aria-label="Cerrar"><X size={20} aria-hidden="true" /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

const field = 'w-full rounded-2xl border border-gray-200 px-4 py-3 text-base focus:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500'
const todayBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
const TIMES = Array.from({ length: 29 }, (_, i) => `${String(6 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)

const REASONS = ['Ya no lo necesito', 'Encontré otra solución', 'Cambió mi horario', 'El precio no me sirve']

/** Cancel with a reason (required by the platform); PATCH /api/bookings/{id}. */
export function CancelBookingSheet({ bookingId, serviceName, onClose, onDone }: { bookingId: string; serviceName: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const tooShort = reason.trim().length < 5
  async function submit() {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/bookings/${bookingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'CANCELLED', reason: reason.trim() }) })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setError(data.error || 'No se pudo cancelar')
    onDone()
  }
  return (
    <Sheet title="Cancelar reserva" subtitle={`${serviceName}. Cuéntanos por qué: el socio y soporte lo verán.`} onClose={onClose} dismissible={!busy}>
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Motivos frecuentes">
        {REASONS.map((r) => (
          <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)} className={`min-h-[44px] rounded-full border px-4 py-2 text-sm ${focusRing} ${reason === r ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-gray-300 text-gray-700'}`}>{r}</button>
        ))}
      </div>
      <label htmlFor="cancel-booking-reason" className="mb-1 block text-sm font-medium text-gray-700">Motivo de la cancelación</label>
      <textarea id="cancel-booking-reason" className={field} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Cuéntanos qué pasó" aria-describedby={tooShort ? 'cancel-booking-reason-hint' : undefined} />
      {tooShort && <p id="cancel-booking-reason-hint" className="mt-1 text-sm text-gray-600">Escribe al menos 5 caracteres</p>}
      {error && <p className="mt-2 text-sm text-rose-700" role="alert">{error}</p>}
      <button type="button" onClick={submit} disabled={busy || tooShort} aria-describedby={tooShort ? 'cancel-booking-reason-hint' : undefined} className={`mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-rose-600 py-3.5 font-semibold text-white disabled:opacity-50 ${focusRing}`}>
        {busy && <Loader2 size={18} className="animate-spin" aria-hidden="true" />} Cancelar reserva
      </button>
    </Sheet>
  )
}

/** Move the service to another day and time; POST /api/bookings/{id}/reschedule. */
export function RescheduleBookingSheet({ bookingId, serviceName, note, onClose, onDone }: { bookingId: string; serviceName: string; note?: string; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit() {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/bookings/${bookingId}/reschedule`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scheduledDate: date, scheduledTime: time }) })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setError(data.error || 'No se pudo reprogramar')
    onDone()
  }
  return (
    <Sheet title="Reprogramar" subtitle={note ?? `${serviceName}. Elige el nuevo día y hora.`} onClose={onClose} dismissible={!busy}>
      <div className="grid grid-cols-2 gap-2">
        <label htmlFor="reschedule-date" className="block text-sm font-medium text-gray-700">Nueva fecha</label>
        <label htmlFor="reschedule-time" className="block text-sm font-medium text-gray-700">Nueva hora</label>
        <input id="reschedule-date" type="date" className={field} min={todayBogota()} value={date} onChange={(e) => setDate(e.target.value)} />
        <select id="reschedule-time" className={field} value={time} onChange={(e) => setTime(e.target.value)}>
          <option value="">Hora</option>
          {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      {(!date || !time) && <p className="mt-2 text-sm text-gray-600">Elige el día y la hora para guardar.</p>}
      {error && <p className="mt-2 text-sm text-rose-700" role="alert">{error}</p>}
      <button type="button" onClick={submit} disabled={busy || !date || !time} className={`mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-primary-600 py-3.5 font-semibold text-white disabled:opacity-50 ${focusRing}`}>
        {busy && <Loader2 size={18} className="animate-spin" aria-hidden="true" />} Guardar nueva fecha
      </button>
    </Sheet>
  )
}
