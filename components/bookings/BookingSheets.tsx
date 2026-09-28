'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X } from 'lucide-react'

function Sheet({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="-mr-1 rounded-full p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Cerrar"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

const field = 'w-full rounded-2xl border border-gray-200 px-4 py-3 text-base outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30'
const todayBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
const TIMES = Array.from({ length: 29 }, (_, i) => `${String(6 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)

const REASONS = ['Ya no lo necesito', 'Encontré otra solución', 'Cambió mi horario', 'El precio no me sirve']

/** Cancel with a reason (required by the platform); PATCH /api/bookings/{id}. */
export function CancelBookingSheet({ bookingId, serviceName, onClose, onDone }: { bookingId: string; serviceName: string; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
    <Sheet title="Cancelar reserva" subtitle={`${serviceName}. Cuéntanos por qué: el socio y soporte lo verán.`} onClose={onClose}>
      <div className="mb-3 flex flex-wrap gap-2">
        {REASONS.map((r) => (
          <button key={r} type="button" onClick={() => setReason(r)} className={`rounded-full border px-3 py-1.5 text-sm ${reason === r ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-gray-200 text-gray-700'}`}>{r}</button>
        ))}
      </div>
      <textarea className={field} rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo de la cancelación" aria-label="Motivo de la cancelación" />
      {error && <p className="mt-2 text-sm text-rose-600" role="alert">{error}</p>}
      <button onClick={submit} disabled={busy || reason.trim().length < 5} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-rose-600 py-3.5 font-semibold text-white disabled:opacity-50">
        {busy && <Loader2 size={18} className="animate-spin" />} Cancelar reserva
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
    <Sheet title="Reprogramar" subtitle={note ?? `${serviceName}. Elige el nuevo día y hora.`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        <input type="date" className={field} min={todayBogota()} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Nueva fecha" />
        <select className={field} value={time} onChange={(e) => setTime(e.target.value)} aria-label="Nueva hora">
          <option value="">Hora</option>
          {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      {error && <p className="mt-2 text-sm text-rose-600" role="alert">{error}</p>}
      <button onClick={submit} disabled={busy || !date || !time} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-primary-600 py-3.5 font-semibold text-white disabled:opacity-50">
        {busy && <Loader2 size={18} className="animate-spin" />} Guardar nueva fecha
      </button>
    </Sheet>
  )
}
