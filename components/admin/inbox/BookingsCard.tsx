'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, CalendarDays, CheckCircle2, ExternalLink, Loader2, RotateCcw, Wallet } from 'lucide-react'
import type { PaymentState } from '@/lib/inbox/bookings-core'

type BookingRow = {
  id: string; ref: string; requestId: string | null; service: string; when: string; status: string; statusLabel: string
  payment: PaymentState; totalPrice: number; counterpart: string | null; canReopen: boolean; needsPayment: boolean
}
type RequestRow = { id: string; ref: string; service: string; status: string; statusLabel: string; when: string; proposals: number }

const TONE: Record<PaymentState['tone'], string> = {
  ok: 'bg-emerald-50 text-emerald-700',
  warn: 'bg-amber-50 text-amber-800',
  bad: 'bg-red-50 text-red-700',
  none: 'bg-gray-100 text-gray-600',
}

const STATUS_TONE: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-900',
  CONFIRMED: 'bg-primary-100 text-primary-800',
  IN_PROGRESS: 'bg-sky-100 text-sky-900',
  COMPLETED: 'bg-secondary-100 text-secondary-900',
}

/** «Reservas y solicitudes» of the linked account, with the team's quick actions. */
export default function BookingsCard({ conversationId, userId }: { conversationId: string; userId: string }) {
  const [data, setData] = useState<{ role: string | null; bookings: BookingRow[]; requests: RequestRow[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/inbox/conversations/${conversationId}/bookings`)
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'No se pudieron cargar las reservas')
      setData(d)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las reservas')
    }
  }, [conversationId])

  useEffect(() => { setData(null); setCancelling(null); setNotice(null); load() }, [load, userId])

  async function cancelAndReopen(b: BookingRow) {
    if (!b.requestId || reason.trim().length < 5) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/service-requests/${b.requestId}/actions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'booking_status', bookingId: b.id, status: 'CANCELLED', reason: reason.trim(), reopen: true }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'No se pudo cancelar la reserva')
      setNotice(`Reserva #${b.ref} cancelada; la solicitud vuelve a los socios.`)
      setCancelling(null)
      setReason('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cancelar la reserva')
    } finally {
      setBusy(false)
    }
  }

  const empty = data && data.bookings.length === 0 && data.requests.length === 0

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-700 flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Reservas y solicitudes</p>
      {error && <p className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700"><AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}</p>}
      {notice && <p className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> {notice}</p>}
      {!data && !error && <p className="flex items-center gap-1.5 text-[11px] text-gray-400"><Loader2 className="h-3 w-3 animate-spin" /> Cargando…</p>}
      {empty && <p className="text-[11px] text-gray-400">Sin reservas activas ni solicitudes abiertas.</p>}
      {data && !empty && (
        <div className="rounded-xl border border-gray-200 divide-y">
          {data.bookings.map((b) => (
            <div key={b.id} className="px-3 py-2.5 space-y-1.5">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">{b.service} <span className="text-[11px] text-gray-400">#{b.ref}</span></p>
                  <p className="text-[11px] text-gray-500">{b.when}{b.counterpart ? ` · ${data.role === 'PARTNER' ? 'Cliente' : 'Socio'}: ${b.counterpart}` : ''}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[b.status] ?? 'bg-gray-100 text-gray-600'}`}>{b.statusLabel}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${TONE[b.payment.tone]}`}>{b.payment.label}</span>
                    <span className="text-[10px] text-gray-500 self-center">${b.totalPrice.toLocaleString('es-CO')}</span>
                  </div>
                </div>
                {b.requestId && (
                  <a href={`/admin/service-requests/${b.requestId}`} className="shrink-0 inline-flex items-center gap-1 text-[11px] text-primary-600 hover:underline">Abrir <ExternalLink className="h-3 w-3" /></a>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {b.needsPayment && b.requestId && (
                  <a href={`/admin/service-requests/${b.requestId}`} className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50">
                    <Wallet className="h-3 w-3" /> Resolver pago
                  </a>
                )}
                {b.canReopen && cancelling !== b.id && (
                  <button onClick={() => { setCancelling(b.id); setReason(''); setNotice(null) }} className="inline-flex items-center gap-1 rounded-full border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50">
                    <RotateCcw className="h-3 w-3" /> Cancelar y reabrir a otros socios
                  </button>
                )}
              </div>
              {cancelling === b.id && (
                <div className="space-y-2 rounded-xl bg-red-50/60 p-2">
                  <label className="block space-y-1">
                    <span className="text-[11px] text-gray-600">Motivo (lo verán el cliente y el socio)</span>
                    <textarea autoFocus rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-base sm:text-sm" placeholder="Ej.: el socio no puede asistir" />
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={() => cancelAndReopen(b)} disabled={busy || reason.trim().length < 5} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Cancelar y reabrir
                    </button>
                    <button onClick={() => setCancelling(null)} disabled={busy} className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">Volver</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {data.requests.map((r) => (
            <div key={r.id} className="flex items-start gap-2 px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 truncate">{r.service} <span className="text-[11px] text-gray-400">#{r.ref}</span></p>
                <p className="text-[11px] text-gray-500">Solicitud · {r.when} · {r.proposals} {r.proposals === 1 ? 'propuesta' : 'propuestas'}</p>
                <span className="mt-1 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-700">{r.statusLabel}</span>
              </div>
              <a href={`/admin/service-requests/${r.id}`} className="shrink-0 inline-flex items-center gap-1 text-[11px] text-primary-600 hover:underline">Abrir <ExternalLink className="h-3 w-3" /></a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
