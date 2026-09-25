'use client'

import { useState } from 'react'
import { AlertCircle, CalendarClock, Loader2, Moon, Pause, Play, Radar, Wallet } from 'lucide-react'
import { MODE_LABEL, type HaggoConfig } from '@/lib/haggo/config'
import { FindingList } from '@/components/admin/haggo/FindingList'
import { ago, api, btn, btnPrimary, card, RUN_TYPE, runStatus, TRIGGER, until, usd, when, type Finding, type Run } from '@/components/admin/haggo/shared'

export type Overview = {
  config: HaggoConfig
  focus: string | null
  lastSnapshotAt: string | null
  working: boolean
  quietNow: boolean
  last: Record<'cycle' | 'daily' | 'weekly', Run | null>
  next: Record<'cycle' | 'daily' | 'weekly', string | null>
  budget: { monthUsd: number; todayUsd: number; calls: number; blocked: 'month' | 'day' | null; monthlyUsd: number; dailyUsd: number }
  findings: Finding[]
  runs: Run[]
  pendingApprovals: number
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 100
  return <div className="h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-primary-500'}`} style={{ width: `${pct}%` }} /></div>
}

export function NowTab({ data, reload }: { data: Overview; reload: () => void }) {
  const [running, setRunning] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const c = data.config

  async function run(type: 'cycle' | 'daily') {
    setRunning(type)
    setMsg(null)
    try {
      const r = await api<{ ok: boolean; summary: string; costUsd: number }>('/api/admin/haggo/run', { method: 'POST', body: JSON.stringify({ type }) })
      setMsg({ ok: r.ok, text: `${r.summary}${r.costUsd ? ` (${usd(r.costUsd)})` : ''}` })
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Error' })
    } finally {
      setRunning(null)
      reload()
    }
  }

  async function toggle() {
    if (c.enabled && !window.confirm('¿Detener a Haggo? Deja de revisar, informar y actuar hasta que lo reanudes.')) return
    await api('/api/admin/haggo/settings', { method: 'PUT', body: JSON.stringify({ enabled: !c.enabled }) })
    reload()
  }

  return (
    <div className="space-y-5">
      <section className={`${card} p-5`}>
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${!c.enabled ? 'bg-rose-100 text-rose-700' : data.working ? 'bg-primary-50 text-primary-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {data.working ? <Loader2 size={12} className="animate-spin" /> : <span className={`h-1.5 w-1.5 rounded-full ${c.enabled ? 'bg-emerald-500' : 'bg-rose-500'}`} />}
                {!c.enabled ? 'Detenido' : data.working ? 'Trabajando' : 'Vigilando'}
              </span>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">Modo {MODE_LABEL[c.mode]}</span>
              {data.quietNow && <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"><Moon size={12} /> Horas sin actuar solo</span>}
              {data.pendingApprovals > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">{data.pendingApprovals} por aprobar</span>}
            </div>
            <p className="mt-3 text-lg font-semibold text-gray-900">{data.focus || 'Todavía no ha hecho su primera revisión.'}</p>
            <p className="mt-1 text-sm text-gray-500">
              {data.last.cycle ? <>Última revisión {ago(data.last.cycle.startedAt)}: {data.last.cycle.summary || data.last.cycle.error}</> : 'Sin revisiones todavía.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => run('cycle')} disabled={Boolean(running) || data.working} className={btnPrimary}>
              {running === 'cycle' ? <Loader2 size={15} className="animate-spin" /> : <Radar size={15} />} Revisar ahora
            </button>
            <button onClick={toggle} className={c.enabled ? `${btn} text-rose-600` : btn}>{c.enabled ? <><Pause size={15} /> Detener a Haggo</> : <><Play size={15} /> Reanudar</>}</button>
          </div>
        </div>
        {running && <p className="mt-3 text-xs text-gray-500">Haggo está investigando con sus herramientas; puede tardar uno o dos minutos.</p>}
        {msg && <p className={`mt-3 flex items-center gap-1.5 text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{!msg.ok && <AlertCircle size={15} />}{msg.text}</p>}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className={`${card} p-5`}>
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-900"><CalendarClock size={17} /> Próximas ejecuciones</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-gray-500">Revisión (cada {c.cycleMinutes} min)</dt><dd className="text-gray-900">{c.enabled ? until(data.next.cycle) : '—'}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Informe diario</dt><dd className="text-gray-900">{c.dailyReportHour == null ? 'Apagado' : when(data.next.daily)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Revisión semanal</dt><dd className="text-gray-900">{c.weeklyReviewDay == null ? 'Apagada' : when(data.next.weekly)}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-gray-500">Solo llama a la IA cuando detecta algo nuevo; si no, revisa con reglas y no cuesta.</p>
        </section>
        <section className={`${card} p-5`}>
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-900"><Wallet size={17} /> Presupuesto de IA</h2>
          <div className="space-y-3 text-sm">
            <div><div className="mb-1 flex justify-between"><span className="text-gray-500">Este mes</span><span className="font-medium text-gray-900">{usd(data.budget.monthUsd)} de {usd(data.budget.monthlyUsd)}</span></div><Bar value={data.budget.monthUsd} max={data.budget.monthlyUsd} /></div>
            <div><div className="mb-1 flex justify-between"><span className="text-gray-500">Hoy</span><span className="font-medium text-gray-900">{usd(data.budget.todayUsd)} de {usd(data.budget.dailyUsd)}</span></div><Bar value={data.budget.todayUsd} max={data.budget.dailyUsd} /></div>
          </div>
          {data.budget.blocked && <p className="mt-3 text-xs font-medium text-rose-600">Tope {data.budget.blocked === 'month' ? 'mensual' : 'diario'} alcanzado: Haggo sigue observando solo con reglas, sin IA.</p>}
        </section>
      </div>

      <section className={`${card} p-5`}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Lo que Haggo tiene abierto</h2>
          <span className="text-xs text-gray-500">{data.findings.length} situaciones</span>
        </div>
        <FindingList findings={data.findings} onChange={reload} />
      </section>

      <section className={`${card} p-5`}>
        <h2 className="mb-3 font-semibold text-gray-900">Últimas ejecuciones</h2>
        <ul className="divide-y divide-gray-100 text-sm">
          {data.runs.length === 0 && <li className="py-4 text-center text-gray-500">Aún no hay ejecuciones.</li>}
          {data.runs.map((r) => (
            <li key={r.id} className="flex items-start gap-3 py-2.5">
              <span className="w-28 shrink-0 text-xs text-gray-500">{when(r.startedAt)}</span>
              <span className="min-w-0 flex-1">
                <span className="text-gray-900">{RUN_TYPE[r.type] ?? r.type}</span>
                {r.trigger && r.trigger !== 'schedule' && <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 text-[11px] text-gray-600">{TRIGGER[r.trigger] ?? r.trigger}</span>}
                <span className={`ml-2 text-xs ${runStatus(r.status).cls}`}>{runStatus(r.status).label}</span>
                <span className="block truncate text-xs text-gray-500">{r.summary || r.error}</span>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-gray-500">{r.costUsd ? usd(r.costUsd) : '$0'}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
