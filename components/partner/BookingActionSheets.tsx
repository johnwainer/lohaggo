'use client'

import { useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { calendarDayKey } from '@/lib/bookings/when'
import { useDialog } from '@/components/ui/use-dialog'

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2'

function Sheet({ title, onClose, dismissible = true, children }: { title: string; onClose: () => void; dismissible?: boolean; children: ReactNode }) {
  const { dialogProps, titleId } = useDialog(true, onClose, { dismissible })
  // On <body>, above the bottom nav whatever the parent's stacking context
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={dismissible ? onClose : undefined} />
      <div
        {...dialogProps}
        className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl focus:outline-none sm:rounded-3xl"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 id={titleId} className="text-lg font-bold text-gray-900">{title}</h3>
          <button type="button" onClick={onClose} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 ${focusRing}`} aria-label="Cerrar">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

const todayBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)

const inputClass = 'w-full rounded-2xl border-2 border-gray-200 px-4 py-3 text-base focus:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500'

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'No se pudo completar la acción')
  return data
}

export function RescheduleSheet({ booking, onClose, onDone }: {
  booking: { id: string; serviceName: string; scheduledDate: string; scheduledTime: string }
  onClose: () => void
  onDone: () => void
}) {
  const min = todayBogota()
  const current = booking.scheduledDate ? calendarDayKey(booking.scheduledDate) : undefined
  const [date, setDate] = useState(current && current >= min ? current : min)
  const [time, setTime] = useState(TIME_SLOTS.includes(booking.scheduledTime) ? booking.scheduledTime : '08:00')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    if (!date || date < min) { setError('Elige una fecha desde hoy'); return }
    setSaving(true)
    try {
      await send(`/api/bookings/${booking.id}/reschedule`, 'POST', { scheduledDate: date, scheduledTime: time })
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo reprogramar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title="Reprogramar servicio" onClose={onClose} dismissible={!saving}>
      <p className="mb-4 text-sm text-gray-600">Elige la nueva fecha y hora para «{booking.serviceName}». Le avisaremos al cliente.</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Fecha</span>
          <input type="date" value={date} min={min} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">Hora</span>
          <select value={time} onChange={(e) => setTime(e.target.value)} className={`${inputClass} bg-white`}>
            {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="mt-3 text-sm font-medium text-red-700" role="alert">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={saving}
        className={`mt-5 flex min-h-[48px] w-full items-center justify-center rounded-full bg-primary-600 px-5 font-semibold text-white hover:bg-primary-700 disabled:opacity-60 ${focusRing}`}
      >
        {saving ? 'Guardando…' : 'Reprogramar'}
      </button>
    </Sheet>
  )
}

export function CancelReasonSheet({ booking, title, onClose, onDone }: {
  booking: { id: string; serviceName: string }
  title: string
  onClose: () => void
  onDone: () => void
}) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const valid = reason.trim().length >= 5
  const reasonId = useId()

  const submit = async () => {
    setError('')
    if (!valid) { setError('Cuéntale al cliente el motivo (mínimo 5 caracteres)'); return }
    setSaving(true)
    try {
      await send(`/api/bookings/${booking.id}`, 'PATCH', { status: 'CANCELLED', reason: reason.trim() })
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cancelar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title={title} onClose={onClose} dismissible={!saving}>
      <p id={`${reasonId}-desc`} className="mb-3 text-sm text-gray-600">¿Por qué no puedes atender «{booking.serviceName}»? El cliente y soporte verán el motivo.</p>
      <label htmlFor={reasonId} className="mb-1 block text-sm font-medium text-gray-700">Motivo</label>
      <textarea
        id={reasonId}
        aria-describedby={`${reasonId}-desc ${reasonId}-count${valid ? '' : ` ${reasonId}-hint`}`}
        value={reason}
        onChange={(e) => setReason(e.target.value.slice(0, 500))}
        rows={4}
        placeholder="Ej.: tuve un imprevisto y no llego a tiempo"
        className={`${inputClass} resize-none`}
        autoFocus
      />
      <div className="mt-1 flex items-start justify-between gap-3 text-xs text-gray-600">
        <span id={`${reasonId}-hint`}>{valid ? '' : 'Escribe al menos 5 caracteres'}</span>
        <span id={`${reasonId}-count`} className="shrink-0">{reason.length}/500</span>
      </div>
      {error && <p className="mt-2 text-sm font-medium text-red-700" role="alert">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onClose} className={`flex min-h-[48px] flex-1 items-center justify-center rounded-full border border-gray-300 bg-white px-4 font-semibold text-gray-800 hover:bg-gray-50 ${focusRing}`}>
          Volver
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving || !valid}
          className={`flex min-h-[48px] flex-1 items-center justify-center rounded-full bg-red-600 px-4 font-semibold text-white hover:bg-red-700 disabled:opacity-50 ${focusRing}`}
        >
          {saving ? 'Enviando…' : title}
        </button>
      </div>
    </Sheet>
  )
}
