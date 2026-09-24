'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '@/components/admin/marketing/shared'

type Member = { id: string; role: 'OWNER' | 'MEMBER'; permissions: string[]; effective: string[]; user: { id: string; name: string; email: string } }

/** Owners decide who in their workspace can see, write and publish. */
export default function PermissionsTab({ workspaces }: { workspaces: Array<{ id: string; name: string }> }) {
  const [wsId, setWsId] = useState(workspaces[0]?.id || '')
  const [labels, setLabels] = useState<Record<string, string>>({})
  const [members, setMembers] = useState<Member[] | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!wsId) return
    try {
      const d = await api<{ labels: Record<string, string>; members: Member[] }>(`/api/admin/marketing/permissions?workspaceId=${wsId}`)
      setLabels(d.labels)
      setMembers(d.members)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }, [wsId])
  useEffect(() => { load() }, [load])

  async function toggle(m: Member, perm: string) {
    const current = m.permissions.filter((p) => p.startsWith('marketing.'))
    let next = current.includes(perm) ? current.filter((p) => p !== perm) : [...current, perm]
    // Writing or publishing without seeing makes no sense; removing "view" removes everything
    if (perm === 'marketing.view' && current.includes(perm)) next = []
    else if (perm !== 'marketing.view' && next.length && !next.includes('marketing.view')) next.unshift('marketing.view')
    setSaving(m.id)
    try {
      await api('/api/admin/marketing/permissions', { method: 'PUT', json: { memberId: m.id, permissions: next } })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-sm text-gray-500 flex-1">Los propietarios del workspace tienen todos los permisos. «Publicar» es aparte para que alguien pueda redactar y dejar la publicación en revisión sin publicarla.</p>
        {workspaces.length > 1 && (
          <select className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" value={wsId} onChange={(e) => setWsId(e.target.value)}>{workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!members ? <Loader2 className="animate-spin text-gray-400" /> : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="text-left text-xs text-gray-500 border-b border-gray-100"><th className="p-3">Miembro</th>{Object.entries(labels).map(([k, v]) => <th key={k} className="p-3 font-medium">{v}</th>)}</tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-gray-100">
                  <td className="p-3"><p className="font-medium text-gray-900">{m.user.name}</p><p className="text-xs text-gray-500">{m.user.email}{m.role === 'OWNER' ? ' · propietario' : ''}</p></td>
                  {Object.keys(labels).map((perm) => (
                    <td key={perm} className="p-3">
                      <input type="checkbox" disabled={m.role === 'OWNER' || saving === m.id} checked={m.effective.includes(perm)} onChange={() => toggle(m, perm)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
