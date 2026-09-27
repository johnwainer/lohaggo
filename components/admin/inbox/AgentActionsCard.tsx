'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Ban, Bot, CheckCircle2, Clock, ExternalLink, Hourglass, Loader2, XCircle } from 'lucide-react'
import { ACTION_STATUS_LABEL, type ActionStatus } from '@/lib/ai/actions-core'

type AgentAction = {
  id: string
  tool: string
  toolLabel: string
  agentName: string | null
  summary: string
  result: string | null
  status: ActionStatus
  entityHref: string | null
  createdAt: string
}

const STATUS_STYLE: Record<ActionStatus, { icon: typeof Clock; cls: string }> = {
  proposed: { icon: Clock, cls: 'text-amber-600' },
  awaiting_approval: { icon: Hourglass, cls: 'text-primary-600' },
  executed: { icon: CheckCircle2, cls: 'text-emerald-600' },
  failed: { icon: XCircle, cls: 'text-red-600' },
  rejected: { icon: Ban, cls: 'text-gray-500' },
  expired: { icon: Clock, cls: 'text-gray-400' },
}

function ago(iso: string) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins} min`
  const h = Math.floor(mins / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} d`
}

/** Actions the AI agent proposed or did on the person's account in this conversation; copilot ones wait for approval here. */
export default function AgentActionsCard({ conversationId, canManage }: { conversationId: string; canManage?: boolean }) {
  const [actions, setActions] = useState<AgentAction[]>([])
  const [allowed, setAllowed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ id: string; ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/inbox/conversations/${conversationId}/actions`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return
      setActions(data.actions || [])
      setAllowed(Boolean(data.canManage))
    } catch { /* keeps the last list */ }
  }, [conversationId])

  useEffect(() => { setActions([]); setMessage(null); load() }, [load])

  const pending = actions.some((a) => a.status === 'awaiting_approval' || a.status === 'proposed')
  useEffect(() => {
    if (!pending) return
    const t = setInterval(load, 20_000)
    return () => clearInterval(t)
  }, [pending, load])

  async function settle(a: AgentAction, verb: 'approve' | 'reject') {
    if (verb === 'approve' && !window.confirm(`¿Aprobar esta acción?\n\n${a.summary}\n\nSe ejecutará en la cuenta de la persona como si lo hiciera desde la app.`)) return
    setBusy(a.id)
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/inbox/conversations/${conversationId}/actions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: verb, actionId: a.id }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo completar')
      setMessage({ id: a.id, ok: Boolean(data.ok), text: data.text || (verb === 'approve' ? 'Hecha.' : 'Rechazada.') })
    } catch (err) {
      setMessage({ id: a.id, ok: false, text: err instanceof Error ? err.message : 'Error' })
    } finally {
      setBusy(null)
      load()
    }
  }

  if (actions.length === 0) return null
  const mayAct = canManage ?? allowed

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-700 flex items-center gap-1.5"><Bot className="h-3.5 w-3.5" /> Acciones del agente</p>
      <div className="rounded-xl border border-gray-200 divide-y">
        {actions.map((a) => {
          const st = STATUS_STYLE[a.status] ?? STATUS_STYLE.expired
          const Icon = st.icon
          const msg = message?.id === a.id ? message : null
          return (
            <div key={a.id} className="px-3 py-2.5 space-y-1.5">
              <div className="flex items-start gap-2">
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${st.cls}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 break-words">{a.summary}</p>
                  <p className="text-[11px] text-gray-500 break-words">
                    {a.toolLabel}{a.agentName ? ` · ${a.agentName}` : ''} · {ago(a.createdAt)}
                  </p>
                  <p className={`text-[11px] font-medium ${st.cls}`}>{ACTION_STATUS_LABEL[a.status] ?? a.status}</p>
                  {a.result && <p className="text-[11px] text-gray-500 break-words whitespace-pre-wrap">{a.result}</p>}
                </div>
                {a.entityHref && (
                  <a href={a.entityHref} className="shrink-0 inline-flex items-center gap-1 text-[11px] text-primary-600 hover:underline">Ver <ExternalLink className="h-3 w-3" /></a>
                )}
              </div>
              {a.status === 'awaiting_approval' && mayAct && (
                <div className="flex flex-col sm:flex-row gap-2 pl-6">
                  <button
                    onClick={() => settle(a, 'approve')}
                    disabled={busy !== null}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    {busy === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Aprobar
                  </button>
                  <button
                    onClick={() => settle(a, 'reject')}
                    disabled={busy !== null}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Ban className="h-3.5 w-3.5" /> Rechazar
                  </button>
                </div>
              )}
              {msg && (
                <p className={`flex items-start gap-1.5 pl-6 text-[11px] break-words ${msg.ok ? 'text-emerald-700' : 'text-red-700'}`}>
                  {msg.ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-px" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-px" />}
                  <span>{msg.text}</span>
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
