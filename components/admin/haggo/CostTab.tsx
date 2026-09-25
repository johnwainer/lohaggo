'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api, card, RUN_TYPE, runStatus, usd } from '@/components/admin/haggo/shared'

type Costs = {
  period: string
  budget: { monthUsd: number; todayUsd: number; calls: number; blocked: string | null; monthlyUsd: number; dailyUsd: number }
  byKind: Array<{ kind: string; provider: string; calls: number; costUsd: number; inputTokens: number; outputTokens: number }>
  perDay: Array<{ day: string; costUsd: number }>
  runs: Array<{ type: string; status: string; count: number; costUsd: number }>
}
const KIND: Record<string, string> = { haggo_cycle: 'Ciclos de revisión', haggo_chat: 'Conversación', haggo_report: 'Informes' }

export function CostTab() {
  const [data, setData] = useState<Costs | null>(null)
  useEffect(() => { api<Costs>('/api/admin/haggo/costs').then(setData).catch(() => null) }, [])
  if (!data) return <div className="flex items-center gap-2 p-6 text-gray-500"><Loader2 size={16} className="animate-spin" /> Cargando…</div>
  const max = Math.max(data.budget.dailyUsd, ...data.perDay.map((d) => d.costUsd), 0.0001)
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {[['Gasto del mes', `${usd(data.budget.monthUsd)}`, `de ${usd(data.budget.monthlyUsd)}`], ['Gasto de hoy', usd(data.budget.todayUsd), `de ${usd(data.budget.dailyUsd)} diarios`], ['Llamadas a la IA', String(data.budget.calls), 'este mes']].map(([label, value, sub]) => (
          <div key={label} className={`${card} p-4`}><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-2xl font-bold text-gray-900">{value}</p><p className="text-xs text-gray-500">{sub}</p></div>
        ))}
      </div>

      <section className={`${card} p-5`}>
        <h2 className="mb-4 font-semibold text-gray-900">Por día ({data.period})</h2>
        {data.perDay.length === 0 ? <p className="text-sm text-gray-500">Sin gasto este mes.</p> : (
          <div className="flex h-40 items-end gap-1">
            {data.perDay.map((d) => (
              <div key={d.day} className="group flex flex-1 flex-col items-center justify-end" title={`${d.day}: ${usd(d.costUsd)}`}>
                <div className="w-full rounded-t bg-primary-500/80 group-hover:bg-primary-600" style={{ height: `${Math.max(2, (d.costUsd / max) * 100)}%` }} />
                <span className="mt-1 text-[10px] text-gray-400">{d.day.slice(8)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-gray-500">La escala llega hasta el tope diario ({usd(data.budget.dailyUsd)}): una barra llena es un día en el tope.</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${card} p-5`}>
          <h2 className="mb-3 font-semibold text-gray-900">Por tipo</h2>
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500"><tr className="text-left"><th className="py-1">Tipo</th><th>Proveedor</th><th>Llamadas</th><th>Tokens (ent/sal)</th><th className="text-right">Costo</th></tr></thead>
            <tbody>
              {data.byKind.length === 0 && <tr><td colSpan={5} className="py-3 text-center text-gray-500">Sin llamadas este mes.</td></tr>}
              {data.byKind.map((r) => (
                <tr key={`${r.kind}:${r.provider}`} className="border-t border-gray-100"><td className="py-1.5">{KIND[r.kind] ?? r.kind}</td><td>{r.provider === 'openai' ? 'OpenAI' : 'Claude'}</td><td>{r.calls}</td><td className="text-xs">{r.inputTokens.toLocaleString('es-CO')} / {r.outputTokens.toLocaleString('es-CO')}</td><td className="text-right font-medium">{usd(r.costUsd)}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className={`${card} p-5`}>
          <h2 className="mb-3 font-semibold text-gray-900">Ejecuciones del mes</h2>
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500"><tr className="text-left"><th className="py-1">Tipo</th><th>Resultado</th><th>Veces</th><th className="text-right">Costo</th></tr></thead>
            <tbody>
              {data.runs.map((r) => (
                <tr key={`${r.type}:${r.status}`} className="border-t border-gray-100"><td className="py-1.5">{RUN_TYPE[r.type] ?? r.type}</td><td className={runStatus(r.status).cls}>{runStatus(r.status).label}</td><td>{r.count}</td><td className="text-right">{usd(r.costUsd)}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}
