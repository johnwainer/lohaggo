'use client'

import { type ComponentType, useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock3,
  Layers3,
  ListFilter,
  Search,
  Users,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface AnalyticsResponse {
  summary: {
    periodDays: number
    totalSearches: number
    previousPeriodSearches: number
    searchesDeltaPct: number
    uniqueUsers: number
    uniqueQueries: number
    averageSearchesPerUser: number
    repeatUsers: number
    repeatUsersRate: number
    top10Share: number
    singleSearchQueryRate: number
    uncoveredQueries: number
    uncoveredQueriesRate: number
  }
  trends: {
    searchesByDay: Array<{ date: string; count: number }>
    searchesByHour: Array<{ hour: number; count: number }>
  }
  segmentation: {
    searchesByRole: Array<{ role: string; count: number }>
    searchesByCity: Array<{ city: string; count: number }>
  }
  topQueries: Array<{
    query: string
    count: number
    length: number
    words: number
    matchingServices: number
    matchingPartners: number
    hasCoverage: boolean
  }>
  uncoveredQueries: Array<{
    query: string
    count: number
    length: number
    words: number
    matchingServices: number
    matchingPartners: number
    hasCoverage: boolean
  }>
  topUsers: Array<{
    userId: string
    userName: string
    userEmail: string
    role: string
    city: string
    searchCount: number
  }>
  recentSearches: Array<{
    id: string
    query: string
    userName: string
    userEmail: string
    role: string
    city: string
    createdAt: string
  }>
  generatedAt: string
}

const PIE_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6']

const roleLabel: Record<string, string> = {
  CLIENT: 'Cliente',
  PARTNER: 'Socio',
  ADMIN: 'Admin',
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

function formatRole(role: string): string {
  return roleLabel[role] || role
}

function chartCountFormatter(value: number | string | undefined): [number | string, string] {
  return [value ?? 0, 'Búsquedas']
}

export default function SearchAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')

  useEffect(() => {
    void fetchAnalytics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  async function fetchAnalytics() {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/search-analytics?days=${period}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Failed to load analytics')
      const data = (await response.json()) as AnalyticsResponse
      setAnalytics(data)
    } catch (error) {
      console.error('Error fetching search analytics', error)
      setAnalytics(null)
    } finally {
      setLoading(false)
    }
  }

  const rolePieData = useMemo(() => {
    if (!analytics) return []
    return analytics.segmentation.searchesByRole.map((entry) => ({
      name: formatRole(entry.role),
      value: entry.count,
    }))
  }, [analytics])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No fue posible cargar la analítica de búsquedas.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Search Analytics</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            Inteligencia de demanda, cobertura y comportamiento de búsqueda.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">
            Actualizado: {new Date(analytics.generatedAt).toLocaleString('es-CO')}
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 días</SelectItem>
              <SelectItem value="30">Últimos 30 días</SelectItem>
              <SelectItem value="90">Últimos 90 días</SelectItem>
              <SelectItem value="365">Último año</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Búsquedas"
          value={analytics.summary.totalSearches.toLocaleString()}
          hint={`${analytics.summary.periodDays} días`}
          trend={analytics.summary.searchesDeltaPct}
          icon={Search}
        />
        <MetricCard
          title="Usuarios con búsqueda"
          value={analytics.summary.uniqueUsers.toLocaleString()}
          hint={`${analytics.summary.averageSearchesPerUser} por usuario`}
          icon={Users}
        />
        <MetricCard
          title="Consultas únicas"
          value={analytics.summary.uniqueQueries.toLocaleString()}
          hint={`Top 10 concentra ${formatPercent(analytics.summary.top10Share)}`}
          icon={Activity}
        />
        <MetricCard
          title="Consultas sin cobertura"
          value={analytics.summary.uncoveredQueries.toLocaleString()}
          hint={`${formatPercent(analytics.summary.uncoveredQueriesRate)} del top analizado`}
          icon={AlertTriangle}
          danger={analytics.summary.uncoveredQueries > 0}
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto rounded-xl border bg-gradient-to-r from-slate-100 via-slate-100 to-slate-50 p-1.5">
          <TabsTrigger
            value="overview"
            className="min-w-[130px] rounded-lg border border-transparent px-3 py-2 text-xs font-semibold text-slate-700 data-[state=active]:border-sky-200 data-[state=active]:bg-white data-[state=active]:text-sky-700 data-[state=active]:shadow"
          >
            <BarChart3 className="mr-1.5 h-4 w-4" />
            Resumen
          </TabsTrigger>
          <TabsTrigger
            value="queries"
            className="min-w-[130px] rounded-lg border border-transparent px-3 py-2 text-xs font-semibold text-slate-700 data-[state=active]:border-sky-200 data-[state=active]:bg-white data-[state=active]:text-sky-700 data-[state=active]:shadow"
          >
            <ListFilter className="mr-1.5 h-4 w-4" />
            Términos
          </TabsTrigger>
          <TabsTrigger
            value="segments"
            className="min-w-[130px] rounded-lg border border-transparent px-3 py-2 text-xs font-semibold text-slate-700 data-[state=active]:border-sky-200 data-[state=active]:bg-white data-[state=active]:text-sky-700 data-[state=active]:shadow"
          >
            <Layers3 className="mr-1.5 h-4 w-4" />
            Segmentos
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            className="min-w-[130px] rounded-lg border border-transparent px-3 py-2 text-xs font-semibold text-slate-700 data-[state=active]:border-sky-200 data-[state=active]:bg-white data-[state=active]:text-sky-700 data-[state=active]:shadow"
          >
            <Clock3 className="mr-1.5 h-4 w-4" />
            Actividad
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle>Tendencia diaria</CardTitle>
                <CardDescription>Volumen de búsquedas por día.</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px] p-0 pr-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.trends.searchesByDay} margin={{ left: 8, right: 8, top: 10, bottom: 10 }}>
                    <defs>
                      <linearGradient id="searchesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => new Date(value).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      labelFormatter={(value) => new Date(String(value)).toLocaleDateString('es-CO')}
                      formatter={chartCountFormatter}
                    />
                    <Area type="monotone" dataKey="count" stroke="#0284c7" fill="url(#searchesGradient)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Calidad de demanda</CardTitle>
                <CardDescription>Indicadores de intención y cobertura.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <QualityItem
                  label="Usuarios recurrentes"
                  value={formatPercent(analytics.summary.repeatUsersRate)}
                  sub={`${analytics.summary.repeatUsers} usuarios con +1 búsqueda`}
                />
                <QualityItem
                  label="Long tail"
                  value={formatPercent(analytics.summary.singleSearchQueryRate)}
                  sub="Consultas que aparecen solo 1 vez"
                />
                <QualityItem
                  label="Concentración top 10"
                  value={formatPercent(analytics.summary.top10Share)}
                  sub="Participación de los 10 términos principales"
                />
                <QualityItem
                  label="Gap de cobertura"
                  value={formatPercent(analytics.summary.uncoveredQueriesRate)}
                  sub="Términos top sin match de catálogo"
                  danger={analytics.summary.uncoveredQueriesRate > 0}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="queries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top términos y cobertura</CardTitle>
              <CardDescription>
                Términos más buscados con match actual de servicios y socios activos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="p-3 font-medium">Término</th>
                      <th className="p-3 font-medium text-right">Búsquedas</th>
                      <th className="p-3 font-medium text-right">Servicios</th>
                      <th className="p-3 font-medium text-right">Socios</th>
                      <th className="p-3 font-medium text-right">Palabras</th>
                      <th className="p-3 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.topQueries.map((item) => (
                      <tr key={item.query} className="border-b hover:bg-muted/30">
                        <td className="p-3 font-medium">{item.query}</td>
                        <td className="p-3 text-right">{item.count}</td>
                        <td className="p-3 text-right">{item.matchingServices}</td>
                        <td className="p-3 text-right">{item.matchingPartners}</td>
                        <td className="p-3 text-right">{item.words}</td>
                        <td className="p-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              item.hasCoverage ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {item.hasCoverage ? 'Con cobertura' : 'Sin cobertura'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {analytics.uncoveredQueries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Prioridad: búsquedas sin cobertura</CardTitle>
                <CardDescription>
                  Oportunidades de expansión de catálogo o activación de socios.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[260px] p-0 pr-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.uncoveredQueries.slice(0, 10)} margin={{ left: 8, right: 8, top: 10, bottom: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="query" angle={-26} height={80} textAnchor="end" interval={0} />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={chartCountFormatter} />
                    <Bar dataKey="count" fill="#ef4444" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="segments" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Distribución por rol</CardTitle>
                <CardDescription>Participación del volumen por tipo de usuario.</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px] p-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={rolePieData} dataKey="value" nameKey="name" outerRadius={90} label>
                      {rolePieData.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={chartCountFormatter} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top ciudades por búsquedas</CardTitle>
                <CardDescription>Concentración geográfica de la demanda.</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px] p-0 pr-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.segmentation.searchesByCity} layout="vertical" margin={{ left: 8, right: 8, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis dataKey="city" type="category" width={130} />
                    <Tooltip formatter={chartCountFormatter} />
                    <Bar dataKey="count" fill="#0ea5e9" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Usuarios más activos en búsqueda</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[840px] text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="p-3 font-medium">Usuario</th>
                      <th className="p-3 font-medium">Correo</th>
                      <th className="p-3 font-medium">Rol</th>
                      <th className="p-3 font-medium">Ciudad</th>
                      <th className="p-3 font-medium text-right">Búsquedas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.topUsers.map((user) => (
                      <tr key={user.userId} className="border-b hover:bg-muted/30">
                        <td className="p-3 font-medium">{user.userName}</td>
                        <td className="p-3 text-muted-foreground">{user.userEmail}</td>
                        <td className="p-3">{formatRole(user.role)}</td>
                        <td className="p-3">{user.city}</td>
                        <td className="p-3 text-right font-semibold">{user.searchCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Horas pico</CardTitle>
                <CardDescription>Distribución por hora del día.</CardDescription>
              </CardHeader>
              <CardContent className="h-[260px] p-0 pr-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.trends.searchesByHour} margin={{ left: 8, right: 8, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" tickFormatter={(value) => `${value}:00`} />
                    <YAxis allowDecimals={false} />
                    <Tooltip labelFormatter={(value) => `${value}:00`} formatter={chartCountFormatter} />
                    <Bar dataKey="count" fill="#14b8a6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Actividad reciente</CardTitle>
                <CardDescription>Últimos eventos de búsqueda capturados.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
                  {analytics.recentSearches.slice(0, 20).map((item) => (
                    <div key={item.id} className="rounded-lg border p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="line-clamp-1 text-sm font-medium">{item.query}</p>
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.userName} · {formatRole(item.role)} · {item.city}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function MetricCard({
  title,
  value,
  hint,
  icon: Icon,
  trend,
  danger,
}: {
  title: string
  value: string
  hint: string
  icon: ComponentType<{ className?: string }>
  trend?: number
  danger?: boolean
}) {
  const trendColor = trend !== undefined ? (trend >= 0 ? 'text-emerald-600' : 'text-red-600') : 'text-muted-foreground'

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${danger ? 'text-red-500' : 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span className={trendColor}>
            {trend !== undefined ? `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%` : 'Sin variación'}
          </span>
          <span className="text-muted-foreground">{hint}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function QualityItem({
  label,
  value,
  sub,
  danger,
}: {
  label: string
  value: string
  sub: string
  danger?: boolean
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium">{label}</p>
        <div className={`text-sm font-semibold ${danger ? 'text-red-600' : 'text-emerald-600'}`}>{value}</div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}
