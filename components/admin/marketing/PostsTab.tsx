'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Search, X } from 'lucide-react'
import { CHANNEL_NAME, ChannelLines, MK_CHANNELS, MkChannelIcon, POST_STATUS, ReviewChip, StatusChip, api, fmtWhen, input, type ChannelLineView, type MkChannel } from '@/components/admin/marketing/shared'
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
  origin?: string
  reviewStatus?: string | null
  reviewScore?: number | null
  campaign: { id: string; name: string; color: string } | null
  variants: Array<{ channel: MkChannel }>
  media: Array<{ url: string; kind: string }>
  publications: Array<{ channel: MkChannel; status: string; lastError: string | null; connection: { name: string } | null }>
  /** Each network's version: format, account, when, state (lib/marketing/format-display.ts) */
  lines: ChannelLineView[]
  /** Next send if pending, else the last one that went out */
  sortAt: string
}

/** Formats to filter by (a line matches when its format starts with it: «Fotos (3)» is «Fotos»). */
const FORMAT_FILTERS = ['Reel', 'Historia', 'Carrusel', 'Foto', 'Fotos', 'Video', 'Enlace', 'Texto', 'Artículo']

const SECTIONS: Array<{ key: string; title: string; statuses: string[]; order: 'asc' | 'desc'; by: 'sortAt' | 'updatedAt' }> = [
  { key: 'next', title: 'Próximas', statuses: ['scheduled', 'approved', 'publishing'], order: 'asc', by: 'sortAt' },
  { key: 'work', title: 'Por revisar y borradores', statuses: ['review', 'draft'], order: 'desc', by: 'updatedAt' },
  { key: 'done', title: 'Publicadas', statuses: ['published', 'partial', 'failed'], order: 'desc', by: 'sortAt' },
  { key: 'archived', title: 'Archivadas', statuses: ['archived'], order: 'desc', by: 'updatedAt' },
]

function PostCard({ p }: { p: PostRow }) {
  const m = p.media[0]
  const thumb = m ? (m.kind === 'video' ? videoPosterUrl(m.url) : m.url) : null
  const vertical = p.lines.some((l) => /^(Reel|Historia)/.test(l.format))
  return (
    <Link href={`/admin/marketing/posts/${p.id}`} className="group flex gap-3 rounded-2xl border border-gray-200 bg-white p-3 hover:border-primary-200 hover:shadow-sm transition">
      <div className={`${vertical ? 'h-24 w-[54px]' : 'h-20 w-20'} shrink-0 overflow-hidden rounded-xl bg-gray-100`}>
        {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-primary-50 to-secondary-50" />}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusChip status={p.status} />
          <ReviewChip status={p.reviewStatus} score={p.reviewScore} />
          {p.origin === 'agent' && <span className="inline-flex rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700">🤖 Agente</span>}
          {p.campaign && <span className="inline-flex min-w-0 max-w-full items-center gap-1 truncate text-[11px] text-gray-500"><span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.campaign.color }} />{p.campaign.name}</span>}
        </div>
        <p className="font-semibold leading-snug text-gray-900 line-clamp-2 break-words group-hover:text-primary-700">{p.title}</p>
        <ChannelLines lines={p.lines} />
        {!p.lines.some((l) => l.at) && <p className="text-[11px] text-gray-400">Editada {fmtWhen(p.updatedAt)}</p>}
      </div>
    </Link>
  )
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
      <div className="w-full sm:max-w-md max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white p-5 sm:p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Nueva publicación</h2>
          <button onClick={onClose} className="-m-2 p-2 text-gray-400 hover:text-gray-700" aria-label="Cerrar"><X size={18} /></button>
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
  const [format, setFormat] = useState('')
  const matches = (label: string) => (format === 'Foto' ? label === 'Foto' : label.startsWith(format))
  const shown = format ? posts.filter((p) => p.lines.some((l) => matches(l.format))) : posts

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap items-center">
        <form className="relative w-full sm:w-auto sm:flex-1 sm:min-w-[200px]" onSubmit={(e) => { e.preventDefault(); setFilters({ ...filters, q }) }}>
          <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
          <input className={`${input} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título" />
        </form>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
        <select className="w-full min-w-0 truncate rounded-xl border border-gray-200 bg-white px-2 py-2 text-sm sm:w-auto sm:px-3" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">Todos los estados</option>
          {Object.entries(POST_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select className="w-full min-w-0 truncate rounded-xl border border-gray-200 bg-white px-2 py-2 text-sm sm:w-auto sm:px-3" value={filters.channel} onChange={(e) => setFilters({ ...filters, channel: e.target.value })}>
          <option value="">Todos los canales</option>
          {MK_CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_NAME[c]}</option>)}
        </select>
        <select className="w-full min-w-0 truncate rounded-xl border border-gray-200 bg-white px-2 py-2 text-sm sm:w-auto sm:px-3" value={format} onChange={(e) => setFormat(e.target.value)} aria-label="Formato">
          <option value="">Todos los formatos</option>
          {FORMAT_FILTERS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select className="w-full min-w-0 truncate rounded-xl border border-gray-200 bg-white px-2 py-2 text-sm sm:w-auto sm:px-3" value={filters.campaignId} onChange={(e) => setFilters({ ...filters, campaignId: e.target.value })}>
          <option value="">Todas las campañas</option>
          <option value="none">Sin campaña</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        </div>
        {anyEditable && (
          <button onClick={() => setCreating(true)} className="inline-flex w-full items-center justify-center gap-2 sm:w-auto rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
            <Plus size={15} /> Nueva publicación
          </button>
        )}
        {loading && <Loader2 size={16} className="animate-spin text-gray-400" />}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <p className="font-medium text-gray-700">No hay publicaciones {filters.status || filters.q || filters.channel || filters.campaignId || format ? 'con estos filtros' : 'todavía'}</p>
          <p className="text-sm text-gray-500 mt-1">Crea una, escribe el texto (el asistente de IA te ayuda) y publícala o prográmala en los canales que quieras.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {SECTIONS.map((sec) => {
            const list = shown
              .filter((p) => sec.statuses.includes(p.status))
              .sort((a, b) => (sec.order === 'asc' ? 1 : -1) * (new Date(a[sec.by]).getTime() - new Date(b[sec.by]).getTime()))
            if (!list.length) return null
            return (
              <section key={sec.key} className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700">{sec.title} <span className="font-normal text-gray-400">({list.length})</span></h3>
                <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                  {list.map((p) => <PostCard key={p.id} p={p} />)}
                </div>
              </section>
            )
          })}
        </div>
      )}
      {creating && <NewPostModal workspaces={workspaces} workspace={workspace} campaigns={campaigns} onClose={() => setCreating(false)} />}
    </div>
  )
}
