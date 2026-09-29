'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  RefreshCw,
  Send,
  UserCheck,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import OriginBadge from '@/components/shared/OriginBadge'
import type { AttentionItem } from '@/components/admin/requests/types'
import { Lightbox, SEVERITY, Thumbs } from '@/components/admin/requests/ui'

type OriginFields = {
  origin?: string
  originChannel?: string | null
  originConversationId?: string | null
  originAgentName?: string | null
}

type Partner = {
  id: string
  user: { id: string; name: string | null; email: string | null; phone: string | null }
} | null

type Proposal = OriginFields & {
  id: string
  price: number
  notes: string | null
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
  proposedDate: string | null
  proposedTime: string | null
  createdAt: string
  partner: Partner
}

type NotifiedPartner = {
  userId: string
  name: string | null
  email: string | null
  phone: string | null
  partnerId: string | null
  isDirect: boolean
  notifiedAt: string
  read: boolean
}

type ServiceRequest = OriginFields & {
  id: string
  status: 'ACTIVE' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED'
  address: string
  city: string
  notes: string | null
  budget: number | null
  preferredDate: string | null
  preferredTime: string | null
  isUrgent: boolean
  expiresAt: string
  createdAt: string
  service: { name: string; icon: string }
  user: { id: string; name: string | null; email: string | null; phone: string | null }
  partner: Partner
  photos?: Array<{ url: string; order: number }>
  proposals: Proposal[]
  notifiedPartners: NotifiedPartner[]
  _count: { proposals: number }
}

const STATUS_STYLES: Record<ServiceRequest['status'], string> = {
  ACTIVE: 'bg-yellow-100 text-yellow-800',
  ACCEPTED: 'bg-green-100 text-green-800',
  EXPIRED: 'bg-gray-100 text-gray-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<ServiceRequest['status'], string> = {
  ACTIVE: 'Activa',
  ACCEPTED: 'Aceptada',
  EXPIRED: 'Expirada',
  CANCELLED: 'Cancelada',
}

const PROPOSAL_STYLES: Record<Proposal['status'], string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  ACCEPTED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-700',
}

const PROPOSAL_LABELS: Record<Proposal['status'], string> = {
  PENDING: 'Pendiente',
  ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada',
}

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 } as const

const proposedWhen = (p: Proposal) =>
  p.proposedDate
    ? `${new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(p.proposedDate))}${p.proposedTime ? ` · ${p.proposedTime}` : ''}`
    : p.proposedTime || '—'

const FILTERS: Array<{ value: 'all' | ServiceRequest['status']; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'ACTIVE', label: 'Activas' },
  { value: 'ACCEPTED', label: 'Aceptadas' },
  { value: 'EXPIRED', label: 'Expiradas' },
  { value: 'CANCELLED', label: 'Canceladas' },
]

type Stats = { total: number; active: number; accepted: number; expired: number; cancelled: number; proposals: number }
type PageResponse = { items: ServiceRequest[]; nextCursor: string | null; hasMore: boolean; stats?: Stats }

const readError = async (res: Response) => {
  if (res.status === 401 || res.status === 403) return 'Tu sesión venció o no tienes permiso.'
  const data = await res.json().catch(() => null)
  return (data && typeof data.error === 'string' && data.error) || `El servidor respondió ${res.status}.`
}

