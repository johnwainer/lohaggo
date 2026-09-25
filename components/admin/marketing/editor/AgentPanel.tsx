'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Bot, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { CHANNEL_NAME, api, fmtDateTime, input } from '@/components/admin/marketing/shared'
import type { Post } from '@/components/admin/marketing/editor/types'

export type AgentIdea = { pillar: string; service: string | null; angle: string; hypothesis: string | null; rationale: string | null; explore: boolean }

/** A post written by the marketing agent: why it exists, what it doubts, and asking for another version or rejecting it. */
export default function AgentPanel({ post, idea, agentId, canEdit, onChanged, onRejected }: {
  post: Post
  idea: AgentIdea | null
  agentId: string
  canEdit: boolean
  onChanged: () => void
  onRejected: () => void
}) {
  const [instruction, setInstruction] = useState('')
  const [busy, setBusy] = useState<'redraft' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const meta = post.agentMeta ?? {}
  const issues = [...(meta.validation ?? []), ...(meta.guardrails ?? []).map((g) => g.message), ...(meta.scheduleProblems ?? [])]
  const closed = ['publishing', 'published', 'partial', 'archived'].includes(post.status)

  async function run(action: 'redraft' | 'reject') {
    const payload = action === 'redraft' ? { action: 'redraft', postId: post.id, instruction } : { action: 'reject_post', postId: post.id, reason: window.prompt('¿Por qué la rechazas? (el agente lo tendrá en cuenta)') || '' }
    if (action === 'reject' && !payload.reason) return
    setBusy(action)
    setError(null)
    try {
      await api(`/api/admin/marketing/agents/${agentId}/actions`, { method: 'POST', json: payload })
      if (action === 'reject') onRejected()
      else { setInstruction(''); onChanged() }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-2xl border border-primary-200 bg-primary-50/40 p-4 space-y-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-gray-900"><Bot size={16} className="text-primary-600" /> Pieza del agente</p>
      <div className="space-y-1 text-xs text-gray-700">
        {(post.pillar || idea?.pillar) && <p><strong>Pilar:</strong> {post.pillar || idea?.pillar}{idea?.service ? ` · ${idea.service}` : ''}{idea?.explore ? ' · prueba' : ''}</p>}
        {idea?.angle && <p><strong>Idea:</strong> {idea.angle}</p>}
        {(idea?.rationale || meta.rationale) && <p><strong>Por qué:</strong> {idea?.rationale || meta.rationale}</p>}
        {(meta.hypothesis || idea?.hypothesis) && <p><strong>Hipótesis:</strong> {meta.hypothesis || idea?.hypothesis}</p>}
        {meta.confidence != null && <p><strong>Confianza:</strong> {Math.round(meta.confidence * 100)} %</p>}
        {meta.slots?.map((s) => <p key={s.channel}><strong>{CHANNEL_NAME[s.channel]}:</strong> {s.reason}</p>)}
        {post.optOutDeadline && post.status === 'scheduled' && <p className="font-semibold text-amber-800">Sale sola si nadie la cancela o edita antes del {fmtDateTime(post.optOutDeadline)}.</p>}
        {meta.risks?.length ? <p className="text-gray-500">Riesgos: {meta.risks.join('; ')}</p> : null}
      </div>
      {issues.length > 0 && <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 space-y-0.5">{issues.slice(0, 6).map((i, n) => <p key={n} className="flex gap-1"><AlertTriangle size={12} className="mt-0.5 shrink-0" />{i}</p>)}</div>}
      {canEdit && !closed && (
        <div className="space-y-2">
          <textarea className={input} rows={2} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Qué cambiar: más corto, otro enfoque, sin precio…" />
          <div className="flex items-center gap-2">
            <button onClick={() => run('redraft')} disabled={Boolean(busy) || !instruction.trim()} className="inline-flex items-center gap-1.5 rounded-full border border-primary-300 bg-white px-3 py-1.5 text-xs font-semibold text-primary-700 disabled:opacity-50">
              {busy === 'redraft' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Pedir otra versión
            </button>
            <button onClick={() => run('reject')} disabled={Boolean(busy)} className="ml-auto inline-flex items-center gap-1 text-xs text-red-600 hover:underline">
              {busy === 'reject' ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />} Rechazar
            </button>
          </div>
          {busy === 'redraft' && <p className="text-[11px] text-gray-500">Reescribiendo (hasta un minuto). Reemplaza el texto de todos los canales.</p>}
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Link href={`/admin/marketing?agente=${agentId}`} className="inline-block text-xs text-primary-700 hover:underline">Ver el agente</Link>
    </div>
  )
}
