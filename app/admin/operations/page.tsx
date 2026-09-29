'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, RefreshCw, X } from 'lucide-react'

type Incident = {
  id: string
  title: string
  type: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'
  source: string
  occurrences: number
  lastSeenAt: string
}

type AuditLog = {
  id: string
  createdAt: string
  action: string
  entityType: string
  entityId: string | null
  actorEmail: string | null
  details: string | null
}

type SupportCase = {
  id: string
  subject: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  assignedTo: string | null
  updatedAt: string
}

export default function AdminOperationsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [cases, setCases] = useState<SupportCase[]>([])
  const [newCaseSubject, setNewCaseSubject] = useState('')
  const [newCaseDescription, setNewCaseDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [iRes, lRes, cRes] = await Promise.all([
        fetch('/api/admin/incidents'),
        fetch('/api/admin/audit'),
        fetch('/api/admin/support-cases'),
      ])
      if (!iRes.ok || !lRes.ok || !cRes.ok) {
        const failed = [iRes, lRes, cRes].find((r) => !r.ok)!
        throw new Error(failed.status === 401 || failed.status === 403 ? 'Tu sesión venció o no tienes permiso.' : `El servidor respondió ${failed.status}.`)
      }
      const [iData, lData, cData] = await Promise.all([iRes.json(), lRes.json(), cRes.json()])
      setIncidents(iData.incidents || [])
      setLogs(lData.logs || [])
      setCases(cData.cases || [])
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error && err.message !== 'Failed to fetch' ? err.message : 'Sin conexión.')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const errorFrom = async (res: Response) => {
    const data = await res.json().catch(() => null)
    return (data && typeof data.error === 'string' && data.error) || `El servidor respondió ${res.status}.`
  }

  const updateIncident = async (id: string, status: Incident['status']) => {
    const prev = incidents
    setActionError(null)
    setIncidents((list) => list.map((x) => (x.id === id ? { ...x, status } : x)))
    try {
      const res = await fetch('/api/admin/incidents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) throw new Error(await errorFrom(res))
      await load(true)
    } catch (err) {
      setIncidents(prev)
      setActionError(`No se pudo actualizar el incidente: ${err instanceof Error ? err.message : 'error desconocido'}`)
    }
  }

  const createSupportCase = async () => {
    if (!newCaseSubject.trim() || !newCaseDescription.trim() || creating) return
    setActionError(null)
    setCreating(true)
    try {
      const res = await fetch('/api/admin/support-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: newCaseSubject,
          description: newCaseDescription,
          priority: 'MEDIUM',
        }),
      })
      if (!res.ok) throw new Error(await errorFrom(res))
      setNewCaseSubject('')
      setNewCaseDescription('')
      await load(true)
    } catch (err) {
      setActionError(`No se pudo crear el caso: ${err instanceof Error ? err.message : 'error desconocido'}`)
    } finally {
      setCreating(false)
    }
  }

  const updateCase = async (id: string, status: SupportCase['status']) => {
    const prev = cases
    setActionError(null)
    setCases((list) => list.map((x) => (x.id === id ? { ...x, status } : x)))
    try {
      const res = await fetch('/api/admin/support-cases', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) throw new Error(await errorFrom(res))
      await load(true)
    } catch (err) {
      setCases(prev)
      setActionError(`No se pudo actualizar el caso: ${err instanceof Error ? err.message : 'error desconocido'}`)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Casos e incidentes</h1>
        <p className="text-gray-600 mt-1">Casos de soporte, incidentes de la plataforma (incluidas tareas automáticas que fallan) y registro de acciones del equipo.</p>
      </div>

      {loadError && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle size={16} className="shrink-0" />
          <span className="min-w-0 flex-1">No se pudo cargar la información. {loadError}</span>
          <button onClick={() => load()} className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"><RefreshCw size={13} /> Reintentar</button>
        </div>
      )}

      {actionError && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1 break-words">{actionError}</span>
          <button onClick={() => setActionError(null)} aria-label="Cerrar" className="shrink-0 rounded-lg p-1 hover:bg-amber-100"><X size={14} /></button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={28} className="animate-spin mr-3" />
          <span className="text-sm font-medium">Cargando…</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm sm:p-5">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide sm:text-xs">Incidentes abiertos</p>
              <p className="text-2xl font-black text-gray-900 mt-1 sm:text-3xl">{incidents.filter((x) => x.status !== 'RESOLVED').length}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm sm:p-5">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide sm:text-xs">Casos activos</p>
              <p className="text-2xl font-black text-gray-900 mt-1 sm:text-3xl">{cases.filter((x) => x.status !== 'CLOSED').length}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm sm:p-5">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide sm:text-xs">Eventos bitácora</p>
              <p className="text-2xl font-black text-gray-900 mt-1 sm:text-3xl">{logs.length}</p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm space-y-3 sm:p-5">
            <h2 className="text-base font-bold text-gray-900">Incidentes</h2>
            <div className="space-y-2">
              {incidents.length === 0 && <p className="text-sm text-gray-400">Sin incidentes registrados.</p>}
              {incidents.slice(0, 20).map((incident) => (
                <div key={incident.id} className="flex flex-wrap items-center justify-between gap-3 border border-gray-100 rounded-xl p-3 sm:p-4">
                  <div className="min-w-0 break-words">
                    <p className="font-semibold text-sm text-gray-900">{incident.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{incident.type} · {incident.severity} · {incident.source} · #{incident.occurrences}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => updateIncident(incident.id, 'ACKNOWLEDGED')} className="min-h-9 px-3 py-1.5 sm:min-h-0 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">Reconocer</button>
                    <button onClick={() => updateIncident(incident.id, 'RESOLVED')} className="min-h-9 px-3 py-1.5 sm:min-h-0 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors">Resolver</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm space-y-3 sm:p-5">
            <h2 className="text-base font-bold text-gray-900">Soporte Unificado</h2>
            <div className="grid md:grid-cols-[1fr_auto] gap-3">
              <input value={newCaseSubject} onChange={(e) => setNewCaseSubject(e.target.value)} placeholder="Asunto del caso" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
              <button onClick={createSupportCase} disabled={creating} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors disabled:opacity-60">{creating ? 'Creando…' : 'Crear caso'}</button>
            </div>
            <textarea value={newCaseDescription} onChange={(e) => setNewCaseDescription(e.target.value)} placeholder="Descripción del caso" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm min-h-[80px] focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
            <div className="space-y-2">
              {cases.length === 0 && <p className="text-sm text-gray-400">Sin casos de soporte.</p>}
              {cases.slice(0, 20).map((supportCase) => (
                <div key={supportCase.id} className="flex flex-wrap items-center justify-between gap-3 border border-gray-100 rounded-xl p-3 sm:p-4">
                  <div className="min-w-0 break-words">
                    <p className="font-semibold text-sm text-gray-900">{supportCase.subject}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{supportCase.priority} · {supportCase.assignedTo || 'Sin asignar'}</p>
                  </div>
                  <select value={supportCase.status} onChange={(e) => updateCase(supportCase.id, e.target.value as SupportCase['status'])} className="border border-gray-200 rounded-lg px-2 py-1 text-xs font-medium">
                    <option value="OPEN">Abierto</option>
                    <option value="IN_PROGRESS">En progreso</option>
                    <option value="RESOLVED">Resuelto</option>
                    <option value="CLOSED">Cerrado</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm space-y-3 sm:p-5">
            <h2 className="text-base font-bold text-gray-900">Bitácora administrativa</h2>
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-100">
                    <th className="py-2 pr-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                    <th className="py-2 pr-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Acción</th>
                    <th className="py-2 pr-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Entidad</th>
                    <th className="py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actor</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 && (
                    <tr><td colSpan={4} className="py-6 text-center text-sm text-gray-400">Sin registros en bitácora.</td></tr>
                  )}
                  {logs.slice(0, 40).map((log) => (
                    <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-2 pr-3 text-gray-600 text-xs whitespace-nowrap">{new Date(log.createdAt).toLocaleString('es-CO')}</td>
                      <td className="py-2 pr-3 font-medium text-gray-900">{log.action}</td>
                      <td className="py-2 pr-3 text-gray-600">{log.entityType}</td>
                      <td className="py-2 text-gray-500">{log.actorEmail || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
