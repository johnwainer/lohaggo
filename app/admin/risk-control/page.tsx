'use client'

import { useEffect, useState } from 'react'

type RiskSignal = {
  id: string
  type: string
  reason: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'
  score: number
  user?: { name: string; email: string }
}

type Cohort = {
  cohort: string
  users: number
  activeUsers: number
  activationRate: number
  completedBookings: number
}

export default function AdminRiskControlPage() {
  const [signals, setSignals] = useState<RiskSignal[]>([])
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [newType, setNewType] = useState('')
  const [newReason, setNewReason] = useState('')

  const load = async () => {
    const [rRes, cRes] = await Promise.all([
      fetch('/api/admin/risk'),
      fetch('/api/admin/reports/cohorts'),
    ])

    const [rData, cData] = await Promise.all([rRes.json(), cRes.json()])
    setSignals(rData.signals || [])
    setCohorts(cData.cohorts || [])
  }

  useEffect(() => {
    load()
  }, [])

  const resolveSignal = async (id: string) => {
    await fetch('/api/admin/risk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'RESOLVED' }),
    })
    await load()
  }

  const runAutomation = async () => {
    await fetch('/api/admin/alerts/run-automation', { method: 'POST' })
    await load()
  }

  const createSignal = async () => {
    if (!newType.trim() || !newReason.trim()) return
    await fetch('/api/admin/risk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: newType.trim(), reason: newReason.trim(), severity: 'HIGH', score: 70 }),
    })
    setNewType('')
    setNewReason('')
    await load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Semana 4: Riesgo, Cohortes y Alertas</h1>
          <p className="text-gray-600 mt-1">Prevención de fraude y control de salud de cohortes.</p>
        </div>
        <button onClick={runAutomation} className="rounded-lg bg-primary-600 text-white px-4 py-2">Ejecutar automatización de alertas</button>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold text-lg mb-3">Señales de riesgo</h2>
        <div className="grid md:grid-cols-3 gap-2 mb-3">
          <input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="tipo señal" className="border rounded-lg px-3 py-2 text-sm" />
          <input value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder="razón" className="border rounded-lg px-3 py-2 text-sm" />
          <button onClick={createSignal} className="rounded-lg bg-primary-600 text-white text-sm px-3 py-2">Crear señal</button>
        </div>
        <div className="space-y-2">
          {signals.map((signal) => (
            <div key={signal.id} className="flex items-center justify-between gap-3 border rounded-lg p-3">
              <div>
                <p className="font-medium">{signal.type} · score {signal.score}</p>
                <p className="text-sm text-gray-500">{signal.reason} · {signal.severity} · {signal.status}</p>
              </div>
              {signal.status !== 'RESOLVED' && (
                <button onClick={() => resolveSignal(signal.id)} className="rounded bg-green-600 text-white px-3 py-1 text-sm">Resolver</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold text-lg mb-3">Cohortes (últimos 6 meses)</h2>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2 pr-2">Cohorte</th>
                <th className="py-2 pr-2">Usuarios</th>
                <th className="py-2 pr-2">Activos</th>
                <th className="py-2 pr-2">Activación %</th>
                <th className="py-2 pr-2">Reservas completadas</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => (
                <tr key={c.cohort} className="border-b">
                  <td className="py-2 pr-2">{c.cohort}</td>
                  <td className="py-2 pr-2">{c.users}</td>
                  <td className="py-2 pr-2">{c.activeUsers}</td>
                  <td className="py-2 pr-2">{c.activationRate}%</td>
                  <td className="py-2 pr-2">{c.completedBookings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
