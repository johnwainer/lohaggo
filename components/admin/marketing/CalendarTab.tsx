'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react'
import { FormatPill, MkChannelIcon, POST_STATUS, api, type MkChannel } from '@/components/admin/marketing/shared'
import { agentFormatLabel } from '@/lib/marketing/format-display'
import { NewPostModal } from '@/components/admin/marketing/PostsTab'
import type { Campaign } from '@/components/admin/marketing/CampaignsTab'
import { formatScore, reviewBadge } from '@/lib/marketing/editorial-rubric'

type Item = {
  /** One card per post and day it goes out (the agent gives each channel its own day) */
  key: string
  id: string
  title: string
  status: string
  at: string
  campaign: { id: string; name: string; color: string } | null
  variants: Array<{ channel: MkChannel }>
  publications: Array<{ id: string; channel: MkChannel; status: string; scheduledAt: string; connection: { name: string } | null }>
  origin?: string
  reviewStatus?: string | null
  reviewScore?: number | null
  slots?: Array<{ channel: MkChannel; reason: string }>
  /** Format of each network's version: Reel, Historia, Carrusel (3)… */
  formats?: Partial<Record<MkChannel, string>>
}
type IdeaItem = { id: string; angle: string; pillar: string; channels: MkChannel[]; formats?: Partial<Record<MkChannel, string>> | null; targetDate: string; status: string; agentId: string; agent: { campaign: { color: string; name: string } } }
type Ws = { id: string; name: string; permissions: string[] }

const TZ = 'America/Bogota'
const DAY = 24 * 3600_000
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/** YYYY-MM-DD of an instant in Bogotá. */
const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
const timeOf = (d: Date) => new Intl.DateTimeFormat('es-CO', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)
/** Midnight of a Bogotá calendar day as an instant (UTC-5, no DST). */
const atMidnight = (key: string) => new Date(`${key}T00:00:00-05:00`)

function monthGrid(anchor: Date) {
  const key = dayKey(anchor)
  const first = atMidnight(`${key.slice(0, 8)}01`)
  const weekday = (first.getUTCDay() + 6) % 7 // Monday = 0 (Bogotá midnight is 05:00 UTC, same weekday)
  const start = new Date(first.getTime() - weekday * DAY)
  return Array.from({ length: 42 }, (_, i) => dayKey(new Date(start.getTime() + i * DAY + 6 * 3600_000)))
}
function weekGrid(anchor: Date) {
  const m = atMidnight(dayKey(anchor))
  const weekday = (m.getUTCDay() + 6) % 7
  const start = new Date(m.getTime() - weekday * DAY)
  return Array.from({ length: 7 }, (_, i) => dayKey(new Date(start.getTime() + i * DAY + 6 * 3600_000)))
}

