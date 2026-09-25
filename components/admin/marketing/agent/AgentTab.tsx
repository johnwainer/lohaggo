'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Bot, Loader2, Pause, Plus } from 'lucide-react'
import { MkChannelIcon, OBJECTIVES, api, fmtDateTime, num } from '@/components/admin/marketing/shared'
import AgentWizard from '@/components/admin/marketing/agent/AgentWizard'
import AgentDetail from '@/components/admin/marketing/agent/AgentDetail'
import { AGENT_STATUS, MODE_INFO, type AgentDetailData, type AgentSummary } from '@/components/admin/marketing/agent/types'

type Ws = { id: string; name: string; permissions: string[] }

export default function AgentTab({ workspaceId, workspace, openAgentId, openWizard, onOpened }: {
  workspaceId: string
  workspace: Ws | null
  openAgentId?: string | null
  openWizard?: boolean
  onOpened?: () => void
}) {
  const [agents, setAgents] = useState<AgentSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(openAgentId ?? null)
  const [wizard, setWizard] = useState<{ existing: AgentDetailData | null } | null>(openWizard ? { existing: null } : null)
  const [busy, setBusy] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [detailKey, setDetailKey] = useState(0)

  const load = useCallback(async () => {
    try {
      const d = await api<{ agents: AgentSummary[] }>(`/api/admin/marketing/agents${workspaceId ? `?workspaceId=${workspaceId}` : ''}`)
      setAgents(d.agents)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }, [workspaceId])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (openAgentId) setOpen(openAgentId)
    if (openWizard) setWizard({ existing: null })
    if (openAgentId || openWizard) onOpened?.()
  }, [openAgentId, openWizard]) // eslint-disable-line react-hooks/exhaustive-deps

  async function pause(a: AgentSummary) {
    if (!window.confirm(`¿Pausar el agente de «${a.campaign.name}»? Lo programado sale de la cola.`)) return
    setBusy(a.id)
    await api(`/api/admin/marketing/agents/${a.id}`, { method: 'PATCH', json: { status: 'paused' } }).catch((e) => setError(e.message))
    setBusy(null)
    load()
  }

  async function saved(agentId: string, generate: boolean) {
    setWizard(null)
    setOpen(agentId)
    load()
    if (generate) {
      setGenerating(true)
      await api(`/api/admin/marketing/agents/${agentId}/actions`, { method: 'POST', json: { action: 'strategy' } }).catch((e) => setError(`No se pudo proponer la estrategia: ${e.message}`))
      setGenerating(false)
    }
    setDetailKey((k) => k + 1)
  }

  const canEdit = Boolean(workspace?.permissions.includes('marketing.edit'))

  return (
    <div className="space-y-4">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {generating && <div className="flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800"><Loader2 size={16} className="animate-spin" /> El agente está preparando la estrategia (puede tardar 1 o 2 minutos)…</div>}

      {open ? (
        <AgentDetail key={`${open}:${detailKey}`} agentId={open} onBack={() => { setOpen(null); load() }} onEdit={(d) => setWizard({ existing: d })} />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-sm text-gray-500">Un estratega de marketing con IA por campaña: define la estrategia a partir del objetivo, propone y redacta las piezas, elige imágenes y horarios, publica según la autonomía que le des y aprende de los resultados.</p>
            {canEdit && workspace && <button onClick={() => setWizard({ existing: null })} className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"><Plus size={15} /> Nuevo agente</button>}
            {canEdit && !workspace && <p className="text-xs text-gray-500">Elige un workspace para crear un agente.</p>}
          </div>
          {!agents ? <Loader2 className="animate-spin text-gray-400" /> : agents.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center space-y-2">
              <Bot className="mx-auto text-primary-500" size={32} />
              <p className="font-medium text-gray-800">Aún no hay agentes</p>
              <p className="text-sm text-gray-500">Crea uno: en 6 pasos le cuentas el objetivo, la oferta, la audiencia, la voz, los canales y cuánta autonomía tiene.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {agents.map((a) => {
                const pct = a.monthlyBudgetUsd > 0 ? Math.min(100, Math.round((a.spentUsd / a.monthlyBudgetUsd) * 100)) : 100
                const kpi = a.kpi.value == null ? '—' : a.kpi.key === 'engagement' ? `${a.kpi.value} %` : num(Math.round(a.kpi.value))
                return (
                  <div key={a.id} className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
                    <button onClick={() => setOpen(a.id)} className="block w-full text-left space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${AGENT_STATUS[a.status].cls}`}>{AGENT_STATUS[a.status].label}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${MODE_INFO[a.effectiveMode].cls}`}>{MODE_INFO[a.effectiveMode].label}</span>
                        <span className="ml-auto flex gap-1">{a.channels.map((c) => <MkChannelIcon key={c} channel={c} size={16} />)}</span>
                      </div>
                      <p className="flex items-center gap-2 font-semibold text-gray-900"><span className="h-2.5 w-2.5 rounded-full" style={{ background: a.campaign.color }} />{a.campaign.name}</p>
                      <p className="text-xs text-gray-500">{OBJECTIVES[a.campaign.objective] || a.campaign.objective} · {a.kpi.label}: <strong className="text-gray-800">{kpi}</strong>{a.kpi.goal != null ? ` de ${num(a.kpi.goal)}` : ''}</p>
                      {a.degradedReason && <p className="flex items-center gap-1 text-xs text-amber-700"><AlertTriangle size={12} /> {a.degradedReason}</p>}
                      {!a.strategyReady && <p className="text-xs text-amber-700">Falta la estrategia</p>}
                      {a.strategyReady && !a.strategyApprovedAt && <p className="text-xs text-amber-700">Estrategia esperando aprobación</p>}
                    </button>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-gray-50 py-2"><p className="text-lg font-bold text-gray-900">{a.counts.ideasProposed}</p><p className="text-[11px] text-gray-500">ideas por revisar</p></div>
                      <div className="rounded-xl bg-gray-50 py-2"><p className="text-lg font-bold text-gray-900">{a.counts.toApprove}</p><p className="text-[11px] text-gray-500">por aprobar</p></div>
                      <div className="rounded-xl bg-gray-50 py-2"><p className="text-lg font-bold text-gray-900">{a.counts.upcoming}</p><p className="text-[11px] text-gray-500">programadas</p></div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-gray-500"><span>IA este mes: ${a.spentUsd.toFixed(2)} de ${a.monthlyBudgetUsd}</span><span>{a.nextPlanAt ? `Planifica ${fmtDateTime(a.nextPlanAt)}` : ''}</span></div>
                      <div className="h-1.5 rounded-full bg-gray-100"><div className={`h-1.5 rounded-full ${pct >= 80 ? 'bg-amber-500' : 'bg-primary-500'}`} style={{ width: `${pct}%` }} /></div>
                    </div>
                    <div className="flex items-center gap-2 border-t border-gray-100 pt-2">
                      <button onClick={() => setOpen(a.id)} className="text-xs font-medium text-primary-700 hover:underline">Abrir</button>
                      {canEdit && a.status === 'active' && (
                        <button onClick={() => pause(a)} disabled={busy === a.id} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-700">
                          {busy === a.id ? <Loader2 size={13} className="animate-spin" /> : <Pause size={13} />} Pausar
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
      {wizard && workspace && (
        <AgentWizard
          workspace={workspace}
          existing={wizard.existing}
          onClose={() => { setWizard(null); load(); setDetailKey((k) => k + 1) }}
          onSaved={saved}
        />
      )}
    </div>
  )
}
