'use client'

import { useEffect, useMemo, useState } from 'react'

type SummaryResponse = {
  generatedAt: string
  rangeDays: number
  summary: {
    signups: number
    installedUsers: number
    pushOptInUsers: number
    installRate: number
    pushOptInRate: number
  }
  byRole: {
    CLIENT: { signups: number; installs: number; pushOptIns: number }
    PARTNER: { signups: number; installs: number; pushOptIns: number }
  }
  daily: Array<{ date: string; signups: number; installs: number; pushOptIns: number }>
}

export default function AdminPwaAdoptionPage() {
  const [data, setData] = useState<SummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [runningAlerts, setRunningAlerts] = useState(false)
  const [alertMessage, setAlertMessage] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/pwa-adoption/summary', { cache: 'no-store' })
      const payload = await response.json()
      setData(payload)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const maxDailySignups = useMemo(() => {
    if (!data?.daily?.length) return 1
    return Math.max(...data.daily.map((item) => item.signups), 1)
  }, [data])

  const runAlerts = async () => {
    setRunningAlerts(true)
    setAlertMessage('')
    try {
      const response = await fetch('/api/admin/pwa-adoption/alerts/run', { method: 'POST' })
      const payload = await response.json()
      setAlertMessage(`Chequeo ejecutado. Alertas disparadas: ${payload.alertsTriggered ?? 0}`)
      await load()
    } finally {
      setRunningAlerts(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Adopción PWA</h1>
          <p className="text-gray-600">Embudo de instalación y opt-in de notificaciones para clientes y socios.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="border rounded px-3 py-2 text-sm">Actualizar</button>
          <button onClick={runAlerts} disabled={runningAlerts} className="bg-primary-600 text-white rounded px-3 py-2 text-sm disabled:opacity-60">
            {runningAlerts ? 'Ejecutando...' : 'Ejecutar alertas'}
          </button>
        </div>
      </div>

      {alertMessage && <div className="rounded border bg-amber-50 text-amber-800 px-3 py-2 text-sm">{alertMessage}</div>}

      {loading || !data ? (
        <div className="rounded-xl border bg-white p-6">Cargando...</div>
      ) : (
        <>
          <section className="rounded-xl border bg-white p-4 grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div><p className="text-xs text-gray-500">Registros ({data.rangeDays}d)</p><p className="text-2xl font-bold">{data.summary.signups}</p></div>
            <div><p className="text-xs text-gray-500">Instalados</p><p className="text-2xl font-bold">{data.summary.installedUsers}</p></div>
            <div><p className="text-xs text-gray-500">Push Opt-in</p><p className="text-2xl font-bold">{data.summary.pushOptInUsers}</p></div>
            <div><p className="text-xs text-gray-500">Install Rate</p><p className="text-2xl font-bold">{data.summary.installRate}%</p></div>
            <div><p className="text-xs text-gray-500">Push Opt-in Rate</p><p className="text-2xl font-bold">{data.summary.pushOptInRate}%</p></div>
          </section>

          <section className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="text-lg font-semibold">Rendimiento por rol</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {(['CLIENT', 'PARTNER'] as const).map((role) => {
                const row = data.byRole[role]
                return (
                  <div key={role} className="border rounded p-3">
                    <p className="text-sm font-semibold">{role === 'CLIENT' ? 'Clientes' : 'Socios'}</p>
                    <p className="text-xs text-gray-500">Registros: {row.signups}</p>
                    <p className="text-xs text-gray-500">Instalaciones: {row.installs}</p>
                    <p className="text-xs text-gray-500">Opt-in push: {row.pushOptIns}</p>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="text-lg font-semibold">Serie diaria (30 días)</h2>
            <div className="space-y-2">
              {data.daily.map((item) => {
                const width = Math.max(4, Math.round((item.signups / maxDailySignups) * 100))
                return (
                  <div key={item.date}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span>{item.date}</span>
                      <span>Reg: {item.signups} · Inst: {item.installs} · Push: {item.pushOptIns}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded overflow-hidden">
                      <div className="h-full bg-primary-600" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
