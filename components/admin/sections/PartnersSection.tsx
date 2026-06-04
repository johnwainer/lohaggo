'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Shield, ShieldCheck, Star, MapPin, Calendar, Package,
  CheckCircle, Users, TrendingUp, Activity, AlertCircle,
  ChevronDown, ChevronUp, BellOff,
} from 'lucide-react'
import DataTable from '@/components/admin/DataTable'

interface Partner {
  id: string
  userId: string
  bio: string | null
  rating: number
  totalReviews: number
  verified: boolean
  city: string
  createdAt: string
  user: {
    id: string
    email: string
    name: string
    phone: string | null
    image: string | null
    createdAt: string
    excludedFromMarketing?: boolean
  }
  services: Array<{
    id: string
    price: number
    active: boolean
    service: { name: string; icon: string }
  }>
  _count: { bookings: number; proposals: number }
}

// ─── Tiny stat card ───────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, color = 'gray', icon,
}: {
  label: string
  value: string | number
  sub?: string
  color?: 'gray' | 'green' | 'yellow' | 'blue' | 'red' | 'purple'
  icon?: React.ReactNode
}) {
  const textColor = {
    gray: 'text-gray-800',
    green: 'text-green-600',
    yellow: 'text-yellow-600',
    blue: 'text-blue-600',
    red: 'text-red-500',
    purple: 'text-purple-600',
  }[color]

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
        {icon && <span className="text-gray-300">{icon}</span>}
      </div>
      <span className={`text-3xl font-black ${textColor}`}>{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  )
}

// ─── Horizontal bar ───────────────────────────────────────────────────────────
function BarRow({ label, count, total, color = 'bg-primary-500' }: {
  label: string; count: number; total: number; color?: string
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 text-sm text-gray-700 truncate flex-shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-sm font-bold text-gray-800">{count}</span>
      <span className="w-8 text-right text-xs text-gray-400">{pct}%</span>
    </div>
  )
}

// ─── Funnel step ──────────────────────────────────────────────────────────────
function FunnelStep({ label, count, total, isLast = false }: {
  label: string; count: number; total: number; isLast?: boolean
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="relative flex flex-col items-center">
      <div
        className="w-full rounded-lg flex flex-col items-center justify-center py-3 font-bold text-white text-sm"
        style={{
          background: `linear-gradient(135deg, #6366f1, #8b5cf6)`,
          opacity: 0.4 + (pct / 100) * 0.6,
          minHeight: 52,
        }}
      >
        <span className="text-lg font-black">{count}</span>
        <span className="text-xs font-semibold opacity-90">{pct}%</span>
      </div>
      <span className="mt-1.5 text-xs text-gray-600 text-center leading-tight">{label}</span>
      {!isLast && <div className="w-0.5 h-3 bg-gray-200 mt-1" />}
    </div>
  )
}

