'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, AlertTriangle, Bot, Loader2, Plus, RefreshCw, Settings2, ShieldCheck, X } from 'lucide-react'
import { AgentFace, ChannelChips, usd, type Avatar } from '@/components/admin/ai/shared'

type Agent = {
  id: string
  workspaceId: string
  name: string
  avatar: string
  status: string
  channels: string[]
  autopilot: boolean
  autopilotChannels: string[]
  isDefault: boolean
  conversations: number
  handoffs: number
  resolution: number | null
  copilotChannels: string[]
  commentChannels: string[]
  commentCopilotChannels: string[]
  copilotStats: { total: number; used: number; edited: number; discarded: number; ignored: number; byChannel: Record<string, { total: number; useful: number }> } | null
}
type Workspace = { id: string; name: string; isDefault: boolean; permissions: string[]; canManagePermissions: boolean }
type Budget = { workspaceId: string; costUsd: number; calls: number; state: string; pct: number }
type Member = { id: string; role: 'OWNER' | 'MEMBER'; permissions: string[]; effective: string[]; user: { id: string; name: string; email: string } }

export default function AiAgentsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [platform, setPlatform] = useState<{ hasAnthropicKey: boolean; hasVoyageKey: boolean; defaultModel: string } | null>(null)
  const [me, setMe] = useState<{ isSuperAdmin: boolean } | null>(null)
  const [wsFilter, setWsFilter] = useState('')

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newWs, setNewWs] = useState('')
  const [saving, setSaving] = useState(false)

  const [permWs, setPermWs] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [permLabels, setPermLabels] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/ai/agents')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudieron cargar los agentes')
      setAgents(data.agents || [])
      setWorkspaces(data.workspaces || [])
      setBudgets(data.budgets || [])
      setAvatars(data.catalog?.avatars || [])
      setPlatform(data.platform || null)
      setMe(data.me || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const editableWs = workspaces.filter((w) => w.permissions.includes('ai.edit'))
  const visible = useMemo(() => agents.filter((a) => !wsFilter || a.workspaceId === wsFilter), [agents, wsFilter])
  const wsName = (id: string) => workspaces.find((w) => w.id === id)?.name || ''

  async function createAgent() {
    if (!newName.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/ai/agents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName, workspaceId: newWs || editableWs[0]?.id }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo crear')
      router.push(`/admin/ai-agents/${data.agent.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
      setSaving(false)
    }
  }

  async function openPermissions(workspaceId: string) {
    setPermWs(workspaceId)
    const res = await fetch(`/api/admin/ai/permissions?workspaceId=${workspaceId}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError(data.error || 'Error'); setPermWs(null); return }
    setMembers(data.members || [])
    setPermLabels(data.labels || {})
  }

  async function togglePermission(member: Member, perm: string) {
    const current = member.permissions.filter((p) => p.startsWith('ai.'))
    const next = current.includes(perm) ? current.filter((p) => p !== perm) : [...current, perm]
    const res = await fetch('/api/admin/ai/permissions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId: member.id, permissions: next }) })
    if (res.ok && permWs) openPermissions(permWs)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Bot size={24} /> Agentes IA</h1>
          <p className="text-gray-500 mt-1 text-sm">Crea los agentes que quieras y decide en qué canales y cuentas atiende cada uno.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {me?.isSuperAdmin && (
            <Link href="/admin/ai-settings" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50">
              <Settings2 size={15} /> Plataforma
            </Link>
          )}
          <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Actualizar
          </button>
          {editableWs.length > 0 && (
            <button onClick={() => { setCreating(true); setNewWs(wsFilter || editableWs[0]?.id || '') }} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-sm font-semibold text-white hover:bg-primary-700">
              <Plus size={15} /> Nuevo agente
            </button>
          )}
        </div>
      </div>

      {error && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle size={16} /> {error}</div>}
      {platform && !platform.hasAnthropicKey && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} /> Falta la clave de Anthropic: los agentes no pueden responder hasta que el administrador de la plataforma la configure.
        </div>
      )}

      {/* Monthly usage per account */}
      {budgets.some((b) => b.state !== 'ok') && (
        <div className="space-y-2">
          {budgets.filter((b) => b.state !== 'ok').map((b) => (
            <div key={b.workspaceId} className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${b.state === 'blocked' ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              <AlertTriangle size={16} />
              {wsName(b.workspaceId)}: {b.pct}% del tope mensual de IA ({usd(b.costUsd)}, {b.calls} llamadas).
              {b.state === 'blocked' ? ' Los agentes están traspasando a personas hasta el próximo mes.' : ''}
            </div>
          ))}
        </div>
      )}

      {workspaces.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setWsFilter('')} className={`px-3 py-1.5 rounded-full text-sm ${!wsFilter ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>Todos</button>
          {workspaces.map((w) => (
            <button key={w.id} onClick={() => setWsFilter(w.id)} className={`px-3 py-1.5 rounded-full text-sm ${wsFilter === w.id ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>{w.name}</button>
          ))}
        </div>
      )}

      {loading && !agents.length ? (
        <div className="flex items-center gap-2 text-gray-500"><Loader2 className="animate-spin" size={18} /> Cargando…</div>
      ) : visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
          <Bot className="mx-auto text-gray-300" size={40} />
          <p className="mt-3 font-medium text-gray-700">Aún no hay agentes</p>
          <p className="text-sm text-gray-500 mt-1">Crea uno, dale instrucciones y conocimiento, pruébalo y después actívale el piloto automático en los canales que quieras.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((a) => (
            <Link key={a.id} href={`/admin/ai-agents/${a.id}`} className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md hover:border-primary-200 transition space-y-4">
              <div className="flex items-start gap-3">
                <AgentFace avatar={a.avatar} avatars={avatars} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 truncate">{a.name}</p>
                    {a.isDefault && <span className="text-[10px] rounded-full bg-primary-50 text-primary-700 px-2 py-0.5">Por defecto</span>}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{wsName(a.workspaceId)}</p>
                </div>
                <span className={`text-xs rounded-full px-2 py-0.5 ${a.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{a.status === 'active' ? 'Activo' : 'Pausado'}</span>
              </div>
              <div className="space-y-1.5">
                <div className="text-xs text-gray-500">Canales</div>
                <ChannelChips channels={a.channels} />
                <div className="text-xs text-gray-500 pt-1">Piloto automático</div>
                {a.autopilot && a.autopilotChannels.length ? <ChannelChips channels={a.autopilotChannels} /> : <span className="text-xs text-gray-400">Apagado</span>}
                <div className="text-xs text-gray-500 pt-1">Copiloto</div>
                {a.copilotChannels.length ? <ChannelChips channels={a.copilotChannels} /> : <span className="text-xs text-gray-400">Apagado</span>}
                {(a.commentChannels.length > 0 || a.commentCopilotChannels.length > 0) && (
                  <>
                    <div className="text-xs text-gray-500 pt-1">Comentarios</div>
                    <span className="inline-flex flex-wrap gap-1">
                      {a.commentChannels.length > 0 && <ChannelChips channels={a.commentChannels} />}
                      {a.commentCopilotChannels.filter((c) => !a.commentChannels.includes(c)).map((c) => (
                        <span key={c} className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700">{c === 'FACEBOOK_COMMENT' ? 'Comentarios de Facebook' : 'Comentarios de Instagram'} · copiloto</span>
                      ))}
                    </span>
                  </>
                )}
                {a.copilotStats && a.copilotStats.total > 0 && (
                  <p className="text-[11px] text-gray-500 pt-1" title={Object.entries(a.copilotStats.byChannel).map(([ch, s]) => `${ch}: ${Math.round((s.useful / s.total) * 100)}% útiles de ${s.total}`).join(' · ')}>
                    Sugerencias útiles: <strong className="text-gray-800">{Math.round(((a.copilotStats.used + a.copilotStats.edited) / a.copilotStats.total) * 100)}%</strong>
                    {' '}({a.copilotStats.used} tal cual · {a.copilotStats.edited} editadas · {a.copilotStats.discarded} descartadas · {a.copilotStats.ignored} ignoradas)
                  </p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center border-t border-gray-100 pt-3">
                <div><p className="text-lg font-semibold text-gray-900">{a.conversations}</p><p className="text-[11px] text-gray-500">Conversaciones</p></div>
                <div><p className="text-lg font-semibold text-gray-900">{a.handoffs}</p><p className="text-[11px] text-gray-500">Traspasos</p></div>
                <div><p className="text-lg font-semibold text-gray-900">{a.resolution == null ? '—' : `${a.resolution}%`}</p><p className="text-[11px] text-gray-500">Resolución</p></div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {workspaces.some((w) => w.canManagePermissions) && (
        <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><ShieldCheck size={18} /> Permisos del equipo</h2>
          <p className="text-xs text-gray-500">Los propietarios del workspace tienen todos. A los miembros se les da uno a uno; probar agentes consume saldo.</p>
          <div className="flex gap-2 flex-wrap">
            {workspaces.filter((w) => w.canManagePermissions).map((w) => (
              <button key={w.id} onClick={() => openPermissions(w.id)} className="px-3 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-700 hover:bg-gray-50">{w.name}</button>
            ))}
          </div>
        </section>
      )}

      {creating && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setCreating(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-semibold text-gray-900">Nuevo agente</h3><button onClick={() => setCreating(false)}><X size={18} /></button></div>
            <label className="block space-y-1">
              <span className="text-sm text-gray-700">Nombre</span>
              <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createAgent()} placeholder="Ej. Sofía de LoHaggo" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </label>
            {editableWs.length > 1 && (
              <label className="block space-y-1">
                <span className="text-sm text-gray-700">Workspace</span>
                <select value={newWs} onChange={(e) => setNewWs(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                  {editableWs.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </label>
            )}
            <p className="text-xs text-gray-500">Nace con el piloto automático apagado: no contestará a nadie hasta que lo actives en la pestaña Canales.</p>
            <button onClick={createAgent} disabled={saving || !newName.trim()} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Crear y configurar
            </button>
          </div>
        </div>
      )}

      {permWs && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setPermWs(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl space-y-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-semibold text-gray-900">Permisos de IA · {wsName(permWs)}</h3><button onClick={() => setPermWs(null)}><X size={18} /></button></div>
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500"><tr className="text-left"><th className="py-2">Miembro</th>{Object.entries(permLabels).map(([k, l]) => <th key={k} className="px-2 text-center font-normal">{l}</th>)}</tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-t border-gray-100">
                    <td className="py-2 pr-2"><p className="text-gray-900">{m.user.name}</p><p className="text-xs text-gray-500">{m.role === 'OWNER' ? 'Propietario' : m.user.email}</p></td>
                    {Object.keys(permLabels).map((p) => (
                      <td key={p} className="text-center">
                        <input type="checkbox" disabled={m.role === 'OWNER'} checked={m.effective.includes(p)} onChange={() => togglePermission(m, p)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
