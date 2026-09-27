'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Loader2, RefreshCw, Send, XCircle } from 'lucide-react'

type Row = {
  code: string
  name: string
  category: string
  finalCategory: string | null
  status: string
  reason: string | null
  sid: string | null
  usage: string
  recategorized: boolean
  sent24h: number
}

type Filter = 'all' | 'approved' | 'pending' | 'rejected' | 'recategorized' | 'missing'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'approved', label: 'Aprobadas' },
  { id: 'pending', label: 'En revisión' },
  { id: 'rejected', label: 'Rechazadas' },
  { id: 'recategorized', label: 'Recategorizadas' },
  { id: 'missing', label: 'Sin crear' },
]

const isPending = (s: string) => s === 'pending' || s === 'received' || s === 'unsubmitted'

function matches(r: Row, f: Filter) {
  if (f === 'all') return true
  if (f === 'pending') return isPending(r.status)
  if (f === 'recategorized') return r.recategorized
  return r.status === f
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved') return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700"><CheckCircle2 size={11} /> Aprobada</span>
  if (status === 'rejected') return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700"><XCircle size={11} /> Rechazada</span>
  if (status === 'unsubmitted') return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Sin enviar a Meta</span>
  if (status === 'missing') return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Sin crear</span>
  if (status === 'paused' || status === 'disabled') return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700"><AlertTriangle size={11} /> {status === 'paused' ? 'Pausada' : 'Desactivada'}</span>
  return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700"><Clock size={11} /> En revisión</span>
}

/**
 * The WhatsApp catalog as the platform uses it: Meta's state of each template, its final category, the
 * event that sends it and how many went out in 24 h. Templates become active on their own when Meta
 * approves them; «Refrescar estado» reads Twilio again instead of waiting for the 30-minute cache.
 */
export default function WaCatalogPanel() {
  const [rows, setRows] = useState<Row[]>([])
  const [legacy, setLegacy] = useState<Array<{ template: string; sent: number }>>([])
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')

  const load = useCallback(async (fresh: boolean) => {
    fresh ? setRefreshing(true) : setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/messaging/wa-templates/catalog', { method: fresh ? 'POST' : 'GET' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'No se pudo leer el catálogo')
      setRows(data.rows || [])
      setLegacy(data.legacy24h || [])
      setCheckedAt(data.checkedAt || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load(false) }, [load])

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, rows.filter((r) => matches(r, f.id)).length])) as Record<Filter, number>, [rows])
  const visible = rows.filter((r) => matches(r, filter))
  const sentTotal = rows.reduce((a, r) => a + r.sent24h, 0) + legacy.reduce((a, l) => a + l.sent, 0)

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800">Catálogo de plantillas de WhatsApp</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Cada plantilla sale sola en su evento el día que Meta la aprueba. Mientras tanto se usa la versión anterior aprobada, si existe.
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-1.5 text-xs font-semibold border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-full transition-colors disabled:opacity-50 shrink-0"
          >
            {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Refrescar estado
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Aprobadas" value={`${counts.approved}/${rows.length}`} tone="green" />
          <Stat label="En revisión" value={counts.pending} tone="yellow" />
          <Stat label="Rechazadas" value={counts.rejected} tone={counts.rejected ? 'red' : 'gray'} />
          <Stat label="Enviadas 24 h" value={sentTotal} tone="gray" />
        </div>
        {checkedAt && <p className="text-[11px] text-gray-400">Estado leído {new Date(checkedAt).toLocaleString('es-CO', { timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })} · se actualiza solo cada 30 min</p>}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${filter === f.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
          >
            {f.label} <span className="opacity-60">{counts[f.id] ?? 0}</span>
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="animate-spin" size={20} /></div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-10 bg-white rounded-2xl border border-gray-100">No hay plantillas en este filtro.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((r) => (
            <li key={r.name} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full">{r.code}</span>
                <StatusBadge status={r.status} />
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${r.recategorized ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-500'}`}>
                  {r.recategorized ? `${r.category} → ${r.finalCategory}` : r.finalCategory || r.category}
                </span>
                {r.sent24h > 0 && (
                  <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-gray-600"><Send size={11} /> {r.sent24h} en 24 h</span>
                )}
              </div>
              <p className="text-sm font-semibold text-gray-800 break-all">{r.name}</p>
              {r.usage && <p className="text-xs text-gray-500">{r.usage}</p>}
              {r.status === 'rejected' && r.reason && (
                <p className="text-xs text-red-600 flex items-start gap-1"><AlertTriangle size={12} className="mt-0.5 shrink-0" /> <span className="break-words">{r.reason}</span></p>
              )}
              {r.recategorized && (
                <p className="text-xs text-orange-700 flex items-start gap-1"><AlertTriangle size={12} className="mt-0.5 shrink-0" /> Meta la aprobó como {r.finalCategory}: solo sale si ninguna versión UTILITY está aprobada, respetando horario y exclusión de marketing.</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {legacy.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-700 mb-2">Plantillas anteriores usadas en 24 h (mientras Meta revisa las nuevas)</p>
          <ul className="space-y-1">
            {legacy.map((l) => (
              <li key={l.template} className="flex items-center justify-between gap-2 text-xs text-gray-600">
                <span className="break-all">{l.template}</span>
                <span className="font-semibold shrink-0">{l.sent}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: 'green' | 'yellow' | 'red' | 'gray' }) {
  const color = { green: 'text-green-700 bg-green-50', yellow: 'text-yellow-700 bg-yellow-50', red: 'text-red-700 bg-red-50', gray: 'text-gray-700 bg-gray-50' }[tone]
  return (
    <div className={`rounded-2xl px-3 py-2 ${color}`}>
      <p className="text-lg font-bold leading-tight">{value}</p>
      <p className="text-[11px] font-medium opacity-80">{label}</p>
    </div>
  )
}
