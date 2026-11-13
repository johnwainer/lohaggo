'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react'
import AgentCard from './AgentCard'
import { FlowsSection, RecentNotes } from './NotesSections'
import type { AgentsData } from './shared'
import { btnGhost, seoApi } from '../seo/shared'

export default function AgentsTeamPanel() {
  const [data, setData] = useState<AgentsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await seoApi<AgentsData>('/api/admin/agents'))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-4 overflow-x-hidden px-4 py-4 sm:px-6 sm:py-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Equipo de agentes</h1>
          <p className="mt-1 text-sm text-gray-600">Cada agente hace su trabajo y se dejan notas entre sí; Haggo los supervisa a todos.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className={btnGhost}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Actualizar
        </button>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> <span className="min-w-0 break-words">{error}</span>
        </div>
      )}
      {!data && loading && <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Cargando…</div>}

      {data && (
        <>
          {!data.bus.tablesReady && (
            <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span className="min-w-0 break-words">Falta aplicar el SQL del tablón de notas (migrations/20261113020000_agent_notes.sql)</span>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {data.agents.map((a) => <AgentCard key={a.key} agent={a} />)}
          </div>
          <FlowsSection data={data} />
          <RecentNotes data={data} onChanged={load} />
        </>
      )}
    </div>
  )
}
