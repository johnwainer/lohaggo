'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bot, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { CAMPAIGN_STATUS, MkChannelIcon, OBJECTIVES, api, fmtDate, input, num } from '@/components/admin/marketing/shared'
import { NewPostModal } from '@/components/admin/marketing/PostsTab'

export type Campaign = {
  id: string
  workspaceId: string
  name: string
  objective: string
  description: string | null
  startsAt: string | null
  endsAt: string | null
  budget: number | null
  status: string
  color: string
  _count?: { posts: number }
}

type Ws = { id: string; name: string; permissions: string[] }
type Totals = { reach: number; impressions: number; likes: number; comments: number; shares: number; saves: number; clicks: number; videoViews: number; webViews: number }
type CampaignStats = {
  totals: Totals & { engagementRate: number | null; publications: number; posts: number }
  byChannel: Array<Totals & { channel: string; publications: number; engagementRate: number | null }>
  posts: Array<{ postId: string; title: string; channels: string[]; totals: Totals; engagementRate: number | null; inboxConversations: number; publishedAt: string | null }>
}

const COLORS = ['#7C3AED', '#F97316', '#0EA5E9', '#10B981', '#E11D48', '#EAB308', '#64748B']

function CampaignForm({ initial, workspaceId, onClose, onSaved }: { initial?: Campaign; workspaceId: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    name: initial?.name || '', objective: initial?.objective || 'reach', description: initial?.description || '',
    startsAt: initial?.startsAt?.slice(0, 10) || '', endsAt: initial?.endsAt?.slice(0, 10) || '', budget: initial?.budget != null ? String(initial.budget) : '',
    status: initial?.status || 'active', color: initial?.color || COLORS[0],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function save() {
    setSaving(true)
    setError(null)
    try {
      const body = { ...f, startsAt: f.startsAt ? `${f.startsAt}T00:00:00-05:00` : null, endsAt: f.endsAt ? `${f.endsAt}T23:59:59-05:00` : null, budget: f.budget === '' ? null : Number(f.budget) }
      if (initial) await api(`/api/admin/marketing/campaigns/${initial.id}`, { method: 'PATCH', json: body })
      else await api('/api/admin/marketing/campaigns', { method: 'POST', json: { ...body, workspaceId } })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
      setSaving(false)
    }
  }
  const field = (label: string, el: React.ReactNode, hint?: string) => (
    <label className="block space-y-1"><span className="text-sm font-medium text-gray-700">{label}</span>{el}{hint && <span className="block text-xs text-gray-500">{hint}</span>}</label>
  )
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-white p-6 space-y-4 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{initial ? 'Editar campaña' : 'Nueva campaña'}</h2><button onClick={onClose}><X size={18} className="text-gray-400" /></button></div>
        {field('Nombre', <input className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ej. Temporada de lluvias" />)}
        {field('Objetivo', <select className={input} value={f.objective} onChange={(e) => setF({ ...f, objective: e.target.value })}>{Object.entries(OBJECTIVES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>, 'Sirve para leer las estadísticas: alcance, clics o conversaciones según lo que buscas.')}
        {field('Descripción', <textarea className={input} rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Mensaje, público y qué queremos lograr" />, 'El asistente de IA la usa como contexto al redactar las publicaciones de la campaña.')}
        <div className="grid grid-cols-2 gap-3">
          {field('Inicio', <input type="date" className={input} value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} />)}
          {field('Fin', <input type="date" className={input} value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} />)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {field('Presupuesto (COP, opcional)', <input type="number" min={0} className={input} value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} />)}
          {field('Estado', <select className={input} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{Object.entries(CAMPAIGN_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>)}
        </div>
        <div className="space-y-1">
          <span className="text-sm font-medium text-gray-700">Color en la parrilla</span>
          <div className="flex gap-2">{COLORS.map((c) => <button key={c} type="button" onClick={() => setF({ ...f, color: c })} className={`h-7 w-7 rounded-full ${f.color === c ? 'ring-2 ring-offset-2 ring-gray-800' : ''}`} style={{ background: c }} aria-label={c} />)}</div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button onClick={save} disabled={saving || !f.name.trim()} className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
          {saving && <Loader2 size={15} className="animate-spin" />} Guardar
        </button>
      </div>
    </div>
  )
}

function CampaignDetail({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const [stats, setStats] = useState<CampaignStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    api<{ stats: CampaignStats }>(`/api/admin/marketing/campaigns/${campaign.id}`).then((d) => setStats(d.stats)).catch((e) => setError(e.message))
  }, [campaign.id])
  const t = stats?.totals
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">{OBJECTIVES[campaign.objective] || campaign.objective} · {CAMPAIGN_STATUS[campaign.status]}</p>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: campaign.color }} />{campaign.name}</h2>
            <p className="text-sm text-gray-500">{fmtDate(campaign.startsAt)} – {fmtDate(campaign.endsAt)}{campaign.budget != null ? ` · Presupuesto $${num(campaign.budget)}` : ''}</p>
          </div>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        {campaign.description && <p className="text-sm text-gray-700 whitespace-pre-wrap">{campaign.description}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!stats ? <Loader2 className="animate-spin text-gray-400" /> : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ['Publicaciones', t!.posts], ['Alcance', t!.reach], ['Interacciones', t!.likes + t!.comments + t!.shares + t!.saves], ['Visitas al blog', t!.webViews],
                ['Impresiones', t!.impressions], ['Clics', t!.clicks], ['Reproducciones', t!.videoViews], ['Tasa de interacción', t!.engagementRate == null ? '—' : `${t!.engagementRate}%`],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl bg-gray-50 p-3"><p className="text-[11px] text-gray-500">{label}</p><p className="text-lg font-semibold text-gray-900">{typeof value === 'number' ? num(value) : value}</p></div>
              ))}
            </div>
            {campaign.budget != null && t!.reach > 0 && <p className="text-xs text-gray-500">Costo por cada 1.000 personas alcanzadas: ${num(Math.round((campaign.budget / t!.reach) * 1000))}</p>}
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900">Publicaciones</h3>
              {stats.posts.length === 0 ? <p className="text-sm text-gray-500">Aún no se ha publicado nada de esta campaña.</p> : stats.posts.map((p) => (
                <Link key={p.postId} href={`/admin/marketing/posts/${p.postId}`} className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2 hover:bg-gray-50">
                  <span className="flex gap-1">{p.channels.map((c) => <MkChannelIcon key={c} channel={c} size={16} />)}</span>
                  <span className="flex-1 truncate text-sm text-gray-900">{p.title}</span>
                  <span className="text-xs text-gray-500">{num(p.totals.reach)} alcance · {num(p.totals.webViews)} visitas · {p.inboxConversations} en bandeja</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function CampaignsTab({ campaigns, workspace, canEdit, onChanged, onCreateWithAgent }: { campaigns: Campaign[]; workspace: Ws | null; canEdit: boolean; onChanged: () => void; onCreateWithAgent?: () => void }) {
  const [editing, setEditing] = useState<Campaign | 'new' | null>(null)
  const [open, setOpen] = useState<Campaign | null>(null)
  const [newPostFor, setNewPostFor] = useState<Campaign | null>(null)

  async function remove(c: Campaign) {
    if (!window.confirm(`¿Eliminar la campaña "${c.name}"? Sus publicaciones se conservan, sin campaña.`)) return
    await api(`/api/admin/marketing/campaigns/${c.id}`, { method: 'DELETE' }).catch(() => null)
    onChanged()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">Agrupa publicaciones con un mismo objetivo para planificarlas juntas y medirlas en conjunto.</p>
        {canEdit && workspace && (
          <div className="flex flex-wrap gap-2">
            {onCreateWithAgent && <button onClick={onCreateWithAgent} className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-100"><Bot size={15} /> Crear campaña con agente</button>}
            <button onClick={() => setEditing('new')} className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"><Plus size={15} /> Nueva campaña</button>
          </div>
        )}
      </div>
      {!workspace && canEdit === false && campaigns.length === 0 && <p className="text-sm text-gray-500">Elige un workspace para crear campañas.</p>}
      {campaigns.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-500">Aún no hay campañas.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <div key={c.id} className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
              <button onClick={() => setOpen(c)} className="block text-left w-full">
                <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: c.color }} /><p className="font-semibold text-gray-900 truncate">{c.name}</p></div>
                <p className="mt-1 text-xs text-gray-500">{OBJECTIVES[c.objective] || c.objective} · {CAMPAIGN_STATUS[c.status] || c.status}</p>
                <p className="text-xs text-gray-500">{fmtDate(c.startsAt)} – {fmtDate(c.endsAt)} · {c._count?.posts ?? 0} publicaciones</p>
              </button>
              <div className="flex items-center gap-2 border-t border-gray-100 pt-2">
                <button onClick={() => setOpen(c)} className="text-xs font-medium text-primary-700 hover:underline">Ver resultados</button>
                {canEdit && <>
                  <button onClick={() => setNewPostFor(c)} className="text-xs text-gray-600 hover:underline">+ Publicación</button>
                  <button onClick={() => setEditing(c)} className="ml-auto text-gray-400 hover:text-gray-700" title="Editar"><Pencil size={14} /></button>
                  <button onClick={() => remove(c)} className="text-gray-400 hover:text-red-600" title="Eliminar"><Trash2 size={14} /></button>
                </>}
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <CampaignForm initial={editing === 'new' ? undefined : editing} workspaceId={editing === 'new' ? workspace?.id || '' : editing.workspaceId} onClose={() => setEditing(null)} onSaved={onChanged} />
      )}
      {open && <CampaignDetail campaign={open} onClose={() => setOpen(null)} />}
      {newPostFor && workspace && <NewPostModal workspaces={[workspace]} workspace={workspace} campaigns={campaigns} defaults={{ campaignId: newPostFor.id }} onClose={() => setNewPostFor(null)} />}
    </div>
  )
}
