'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle, CheckCircle2, Crown, Loader2, Plus, RefreshCw, Trash2, UserPlus, Users, X, Shield, Link2, Inbox, Pencil,
} from 'lucide-react'

type Role = 'OWNER' | 'MEMBER'
type MemberUser = { id: string; name: string; email: string; image?: string | null; isActive: boolean }
type Member = { id: string; role: Role; createdAt: string; user: MemberUser }
type Workspace = {
  id: string
  name: string
  description?: string | null
  isDefault: boolean
  createdAt: string
  createdBy?: { id: string; name: string; email: string } | null
  myRole: Role | null
  canManage: boolean
  counts: { connections: number; conversations: number }
  members: Member[]
}
type AdminUser = { id: string; name: string; email: string; isSuperAdmin: boolean }

const ROLE_LABEL: Record<Role, string> = { OWNER: 'Propietario', MEMBER: 'Miembro' }

export default function WorkspacesPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [me, setMe] = useState<{ id: string; isSuperAdmin: boolean } | null>(null)

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [saving, setSaving] = useState(false)

  const [manageId, setManageId] = useState<string | null>(null)
  const [inviteUserId, setInviteUserId] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('MEMBER')
  const [busy, setBusy] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/workspaces')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudieron cargar los workspaces')
      setWorkspaces(data.workspaces || [])
      setAdmins(data.admins || [])
      setMe(data.me || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const managed = workspaces.find((w) => w.id === manageId) || null
  useEffect(() => {
    if (managed) { setEditName(managed.name); setEditDesc(managed.description || '') }
  }, [managed])

  async function call(path: string, init: RequestInit, okMessage?: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Error')
      if (okMessage) setNotice(okMessage)
      await load()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function createWorkspace() {
    if (!newName.trim()) return
    setSaving(true)
    const ok = await call('/api/admin/workspaces', { method: 'POST', body: JSON.stringify({ name: newName, description: newDesc }) }, `Workspace "${newName.trim()}" creado.`)
    setSaving(false)
    if (ok) { setCreating(false); setNewName(''); setNewDesc('') }
  }

  async function deleteWorkspace(w: Workspace) {
    if (!window.confirm(`¿Eliminar el workspace "${w.name}"? Solo es posible si no tiene cuentas ni conversaciones.`)) return
    const ok = await call(`/api/admin/workspaces/${w.id}`, { method: 'DELETE' }, `Workspace "${w.name}" eliminado.`)
    if (ok && manageId === w.id) setManageId(null)
  }

  const availableAdmins = managed ? admins.filter((a) => !managed.members.some((m) => m.user.id === a.id)) : []

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Espacios de trabajo</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Cada workspace agrupa cuentas conectadas y sus conversaciones. Solo sus miembros las ven en la{' '}
            <Link href="/admin/inbox" className="text-primary-600 font-medium hover:underline">bandeja</Link>; el propietario decide quién entra.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Actualizar
          </button>
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-sm font-semibold text-white hover:bg-primary-700">
            <Plus size={15} /> Nuevo workspace
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle size={18} className="shrink-0 mt-0.5" /><span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm">
          <CheckCircle2 size={18} className="shrink-0 mt-0.5" /><span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} className="text-green-500 hover:text-green-700">✕</button>
        </div>
      )}

      {me?.isSuperAdmin && (
        <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-800 flex items-center gap-2">
          <Shield size={14} className="shrink-0" /> Eres superadmin: ves y administras todos los workspaces, incluso los que no te incluyen como miembro.
        </div>
      )}

      {loading && workspaces.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin mr-3" /><span className="text-sm">Cargando…</span></div>
      ) : workspaces.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-gray-400">
          <Users size={28} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">No perteneces a ningún workspace todavía. Pide a un propietario que te añada o crea uno nuevo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {workspaces.map((w) => (
            <div key={w.id} className="rounded-2xl border border-gray-200 bg-white p-5 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
                  <Users size={20} className="text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 truncate">{w.name}</p>
                    {w.isDefault && <span className="rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-[10px] font-semibold">Por defecto · WhatsApp/SMS</span>}
                    {w.myRole && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${w.myRole === 'OWNER' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-700'}`}>{ROLE_LABEL[w.myRole]}</span>}
                  </div>
                  {w.description && <p className="text-xs text-gray-500 mt-0.5">{w.description}</p>}
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1"><Users size={12} /> {w.members.length} miembro{w.members.length === 1 ? '' : 's'}</span>
                <span className="inline-flex items-center gap-1"><Link2 size={12} /> {w.counts.connections} cuenta{w.counts.connections === 1 ? '' : 's'}</span>
                <span className="inline-flex items-center gap-1"><Inbox size={12} /> {w.counts.conversations} conversaciones</span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {w.members.slice(0, 6).map((m) => (
                  <span key={m.id} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-700" title={m.user.email}>
                    {m.role === 'OWNER' && <Crown size={10} className="text-amber-500" />}
                    {m.user.name}
                  </span>
                ))}
                {w.members.length > 6 && <span className="text-[11px] text-gray-400">+{w.members.length - 6}</span>}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                {w.canManage ? (
                  <button onClick={() => setManageId(w.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                    <UserPlus size={13} /> Gestionar miembros
                  </button>
                ) : (
                  <span className="text-xs text-gray-400">Solo lectura: no eres propietario</span>
                )}
                <Link href="/admin/channels" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
                  <Link2 size={13} /> Canales
                </Link>
                {w.canManage && !w.isDefault && (
                  <button onClick={() => deleteWorkspace(w)} disabled={busy} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                    <Trash2 size={13} /> Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {me?.isSuperAdmin && admins.length > 0 && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Shield size={16} /> Superadmins</h2>
            <p className="text-xs text-gray-500">Ven todos los workspaces y editan la configuración de la App de Meta. Debe quedar al menos uno.</p>
          </div>
          <div className="divide-y divide-gray-100">
            {admins.map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{a.name}</p>
                  <p className="text-xs text-gray-400 truncate">{a.email}</p>
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary-600"
                    checked={a.isSuperAdmin}
                    disabled={busy}
                    onChange={(e) => call('/api/admin/workspaces/superadmins', { method: 'PATCH', body: JSON.stringify({ userId: a.id, isSuperAdmin: e.target.checked }) })}
                  />
                  Superadmin
                </label>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Create modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold text-gray-900">Nuevo workspace</h3>
              <button onClick={() => setCreating(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-600">Nombre</span>
                <input autoFocus className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej. Ventas Instagram" maxLength={80} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-600">Descripción <span className="text-gray-400">(opcional)</span></span>
                <textarea className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" rows={2} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} maxLength={300} />
              </label>
              <p className="text-xs text-gray-400">Quedarás como propietario. Luego podrás invitar a otros admins y conectar cuentas desde Canales.</p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t">
              <button onClick={() => setCreating(false)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={createWorkspace} disabled={saving || !newName.trim()} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage members modal */}
      {managed && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="w-full sm:max-w-lg max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold text-gray-900 truncate">{managed.name}</h3>
              <button onClick={() => setManageId(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5"><Pencil size={12} /> Datos</p>
                <div className="flex gap-2">
                  <input className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={80} />
                  <button
                    disabled={busy || !editName.trim() || (editName.trim() === managed.name && (editDesc || '') === (managed.description || ''))}
                    onClick={() => call(`/api/admin/workspaces/${managed.id}`, { method: 'PATCH', body: JSON.stringify({ name: editName, description: editDesc }) }, 'Workspace actualizado.')}
                    className="rounded-lg bg-gray-900 px-3 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-40"
                  >
                    Guardar
                  </button>
                </div>
                <input className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Descripción (opcional)" maxLength={300} />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5"><UserPlus size={12} /> Añadir miembro</p>
                {availableAdmins.length === 0 ? (
                  <p className="text-xs text-gray-400">Todos los admins activos ya son miembros. Para añadir a alguien nuevo, créalo primero como usuario ADMIN.</p>
                ) : (
                  <div className="flex gap-2">
                    <select className="flex-1 min-w-0 rounded-lg border border-gray-200 px-2 py-2 text-sm" value={inviteUserId} onChange={(e) => setInviteUserId(e.target.value)}>
                      <option value="">Elige un admin…</option>
                      {availableAdmins.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.email}</option>)}
                    </select>
                    <select className="rounded-lg border border-gray-200 px-2 py-2 text-sm" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)}>
                      <option value="MEMBER">Miembro</option>
                      <option value="OWNER">Propietario</option>
                    </select>
                    <button
                      disabled={busy || !inviteUserId}
                      onClick={async () => {
                        const ok = await call(`/api/admin/workspaces/${managed.id}/members`, { method: 'POST', body: JSON.stringify({ userId: inviteUserId, role: inviteRole }) })
                        if (ok) setInviteUserId('')
                      }}
                      className="rounded-lg bg-primary-600 px-3 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-40"
                    >
                      Añadir
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5"><Users size={12} /> Miembros ({managed.members.length})</p>
                <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                  {managed.members.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 px-3 py-2">
                      <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {m.user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">{m.user.name}{m.user.id === me?.id ? ' (tú)' : ''}</p>
                        <p className="text-xs text-gray-400 truncate">{m.user.email}</p>
                      </div>
                      <select
                        className="rounded-lg border border-gray-200 px-2 py-1 text-xs"
                        value={m.role}
                        disabled={busy}
                        onChange={(e) => call(`/api/admin/workspaces/${managed.id}/members`, { method: 'PATCH', body: JSON.stringify({ userId: m.user.id, role: e.target.value }) })}
                      >
                        <option value="OWNER">Propietario</option>
                        <option value="MEMBER">Miembro</option>
                      </select>
                      <button
                        disabled={busy}
                        onClick={() => { if (window.confirm(`¿Quitar a ${m.user.name} de "${managed.name}"?`)) call(`/api/admin/workspaces/${managed.id}/members?userId=${m.user.id}`, { method: 'DELETE' }) }}
                        className="rounded-lg p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
                        title="Quitar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end px-5 py-4 border-t">
              <button onClick={() => setManageId(null)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
