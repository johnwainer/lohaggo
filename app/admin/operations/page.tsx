'use client'

import { useEffect, useState } from 'react'

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
        <h1 className="text-3xl font-bold text-gray-900">Semana 1: Incidentes, Bitácora y Soporte</h1>
        <p className="text-gray-600 mt-1">Centro operativo unificado para monitorear y resolver incidencias.</p>
      </div>

      {loading ? (
        <div className="rounded-xl bg-white p-6 border">Cargando...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border bg-white p-4">
              <p className="text-sm text-gray-500">Incidentes abiertos</p>
              <p className="text-3xl font-bold">{incidents.filter((x) => x.status !== 'RESOLVED').length}</p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-sm text-gray-500">Casos de soporte activos</p>
              <p className="text-3xl font-bold">{cases.filter((x) => x.status !== 'CLOSED').length}</p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-sm text-gray-500">Eventos de bitácora</p>
              <p className="text-3xl font-bold">{logs.length}</p>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="font-semibold text-lg">Incidentes</h2>
            <div className="space-y-2">
              {incidents.slice(0, 20).map((incident) => (
                <div key={incident.id} className="flex flex-wrap items-center justify-between gap-3 border rounded-lg p-3">
                  <div>
                    <p className="font-medium">{incident.title}</p>
                    <p className="text-sm text-gray-500">{incident.type} · {incident.severity} · {incident.source} · #{incident.occurrences}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => updateIncident(incident.id, 'ACKNOWLEDGED')} className="px-3 py-1 text-sm rounded border">Ack</button>
                    <button onClick={() => updateIncident(incident.id, 'RESOLVED')} className="px-3 py-1 text-sm rounded bg-green-600 text-white">Resolver</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="font-semibold text-lg">Soporte Unificado</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <input value={newCaseSubject} onChange={(e) => setNewCaseSubject(e.target.value)} placeholder="Asunto del caso" className="border rounded-lg px-3 py-2" />
              <button onClick={createSupportCase} className="rounded-lg bg-primary-600 text-white px-4 py-2">Crear caso</button>
            </div>
            <textarea value={newCaseDescription} onChange={(e) => setNewCaseDescription(e.target.value)} placeholder="Descripción del caso" className="w-full border rounded-lg px-3 py-2 min-h-[90px]" />
            <div className="space-y-2">
              {cases.slice(0, 20).map((supportCase) => (
                <div key={supportCase.id} className="flex flex-wrap items-center justify-between gap-3 border rounded-lg p-3">
                  <div>
                    <p className="font-medium">{supportCase.subject}</p>
                    <p className="text-sm text-gray-500">{supportCase.priority} · {supportCase.status} · {supportCase.assignedTo || 'sin asignar'}</p>
                  </div>
                  <select value={supportCase.status} onChange={(e) => updateCase(supportCase.id, e.target.value as SupportCase['status'])} className="border rounded px-2 py-1 text-sm">
                    <option value="OPEN">OPEN</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="font-semibold text-lg">Bitácora administrativa</h2>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-2">Fecha</th>
                    <th className="py-2 pr-2">Acción</th>
                    <th className="py-2 pr-2">Entidad</th>
                    <th className="py-2 pr-2">Actor</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.slice(0, 40).map((log) => (
                    <tr key={log.id} className="border-b">
                      <td className="py-2 pr-2">{new Date(log.createdAt).toLocaleString('es-CO')}</td>
                      <td className="py-2 pr-2">{log.action}</td>
                      <td className="py-2 pr-2">{log.entityType}</td>
                      <td className="py-2 pr-2">{log.actorEmail || '-'}</td>
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
