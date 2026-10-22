'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useDialog } from '@/components/ui/use-dialog'
import { formatSeconds, percent, type MetricPeriod } from '@/lib/inbox/metrics-core'

type Metrics = {
  days: number
  conversations: number
  firstResponse: { medianSeconds: number | null; answered: number; unanswered: number }
  ai: { closed: number; byAi: number; rate: number | null }
  handoffs: { total: number; top: { reason: string; count: number }[] }
  reopened: number
  csat: { asked: number; answered: number; average: number | null }
}

const n = (x: number) => x.toLocaleString('es-CO')

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-gray-50 p-3 min-w-0">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-gray-900">{value}</p>
      {hint && <p className="text-[11px] text-gray-400 break-words">{hint}</p>}
    </div>
  )
}

/** How the inbox is doing in the last 7 or 30 days. */
export default function InboxMetricsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dialogProps, titleId } = useDialog(open, onClose)
  const [days, setDays] = useState<MetricPeriod>(7)
  const [data, setData] = useState<Metrics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/admin/inbox/metrics?days=${days}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error || `No se pudieron calcular las métricas (HTTP ${r.status})`)
        if (!cancelled) setData(d)
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudieron calcular las métricas') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, days])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={onClose} />
      <div {...dialogProps} className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-5 shadow-xl focus:outline-none">
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-base font-bold text-gray-900">Métricas de la bandeja</h2>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>

        <div role="group" aria-label="Periodo" className="mt-3 inline-flex rounded-full bg-gray-100 p-0.5">
          {([7, 30] as MetricPeriod[]).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              aria-pressed={days === d}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${days === d ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}
            >
              Últimos {d} días
            </button>
          ))}
        </div>

        <div className="mt-4" aria-live="polite">
          {loading && !data && <p className="text-sm text-gray-500">Calculando…</p>}
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          {data && (
            <div className={`space-y-4 ${loading ? 'opacity-60' : ''}`}>
              <div className="grid grid-cols-2 gap-2">
                <Stat
                  label="Primera respuesta (mediana)"
                  value={formatSeconds(data.firstResponse.medianSeconds)}
                  hint={`${n(data.firstResponse.answered)} respondidas · ${n(data.firstResponse.unanswered)} sin respuesta`}
                />
                <Stat label="Resueltas solo por la IA" value={percent(data.ai.rate)} hint={`${n(data.ai.byAi)} de ${n(data.ai.closed)} cerradas`} />
                <Stat label="Reabiertas" value={n(data.reopened)} hint="El contacto volvió a escribir tras el cierre" />
                <Stat
                  label="Satisfacción (CSAT)"
                  value={data.csat.average === null ? '—' : `${data.csat.average.toFixed(1)} / 5`}
                  hint={`${n(data.csat.answered)} respuestas de ${n(data.csat.asked)} encuestas`}
                />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700">Motivos de traspaso a una persona <span className="font-normal text-gray-400">({n(data.handoffs.total)})</span></p>
                {data.handoffs.top.length === 0 ? (
                  <p className="mt-1 text-xs text-gray-400">La IA no traspasó conversaciones en este periodo.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {data.handoffs.top.map((h) => (
                      <li key={h.reason} className="flex items-center gap-2 text-xs">
                        <span className="flex-1 min-w-0 truncate text-gray-700">{h.reason}</span>
                        <span className="h-1.5 w-20 sm:w-28 shrink-0 overflow-hidden rounded-full bg-gray-100">
                          <span className="block h-full rounded-full bg-primary-500" style={{ width: `${Math.round((h.count / data.handoffs.top[0].count) * 100)}%` }} />
                        </span>
                        <span className="w-8 shrink-0 text-right font-semibold text-gray-900">{n(h.count)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <p className="text-[11px] text-gray-400">
                Sobre {n(data.conversations)} conversaciones iniciadas en el periodo (sin pruebas ni comentarios). Primera respuesta: del primer mensaje del contacto a la primera respuesta de una persona o de la IA.
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="rounded-full border px-4 py-2.5 sm:py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cerrar</button>
        </div>
      </div>
    </div>
  )
}
