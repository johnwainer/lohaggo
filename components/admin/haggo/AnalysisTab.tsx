'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, FileText, Loader2 } from 'lucide-react'
import { FindingList } from '@/components/admin/haggo/FindingList'
import { api, btn, card, domainLabel, RUN_TYPE, usd, when, type Finding } from '@/components/admin/haggo/shared'

type Report = { id: string; type: string; status: string; summary: string | null; report: string | null; output: { recommendations?: Array<{ domain: string; title: string; why: string }> } | null; error: string | null; costUsd: number; startedAt: string }

/** Reports (daily, weekly) and every finding, open or closed. */
export function AnalysisTab() {
  const [status, setStatus] = useState<'open' | 'closed'>('open')
  const [data, setData] = useState<{ findings: Finding[]; reports: Report[] } | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setData(await api(`/api/admin/haggo/analysis?status=${status}`))
  }, [status])
  useEffect(() => { load().catch((e) => setError(e.message)) }, [load])

  async function generate(type: 'daily' | 'weekly') {
    setRunning(type)
    setError(null)
    try {
      await api('/api/admin/haggo/run', { method: 'POST', body: JSON.stringify({ type }) })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setRunning(null)
    }
  }

  if (!data) return <div className="flex items-center gap-2 p-6 text-gray-500"><Loader2 size={16} className="animate-spin" /> Cargando…</div>
  return (
    <div className="space-y-5">
      <section className={`${card} p-5`}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="flex flex-1 items-center gap-2 font-semibold text-gray-900"><FileText size={17} /> Informes</h2>
          <button onClick={() => generate('daily')} disabled={Boolean(running)} className={btn}>{running === 'daily' && <Loader2 size={14} className="animate-spin" />} Generar informe diario ahora</button>
          <button onClick={() => generate('weekly')} disabled={Boolean(running)} className={btn}>{running === 'weekly' && <Loader2 size={14} className="animate-spin" />} Revisión semanal ahora</button>
        </div>
        {running && <p className="mb-2 text-xs text-gray-500">Haggo está escribiendo el informe; puede tardar un par de minutos.</p>}
        {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}
        {data.reports.length === 0 && <p className="py-4 text-center text-sm text-gray-500">Todavía no hay informes. El diario sale a la hora configurada en Ajustes.</p>}
        <ul className="divide-y divide-gray-100">
          {data.reports.map((r) => {
            const expanded = open === r.id
            return (
              <li key={r.id} className="py-3">
                <button onClick={() => setOpen(expanded ? null : r.id)} className="flex w-full items-start gap-3 text-left">
                  <span className="w-32 shrink-0 text-xs text-gray-500">{when(r.startedAt)}<span className="block">{RUN_TYPE[r.type]}</span></span>
                  <span className={`min-w-0 flex-1 text-sm ${r.status === 'error' ? 'text-rose-600' : 'text-gray-900'}`}>{r.summary || r.error}</span>
                  <span className="shrink-0 text-xs text-gray-400">{r.costUsd ? usd(r.costUsd) : ''}</span>
                  <ChevronDown size={16} className={`shrink-0 text-gray-400 transition ${expanded ? 'rotate-180' : ''}`} />
                </button>
                {expanded && (
                  <div className="mt-3 space-y-4 rounded-xl bg-gray-50 p-4">
                    {r.report && <div className="whitespace-pre-line text-sm leading-relaxed text-gray-800">{r.report}</div>}
                    {!!r.output?.recommendations?.length && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Recomendaciones</p>
                        <ul className="space-y-2">
                          {r.output.recommendations.map((rec, i) => (
                            <li key={i} className="rounded-lg bg-white p-3 text-sm"><span className="font-medium text-gray-900">{rec.title}</span> <span className="text-xs text-gray-500">· {domainLabel(rec.domain)}</span><span className="mt-0.5 block text-gray-600">{rec.why}</span></li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section className={`${card} p-5`}>
        <div className="mb-1 flex items-center gap-2">
          <h2 className="flex-1 font-semibold text-gray-900">Hallazgos</h2>
          {(['open', 'closed'] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={`rounded-full px-3 py-1 text-xs font-medium ${status === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}>{s === 'open' ? 'Abiertos' : 'Cerrados'}</button>
          ))}
        </div>
        <FindingList findings={data.findings} onChange={load} empty={status === 'open' ? 'Nada abierto: todo en orden.' : 'No hay hallazgos cerrados.'} />
      </section>
    </div>
  )
}
