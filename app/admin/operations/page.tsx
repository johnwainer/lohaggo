'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

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

  const load = async () => {
    setLoading(true)
    try {
      const [iRes, lRes, cRes] = await Promise.all([
        fetch('/api/admin/incidents'),
        fetch('/api/admin/audit'),
        fetch('/api/admin/support-cases'),
      ])
      const [iData, lData, cData] = await Promise.all([iRes.json(), lRes.json(), cRes.json()])
      setIncidents(iData.incidents || [])
      setLogs(lData.logs || [])
      setCases(cData.cases || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const updateIncident = async (id: string, status: Incident['status']) => {
    await fetch('/api/admin/incidents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    await load()
  }

  const createSupportCase = async () => {
    if (!newCaseSubject.trim() || !newCaseDescription.trim()) return
    await fetch('/api/admin/support-cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: newCaseSubject,
        description: newCaseDescription,
        priority: 'MEDIUM',
      }),
    })
    setNewCaseSubject('')
    setNewCaseDescription('')
    await load()
  }

  const updateCase = async (id: string, status: SupportCase['status']) => {
    await fetch('/api/admin/support-cases', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    await load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Centro de Operaciones</h1>
        <p className="text-gray-600 mt-1">Centro operativo unificado para monitorear y resolver incidencias.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={28} className="animate-spin mr-3" />
          <span className="text-sm font-medium">Cargando…</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Incidentes abiertos</p>
              <p className="text-3xl font-black text-gray-900 mt-1">{incidents.filter((x) => x.status !== 'RESOLVED').length}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Casos activos</p>
              <p className="text-3xl font-black text-gray-900 mt-1">{cases.filter((x) => x.status !== 'CLOSED').length}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Eventos bitácora</p>
              <p className="text-3xl font-black text-gray-900 mt-1">{logs.length}</p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
            <h2 className="text-base font-bold text-gray-900">Incidentes</h2>
            <div className="space-y-2">
              {incidents.length === 0 && <p className="text-sm text-gray-400">Sin incidentes registrados.</p>}
              {incidents.slice(0, 20).map((incident) => (
                <div key={incident.id} className="flex flex-wrap items-center justify-between gap-3 border border-gray-100 rounded-xl p-4">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{incident.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{incident.type} · {incident.severity} · {incident.source} · #{incident.occurrences}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => updateIncident(incident.id, 'ACKNOWLEDGED')} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">Reconocer</button>
                    <button onClick={() => updateIncident(incident.id, 'RESOLVED')} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors">Resolver</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
            <h2 className="text-base font-bold text-gray-900">Soporte Unificado</h2>
            <div className="grid md:grid-cols-[1fr_auto] gap-3">
              <input value={newCaseSubject} onChange={(e) => setNewCaseSubject(e.target.value)} placeholder="Asunto del caso" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none" />
              <button onClick={createSupportCase} className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors">Crear caso</button>
            </div>
            <textarea value={newCaseDescription} onChange={(e) => setNewCaseDescription(e.target.value)} placeholder="Descripción del caso" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm min-h-[80px] focus:ring-2 focus:ring-primary-500 outline-none resize-none" />
            <div className="space-y-2">
              {cases.length === 0 && <p className="text-sm text-gray-400">Sin casos de soporte.</p>}
              {cases.slice(0, 20).map((supportCase) => (
                <div key={supportCase.id} className="flex flex-wrap items-center justify-between gap-3 border border-gray-100 rounded-xl p-4">
                  <div>
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

          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
            <h2 className="text-base font-bold text-gray-900">Bitácora administrativa</h2>
            <div className="overflow-auto">
              <table className="w-full text-sm">
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
                      <td className="py-2 pr-3 text-gray-600 text-xs">{new Date(log.createdAt).toLocaleString('es-CO')}</td>
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
