'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Send,
  UserCheck,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type Partner = {
  id: string
  user: { id: string; name: string | null; email: string | null; phone: string | null }
} | null

type Proposal = {
  id: string
  price: number
  notes: string | null
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
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

type ServiceRequest = {
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

const FILTERS: Array<{ value: 'all' | ServiceRequest['status']; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'ACTIVE', label: 'Activas' },
  { value: 'ACCEPTED', label: 'Aceptadas' },
  { value: 'EXPIRED', label: 'Expiradas' },
  { value: 'CANCELLED', label: 'Canceladas' },
]

export default function AdminServiceRequestsPage() {
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | ServiceRequest['status']>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/service-requests')
        const data = await res.json()
        if (!active) return
        setRequests(Array.isArray(data) ? data : [])
      } catch {
        if (active) setRequests([])
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  const filtered = useMemo(
    () => (filter === 'all' ? requests : requests.filter((r) => r.status === filter)),
    [filter, requests]
  )

  const stats = useMemo(() => ({
    total: requests.length,
    active: requests.filter((r) => r.status === 'ACTIVE').length,
    accepted: requests.filter((r) => r.status === 'ACCEPTED').length,
    expired: requests.filter((r) => r.status === 'EXPIRED').length,
    cancelled: requests.filter((r) => r.status === 'CANCELLED').length,
    proposals: requests.reduce((sum, r) => sum + (r._count?.proposals ?? 0), 0),
  }), [requests])

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
        <h1 className="text-3xl font-bold text-gray-900">Solicitudes de servicio</h1>
        <p className="text-gray-600 mt-1">
          Cada solicitud creada por un cliente, los socios a quienes se les notificó y las propuestas enviadas.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatBox label="Total" value={stats.total} />
        <StatBox label="Activas" value={stats.active} tone="yellow" />
        <StatBox label="Aceptadas" value={stats.accepted} tone="green" />
        <StatBox label="Expiradas" value={stats.expired} tone="gray" />
        <StatBox label="Canceladas" value={stats.cancelled} tone="red" />
        <StatBox label="Propuestas" value={stats.proposals} tone="primary" />
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
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-gray-100 bg-white p-10 text-center text-sm text-gray-400">
            No hay solicitudes para este filtro.
          </div>
        )}
        {filtered.map((r) => {
          const isOpen = expanded.has(r.id)
          return (
            <div
              key={r.id}
              className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden"
            >
              <button
                onClick={() => toggleExpand(r.id)}
                className="w-full flex items-center justify-between gap-3 px-4 sm:px-5 py-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="text-2xl">{r.service.icon}</span>
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
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {r.user.name || r.user.email} · {r.city} · {new Date(r.createdAt).toLocaleString('es-CO')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 flex-shrink-0">
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

              {isOpen && (
                <div className="border-t border-gray-100 px-4 sm:px-5 py-4 space-y-5 bg-gray-50/50">
                  <div className="grid md:grid-cols-2 gap-4">
                    <DetailBox title="Cliente">
                      <p className="font-medium text-gray-900">{r.user.name || 'Sin nombre'}</p>
                      <p className="text-xs text-gray-500">{r.user.email}</p>
                      {r.user.phone && <p className="text-xs text-gray-500">{r.user.phone}</p>}
                    </DetailBox>
                    <DetailBox title="Detalle">
                      <p className="text-xs text-gray-700 flex items-start gap-1">
                        <MapPin size={12} className="mt-0.5 flex-shrink-0" />
                        <span>{r.address}</span>
                      </p>
                      {r.preferredDate && (
                        <p className="text-xs text-gray-700 flex items-center gap-1 mt-1">
                          <Calendar size={12} />
                          {new Date(r.preferredDate).toLocaleDateString('es-CO')}
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
                      <div className="overflow-x-auto rounded-lg border border-gray-100 bg-white">
                        <table className="w-full text-xs">
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
                                <td className="py-2 px-3 text-gray-500">
                                  {new Date(p.notifiedAt).toLocaleString('es-CO')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
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
                      <div className="overflow-x-auto rounded-lg border border-gray-100 bg-white">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 text-gray-500">
                            <tr>
                              <th className="text-left py-2 px-3 font-semibold uppercase tracking-wide">Socio</th>
                              <th className="text-left py-2 px-3 font-semibold uppercase tracking-wide">Contacto</th>
                              <th className="text-left py-2 px-3 font-semibold uppercase tracking-wide">Precio</th>
                              <th className="text-left py-2 px-3 font-semibold uppercase tracking-wide">Estado</th>
                              <th className="text-left py-2 px-3 font-semibold uppercase tracking-wide">Notas</th>
                              <th className="text-left py-2 px-3 font-semibold uppercase tracking-wide">Enviada</th>
                            </tr>
                          </thead>
                          <tbody>
                            {r.proposals.map((p) => (
                              <tr key={p.id} className="border-t border-gray-100">
                                <td className="py-2 px-3 font-medium text-gray-900">
                                  {p.partner?.user.name || 'Socio eliminado'}
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
                                <td className="py-2 px-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${PROPOSAL_STYLES[p.status]}`}>
                                    {PROPOSAL_LABELS[p.status]}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-gray-600 max-w-[240px] truncate" title={p.notes ?? ''}>
                                  {p.notes || '—'}
                                </td>
                                <td className="py-2 px-3 text-gray-500">
                                  {new Date(p.createdAt).toLocaleString('es-CO')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                </div>
              )}
            </div>
          )
        })}
      </div>
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
    <div className={`rounded-xl border border-gray-100 shadow-sm p-4 ${toneStyles[tone]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-2xl font-black mt-1">{value}</p>
    </div>
  )
}