export default function CalendarTab({ workspaceId, campaigns, workspace, canEdit }: { workspaceId: string; campaigns: Campaign[]; workspace: Ws | null; canEdit: boolean }) {
  const [view, setView] = useState<'month' | 'week'>('month')
  const [anchor, setAnchor] = useState(() => new Date())
  const [campaignId, setCampaignId] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [ideas, setIdeas] = useState<IdeaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ kind: 'post' | 'idea'; id: string } | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [newOn, setNewOn] = useState<string | null>(null)

  const days = useMemo(() => (view === 'month' ? monthGrid(anchor) : weekGrid(anchor)), [view, anchor])
  const monthKey = dayKey(anchor).slice(0, 7)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ from: atMidnight(days[0]).toISOString(), to: new Date(atMidnight(days[days.length - 1]).getTime() + DAY - 1).toISOString() })
      if (workspaceId) q.set('workspaceId', workspaceId)
      if (campaignId) q.set('campaignId', campaignId)
      const d = await api<{ items: Item[]; ideas?: IdeaItem[] }>(`/api/admin/marketing/calendar?${q}`)
      setItems(d.items)
      setIdeas(d.ideas ?? [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [days, workspaceId, campaignId])
  useEffect(() => { load() }, [load])

  const byDay = useMemo(() => {
    const m = new Map<string, Item[]>()
    for (const it of items) {
      const k = dayKey(new Date(it.at))
      m.set(k, [...(m.get(k) || []), it].sort((a, b) => a.at.localeCompare(b.at)))
    }
    return m
  }, [items])
  const ideasByDay = useMemo(() => {
    const m = new Map<string, IdeaItem[]>()
    for (const it of ideas) m.set(dayKey(new Date(it.targetDate)), [...(m.get(dayKey(new Date(it.targetDate))) || []), it])
    return m
  }, [ideas])

  async function drop(day: string) {
    const d = drag
    setDrag(null)
    if (!d) return
    if (day < today) { setError('Solo se puede mover a hoy o después'); return }
    setNotice(null)
    try {
      if (d.kind === 'idea') {
        const idea = ideas.find((i) => i.id === d.id)
        if (!idea || dayKey(new Date(idea.targetDate)) === day) return
        setIdeas((list) => list.map((i) => (i.id === idea.id ? { ...i, targetDate: `${day}T17:00:00.000Z` } : i)))
        await api('/api/admin/marketing/calendar', { method: 'PATCH', json: { ideaId: idea.id, when: new Date(`${day}T12:00:00-05:00`).toISOString() } })
        setNotice('Idea movida: el agente la redactará para ese día.')
      } else {
        const item = items.find((i) => i.key === d.id)
        if (!item || dayKey(new Date(item.at)) === day) return
        // Same time of day, another date; only this day's sends of the post (the other channels keep their day)
        const when = new Date(`${day}T${timeOf(new Date(item.at))}:00-05:00`)
        const publicationIds = item.publications.filter((p) => p.status === 'scheduled').map((p) => p.id)
        setItems((list) => list.map((i) => (i.key === item.key ? { ...i, at: when.toISOString() } : i)))
        const r = await api<{ warning?: string | null }>('/api/admin/marketing/calendar', { method: 'PATCH', json: { postId: item.id, when: when.toISOString(), ...(publicationIds.length ? { publicationIds } : {}) } })
        setNotice(r.warning || null)
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo mover')
    }
    load()
  }
  const movable = (it: Item) => canEdit && (it.publications.some((p) => p.status === 'scheduled') || (!it.publications.length && ['draft', 'review', 'approved'].includes(it.status)))

  const shift = (dir: number) => {
    const d = new Date(anchor)
    if (view === 'month') d.setUTCMonth(d.getUTCMonth() + dir, 15)
    else d.setTime(d.getTime() + dir * 7 * DAY)
    setAnchor(d)
  }
  const today = dayKey(new Date())
  const title = view === 'month'
    ? new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: TZ }).format(atMidnight(`${monthKey}-15`))
    : `${new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: TZ }).format(atMidnight(days[0]))} – ${new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }).format(atMidnight(days[6]))}`

  const Card = ({ it }: { it: Item }) => {
    const channels = (it.publications.length ? it.publications.map((p) => p.channel) : it.variants.map((v) => v.channel)).filter((c, i, a) => a.indexOf(c) === i)
    const locked = !movable(it)
    return (
      <Link
        href={`/admin/marketing/posts/${it.id}`}
        draggable={!locked}
        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDrag({ kind: 'post', id: it.key }) }}
        onDragEnd={() => setDrag(null)}
        className={`block rounded-lg border-l-4 bg-white px-1.5 py-1 text-[11px] shadow-sm hover:shadow ${locked ? 'opacity-90' : 'cursor-grab'} ${it.status === 'failed' ? 'ring-1 ring-red-300' : ''}`}
        style={{ borderLeftColor: it.campaign?.color || '#CBD5E1' }}
        title={`${it.title} · ${POST_STATUS[it.status]?.label || it.status}${reviewBadge(it.reviewStatus, it.reviewScore) ? ` · ${reviewBadge(it.reviewStatus, it.reviewScore)!.label}` : ''}${it.campaign ? ` · ${it.campaign.name}` : ''}${it.slots?.length ? `\n${it.slots.map((s) => s.reason).join('\n')}` : ''}`}
      >
        <span className="flex items-center gap-1">
          <span className="text-gray-500 tabular-nums">{timeOf(new Date(it.at))}</span>
          {(it.publications.length ? it.publications.every((p) => p.status === 'published') : it.status === 'published') && <span className="text-emerald-600" title="Publicada">✓</span>}
          {(it.publications.some((p) => p.status === 'failed') || (!it.publications.length && it.status === 'failed')) && <span className="text-red-600" title="Falló">!</span>}
          {it.origin === 'agent' && <span title="Creada por el agente">🤖</span>}
          {it.reviewStatus && !['approved', 'overridden'].includes(it.reviewStatus) && !['published', 'partial'].includes(it.status) && <span className="text-amber-600" title={reviewBadge(it.reviewStatus, it.reviewScore)?.label}>✎</span>}
          {it.reviewStatus === 'approved' && it.reviewScore != null && !['published', 'partial'].includes(it.status) && <span className="text-emerald-700 tabular-nums" title="Revisada por el editor">{formatScore(it.reviewScore)}</span>}
        </span>
        <span className="block truncate font-medium text-gray-800">{it.title}</span>
        {/* Each network with its format, so the day shows what goes out as reel, story or post */}
        <span className="mt-0.5 flex flex-wrap gap-x-1.5 gap-y-0.5">
          {channels.map((c) => (
            <span key={c} className="inline-flex items-center gap-0.5"><MkChannelIcon channel={c} size={11} /><FormatPill size="xs" label={(it.formats?.[c] ?? '').replace(/ \(\d+\)$/, '') || '—'} /></span>
          ))}
        </span>
      </Link>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => shift(-1)} className="rounded-lg border border-gray-200 bg-white p-1.5 hover:bg-gray-50" aria-label="Anterior"><ChevronLeft size={16} /></button>
        <button onClick={() => setAnchor(new Date())} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50">Hoy</button>
        <button onClick={() => shift(1)} className="rounded-lg border border-gray-200 bg-white p-1.5 hover:bg-gray-50" aria-label="Siguiente"><ChevronRight size={16} /></button>
        <h2 className="text-lg font-semibold capitalize text-gray-900 min-w-[180px]">{title}</h2>
        {loading && <Loader2 size={16} className="animate-spin text-gray-400" />}
        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          <select className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm sm:flex-none" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">Todas las campañas</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="inline-flex rounded-xl border border-gray-200 bg-white p-0.5 text-sm">
            {(['month', 'week'] as const).map((v) => <button key={v} onClick={() => setView(v)} className={`rounded-lg px-3 py-1 ${view === v ? 'bg-gray-900 text-white' : 'text-gray-600'}`}>{v === 'month' ? 'Mes' : 'Semana'}</button>)}
          </div>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-amber-700">{notice}</p>}
      <p className="hidden text-xs text-gray-500 md:block">Cada red aparece el día en que sale. Arrastra una publicación a otro día para moverla (conserva la hora; los demás canales de esa pieza mantienen su día) o una idea punteada del agente para cambiar su fecha. El agente lo tiene en cuenta al planificar. Lo ya publicado no se mueve. Horario de Bogotá.</p>

      <div className="space-y-2 md:hidden">
        <p className="text-xs text-gray-500">Cada red aparece el día en que sale. Para mover una publicación a otro día, ábrela desde un computador y arrástrala en el calendario. Horario de Bogotá.</p>
        {(() => {
          const agenda = days.filter((day) => (view === 'week' || day.slice(0, 7) === monthKey) && (view === 'week' || day === today || (byDay.get(day) || []).length || (ideasByDay.get(day) || []).length))
          if (!agenda.length) return <p className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">Nada programado este mes.</p>
          return agenda.map((day) => {
            const list = byDay.get(day) || []
            const dayIdeas = ideasByDay.get(day) || []
            return (
              <div key={day} className={`rounded-2xl border bg-white p-3 ${day === today ? 'border-primary-300' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-semibold capitalize ${day === today ? 'text-primary-700' : 'text-gray-800'}`}>{new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'short', timeZone: TZ }).format(atMidnight(day))}</span>
                  {canEdit && workspace && day >= today && (
                    <button onClick={() => setNewOn(day)} className="-m-1.5 p-1.5 text-gray-400 hover:text-primary-600" aria-label="Nueva publicación este día"><Plus size={18} /></button>
                  )}
                </div>
                {list.length || dayIdeas.length ? (
                  <div className="mt-2 space-y-1.5">
                    {list.map((it) => <Card key={it.key} it={it} />)}
                    {dayIdeas.map((idea) => (
                      <span key={idea.id} className="block rounded-lg border border-dashed px-1.5 py-1 text-[11px] text-gray-500" style={{ borderColor: idea.agent.campaign.color }}>
                        <span className="flex flex-wrap items-center gap-1">🤖 {idea.channels.map((c) => <span key={c} className="inline-flex items-center gap-0.5"><MkChannelIcon channel={c} size={11} /><FormatPill size="xs" label={agentFormatLabel(c, idea.formats?.[c])} /></span>)}{idea.status === 'proposed' && <span className="text-amber-600">idea</span>}</span>
                        <span className="block truncate">{idea.angle}</span>
                      </span>
                    ))}
                  </div>
                ) : <p className="mt-1 text-xs text-gray-400">Sin publicaciones</p>}
              </div>
            )
          })
        })()}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <div className="grid min-w-[760px] grid-cols-7 gap-px overflow-hidden rounded-2xl border border-gray-200 bg-gray-200">
          {WEEKDAYS.map((d) => <div key={d} className="bg-gray-50 px-2 py-1.5 text-center text-xs font-medium text-gray-500">{d}</div>)}
          {days.map((day) => {
            const inMonth = view === 'week' || day.slice(0, 7) === monthKey
            const list = byDay.get(day) || []
            return (
              <div
                key={day}
                onDragOver={(e) => { if (drag && day >= today) e.preventDefault() }}
                onDrop={(e) => { e.preventDefault(); drop(day) }}
                className={`group relative bg-white p-1.5 ${view === 'month' ? 'min-h-[112px]' : 'min-h-[420px]'} ${inMonth ? '' : 'bg-gray-50/70'} ${drag && day >= today ? 'hover:bg-primary-50' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${day === today ? 'rounded-full bg-primary-600 px-1.5 font-semibold text-white' : inMonth ? 'text-gray-700' : 'text-gray-300'}`}>{Number(day.slice(8))}</span>
                  {canEdit && workspace && day >= today && (
                    <button onClick={() => setNewOn(day)} className="opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 text-gray-400 hover:text-primary-600" title="Nueva publicación este día"><Plus size={14} /></button>
                  )}
                </div>
                <div className="mt-1 space-y-1">
                  {(view === 'month' ? list.slice(0, 3) : list).map((it) => <Card key={it.key} it={it} />)}
                  {(ideasByDay.get(day) || []).slice(0, view === 'month' ? 2 : 10).map((idea) => (
                    <span
                      key={idea.id}
                      draggable={canEdit}
                      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDrag({ kind: 'idea', id: idea.id }) }}
                      onDragEnd={() => setDrag(null)}
                      title={`Idea del agente (${idea.status === 'proposed' ? 'por revisar' : 'aceptada, se redactará antes de la fecha'}) · ${idea.agent.campaign.name}\n${idea.pillar}${canEdit ? '\nArrástrala a otro día para cambiar su fecha' : ''}`}
                      className={`block rounded-lg border border-dashed px-1.5 py-1 text-[11px] text-gray-500 ${canEdit ? 'cursor-grab' : ''}`}
                      style={{ borderColor: idea.agent.campaign.color }}
                    >
                      <span className="flex flex-wrap items-center gap-1">🤖 {idea.channels.map((c) => <span key={c} className="inline-flex items-center gap-0.5"><MkChannelIcon channel={c} size={11} /><FormatPill size="xs" label={agentFormatLabel(c, idea.formats?.[c])} /></span>)}{idea.status === 'proposed' && <span className="text-amber-600">idea</span>}</span>
                      <span className="block truncate">{idea.angle}</span>
                    </span>
                  ))}
                  {view === 'month' && list.length > 3 && <button onClick={() => { setAnchor(atMidnight(day)); setView('week') }} className="text-[11px] text-primary-700 hover:underline">+{list.length - 3} más</button>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {newOn && workspace && (
        <NewPostModal workspaces={[workspace]} workspace={workspace} campaigns={campaigns} defaults={{ scheduledAt: new Date(`${newOn}T10:00:00-05:00`).toISOString(), campaignId: campaignId || undefined }} onClose={() => setNewOn(null)} />
      )}
    </div>
  )
}
