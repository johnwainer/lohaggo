'use client'

import { useState } from 'react'
import { AlertTriangle, Check, ChevronDown, Loader2, RotateCcw, ShieldAlert, X } from 'lucide-react'
import { api, domainLabel, when } from '@/components/admin/haggo/shared'

export type ActionView = {
  id: string; tool: string; label: string; domain: string; risk: 'low' | 'medium' | 'high' | 'max'; riskLabel: string; sideEffects: string[]; reversible: boolean
  status: string; statusLabel: string; origin: string | null; what: string | null; why: string; evidence: Array<{ tool: string; fact: string }>; lowTrust: boolean; forReview: boolean
  risks: string | null; policy: string[]; againBecause: string | null; hypothesis: { metric: string; current: string; expected: string; byHours: number } | null
  alternatives: Array<{ option: string; whyNot: string }>; confidence: number | null; preview: { summary: string; diff: Array<{ field: string; from: unknown; to: unknown }> } | null
  result: string | null; error: string | null; planId: string | null; planOrder: number | null; decidedByEmail: string | null; decisionNote: string | null
  createdAt: string; decidedAt: string | null; executedAt: string | null; revertedAt: string | null; expiresAt: string | null; canUndo: boolean; needsTypedConfirm: boolean
}

const RISK_CLS: Record<string, string> = { low: 'bg-emerald-100 text-emerald-800', medium: 'bg-amber-100 text-amber-800', high: 'bg-orange-100 text-orange-800', max: 'bg-rose-100 text-rose-700' }
const STATUS_CLS: Record<string, string> = { proposed: 'text-primary-700', executed: 'text-emerald-700', failed: 'text-rose-600', blocked: 'text-gray-500', rejected: 'text-gray-500', expired: 'text-gray-400', reverted: 'text-indigo-600', approved: 'text-primary-700', executing: 'text-primary-700' }
const ORIGIN: Record<string, string> = { cycle: 'revisión automática', report: 'informe', chat: 'conversación' }
const show = (v: unknown) => (v == null || v === '' ? '—' : typeof v === 'string' ? v : Array.isArray(v) || typeof v === 'object' ? JSON.stringify(v) : String(v))

