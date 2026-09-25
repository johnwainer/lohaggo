'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { NowTab, type Overview } from '@/components/admin/haggo/NowTab'
import { AnalysisTab } from '@/components/admin/haggo/AnalysisTab'
import { CostTab } from '@/components/admin/haggo/CostTab'
import { SettingsTab } from '@/components/admin/haggo/SettingsTab'
import { api } from '@/components/admin/haggo/shared'

const TABS = [
  { id: 'now', label: 'Ahora' },
  { id: 'analysis', label: 'Análisis' },
  { id: 'cost', label: 'Costo' },
  { id: 'settings', label: 'Ajustes' },
] as const
type Tab = (typeof TABS)[number]['id']
const TAB_KEY = 'admin.haggo.tab'

/** Haggo, the master agent: what it sees, what it thinks and how it works. Platform superadmin only. */
export default function HaggoPage() {
  const [tab, setTab] = useState<Tab>('now')
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await api<Overview>('/api/admin/haggo'))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY)
      if (saved && TABS.some((t) => t.id === saved)) setTab(saved as Tab)
    } catch {}
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [load])

  const choose = (t: Tab) => {
    setTab(t)
    try { localStorage.setItem(TAB_KEY, t) } catch {}
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-orange-400 text-white shadow-sm"><Sparkles size={24} /></span>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Haggo</h1>
          <p className="text-sm text-gray-500">El agente maestro: vigila toda la plataforma, analiza lo que pasa y te dice qué hacer.</p>
        </div>
        <button onClick={load} disabled={loading} className="rounded-full border border-gray-200 bg-white p-2.5 text-gray-600 hover:bg-gray-50" title="Actualizar"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl bg-gray-100 p-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => choose(t.id)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium ${tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>{t.label}</button>
        ))}
      </div>

      {error && <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><AlertCircle size={16} /> {error}</div>}
      {!data && !error && <div className="flex items-center gap-2 p-6 text-gray-500"><Loader2 size={16} className="animate-spin" /> Cargando…</div>}
      {data && tab === 'now' && <NowTab data={data} reload={load} />}
      {data && tab === 'analysis' && <AnalysisTab />}
      {data && tab === 'cost' && <CostTab />}
      {data && tab === 'settings' && <SettingsTab key={JSON.stringify(data.config)} config={data.config} reload={load} />}
    </div>
  )
}
