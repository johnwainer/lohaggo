'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CalendarClock, Loader2, RefreshCw } from 'lucide-react'

type Stage = 'pending' | 'confirmed' | 'reconfirmed' | 'on_way' | 'started' | 'finished' | 'paid' | 'cancelled'
type Flag = 'late' | 'partner_silent' | 'not_reconfirmed' | 'on_hold' | 'no_show_claim' | 'client_absent' | 'late_start' | 'unpaid'
type Item = {
  id: string; ref: string; requestId: string | null; when: string; service: string; client: string; partner: string
  price: number; status: string; stage: Stage; flags: Flag[]; eta: string | null; startedAt: string | null
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' })

const STAGE: Record<Stage, { label: string; tone: string }> = {
  pending: { label: 'Sin confirmar por el socio', tone: 'bg-amber-100 text-amber-900' },
  confirmed: { label: 'Confirmada', tone: 'bg-sky-100 text-sky-900' },
  reconfirmed: { label: 'Cliente reconfirmó', tone: 'bg-sky-100 text-sky-900' },
  on_way: { label: 'Socio en camino', tone: 'bg-violet-100 text-violet-900' },
  started: { label: 'En curso', tone: 'bg-indigo-100 text-indigo-900' },
  finished: { label: 'Terminado, sin pago', tone: 'bg-amber-100 text-amber-900' },
  paid: { label: 'Terminado y pagado', tone: 'bg-green-100 text-green-900' },
  cancelled: { label: 'Cancelada', tone: 'bg-gray-100 text-gray-700' },
}

const FLAG: Record<Flag, string> = {
  late: 'Retrasado', partner_silent: 'Socio sin responder', not_reconfirmed: 'Sin reconfirmar', on_hold: 'En espera',
  no_show_claim: 'Reclamo: no llegó', client_absent: 'Cliente ausente', late_start: 'Inició tarde', unpaid: 'Pago pendiente',
}

/** Admin «Servicios de hoy»: today's bookings with their live state and red flags. Mobile-first cards. */
export default function TodayServices() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/bookings/today', { cache: 'no-store' })
      if (!res.ok) throw new Error(res.status === 401 ? 'Tu sesión venció.' : `El servidor respondió ${res.status}.`)
      const data = await res.json()
      setItems(data.items ?? [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error && err.message !== 'Failed to fetch' ? err.message : 'Sin conexión.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [load])

  const flagged = items?.filter((i) => i.flags.length).length ?? 0

  return (
    <section aria-labelledby="today-services" className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm space-y-3 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="today-services" className="flex items-center gap-2 text-base font-bold text-gray-900"><CalendarClock size={18} aria-hidden="true" /> Servicios de hoy</h2>
          {items && <p className="text-xs text-gray-500">{items.length} {items.length === 1 ? 'reserva' : 'reservas'}{flagged ? ` · ${flagged} con alertas` : ''}</p>}
        </div>
        <button type="button" onClick={load} disabled={loading} aria-label="Actualizar" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-60">
          {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}
        </button>
      </div>
      {error && <p role="alert" className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700"><AlertTriangle size={14} aria-hidden="true" /> No se pudo cargar. {error}</p>}
      {items && !items.length && <p className="text-sm text-gray-500">No hay servicios agendados para hoy.</p>}
      {!items && !error && (
        <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
          {[0, 1, 2].map((k) => <li key={k} className="h-[88px] animate-pulse rounded-2xl bg-gray-100" />)}
        </ul>
      )}
      <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {/* Red flags first, then by hour */}
        {[...(items ?? [])].sort((a, b) => b.flags.length - a.flags.length || a.when.localeCompare(b.when)).map((i) => (
          <li key={i.id} className={`min-w-0 rounded-2xl border p-3 ${i.flags.some((f) => f !== 'late_start' && f !== 'unpaid') ? 'border-rose-200 border-l-4 border-l-rose-500 bg-rose-50/40' : 'border-gray-100'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="line-clamp-2 break-words text-sm font-semibold text-gray-900">{clock(i.when)} · {i.service}</p>
                <p className="break-words text-xs text-gray-500">{i.client} con {i.partner}</p>
                <p className="text-xs font-medium text-gray-500">#{i.ref}</p>
              </div>
              {i.requestId && <Link href={`/admin/service-requests/${i.requestId}`} className="inline-flex min-h-11 shrink-0 items-center px-2 text-sm font-semibold text-primary-600 hover:underline">Abrir</Link>}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {i.flags.map((f) => (
                <span key={f} className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800"><AlertTriangle size={11} aria-hidden="true" />{FLAG[f]}</span>
              ))}
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STAGE[i.stage].tone}`}>
                {STAGE[i.stage].label}{i.stage === 'on_way' && i.eta ? ` · llega ${clock(i.eta)}` : ''}{i.stage === 'started' && i.startedAt ? ` · ${clock(i.startedAt)}` : ''}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