/** One action: what, why, evidence, hypothesis, alternatives, risks, confidence, the real preview, and the decision buttons. */
export function ActionCard({ a, onChange, compact = false }: { a: ActionView; onChange: () => void; compact?: boolean }) {
  const [open, setOpen] = useState(!compact && a.status === 'proposed')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [confirm, setConfirm] = useState('')

  async function op(kind: 'approve' | 'reject' | 'undo') {
    if (kind === 'undo' && !window.confirm('¿Deshacer esta acción? Haggo devuelve todo a como estaba antes.')) return
    setBusy(kind)
    setError(null)
    try {
      const r = await api<{ action: ActionView | null }>(`/api/admin/haggo/actions/${a.id}`, { method: 'POST', body: JSON.stringify({ op: kind, reason: reason || undefined, confirm: confirm || undefined }) })
      if (kind === 'approve' && r.action?.status === 'failed') setError(r.action.error)
      setRejecting(false)
      onChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setBusy(null)
    }
  }

  const pct = a.confidence != null ? Math.round(a.confidence * 100) : null
  return (
    <div className={`rounded-2xl border ${a.status === 'proposed' ? 'border-primary-200 bg-white' : 'border-gray-200 bg-white'} p-4`}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-start gap-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${RISK_CLS[a.risk]}`}>Riesgo {a.riskLabel.toLowerCase()}</span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">{domainLabel(a.domain)}</span>
            {a.forReview && a.status === 'proposed' && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">Para revisar</span>}
            {a.planId && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700">Plan · paso {a.planOrder ?? '?'}</span>}
            <span className={`text-xs font-medium ${STATUS_CLS[a.status] ?? 'text-gray-600'}`}>{a.statusLabel}</span>
          </span>
          <span className="mt-1.5 block text-sm font-semibold text-gray-900">{a.what || a.label}</span>
          <span className="block text-xs text-gray-500">{a.label}{a.origin ? ` · desde ${ORIGIN[a.origin] ?? a.origin}` : ''} · {when(a.createdAt)}</span>
        </span>
        <ChevronDown size={16} className={`mt-1 shrink-0 text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-3 space-y-3 text-sm">
          {a.preview && (
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="font-medium text-gray-900">{a.preview.summary}</p>
              {a.preview.diff.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {a.preview.diff.map((d, i) => (
                    <div key={i} className="grid gap-1 text-xs sm:grid-cols-[8rem_1fr]">
                      <span className="text-gray-500">{d.field}</span>
                      <span className="min-w-0"><span className="whitespace-pre-wrap break-words text-rose-700 line-through decoration-rose-300">{show(d.from).slice(0, 600)}</span>{' → '}<span className="whitespace-pre-wrap break-words text-emerald-700">{show(d.to).slice(0, 1200)}</span></span>
                    </div>
                  ))}
                </div>
              )}
              {a.sideEffects.length > 0 && <p className="mt-2 text-xs text-amber-700">Efectos: {a.sideEffects.join(', ')}</p>}
              <p className="mt-1 text-xs text-gray-500">{a.reversible ? 'Se puede deshacer después.' : 'No se puede deshacer.'}</p>
            </div>
          )}
          <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Por qué</p><p className="mt-0.5 whitespace-pre-line text-gray-800">{a.why}</p></div>
          {a.evidence.length > 0 && (
            <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Evidencia</p>
              <ul className="mt-1 space-y-1">{a.evidence.map((e, i) => <li key={i} className="text-gray-700"><span className="mr-1 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500">{e.tool === 'orden_del_superadmin' ? 'tu orden' : e.tool}</span>{e.fact}</li>)}</ul>
            </div>
          )}
          {a.lowTrust && <p className="flex items-center gap-1.5 text-xs text-amber-700"><AlertTriangle size={13} /> La evidencia viene solo de lo que escribieron clientes o socios: revísala con cuidado.</p>}
          {a.hypothesis && (
            <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Qué debería pasar</p>
              <p className="mt-0.5 text-gray-800">{a.hypothesis.metric}: de {a.hypothesis.current || '—'} a {a.hypothesis.expected} en {a.hypothesis.byHours} h</p>
            </div>
          )}
          {a.alternatives.length > 0 && (
            <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Alternativas descartadas</p>
              <ul className="mt-1 space-y-0.5">{a.alternatives.map((x, i) => <li key={i} className="text-gray-700">{x.option}: <span className="text-gray-500">{x.whyNot}</span></li>)}</ul>
            </div>
          )}
          {a.risks && <div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Riesgos</p><p className="mt-0.5 text-gray-700">{a.risks}</p></div>}
          {pct != null && (
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span>Confianza</span>
              <span className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100"><span className={`block h-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-primary-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} /></span>
              <span>{pct} %</span>
            </div>
          )}
          {a.againBecause && <p className="text-xs text-gray-600">Se propone de nuevo porque: {a.againBecause}</p>}
          {a.policy.length > 0 && <p className="text-xs text-gray-500">Política: {a.policy.join(' · ')}</p>}
          {a.result && <p className="text-sm text-emerald-700">Resultado: {a.result}</p>}
          {a.error && <p className="text-sm text-rose-600">{a.error}</p>}
          {a.decidedByEmail && <p className="text-xs text-gray-500">Decidió {a.decidedByEmail} · {when(a.decidedAt)}{a.decisionNote ? ` · «${a.decisionNote}»` : ''}{a.revertedAt ? ` · deshecha ${when(a.revertedAt)}` : ''}</p>}

          {a.status === 'proposed' && (
            <div className="space-y-2 border-t border-gray-100 pt-3">
              {a.needsTypedConfirm && (
                <label className="flex items-center gap-2 text-xs text-rose-700"><ShieldAlert size={14} /> Riesgo máximo: escribe APROBAR
                  <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-28 rounded-lg border border-rose-200 px-2 py-1 text-sm" />
                </label>
              )}
              {rejecting ? (
                <div className="space-y-2">
                  <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="¿Por qué? (opcional: Haggo lo aprende)" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
                  <div className="flex gap-2">
                    <button disabled={Boolean(busy)} onClick={() => op('reject')} className="inline-flex items-center gap-1 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{busy === 'reject' ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />} Rechazar</button>
                    <button onClick={() => setRejecting(false)} className="rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-600">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button disabled={Boolean(busy) || (a.needsTypedConfirm && confirm !== 'APROBAR')} onClick={() => op('approve')} className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">{busy === 'approve' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Aprobar y ejecutar</button>
                  <button disabled={Boolean(busy)} onClick={() => setRejecting(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"><X size={14} /> Rechazar</button>
                </div>
              )}
              {a.expiresAt && <p className="text-[11px] text-gray-400">Caduca {when(a.expiresAt)} si nadie la decide.</p>}
            </div>
          )}
          {a.canUndo && (
            <button disabled={Boolean(busy)} onClick={() => op('undo')} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">{busy === 'undo' ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Deshacer</button>
          )}
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
