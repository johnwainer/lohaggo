'use client'

import { useEffect, useMemo, useState } from 'react'
import { ShieldAlert, Ban, Search, RefreshCw, Unlock, Lock } from 'lucide-react'

type SecurityEvent = {
  id: string
  ipAddress: string
  path: string
  method: string
  threatType: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  blocked: boolean
  statusCode: number | null
  createdAt: string
}

type BlockedIp = {
  id: string
  ipAddress: string
  reason: string
  blockSource: string
  isActive: boolean
  blockedBy: string | null
  blockedAt: string
  expiresAt: string | null
  unblockedAt: string | null
}

type SecuritySummary = {
  openBlocksCount: number
  last24hCount: number
  highSeverity24hCount: number
}

export default function AdminSecurityPage() {
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [blockedIps, setBlockedIps] = useState<BlockedIp[]>([])
  const [summary, setSummary] = useState<SecuritySummary>({
    openBlocksCount: 0,
    last24hCount: 0,
    highSeverity24hCount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [ipFilter, setIpFilter] = useState('')
  const [threatFilter, setThreatFilter] = useState('')
  const [newIp, setNewIp] = useState('')
  const [newReason, setNewReason] = useState('')
  const [newExpiresAt, setNewExpiresAt] = useState('')

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesIp = !ipFilter || event.ipAddress.toLowerCase().includes(ipFilter.toLowerCase())
      const matchesThreat = !threatFilter || event.threatType === threatFilter
      return matchesIp && matchesThreat
    })
  }, [events, ipFilter, threatFilter])

  const threatTypes = useMemo(() => {
    return Array.from(new Set(events.map((event) => event.threatType))).sort()
  }, [events])

  const load = async () => {
    setLoading(true)
    try {
      const [eventsRes, blockedRes] = await Promise.all([
        fetch('/api/admin/security/events?limit=300', { cache: 'no-store' }),
        fetch('/api/admin/security/blocked-ips?includeInactive=true', { cache: 'no-store' }),
      ])

      const [eventsData, blockedData] = await Promise.all([eventsRes.json(), blockedRes.json()])
      setEvents(eventsData.events || [])
      setSummary(eventsData.summary || { openBlocksCount: 0, last24hCount: 0, highSeverity24hCount: 0 })
      setBlockedIps(blockedData.blockedIps || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const blockIp = async () => {
    if (!newIp.trim() || !newReason.trim()) return

    await fetch('/api/admin/security/blocked-ips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ipAddress: newIp.trim(),
        reason: newReason.trim(),
        expiresAt: newExpiresAt || null,
      }),
    })

    setNewIp('')
    setNewReason('')
    setNewExpiresAt('')
    await load()
  }

  const unblockIp = async (ipAddress: string) => {
    await fetch('/api/admin/security/blocked-ips', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ipAddress, action: 'UNBLOCK', unblockReason: 'Liberado por admin' }),
    })
    await load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldAlert className="w-8 h-8 text-primary-600" />
            Seguridad Operativa
          </h1>
          <p className="text-gray-600 mt-1">
            Detección de amenazas, auditoría de intentos maliciosos y control de bloqueos por IP.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 text-white px-4 py-2"
        >
          <RefreshCw size={16} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-gray-500">Eventos (24h)</p>
          <p className="text-3xl font-bold">{summary.last24hCount}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-gray-500">Alta severidad (24h)</p>
          <p className="text-3xl font-bold text-amber-600">{summary.highSeverity24hCount}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-gray-500">IPs bloqueadas activas</p>
          <p className="text-3xl font-bold text-red-600">{summary.openBlocksCount}</p>
        </div>
      </div>

      <section className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Lock size={18} />
          Bloquear IP manualmente
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            value={newIp}
            onChange={(e) => setNewIp(e.target.value)}
            placeholder="IP (ej: 190.24.1.10)"
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            placeholder="Motivo del bloqueo"
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={newExpiresAt}
            onChange={(e) => setNewExpiresAt(e.target.value)}
            type="datetime-local"
            className="border rounded-lg px-3 py-2 text-sm"
          />
          <button onClick={blockIp} className="rounded-lg bg-red-600 text-white px-3 py-2 text-sm">
            Bloquear
          </button>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Ban size={18} />
          Lista de IPs bloqueadas
        </h2>
        <div className="space-y-2">
          {blockedIps.length === 0 && <p className="text-sm text-gray-500">No hay IPs bloqueadas registradas.</p>}
          {blockedIps.map((item) => (
            <div key={item.id} className="border rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{item.ipAddress}</p>
                <p className="text-xs text-gray-500">
                  {item.reason} · fuente: {item.blockSource} · {item.isActive ? 'ACTIVO' : 'INACTIVO'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {item.expiresAt && (
                  <span className="text-xs text-gray-500">
                    vence {new Date(item.expiresAt).toLocaleString('es-CO')}
                  </span>
                )}
                {item.isActive && (
                  <button
                    onClick={() => unblockIp(item.ipAddress)}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded border text-sm"
                  >
                    <Unlock size={14} />
                    Desbloquear
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Eventos de seguridad</h2>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-2 top-2.5 text-gray-400" />
              <input
                value={ipFilter}
                onChange={(e) => setIpFilter(e.target.value)}
                placeholder="Filtrar por IP"
                className="border rounded-lg pl-7 pr-3 py-2 text-sm"
              />
            </div>
            <select
              value={threatFilter}
              onChange={(e) => setThreatFilter(e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Todos los tipos</option>
              {threatTypes.map((threat) => (
                <option key={threat} value={threat}>
                  {threat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Cargando eventos...</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2 pr-2">Fecha</th>
                  <th className="py-2 pr-2">IP</th>
                  <th className="py-2 pr-2">Tipo</th>
                  <th className="py-2 pr-2">Ruta</th>
                  <th className="py-2 pr-2">Método</th>
                  <th className="py-2 pr-2">Severidad</th>
                  <th className="py-2 pr-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event) => (
                  <tr key={event.id} className="border-b">
                    <td className="py-2 pr-2">{new Date(event.createdAt).toLocaleString('es-CO')}</td>
                    <td className="py-2 pr-2">{event.ipAddress}</td>
                    <td className="py-2 pr-2">{event.threatType}</td>
                    <td className="py-2 pr-2 max-w-[280px] truncate" title={event.path}>
                      {event.path}
                    </td>
                    <td className="py-2 pr-2">{event.method}</td>
                    <td className="py-2 pr-2">{event.severity}</td>
                    <td className="py-2 pr-2">{event.blocked ? 'Bloqueado' : 'Detectado'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
