'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react'
import { MkChannelIcon, POST_STATUS, api, type MkChannel } from '@/components/admin/marketing/shared'
import { NewPostModal } from '@/components/admin/marketing/PostsTab'
import type { Campaign } from '@/components/admin/marketing/CampaignsTab'

type Item = {
  id: string
  title: string
  status: string
  at: string
  campaign: { id: string; name: string; color: string } | null
  variants: Array<{ channel: MkChannel }>
  publications: Array<{ channel: MkChannel; status: string; connection: { name: string } | null }>
}
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [newOn, setNewOn] = useState<string | null>(null)

  const days = useMemo(() => (view === 'month' ? monthGrid(anchor) : weekGrid(anchor)), [view, anchor])
  const monthKey = dayKey(anchor).slice(0, 7)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ from: atMidnight(days[0]).toISOString(), to: new Date(atMidnight(days[days.length - 1]).getTime() + DAY - 1).toISOString() })
      if (workspaceId) q.set('workspaceId', workspaceId)
      if (campaignId) q.set('campaignId', campaignId)
      const d = await api<{ items: Item[] }>(`/api/admin/marketing/calendar?${q}`)
      setItems(d.items)
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

  async function drop(day: string) {
    const item = items.find((i) => i.id === dragId)
    setDragId(null)
    if (!item || dayKey(new Date(item.at)) === day) return
    // Same time of day, another date
    const time = timeOf(new Date(item.at))
    const when = new Date(`${day}T${time}:00-05:00`)
    setItems((list) => list.map((i) => (i.id === item.id ? { ...i, at: when.toISOString() } : i)))
    try {
      await api('/api/admin/marketing/calendar', { method: 'PATCH', json: { postId: item.id, when: when.toISOString() } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo mover')
    }
    load()
  }

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
    const locked = ['published', 'partial', 'publishing'].includes(it.status)
    return (
      <Link
        href={`/admin/marketing/posts/${it.id}`}
        draggable={canEdit && !locked}
        onDragStart={() => setDragId(it.id)}
        onDragEnd={() => setDragId(null)}
        className={`block rounded-lg border-l-4 bg-white px-1.5 py-1 text-[11px] shadow-sm hover:shadow ${locked ? 'opacity-90' : 'cursor-grab'} ${it.status === 'failed' ? 'ring-1 ring-red-300' : ''}`}
        style={{ borderLeftColor: it.campaign?.color || '#CBD5E1' }}
        title={`${it.title} · ${POST_STATUS[it.status]?.label || it.status}${it.campaign ? ` · ${it.campaign.name}` : ''}`}
      >
        <span className="flex items-center gap-1">
          <span className="text-gray-500 tabular-nums">{timeOf(new Date(it.at))}</span>
          <span className="flex -space-x-1">{channels.map((c) => <MkChannelIcon key={c} channel={c} size={12} />)}</span>
          {it.status === 'published' && <span className="text-emerald-600">✓</span>}
          {it.status === 'failed' && <span className="text-red-600">!</span>}
        </span>
        <span className="block truncate font-medium text-gray-800">{it.title}</span>
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
        <div className="ml-auto flex gap-2 items-center">
          <select className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">Todas las campañas</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="inline-flex rounded-xl border border-gray-200 bg-white p-0.5 text-sm">
            {(['month', 'week'] as const).map((v) => <button key={v} onClick={() => setView(v)} className={`rounded-lg px-3 py-1 ${view === v ? 'bg-gray-900 text-white' : 'text-gray-600'}`}>{v === 'month' ? 'Mes' : 'Semana'}</button>)}
          </div>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-gray-500">Arrastra una publicación a otro día para reprogramarla (conserva la hora). Lo ya publicado no se mueve. Horario de Bogotá.</p>

      <div className="overflow-x-auto">
        <div className="grid min-w-[760px] grid-cols-7 gap-px overflow-hidden rounded-2xl border border-gray-200 bg-gray-200">
          {WEEKDAYS.map((d) => <div key={d} className="bg-gray-50 px-2 py-1.5 text-center text-xs font-medium text-gray-500">{d}</div>)}
          {days.map((day) => {
            const inMonth = view === 'week' || day.slice(0, 7) === monthKey
            const list = byDay.get(day) || []
            return (
              <div
                key={day}
                onDragOver={(e) => { if (dragId) e.preventDefault() }}
                onDrop={() => drop(day)}
                className={`group relative bg-white p-1.5 ${view === 'month' ? 'min-h-[112px]' : 'min-h-[420px]'} ${inMonth ? '' : 'bg-gray-50/70'} ${dragId ? 'hover:bg-primary-50' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${day === today ? 'rounded-full bg-primary-600 px-1.5 font-semibold text-white' : inMonth ? 'text-gray-700' : 'text-gray-300'}`}>{Number(day.slice(8))}</span>
                  {canEdit && workspace && day >= today && (
                    <button onClick={() => setNewOn(day)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-primary-600" title="Nueva publicación este día"><Plus size={14} /></button>
                  )}
                </div>
                <div className="mt-1 space-y-1">
                  {(view === 'month' ? list.slice(0, 3) : list).map((it) => <Card key={it.id} it={it} />)}
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
