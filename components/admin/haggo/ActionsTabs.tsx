'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { DOMAINS, DOMAIN_LABEL } from '@/lib/haggo/config'
import { ActionCard, type ActionView } from '@/components/admin/haggo/ActionCard'
import { api, btn, card } from '@/components/admin/haggo/shared'

function useActions(query: string) {
  const [list, setList] = useState<ActionView[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    try {
      setList((await api<{ actions: ActionView[] }>(`/api/admin/haggo/actions?${query}`)).actions)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }, [query])
  useEffect(() => { load() }, [load])
  return { list, error, load }
}

/** What waits for approval: by risk, plans grouped with «Aprobar todo el plan». */
export function ProposalsTab({ onChange }: { onChange: () => void }) {
  const { list, error, load } = useActions('view=pending')
  const [busyPlan, setBusyPlan] = useState<string | null>(null)
  const [planError, setPlanError] = useState<string | null>(null)
  const refresh = () => { load(); onChange() }

  async function approvePlan(planId: string) {
    if (!window.confirm('¿Aprobar y ejecutar todos los pasos del plan, en orden? Se detiene en el primero que falle.')) return
    setBusyPlan(planId)
    setPlanError(null)
    try {
      await api(`/api/admin/haggo/actions/plans/${planId}`, { method: 'POST' })
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Error')
    } finally {
      setBusyPlan(null)
      refresh()
    }
  }

  if (error) return <p className="text-sm text-rose-600">{error}</p>
  if (!list) return <div className="flex items-center gap-2 p-6 text-gray-500"><Loader2 size={16} className="animate-spin" /> Cargando…</div>
  if (!list.length) return <section className={`${card} p-8 text-center text-sm text-gray-500`}>Nada espera tu aprobación. Cuando Haggo proponga algo, aparece aquí y en la franja del dashboard.</section>

  const plans = new Map<string, ActionView[]>()
  const single: ActionView[] = []
  for (const a of list) {
    if (a.planId) plans.set(a.planId, [...(plans.get(a.planId) ?? []), a])
    else single.push(a)
  }
  return (
    <div className="space-y-4">
      {planError && <p className="text-sm text-rose-600">{planError}</p>}
      {Array.from(plans.entries()).map(([planId, steps]) => (
        <section key={planId} className="space-y-2 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-3">
          <div className="flex flex-wrap items-center gap-2 px-1">
            <p className="flex-1 text-sm font-semibold text-indigo-900">Plan de {steps.length} pasos</p>
            <button disabled={Boolean(busyPlan)} onClick={() => approvePlan(planId)} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{busyPlan === planId ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Aprobar todo el plan</button>
          </div>
          {[...steps].sort((a, b) => (a.planOrder ?? 0) - (b.planOrder ?? 0)).map((a) => <ActionCard key={a.id} a={a} onChange={refresh} />)}
        </section>
      ))}
      {single.map((a) => <ActionCard key={a.id} a={a} onChange={refresh} />)}
    </div>
  )
}

const STATUSES = [['', 'Todas'], ['executed', 'Ejecutadas'], ['failed', 'Fallidas'], ['reverted', 'Deshechas'], ['rejected', 'Rechazadas'], ['blocked', 'Bloqueadas'], ['expired', 'Caducadas']] as const
const ORIGINS = [['', 'Cualquier origen'], ['cycle', 'Revisión automática'], ['report', 'Informe'], ['chat', 'Conversación']] as const

/** Everything that was decided or blocked, with before/after, who approved, and undo. */
export function DecisionsTab({ onChange }: { onChange: () => void }) {
  const [status, setStatus] = useState('')
  const [domain, setDomain] = useState('')
  const [origin, setOrigin] = useState('')
  const { list, error, load } = useActions(`view=history${status ? `&status=${status}` : ''}${domain ? `&domain=${domain}` : ''}${origin ? `&origin=${origin}` : ''}`)
  const select = 'rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm'
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={select}>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select value={domain} onChange={(e) => setDomain(e.target.value)} className={select}><option value="">Todas las áreas</option>{DOMAINS.map((d) => <option key={d} value={d}>{DOMAIN_LABEL[d]}</option>)}</select>
        <select value={origin} onChange={(e) => setOrigin(e.target.value)} className={select}>{ORIGINS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <button onClick={load} className={btn}>Actualizar</button>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {!list ? <div className="flex items-center gap-2 p-6 text-gray-500"><Loader2 size={16} className="animate-spin" /> Cargando…</div>
        : !list.length ? <section className={`${card} p-8 text-center text-sm text-gray-500`}>Sin decisiones con estos filtros.</section>
        : <div className="space-y-3">{list.map((a) => <ActionCard key={a.id} a={a} compact onChange={() => { load(); onChange() }} />)}</div>}
    </div>
  )
}
