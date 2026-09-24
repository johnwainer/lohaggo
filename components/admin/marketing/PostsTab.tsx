'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Search, X } from 'lucide-react'
import { CHANNEL_NAME, MK_CHANNELS, MkChannelIcon, PUB_STATUS, POST_STATUS, StatusChip, api, fmtDateTime, input, type MkChannel } from '@/components/admin/marketing/shared'
import { videoPosterUrl } from '@/lib/marketing/media'
import type { Campaign } from '@/components/admin/marketing/CampaignsTab'

export type PostRow = {
  id: string
  workspaceId: string
  title: string
  status: string
  scheduledAt: string | null
  publishedAt: string | null
  updatedAt: string
  campaign: { id: string; name: string; color: string } | null
  variants: Array<{ channel: MkChannel }>
  media: Array<{ url: string; kind: string }>
  publications: Array<{ channel: MkChannel; status: string; lastError: string | null; connection: { name: string } | null }>
}

type Filters = { status: string; campaignId: string; channel: string; q: string }
type Ws = { id: string; name: string; permissions: string[] }

export function NewPostModal({ workspaces, workspace, campaigns, defaults, onClose }: {
  workspaces: Ws[]
  workspace: Ws | null
  campaigns: Campaign[]
  defaults?: { scheduledAt?: string; campaignId?: string }
  onClose: () => void
}) {
  const router = useRouter()
  const editable = workspaces.filter((w) => w.permissions.includes('marketing.edit'))
  const [wsId, setWsId] = useState(workspace?.permissions.includes('marketing.edit') ? workspace.id : editable[0]?.id || '')
  const [title, setTitle] = useState('')
  const [campaignId, setCampaignId] = useState(defaults?.campaignId || '')
  const [channels, setChannels] = useState<MkChannel[]>(['FACEBOOK', 'INSTAGRAM'])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    setSaving(true)
    setError(null)
    try {
      const d = await api<{ post: { id: string } }>('/api/admin/marketing', { method: 'POST', json: { workspaceId: wsId, title, campaignId: campaignId || null, channels, scheduledAt: defaults?.scheduledAt } })
      router.push(`/admin/marketing/posts/${d.post.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Nueva publicación</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        {editable.length > 1 && (
          <label className="block space-y-1"><span className="text-sm font-medium text-gray-700">Workspace</span>
            <select className={input} value={wsId} onChange={(e) => setWsId(e.target.value)}>{editable.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
          </label>
        )}
        <label className="block space-y-1"><span className="text-sm font-medium text-gray-700">Título interno</span>
          <input className={input} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Consejos para limpiar sofás" onKeyDown={(e) => e.key === 'Enter' && create()} />
          <span className="block text-xs text-gray-500">En el blog es el título del artículo; en redes no se publica.</span>
        </label>
        <div className="space-y-1">
          <span className="text-sm font-medium text-gray-700">Canales</span>
          <div className="flex gap-2 flex-wrap">
            {MK_CHANNELS.map((c) => (
              <button key={c} type="button" onClick={() => setChannels((l) => (l.includes(c) ? l.filter((x) => x !== c) : [...l, c]))} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${channels.includes(c) ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-gray-200 text-gray-600'}`}>
                <MkChannelIcon channel={c} size={16} /> {CHANNEL_NAME[c]}
              </button>
            ))}
          </div>
        </div>
        {campaigns.filter((c) => c.workspaceId === wsId && c.status !== 'done').length > 0 && (
          <label className="block space-y-1"><span className="text-sm font-medium text-gray-700">Campaña (opcional)</span>
            <select className={input} value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
              <option value="">Sin campaña</option>
              {campaigns.filter((c) => c.workspaceId === wsId && c.status !== 'done').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={create} disabled={saving || !wsId || !channels.length} className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Crear y abrir el editor
        </button>
      </div>
    </div>
  )
}

export default function PostsTab({ posts, campaigns, filters, setFilters, workspace, workspaces, canCreate, loading }: {
  posts: PostRow[]
  campaigns: Campaign[]
  filters: Filters
  setFilters: (f: Filters) => void
  workspace: Ws | null
  workspaces: Ws[]
  canCreate: boolean
  loading: boolean
  onChanged: () => void
}) {
  const [creating, setCreating] = useState(false)
  const [q, setQ] = useState(filters.q)
  const anyEditable = canCreate || workspaces.some((w) => w.permissions.includes('marketing.edit'))

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <form className="relative flex-1 min-w-[200px]" onSubmit={(e) => { e.preventDefault(); setFilters({ ...filters, q }) }}>
          <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
          <input className={`${input} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título" />
        </form>
        <select className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">Todos los estados</option>
          {Object.entries(POST_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" value={filters.channel} onChange={(e) => setFilters({ ...filters, channel: e.target.value })}>
          <option value="">Todos los canales</option>
          {MK_CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_NAME[c]}</option>)}
        </select>
        <select className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" value={filters.campaignId} onChange={(e) => setFilters({ ...filters, campaignId: e.target.value })}>
          <option value="">Todas las campañas</option>
          <option value="none">Sin campaña</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {anyEditable && (
          <button onClick={() => setCreating(true)} className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
            <Plus size={15} /> Nueva publicación
          </button>
        )}
        {loading && <Loader2 size={16} className="animate-spin text-gray-400" />}
      </div>

      {posts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <p className="font-medium text-gray-700">No hay publicaciones {filters.status || filters.q || filters.channel || filters.campaignId ? 'con estos filtros' : 'todavía'}</p>
          <p className="text-sm text-gray-500 mt-1">Crea una, escribe el texto (el asistente de IA te ayuda) y publícala o prográmala en los canales que quieras.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => {
            const m = p.media[0]
            const thumb = m ? (m.kind === 'video' ? videoPosterUrl(m.url) : m.url) : null
            const pubs = p.publications
            return (
              <Link key={p.id} href={`/admin/marketing/posts/${p.id}`} className="group flex gap-3 rounded-2xl border border-gray-200 bg-white p-3 hover:border-primary-200 hover:shadow-sm transition">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                  {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-primary-50 to-secondary-50" />}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <StatusChip status={p.status} />
                    {p.campaign && <span className="inline-flex items-center gap-1 truncate text-[11px] text-gray-500"><span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.campaign.color }} />{p.campaign.name}</span>}
                  </div>
                  <p className="font-semibold text-gray-900 truncate group-hover:text-primary-700">{p.title}</p>
                  <div className="flex items-center gap-1.5">
                    {(pubs.length ? pubs.map((x) => x.channel) : p.variants.map((v) => v.channel)).filter((c, i, a) => a.indexOf(c) === i).map((c) => {
                      const pub = pubs.find((x) => x.channel === c)
                      return (
                        <span key={c} title={pub ? `${CHANNEL_NAME[c]}${pub.connection ? ` · ${pub.connection.name}` : ''}: ${PUB_STATUS[pub.status]?.label || pub.status}${pub.lastError ? ` — ${pub.lastError}` : ''}` : CHANNEL_NAME[c]} className={`relative ${pub?.status === 'failed' ? 'ring-2 ring-red-400 rounded-full' : ''}`}>
                          <MkChannelIcon channel={c} size={18} />
                        </span>
                      )
                    })}
                    <span className="ml-auto text-[11px] text-gray-400">{p.publishedAt ? `Publicada ${fmtDateTime(p.publishedAt)}` : p.scheduledAt ? `${p.status === 'scheduled' ? 'Sale' : 'Para'} ${fmtDateTime(p.scheduledAt)}` : `Editada ${fmtDateTime(p.updatedAt)}`}</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
      {creating && <NewPostModal workspaces={workspaces} workspace={workspace} campaigns={campaigns} onClose={() => setCreating(false)} />}
    </div>
  )
}