// ─── Filter pill ──────────────────────────────────────────────────────────────
function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${
        active
          ? 'bg-primary-500 border-primary-500 text-white'
          : 'bg-white border-gray-200 text-gray-600 hover:border-primary-300'
      }`}
    >
      {label}
    </button>
  )
}

type FilterKey = 'all' | 'verified' | 'unverified' | 'active' | 'no_services' | 'new7d'

export default function PartnersSection() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [showAllCities, setShowAllCities] = useState(false)
  const [showAllServices, setShowAllServices] = useState(false)

  useEffect(() => { fetchPartners() }, [])

  const fetchPartners = async () => {
    try {
      const res = await fetch('/api/admin/partners')
      const data = await res.json()
      setPartners(data)
    } catch (error) {
      console.error('Error fetching partners:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyPartner = async (partnerId: string, verified: boolean) => {
    try {
      const res = await fetch('/api/admin/partners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId, verified }),
      })
      if (res.ok) fetchPartners()
      else alert('Error al actualizar verificación')
    } catch {
      alert('Error al actualizar verificación')
    }
  }

  const handleToggleMarketingExclusion = async (userId: string, excluded: boolean) => {
    setPartners(prev => prev.map(p => p.user.id === userId
      ? { ...p, user: { ...p.user, excludedFromMarketing: excluded } }
      : p,
    ))
    try {
      const res = await fetch(`/api/admin/users/${userId}/marketing-exclusion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excluded }),
      })
      if (!res.ok) throw new Error('failed')
    } catch {
      setPartners(prev => prev.map(p => p.user.id === userId
        ? { ...p, user: { ...p.user, excludedFromMarketing: !excluded } }
        : p,
      ))
      alert('Error al actualizar exclusión de comunicaciones')
    }
  }

  // ── Stats derivadas ────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = partners.length
    const verified = partners.filter(p => p.verified).length
    const withServices = partners.filter(p => p.services.length > 0).length
    const active = partners.filter(p => p._count.bookings > 0).length
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const new7d = partners.filter(p => new Date(p.user.createdAt).getTime() > sevenDaysAgo).length
    const avgRating = total > 0
      ? (partners.reduce((s, p) => s + p.rating, 0) / total).toFixed(1)
      : '0.0'
    const withBookings = active
    const withProposals = partners.filter(p => p._count.proposals > 0).length

    return { total, verified, withServices, active, new7d, avgRating, withBookings, withProposals }
  }, [partners])

  // ── Por ciudad ────────────────────────────────────────────────────────────
  const cityBreakdown = useMemo(() => {
    const map = new Map<string, number>()
    partners.forEach(p => map.set(p.city, (map.get(p.city) ?? 0) + 1))
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [partners])

  // ── Por servicio ──────────────────────────────────────────────────────────
  const serviceBreakdown = useMemo(() => {
    const map = new Map<string, number>()
    partners.forEach(p =>
      p.services.forEach(s => map.set(s.service.name, (map.get(s.service.name) ?? 0) + 1))
    )
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [partners])

  // ── Filtrado de tabla ─────────────────────────────────────────────────────
  const filteredPartners = useMemo(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    switch (filter) {
      case 'verified': return partners.filter(p => p.verified)
      case 'unverified': return partners.filter(p => !p.verified)
      case 'active': return partners.filter(p => p._count.bookings > 0)
      case 'no_services': return partners.filter(p => p.services.length === 0)
      case 'new7d': return partners.filter(p => new Date(p.user.createdAt).getTime() > sevenDaysAgo)
      default: return partners
    }
  }, [partners, filter])

  // ── Columnas tabla ────────────────────────────────────────────────────────
  const columns = [
    {
      key: 'user',
      label: 'Socio',
      sortable: true,
      render: (value: any, row: Partner) => {
        const initials = value.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
        return (
          <div className="flex items-center gap-3">
            {value.image ? (
              <img src={value.image} alt={value.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-secondary-100 text-secondary-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {initials}
              </div>
            )}
            <div>
              <div className="font-medium text-gray-900 flex items-center gap-1.5">
                {value.name}
                {row.verified && <ShieldCheck size={14} className="text-green-600" />}
              </div>
              <div className="text-xs text-gray-400">{value.email}</div>
              {value.phone && <div className="text-xs text-gray-400">{value.phone}</div>}
            </div>
          </div>
        )
      },
    },
    {
      key: 'city',
      label: 'Ciudad',
      sortable: true,
      render: (value: string) => (
        <div className="flex items-center gap-1 text-sm text-gray-700">
          <MapPin size={13} className="text-gray-400" />
          {value}
        </div>
      ),
    },
    {
      key: 'services',
      label: 'Servicios',
      render: (value: any[]) =>
        value.length === 0 ? (
          <span className="text-xs text-red-400 font-semibold">Sin servicios</span>
        ) : (
          <div className="flex flex-wrap gap-1 max-w-[200px]">
            {value.slice(0, 3).map((s, idx) => (
              <span key={idx} className="bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded text-xs">
                {s.service.name}
              </span>
            ))}
            {value.length > 3 && (
              <span className="text-xs text-gray-400">+{value.length - 3}</span>
            )}
          </div>
        ),
    },
    {
      key: '_count',
      label: 'Actividad',
      render: (value: any) => (
        <div className="text-xs space-y-0.5">
          <div className={value.bookings > 0 ? 'text-green-700 font-semibold' : 'text-gray-400'}>
            {value.bookings} reservas
          </div>
          <div className="text-gray-400">{value.proposals} propuestas</div>
        </div>
      ),
    },
    {
      key: 'rating',
      label: 'Rating',
      sortable: true,
      render: (value: number, row: Partner) =>
        row.totalReviews > 0 ? (
          <div className="flex items-center gap-1">
            <Star size={13} className="text-yellow-500 fill-yellow-500" />
            <span className="text-sm font-semibold">{value.toFixed(1)}</span>
            <span className="text-xs text-gray-400">({row.totalReviews})</span>
          </div>
        ) : (
          <span className="text-xs text-gray-300">Sin reseñas</span>
        ),
    },
    {
      key: 'createdAt',
      label: 'Registro',
      sortable: true,
      render: (value: string) => (
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Calendar size={12} />
          {new Date(value).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })}
        </div>
      ),
    },
    {
      key: 'verified',
      label: 'Estado',
      render: (value: boolean, row: Partner) => (
        <button
          onClick={() => handleVerifyPartner(row.id, !value)}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
            value
              ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
              : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200'
          }`}
        >
          {value ? '✓ Verificado' : 'Verificar'}
        </button>
      ),
    },
    {
      key: 'marketing',
      label: 'Comunicaciones',
      render: (_: unknown, row: Partner) => {
        const excluded = Boolean(row.user.excludedFromMarketing)
        return (
          <button
            onClick={() => handleToggleMarketingExclusion(row.user.id, !excluded)}
            title={excluded ? 'Excluido de campañas — clic para reactivar' : 'Recibe campañas — clic para excluir'}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
              excluded
                ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-gray-50 hover:text-gray-600 hover:border-gray-200'
                : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200'
            }`}
          >
            <BellOff size={12} />
            {excluded ? 'Excluido' : 'Recibe'}
          </button>
        )
      },
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
      </div>
    )
  }

  const visibleCities = showAllCities ? cityBreakdown : cityBreakdown.slice(0, 6)
  const visibleServices = showAllServices ? serviceBreakdown : serviceBreakdown.slice(0, 8)

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">Socios</h1>
        <p className="text-sm text-gray-500 mt-0.5">Estadísticas y gestión de la red de profesionales</p>
      </div>

      {/* ── KPIs principales ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total socios" value={stats.total} icon={<Users size={22} />} />
        <StatCard label="Verificados" value={stats.verified}
          sub={`${stats.total > 0 ? Math.round((stats.verified / stats.total) * 100) : 0}% del total`}
          color="green" icon={<ShieldCheck size={22} />} />
        <StatCard label="Activos (con reservas)" value={stats.active}
          sub={`${stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% del total`}
          color="blue" icon={<Activity size={22} />} />
        <StatCard label="Nuevos (7 días)" value={stats.new7d} color="purple" icon={<TrendingUp size={22} />} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Sin verificar" value={stats.total - stats.verified} color="red" icon={<Shield size={22} />} />
        <StatCard label="Sin servicios" value={stats.total - stats.withServices}
          sub="No configuraron oficio" color="red" icon={<AlertCircle size={22} />} />
        <StatCard label="Con propuestas" value={stats.withProposals}
          sub="Al menos 1 propuesta" icon={<Package size={22} />} />
        <StatCard label="Rating promedio" value={stats.avgRating} color="yellow"
          icon={<Star size={22} />} />
      </div>

      {/* ── Funnel + Ciudad + Servicio ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Funnel de activación */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-black text-gray-800 mb-4 uppercase tracking-wide">Funnel de activación</h3>
          <div className="space-y-1">
            <FunnelStep label="Registrados" count={stats.total} total={stats.total} />
            <FunnelStep label="Con servicios" count={stats.withServices} total={stats.total} />
            <FunnelStep label="Verificados" count={stats.verified} total={stats.total} />
            <FunnelStep label="Con reservas" count={stats.active} total={stats.total} isLast />
          </div>
        </div>

        {/* Por ciudad */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-black text-gray-800 mb-4 uppercase tracking-wide">Por ciudad</h3>
          <div className="space-y-2.5">
            {visibleCities.map(([city, count]) => (
              <BarRow key={city} label={city} count={count} total={stats.total} color="bg-blue-400" />
            ))}
            {cityBreakdown.length === 0 && <p className="text-xs text-gray-400">Sin datos</p>}
          </div>
          {cityBreakdown.length > 6 && (
            <button
              onClick={() => setShowAllCities(v => !v)}
              className="mt-3 flex items-center gap-1 text-xs text-primary-500 hover:text-primary-700 font-semibold"
            >
              {showAllCities ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {showAllCities ? 'Ver menos' : `Ver ${cityBreakdown.length - 6} más`}
            </button>
          )}
        </div>

        {/* Top servicios */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-black text-gray-800 mb-4 uppercase tracking-wide">Top servicios</h3>
          <div className="space-y-2.5">
            {visibleServices.map(([name, count]) => (
              <BarRow key={name} label={name} count={count} total={stats.total} color="bg-purple-400" />
            ))}
            {serviceBreakdown.length === 0 && <p className="text-xs text-gray-400">Sin datos</p>}
          </div>
          {serviceBreakdown.length > 8 && (
            <button
              onClick={() => setShowAllServices(v => !v)}
              className="mt-3 flex items-center gap-1 text-xs text-primary-500 hover:text-primary-700 font-semibold"
            >
              {showAllServices ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {showAllServices ? 'Ver menos' : `Ver ${serviceBreakdown.length - 8} más`}
            </button>
          )}
        </div>
      </div>

      {/* ── Tabla con filtros ── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">
            Lista de socios
            <span className="ml-2 text-xs font-normal text-gray-400 normal-case">
              {filteredPartners.length} de {stats.total}
            </span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {([
              ['all', 'Todos'],
              ['verified', 'Verificados'],
              ['unverified', 'Sin verificar'],
              ['active', 'Activos'],
              ['no_services', 'Sin servicios'],
              ['new7d', 'Últimos 7 días'],
            ] as [FilterKey, string][]).map(([key, label]) => (
              <FilterPill key={key} label={label} active={filter === key} onClick={() => setFilter(key)} />
            ))}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredPartners}
          searchable
          exportable
          itemsPerPage={15}
        />
      </div>
    </div>
  )
}