export default function AdminServiceRequestsPage() {
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [listLoading, setListLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | ServiceRequest['status']>('all')
  const [originFilter, setOriginFilter] = useState<'all' | 'app' | 'chat'>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [attention, setAttention] = useState<Map<string, AttentionItem>>(new Map())
  const [attentionOnly, setAttentionOnly] = useState(false)
  const [attentionRequests, setAttentionRequests] = useState<ServiceRequest[] | null>(null)
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null)
  const requestSeq = useRef(0)

  const queryFor = useCallback((cursor: string | null) => {
    const q = new URLSearchParams()
    if (filter !== 'all') q.set('status', filter)
    if (originFilter !== 'all') q.set('origin', originFilter)
    if (cursor) q.set('cursor', cursor)
    return q.toString()
  }, [filter, originFilter])

  const loadFirstPage = useCallback(async () => {
    const seq = ++requestSeq.current
    setListLoading(true)
    try {
      const res = await fetch(`/api/admin/service-requests?${queryFor(null)}`)
      if (!res.ok) throw new Error(await readError(res))
      const data: PageResponse = await res.json()
      if (seq !== requestSeq.current) return
      setRequests(Array.isArray(data.items) ? data.items : [])
      setNextCursor(data.nextCursor ?? null)
      setHasMore(Boolean(data.hasMore))
      if (data.stats) setStats(data.stats)
      setError(null)
    } catch (err) {
      if (seq === requestSeq.current) setError(err instanceof Error && err.message !== 'Failed to fetch' ? err.message : 'Sin conexión.')
    } finally {
      if (seq === requestSeq.current) {
        setListLoading(false)
        setLoading(false)
      }
    }
  }, [queryFor])

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return
    const seq = requestSeq.current
    setLoadingMore(true)
    try {
      const res = await fetch(`/api/admin/service-requests?${queryFor(nextCursor)}`)
      if (!res.ok) throw new Error(await readError(res))
      const data: PageResponse = await res.json()
      if (seq !== requestSeq.current) return
      setRequests((prev) => {
        const have = new Set(prev.map((r) => r.id))
        return [...prev, ...(data.items ?? []).filter((r) => !have.has(r.id))]
      })
      setNextCursor(data.nextCursor ?? null)
      setHasMore(Boolean(data.hasMore))
      setError(null)
    } catch (err) {
      setError(err instanceof Error && err.message !== 'Failed to fetch' ? err.message : 'Sin conexión.')
    } finally {
      setLoadingMore(false)
    }
  }

  // Status and origin filter on the server: a new filter starts from the first page
  useEffect(() => { loadFirstPage() }, [loadFirstPage])

  useEffect(() => {
    let active = true
    fetch('/api/admin/service-requests/attention')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((att) => {
        if (!active) return
        const items: AttentionItem[] = Array.isArray(att?.items) ? att.items : []
        setAttention(new Map(items.map((i) => [i.id, i])))
      })
    return () => { active = false }
  }, [])

  const flaggedIds = useMemo(() => Array.from(attention.values()).filter((a) => a.flags.length).map((a) => a.id), [attention])
  const attentionCount = flaggedIds.length

  // "Necesitan atención" shows every flagged request, not only the ones on the loaded pages
  useEffect(() => {
    if (!attentionOnly) return
    if (!flaggedIds.length) { setAttentionRequests([]); return }
    let active = true
    setAttentionRequests(null)
    ;(async () => {
      try {
        const res = await fetch(`/api/admin/service-requests?ids=${encodeURIComponent(flaggedIds.slice(0, 200).join(','))}`)
        if (!res.ok) throw new Error(await readError(res))
        const data: PageResponse = await res.json()
        if (active) setAttentionRequests(Array.isArray(data.items) ? data.items : [])
      } catch (err) {
        if (!active) return
        setAttentionRequests([])
        setError(err instanceof Error && err.message !== 'Failed to fetch' ? err.message : 'Sin conexión.')
      }
    })()
    return () => { active = false }
  }, [attentionOnly, flaggedIds])

  const filtered = useMemo(() => {
    if (!attentionOnly) return requests
    const rank = (id: string) => {
      const a = attention.get(id)
      return a?.flags.length ? SEVERITY_ORDER[a.flags[0].severity] : 9
    }
    return (attentionRequests ?? [])
      .filter((r) => filter === 'all' || r.status === filter)
      .filter((r) => originFilter === 'all' || (originFilter === 'chat' ? r.origin === 'chat' : r.origin !== 'chat'))
      .filter((r) => attention.get(r.id)?.flags.length)
      .sort((a, b) => rank(a.id) - rank(b.id) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [filter, originFilter, requests, attentionOnly, attentionRequests, attention])

  const shownStats: Stats = stats ?? { total: 0, active: 0, accepted: 0, expired: 0, cancelled: 0, proposals: 0 }
  const busy = attentionOnly ? attentionRequests === null : listLoading

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 size={28} className="animate-spin mr-3" />
        <span className="text-sm font-medium">Cargando solicitudes…</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Solicitudes de servicio</h1>
        <p className="text-gray-600 mt-1">
          Cada solicitud creada por un cliente, los socios a quienes se les notificó y las propuestas enviadas.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-6">
        <StatBox label="Total" value={shownStats.total} />
        <StatBox label="Activas" value={shownStats.active} tone="yellow" />
        <StatBox label="Aceptadas" value={shownStats.accepted} tone="green" />
        <StatBox label="Expiradas" value={shownStats.expired} tone="gray" />
        <StatBox label="Canceladas" value={shownStats.cancelled} tone="red" />
        <StatBox label="Propuestas" value={shownStats.proposals} tone="primary" />
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              filter === f.value
                ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white shadow'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={() => setAttentionOnly((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            attentionOnly ? 'bg-red-600 text-white shadow' : 'bg-white text-red-700 border border-red-200 hover:bg-red-50'
          }`}
        >
          Necesitan atención
          <span className={`rounded-full px-1.5 text-xs font-bold ${attentionOnly ? 'bg-white/25' : 'bg-red-100'}`}>{attentionCount}</span>
        </button>
        <div className="flex w-full items-center gap-2 sm:w-auto sm:ml-auto">
          <label htmlFor="requests-origin-filter" className="text-sm text-gray-600 shrink-0">Origen</label>
          <select
            id="requests-origin-filter"
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value as 'all' | 'app' | 'chat')}
            className="flex-1 sm:flex-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
          >
            <option value="all">Todos</option>
            <option value="app">App</option>
            <option value="chat">Chat</option>
          </select>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span className="min-w-0 flex-1">No se pudieron cargar las solicitudes. {error}</span>
          <button onClick={() => loadFirstPage()} className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"><RefreshCw size={13} /> Reintentar</button>
        </div>
      )}

      <div className={`space-y-3 transition-opacity ${busy ? 'opacity-60' : ''}`} aria-busy={busy}>
        {busy && filtered.length === 0 && (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-100 bg-white p-10 text-sm text-gray-400">
            <Loader2 size={18} className="animate-spin" /> Cargando…
          </div>
        )}
        {!busy && filtered.length === 0 && (
          <div className="rounded-xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400">
            No hay solicitudes para este filtro.
          </div>
        )}
        {filtered.map((r) => {
          const isOpen = expanded.has(r.id)
          const att = attention.get(r.id)
          const top = att?.flags[0]
          const sev = top ? SEVERITY[top.severity] : null
          const photos = [...(r.photos ?? [])].sort((a, b) => a.order - b.order).map((p) => p.url)
          return (
            <div
              key={r.id}
              className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden"
            >
              <button
                onClick={() => toggleExpand(r.id)}
                className="w-full flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-5 py-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="text-2xl flex-shrink-0">{r.service.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 truncate">{r.service.name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLES[r.status]}`}>
                        {STATUS_LABELS[r.status]}
                      </span>
                      {r.isUrgent && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-orange-100 text-orange-700">
                          Urgente
                        </span>
                      )}
                      {r.partner && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-purple-100 text-purple-700">
                          Directa
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 break-words sm:truncate">
                      {r.user.name || r.user.email} · {r.city} · {new Date(r.createdAt).toLocaleString('es-CO')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 text-xs text-gray-500 flex-shrink-0">
                  <span className="flex items-center gap-1">
                    <Send size={14} />
                    {r.notifiedPartners.length}
                  </span>
                  <span className="flex items-center gap-1">
                    <UserCheck size={14} />
                    {r._count?.proposals ?? r.proposals.length}
                  </span>
                  {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </div>
              </button>
              <div className="px-3 sm:px-5 pb-3 -mt-2 flex flex-wrap items-center gap-2">
                {top && sev && att && (
                  <Link
                    href={`/admin/service-requests/${r.id}`}
                    title={att.flags.map((f) => f.title).join(' · ')}
                    className={`inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${sev.box}`}
                  >
                    <span className={`inline-flex h-4 min-w-[1rem] flex-shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold ${sev.chip}`}>{att.flags.length}</span>
                    <span className="truncate">{top.title}</span>
                  </Link>
                )}
                {r.origin === 'chat' && (
                  <OriginBadge
                    origin={r.origin}
                    originChannel={r.originChannel}
                    originConversationId={r.originConversationId}
                    agentName={r.originAgentName}
                  />
                )}
                <Link
                  href={`/admin/service-requests/${r.id}`}
                  className="ml-auto inline-flex flex-shrink-0 items-center gap-1 text-xs font-semibold text-primary-600 hover:underline"
                >
                  Ver todo <ArrowRight size={12} />
                </Link>
              </div>

              {isOpen && (
                <div className="border-t border-gray-100 px-3 sm:px-5 py-4 space-y-5 bg-gray-50/50">
                  <div className="grid md:grid-cols-2 gap-4">
                    <DetailBox title="Cliente">
                      <p className="font-medium text-gray-900">{r.user.name || 'Sin nombre'}</p>
                      <p className="text-xs text-gray-500 break-all">{r.user.email}</p>
                      {r.user.phone && <p className="text-xs text-gray-500">{r.user.phone}</p>}
                    </DetailBox>
                    <DetailBox title="Detalle">
                      <p className="text-xs text-gray-700 flex items-start gap-1">
                        <MapPin size={12} className="mt-0.5 flex-shrink-0" />
                        <span>{r.address}</span>
                      </p>
                      {r.preferredDate && (
                        <p className="text-xs text-gray-700 flex flex-wrap items-center gap-1 mt-1">
                          <Calendar size={12} />
                          {new Date(r.preferredDate).toLocaleDateString('es-CO', { timeZone: 'UTC' })}
                          {r.preferredTime && <> · <Clock size={12} /> {r.preferredTime}</>}
                        </p>
                      )}
                      {r.budget != null && (
                        <p className="text-xs text-gray-700 mt-1">
                          Presupuesto: <span className="font-semibold text-gray-900">{formatCurrency(r.budget)}</span>
                        </p>
                      )}
                      {r.notes && <p className="text-xs text-gray-600 mt-2 italic">"{r.notes}"</p>}
                    </DetailBox>
                  </div>

                  {photos.length > 0 && (
                    <section>
                      <h3 className="text-sm font-bold text-gray-900 mb-2">Fotos ({photos.length})</h3>
                      <Thumbs urls={photos} onOpen={(urls, index) => setLightbox({ urls, index })} size="h-16 w-16" />
                    </section>
                  )}

                  <section>
                    <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <Send size={14} />
                      Socios notificados ({r.notifiedPartners.length})
                    </h3>
                    {r.notifiedPartners.length === 0 ? (
                      <p className="text-xs text-gray-400">
                        No se registraron notificaciones a socios para esta solicitud.
                      </p>
                    ) : (
                      <>
                      <div className="space-y-2 md:hidden">
                        {r.notifiedPartners.map((p) => (
                          <div key={p.userId} className="rounded-2xl border border-gray-100 bg-white p-3 text-xs">
                            <div className="flex items-start justify-between gap-2">
                              <p className="min-w-0 truncate text-sm font-medium text-gray-900">{p.name || 'Sin nombre'}</p>
                              <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${p.isDirect ? 'bg-purple-100 text-purple-700' : 'bg-primary-100 text-primary-700'}`}>
                                {p.isDirect ? 'Directa' : 'Abierta'}
                              </span>
                            </div>
                            {p.email && <p className="mt-0.5 break-all text-gray-600">{p.email}</p>}
                            {p.phone && <p className="text-gray-400">{p.phone}</p>}
                            <p className="mt-1 text-gray-500">
                              {new Date(p.notifiedAt).toLocaleString('es-CO')} · {p.read ? 'Leído' : 'Sin leer'}
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-100 bg-white">
                        <table className="w-full min-w-[560px] text-xs">
                          <thead className="bg-gray-50 text-gray-500">
                            <tr>
                              <th className="text-left py-2 px-3 font-semibold uppercase tracking-wide">Socio</th>
                              <th className="text-left py-2 px-3 font-semibold uppercase tracking-wide">Contacto</th>
                              <th className="text-left py-2 px-3 font-semibold uppercase tracking-wide">Tipo</th>
                              <th className="text-left py-2 px-3 font-semibold uppercase tracking-wide">Leído</th>
                              <th className="text-left py-2 px-3 font-semibold uppercase tracking-wide">Notificado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.notifiedPartners.map((p) => (
                              <tr key={p.userId} className="border-t border-gray-100">
                                <td className="py-2 px-3 font-medium text-gray-900">{p.name || 'Sin nombre'}</td>
                                <td className="py-2 px-3 text-gray-600">
                                  <div>{p.email}</div>
                                  {p.phone && <div className="text-gray-400">{p.phone}</div>}
                                </td>
                                <td className="py-2 px-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${p.isDirect ? 'bg-purple-100 text-purple-700' : 'bg-primary-100 text-primary-700'}`}>
                                    {p.isDirect ? 'Directa' : 'Abierta'}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-gray-600">{p.read ? 'Sí' : 'No'}</td>
                                <td className="py-2 px-3 text-gray-500 whitespace-nowrap">
                                  {new Date(p.notifiedAt).toLocaleString('es-CO')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      </>
                    )}
                  </section>

                  <section>
                    <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <UserCheck size={14} />
                      Propuestas ({r.proposals.length})
                    </h3>
                    {r.proposals.length === 0 ? (
                      <p className="text-xs text-gray-400">
                        Aún no se han enviado propuestas para esta solicitud.
                      </p>
                    ) : (
                      <>
                      <div className="space-y-2 md:hidden">
                        {r.proposals.map((p) => (
                          <div key={p.id} className="rounded-2xl border border-gray-100 bg-white p-3 text-xs">
                            <div className="flex items-start justify-between gap-2">
                              <p className="min-w-0 truncate text-sm font-medium text-gray-900">{p.partner?.user.name || 'Socio eliminado'}</p>
                              <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${PROPOSAL_STYLES[p.status]}`}>
                                {PROPOSAL_LABELS[p.status]}
                              </span>
                            </div>
                            <p className="mt-1 text-sm font-semibold text-green-600">{formatCurrency(p.price)}</p>
                            <p className="mt-0.5 flex items-center gap-1 text-gray-700"><Calendar size={12} /> Propone: {proposedWhen(p)}</p>
                            {p.partner?.user.email && <p className="mt-0.5 break-all text-gray-600">{p.partner.user.email}</p>}
                            {p.partner?.user.phone && <p className="text-gray-400">{p.partner.user.phone}</p>}
                            {p.notes && <p className="mt-1 break-words text-gray-600">{p.notes}</p>}
                            <p className="mt-1 text-gray-500">Enviada {new Date(p.createdAt).toLocaleString('es-CO')}</p>
                            <OriginBadge
                              origin={p.origin}
                              originChannel={p.originChannel}
                              originConversationId={p.originConversationId}
                              agentName={p.originAgentName}
                              className="mt-1"
                            />
                          </div>
                        ))}
                      </div>
                      <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-100 bg-white">
                        <table className="w-full min-w-[560px] text-xs">
                          <thead className="bg-gray-50 text-gray-500">
                            <tr>
                              <th className="text-left py-2 px-3 font-semibold uppercase tracking-wide">Socio</th>
                              <th className="text-left py-2 px-3 font-semibold uppercase tracking-wide">Contacto</th>
                              <th className="text-left py-2 px-3 font-semibold uppercase tracking-wide">Precio</th>
                              <th className="text-left py-2 px-3 font-semibold uppercase tracking-wide">Propone</th>
                              <th className="text-left py-2 px-3 font-semibold uppercase tracking-wide">Estado</th>
                              <th className="text-left py-2 px-3 font-semibold uppercase tracking-wide">Notas</th>
                              <th className="text-left py-2 px-3 font-semibold uppercase tracking-wide">Enviada</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.proposals.map((p) => (
                              <tr key={p.id} className="border-t border-gray-100">
                                <td className="py-2 px-3 font-medium text-gray-900">
                                  <div>{p.partner?.user.name || 'Socio eliminado'}</div>
                                  <OriginBadge
                                    origin={p.origin}
                                    originChannel={p.originChannel}
                                    originConversationId={p.originConversationId}
                                    agentName={p.originAgentName}
                                    className="mt-1"
                                  />
                                </td>
                                <td className="py-2 px-3 text-gray-600">
                                  <div>{p.partner?.user.email}</div>
                                  {p.partner?.user.phone && (
                                    <div className="text-gray-400">{p.partner.user.phone}</div>
                                  )}
                                </td>
                                <td className="py-2 px-3 font-semibold text-green-600">
                                  {formatCurrency(p.price)}
                                </td>
                                <td className="py-2 px-3 text-gray-700 whitespace-nowrap">{proposedWhen(p)}</td>
                                <td className="py-2 px-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${PROPOSAL_STYLES[p.status]}`}>
                                    {PROPOSAL_LABELS[p.status]}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-gray-600 max-w-[240px] truncate" title={p.notes ?? ''}>
                                  {p.notes || '—'}
                                </td>
                                <td className="py-2 px-3 text-gray-500 whitespace-nowrap">
                                  {new Date(p.createdAt).toLocaleString('es-CO')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      </>
                    )}
                  </section>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {!attentionOnly && hasMore && (
        <div className="flex justify-center">
          <button
            onClick={loadMore}
            disabled={loadingMore || listLoading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60 sm:w-auto"
          >
            {loadingMore ? <><Loader2 size={16} className="animate-spin" /> Cargando…</> : 'Cargar más'}
          </button>
        </div>
      )}
      {lightbox && <Lightbox urls={lightbox.urls} index={lightbox.index} onClose={() => setLightbox(null)} />}
    </div>
  )
}

function DetailBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">{title}</p>
      {children}
    </div>
  )
}

function StatBox({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'yellow' | 'green' | 'gray' | 'red' | 'primary'
}) {
  const toneStyles: Record<string, string> = {
    default: 'bg-white text-gray-900',
    yellow: 'bg-yellow-50 text-yellow-800',
    green: 'bg-green-50 text-green-800',
    gray: 'bg-gray-50 text-gray-700',
    red: 'bg-red-50 text-red-700',
    primary: 'bg-primary-50 text-primary-800',
  }
  return (
    <div className={`rounded-xl border border-gray-100 shadow-sm p-3 sm:p-4 ${toneStyles[tone]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70 truncate">{label}</p>
      <p className="text-2xl font-black mt-1">{value}</p>
    </div>
  )
}
