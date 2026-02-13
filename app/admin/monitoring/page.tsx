'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Clock3, RefreshCw, ShieldAlert, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type AuthSessionHour = {
  hour: string
  total: number
  success: number
  rateLimited: number
  errors: number
}

type AuthSessionPayload = {
  window: string
  generatedAt: string
  totals: {
    total: number
    success: number
    rateLimited: number
    errors: number
  }
  byHour: AuthSessionHour[]
}

type OperationalHour = {
  hour: string
  authSession429: number
  authSessionErrors: number
  loginFailures: number
  apiErrors: number
}

type OperationalAlert = {
  key: string
  level: 'warning' | 'critical'
  message: string
  count: number
}

type OperationalPayload = {
  window: string
  generatedAt: string
  byHour: OperationalHour[]
  last5Minutes: {
    authSession429: number
    loginFailures: number
    apiErrors: number
  }
  alerts: OperationalAlert[]
}

function formatHourLabel(hour: string) {
  const date = new Date(`${hour}:00:00.000Z`)
  return date.toLocaleString('es-CO', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminMonitoringPage() {
  const [authSession, setAuthSession] = useState<AuthSessionPayload | null>(null)
  const [operational, setOperational] = useState<OperationalPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)

  const fetchData = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      const [authRes, opsRes] = await Promise.all([
        fetch('/api/admin/monitoring/auth-session', { cache: 'no-store' }),
        fetch('/api/admin/monitoring/operational-alerts', { cache: 'no-store' }),
      ])

      if (!authRes.ok || !opsRes.ok) {
        throw new Error('No se pudieron cargar las métricas de monitoreo.')
      }

      const [authData, opsData] = await Promise.all([authRes.json(), opsRes.json()])
      setAuthSession(authData)
      setOperational(opsData)
      setLastUpdatedAt(new Date().toISOString())
    } catch (err: any) {
      setError(err?.message || 'Error inesperado al cargar monitoreo.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()

    const interval = setInterval(() => {
      fetchData(true)
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const sessionSuccessRate = useMemo(() => {
    if (!authSession?.totals?.total) return 0
    return (authSession.totals.success / authSession.totals.total) * 100
  }, [authSession])

  const hasTrafficData = (authSession?.totals.total || 0) > 0
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary-500" />
          <p className="text-gray-600">Cargando monitoreo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Monitoreo Operativo</h1>
          <p className="text-sm text-gray-600">
            Salud de autenticación, sesiones y alertas de regresión en tiempo casi real.
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {lastUpdatedAt && (
        <p className="text-xs text-gray-500">
          Última actualización: {new Date(lastUpdatedAt).toLocaleString('es-CO')}
        </p>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!error && !hasTrafficData && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          Aún no hay tráfico suficiente para generar métricas de sesión. Esto es normal en entornos nuevos o de bajo uso.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sesiones (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{authSession?.totals.total ?? 0}</p>
            <p className="text-xs text-gray-500">Total de lecturas `/api/auth/session`</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Éxito de sesión</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{sessionSuccessRate.toFixed(1)}%</p>
            <p className="text-xs text-gray-500">Respuestas exitosas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">429 sesión (5m)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{operational?.last5Minutes.authSession429 ?? 0}</p>
            <p className="text-xs text-gray-500">Ventana rolling de 5 minutos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Errores API (5m)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{operational?.last5Minutes.apiErrors ?? 0}</p>
            <p className="text-xs text-gray-500">Para detección temprana de regresiones</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary-600" />
            Alertas Operativas
          </CardTitle>
          <CardDescription>Umbrales automáticos para los últimos 5 minutos</CardDescription>
        </CardHeader>
        <CardContent>
          {!operational?.alerts?.length ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              Sin alertas activas.
            </div>
          ) : (
            <div className="space-y-3">
              {operational.alerts.map((alert) => (
                <div
                  key={alert.key}
                  className={`rounded-lg border p-4 text-sm ${
                    alert.level === 'critical'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4" />
                    {alert.message}
                  </div>
                  <p className="mt-1">Conteo observado: {alert.count}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock3 className="h-4 w-4 text-primary-600" />
              Auth Session por Hora
            </CardTitle>
            <CardDescription>Totales, éxitos, 429 y errores de `/api/auth/session`</CardDescription>
          </CardHeader>
          <CardContent>
            {(authSession?.byHour?.length || 0) === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-gray-600">
                Sin eventos por hora para `/api/auth/session` todavía.
              </div>
            ) : (
              <div className="max-h-[420px] overflow-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr className="border-b">
                      <th className="p-2 text-left font-semibold">Hora</th>
                      <th className="p-2 text-right font-semibold">Total</th>
                      <th className="p-2 text-right font-semibold">OK</th>
                      <th className="p-2 text-right font-semibold">429</th>
                      <th className="p-2 text-right font-semibold">Errores</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(authSession?.byHour || []).slice().reverse().map((item) => (
                      <tr key={item.hour} className="border-b">
                        <td className="p-2">{formatHourLabel(item.hour)}</td>
                        <td className="p-2 text-right">{item.total}</td>
                        <td className="p-2 text-right text-emerald-700">{item.success}</td>
                        <td className="p-2 text-right text-amber-700">{item.rateLimited}</td>
                        <td className="p-2 text-right text-red-700">{item.errors}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary-600" />
              Operación por Hora
            </CardTitle>
            <CardDescription>Fallos login, 429 de sesión y errores de API</CardDescription>
          </CardHeader>
          <CardContent>
            {(operational?.byHour?.length || 0) === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-gray-600">
                Sin datos operativos por hora todavía.
              </div>
            ) : (
              <div className="max-h-[420px] overflow-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr className="border-b">
                      <th className="p-2 text-left font-semibold">Hora</th>
                      <th className="p-2 text-right font-semibold">429 sesión</th>
                      <th className="p-2 text-right font-semibold">Errores sesión</th>
                      <th className="p-2 text-right font-semibold">Login fail</th>
                      <th className="p-2 text-right font-semibold">API error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(operational?.byHour || []).slice().reverse().map((item) => (
                      <tr key={item.hour} className="border-b">
                        <td className="p-2">{formatHourLabel(item.hour)}</td>
                        <td className="p-2 text-right text-amber-700">{item.authSession429}</td>
                        <td className="p-2 text-right text-red-700">{item.authSessionErrors}</td>
                        <td className="p-2 text-right">{item.loginFailures}</td>
                        <td className="p-2 text-right">{item.apiErrors}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
