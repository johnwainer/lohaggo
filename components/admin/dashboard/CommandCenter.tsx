'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Bot, CalendarCheck, CheckCircle2, CreditCard, Inbox, Loader2, Maximize2, Megaphone,
  MessageSquare, Minimize2, Newspaper, RefreshCw, Send, ShieldAlert, Sparkles, Star, UserPlus, Users, Wallet,
} from 'lucide-react'
import { ChannelIcon, channelLabel } from '@/components/admin/ChannelIcon'
import { MkChannelIcon } from '@/components/admin/marketing/shared'
import type { PlatformOverview } from '@/lib/admin/overview'

const REFRESH_MS = 30_000
const TZ = 'America/Bogota'

const money = (n: number) => (Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1).replace('.', ',')} M` : `$${Math.round(n).toLocaleString('es-CO')}`)
const num = (n: number) => n.toLocaleString('es-CO')
const usd = (n: number) => `US$${n.toLocaleString('es-CO', { minimumFractionDigits: n < 10 ? 2 : 0, maximumFractionDigits: n < 10 ? 2 : 0 })}`
const plural = (n: number, one: string, many: string) => `${num(n)} ${n === 1 ? one : many}`
const time = (d: string | Date) => new Intl.DateTimeFormat('es-CO', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(d))
const dayLabel = (key: string) => new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(`${key}T12:00:00Z`))
function ago(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'ahora'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  return `hace ${Math.floor(s / 86400)} d`
}

/** Two looks: the admin's light theme, and a dark high-contrast one for a TV on the wall. */
const THEMES = {
  light: {
    card: 'rounded-2xl border border-gray-200 bg-white', text: 'text-gray-900', muted: 'text-gray-500', faint: 'text-gray-400',
    divider: 'border-gray-100', soft: 'bg-gray-50', bar: 'bg-gray-100', grid: '#E5E7EB', axis: '#9CA3AF', h1: 'text-2xl', kpi: 'text-2xl', label: 'text-xs',
  },
  tv: {
    card: 'rounded-2xl border border-white/10 bg-white/[0.04]', text: 'text-white', muted: 'text-slate-400', faint: 'text-slate-500',
    divider: 'border-white/10', soft: 'bg-white/[0.05]', bar: 'bg-white/10', grid: '#1E293B', axis: '#64748B', h1: 'text-3xl', kpi: 'text-4xl', label: 'text-sm',
  },
} as const
type Theme = (typeof THEMES)[keyof typeof THEMES]

function Delta({ value, label }: { value: number | null; label: string }) {
  if (value === null) return <span className="text-[0.6875rem] text-emerald-500">Nuevo {label}</span>
  if (value === 0) return <span className="text-[0.6875rem] font-medium text-gray-400">Igual {label.replace(/^vs /, 'que ')}</span>
  const up = value > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[0.6875rem] font-semibold ${up ? 'text-emerald-500' : 'text-rose-500'}`}>
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{Math.abs(value).toLocaleString('es-CO')} % {label}
    </span>
  )
}

function Kpi({ t, icon: Icon, label, value, sub, delta, deltaLabel, tone = 'primary', href, tv, px }: {
  t: Theme; icon: typeof Users; label: string; value: string; sub?: string; delta?: number | null; deltaLabel?: string; tone?: 'primary' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet'; href?: string; tv: boolean; px: (n: number) => number
}) {
  const tones = { primary: 'bg-primary-500/15 text-primary-500', emerald: 'bg-emerald-500/15 text-emerald-500', amber: 'bg-amber-500/15 text-amber-500', rose: 'bg-rose-500/15 text-rose-500', sky: 'bg-sky-500/15 text-sky-500', violet: 'bg-violet-500/15 text-violet-500' }
  const body = (
    <div className={`${t.card} h-full p-4 ${href && !tv ? 'transition hover:border-primary-300 hover:shadow-sm' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`${t.label} font-medium ${t.muted}`}>{label}</span>
        <span className={`rounded-xl p-2 ${tones[tone]}`}><Icon size={px(16)} /></span>
      </div>
      <p className={`mt-2 font-bold tabular-nums tracking-tight ${t.kpi} ${t.text}`}>{value}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {delta !== undefined && <Delta value={delta} label={deltaLabel ?? ''} />}
        {sub && <span className={`${tv ? 'text-sm' : 'text-[0.6875rem]'} ${t.muted}`}>{sub}</span>}
      </div>
    </div>
  )
  return href && !tv ? <Link href={href} className="block">{body}</Link> : body
}

function Panel({ t, tv, px, title, icon: Icon, href, children, className = '' }: { t: Theme; tv: boolean; px: (n: number) => number; title: string; icon: typeof Users; href?: string; children: React.ReactNode; className?: string }) {
  // TV: panels fill their grid cell and clip what does not fit (lists keep the newest first)
  return (
    <section className={`${t.card} p-4 ${tv ? 'flex min-h-0 flex-col overflow-hidden' : ''} ${className}`}>
      <div className="mb-3 flex shrink-0 items-center gap-2">
        <Icon size={px(16)} className="text-primary-500" />
        <h2 className={`font-semibold ${tv ? 'text-lg' : 'text-sm'} ${t.text}`}>{title}</h2>
        {href && !tv && <Link href={href} className="ml-auto text-xs font-medium text-primary-600 hover:underline">Abrir</Link>}
      </div>
      {children}
    </section>
  )
}

function Stat({ t, label, value, tone }: { t: Theme; label: string; value: string | number; tone?: 'rose' | 'amber' | 'emerald' }) {
  const color = tone === 'rose' ? 'text-rose-500' : tone === 'amber' ? 'text-amber-500' : tone === 'emerald' ? 'text-emerald-500' : t.text
  return (
    <div className={`shrink-0 rounded-xl ${t.soft} px-3 py-2`}>
      <p className={`text-[0.6875rem] ${t.muted}`}>{label}</p>
      <p className={`text-lg font-bold tabular-nums ${color}`}>{typeof value === 'number' ? num(value) : value}</p>
    </div>
  )
}

const FEED_ICON: Record<string, { icon: typeof Users; cls: string }> = {
  booking: { icon: CalendarCheck, cls: 'text-sky-500 bg-sky-500/15' },
  payment: { icon: CreditCard, cls: 'text-emerald-500 bg-emerald-500/15' },
  client: { icon: UserPlus, cls: 'text-violet-500 bg-violet-500/15' },
  partner: { icon: Users, cls: 'text-amber-500 bg-amber-500/15' },
  conversation: { icon: MessageSquare, cls: 'text-primary-500 bg-primary-500/15' },
  post: { icon: Megaphone, cls: 'text-pink-500 bg-pink-500/15' },
  case: { icon: ShieldAlert, cls: 'text-rose-500 bg-rose-500/15' },
}

/**
 * The admin's command center: money, operation, people, inbox, AI agents and marketing on one
 * screen, refreshed every 30 s. "Modo TV" goes full screen with a dark, high-contrast layout and
 * keeps the display awake, for a TV on the wall.
 */
export default function CommandCenter() {
  const [data, setData] = useState<PlatformOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tv, setTv] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const rootRef = useRef<HTMLDivElement>(null)
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/overview', { cache: 'no-store' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || `Error ${res.status}`)
      setData(d)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sin conexión')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const refresh = setInterval(() => { if (document.visibilityState === 'visible') load() }, REFRESH_MS)
    const clock = setInterval(() => setNow(Date.now()), 1000)
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(refresh); clearInterval(clock); document.removeEventListener('visibilitychange', onVisible) }
  }, [load])

  // TV: a 1920×1080 canvas scaled to the screen through the root font size (every rem scales with it),
  // letterboxed if the screen is not 16:9. No page scroll behind it.
  const [scale, setScale] = useState(1)
  useEffect(() => {
    if (!tv) return
    const html = document.documentElement
    const prev = { overflow: html.style.overflow, fontSize: html.style.fontSize }
    const fit = () => {
      const k = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
      setScale(k)
      html.style.fontSize = `${16 * k}px`
    }
    html.style.overflow = 'hidden'
    fit()
    window.addEventListener('resize', fit)
    return () => { window.removeEventListener('resize', fit); html.style.overflow = prev.overflow; html.style.fontSize = prev.fontSize }
  }, [tv])
  /** Pixel sizes (icons, chart text) follow the TV scale. */
  const px = (n: number) => (tv ? Math.max(1, Math.round(n * scale * 1.25)) : n)

  // Leaving full screen (Esc on the TV remote/keyboard) leaves TV mode too
  useEffect(() => {
    const onChange = () => { if (!document.fullscreenElement) setTv(false) }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  async function toggleTv() {
    if (!tv) {
      setTv(true)
      await document.documentElement.requestFullscreen?.().catch(() => null)
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
        wakeLock.current = (await nav.wakeLock?.request('screen')) ?? null
      } catch { /* not supported: the TV's own settings decide */ }
    } else {
      setTv(false)
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => null)
      await wakeLock.current?.release().catch(() => null)
      wakeLock.current = null
    }
  }

  const t = tv ? THEMES.tv : THEMES.light
  const clock = new Intl.DateTimeFormat('es-CO', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now)
  const today = new Intl.DateTimeFormat('es-CO', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(now)
  const age = data ? Math.round((now - new Date(data.generatedAt).getTime()) / 1000) : null
  const stale = age !== null && age > 120

  if (!data) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-gray-500">
        {error ? <><AlertTriangle size={18} /> {error} <button onClick={load} className="ml-2 text-primary-600 underline">Reintentar</button></> : <><Loader2 className="animate-spin" size={18} /> Cargando el centro de control…</>}
      </div>
    )
  }

  const d = data
  const chart = d.series.days.map((day, i) => ({ day: dayLabel(day), ventas: d.series.sales[i], reservas: d.series.bookings[i], mensajes: d.series.inbound[i] }))
  const replies = d.inbox.today.ai + (d.inbox.today.outbound - d.inbox.today.ai)
  const aiShare = replies ? Math.round((d.inbox.today.ai / replies) * 100) : 0

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className={`${t.h1} font-bold tracking-tight ${t.text}`}>Centro de control</h1>
        <p className={`text-sm capitalize ${t.muted}`}>{today}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className={`font-bold tabular-nums ${tv ? 'text-4xl' : 'text-2xl'} ${t.text}`}>{clock}</p>
          <p className={`flex items-center justify-end gap-1.5 text-xs ${stale || error ? 'text-rose-500' : t.muted}`}>
            <span className={`h-2 w-2 rounded-full ${stale || error ? 'bg-rose-500' : 'animate-pulse bg-emerald-500'}`} />
            {error ? `Sin conexión: ${error}` : `En vivo · actualizado ${age !== null && age < 5 ? 'ahora' : `hace ${age} s`}`}
          </p>
        </div>
        {!tv && (
          <button onClick={load} disabled={loading} title="Actualizar ahora" className="rounded-full border border-gray-200 bg-white p-2.5 text-gray-600 hover:bg-gray-50">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        )}
        <button onClick={toggleTv} className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold ${tv ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-900 text-white hover:bg-gray-800'}`}>
          {tv ? <><Minimize2 size={px(16)} /> Salir</> : <><Maximize2 size={16} /> Modo TV</>}
        </button>
      </div>
    </div>
  )

  const alerts = d.alerts.length ? (
    <div className={`flex gap-2 ${tv ? 'flex-nowrap overflow-hidden' : 'flex-wrap'}`}>
      {d.alerts.map((a) => {
        const cls = a.level === 'critical' ? 'border-rose-500/40 bg-rose-500/10' : 'border-amber-500/40 bg-amber-500/10'
        const color = tv ? (a.level === 'critical' ? 'text-rose-300' : 'text-amber-300') : a.level === 'critical' ? 'text-rose-600' : 'text-amber-600'
        const inner = <><AlertTriangle size={px(14)} className="shrink-0" />{a.text}</>
        return tv
          ? <span key={a.text} className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 py-1.5 text-base font-semibold ${cls} ${color}`}>{inner}</span>
          : <Link key={a.text} href={a.href} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold hover:opacity-80 ${cls} ${color}`}>{inner}</Link>
      })}
    </div>
  ) : (
    <p className={`inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-semibold ${tv ? 'text-base text-emerald-300' : 'text-xs text-emerald-600'}`}><CheckCircle2 size={px(14)} /> Todo en orden: nada requiere atención ahora</p>
  )

  const kpis = (
    <div className={`grid gap-3 ${tv ? 'grid-cols-6' : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6'}`}>
      <Kpi t={t} tv={tv} px={px} icon={CreditCard} tone="emerald" label="Ventas hoy" value={money(d.sales.today.amount)} delta={d.sales.today.delta} deltaLabel="vs ayer" sub={`${d.sales.today.count} pagos · comisión ${money(d.sales.today.commission)}`} href="/admin?section=payments" />
      <Kpi t={t} tv={tv} px={px} icon={Wallet} tone="emerald" label="Ventas del mes" value={money(d.sales.month.amount)} delta={d.sales.month.delta} deltaLabel="vs mes anterior" sub={`comisión ${money(d.sales.month.commission)}`} href="/admin?section=payments" />
      <Kpi t={t} tv={tv} px={px} icon={CalendarCheck} tone="sky" label="Reservas hoy" value={num(d.bookings.today)} delta={d.bookings.todayDelta} deltaLabel="vs ayer" sub={`${d.bookings.scheduledToday} servicios agendados hoy`} href="/admin?section=bookings" />
      <Kpi t={t} tv={tv} px={px} icon={Send} tone="violet" label="Solicitudes activas" value={num(d.requests.active)} sub={`${d.requests.today} nuevas hoy${d.requests.withoutProposals ? ` · ${d.requests.withoutProposals} sin propuestas` : ''}`} href="/admin/service-requests" />
      <Kpi t={t} tv={tv} px={px} icon={Inbox} tone={d.inbox.waiting ? 'rose' : 'primary'} label="Bandeja abierta" value={num(d.inbox.open)} sub={`${d.inbox.waiting} esperando · ${d.inbox.unread} sin leer`} href="/admin/inbox" />
      <Kpi t={t} tv={tv} px={px} icon={UserPlus} tone="amber" label="Usuarios nuevos hoy" value={num(d.users.newClientsToday + d.users.newPartnersToday)} sub={`${plural(d.users.newClientsToday, 'cliente', 'clientes')} · ${plural(d.users.newPartnersToday, 'socio', 'socios')}`} href="/admin?section=users" />
    </div>
  )

  const trend = (
    <Panel t={t} tv={tv} px={px} title="Últimos 14 días" icon={Sparkles} className={tv ? 'col-span-2' : 'xl:col-span-2'}>
      <div className={tv ? 'min-h-0 flex-1' : 'h-64'}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chart} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={t.grid} vertical={false} />
            <XAxis dataKey="day" tick={{ fill: t.axis, fontSize: px(11) }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="money" tick={{ fill: t.axis, fontSize: px(11) }} axisLine={false} tickLine={false} tickFormatter={(v: number) => money(v)} width={px(70)} />
            <YAxis yAxisId="count" orientation="right" tick={{ fill: t.axis, fontSize: px(11) }} axisLine={false} tickLine={false} allowDecimals={false} width={px(30)} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: 'none', background: tv ? '#0F172A' : '#fff', color: tv ? '#fff' : '#111827', boxShadow: '0 10px 30px rgba(0,0,0,.15)' }}
              formatter={(v, name) => [name === 'ventas' ? money(Number(v ?? 0)) : num(Number(v ?? 0)), name === 'ventas' ? 'Ventas cobradas' : name === 'reservas' ? 'Reservas' : 'Mensajes recibidos']}
            />
            <Bar yAxisId="money" dataKey="ventas" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={px(28)} />
            <Line yAxisId="count" dataKey="reservas" stroke="#0EA5E9" strokeWidth={px(2.5)} dot={false} isAnimationActive={!tv} />
            <Line yAxisId="count" dataKey="mensajes" stroke="#8B5CF6" strokeWidth={px(2)} strokeDasharray="4 3" dot={false} isAnimationActive={!tv} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className={`mt-2 flex flex-wrap gap-4 text-xs ${t.muted}`}>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Ventas cobradas</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-sky-500" /> Reservas</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-violet-500" /> Mensajes recibidos</span>
        <span className="ml-auto">Semana: {money(d.sales.week.amount)} en {d.sales.week.count} pagos</span>
      </div>
    </Panel>
  )

  const inbox = (
    <Panel t={t} tv={tv} px={px} title="Bandeja de entrada" icon={Inbox} href="/admin/inbox">
      <div className="grid grid-cols-3 gap-2">
        <Stat t={t} label="Esperando" value={d.inbox.waiting} tone={d.inbox.waiting ? 'rose' : undefined} />
        <Stat t={t} label="Sin asignar" value={d.inbox.unassigned} tone={d.inbox.unassigned ? 'amber' : undefined} />
        <Stat t={t} label="La atiende IA" value={d.inbox.aiHandling} />
      </div>
      <div className={`mt-3 space-y-1.5 ${tv ? 'min-h-0 flex-1 overflow-hidden' : ''}`}>
        {d.inbox.byChannel.length === 0 && <p className={`text-sm ${t.muted}`}>No hay conversaciones abiertas.</p>}
        {d.inbox.byChannel.map((c) => (
          <div key={c.channel} className="flex items-center gap-2">
            <ChannelIcon channel={c.channel} size={px(18)} />
            <span className={`flex-1 text-sm ${t.text}`}>{channelLabel(c.channel)}</span>
            <div className={`h-1.5 w-24 rounded-full ${t.bar}`}><div className="h-1.5 rounded-full bg-primary-500" style={{ width: `${Math.min(100, (c.open / Math.max(1, d.inbox.open)) * 100)}%` }} /></div>
            <span className={`w-8 text-right text-sm font-semibold tabular-nums ${t.text}`}>{c.open}</span>
          </div>
        ))}
      </div>
      <div className={`mt-3 border-t pt-3 ${t.divider}`}>
        <p className={`text-xs ${t.muted}`}>Hoy: {num(d.inbox.today.inbound)} mensajes recibidos · {num(d.inbox.today.outbound)} enviados</p>
        <div className={`mt-2 flex h-2 overflow-hidden rounded-full ${t.bar}`}>
          <div className="bg-violet-500" style={{ width: `${aiShare}%` }} />
          <div className="bg-sky-500" style={{ width: `${replies ? 100 - aiShare : 0}%` }} />
        </div>
        <div className={`mt-1 flex justify-between text-[0.6875rem] ${t.muted}`}>
          <span><span className="text-violet-500">●</span> IA {num(d.inbox.today.ai)} ({aiShare} %)</span>
          <span><span className="text-sky-500">●</span> Personas {num(Math.max(0, d.inbox.today.outbound - d.inbox.today.ai))}</span>
          <span>{d.inbox.today.handoffs} pasadas a humano</span>
        </div>
      </div>
    </Panel>
  )

  const agents = (
    <Panel t={t} tv={tv} px={px} title="Agentes de IA" icon={Bot} href="/admin/ai-agents">
      <div className="grid grid-cols-3 gap-2">
        <Stat t={t} label="Activos" value={d.ai.agents.length + d.marketing.agents.length} />
        <Stat t={t} label="Llamadas hoy" value={d.ai.callsToday} />
        <Stat t={t} label="Costo hoy" value={usd(d.ai.costToday)} />
      </div>
      <p className={`mt-2 text-xs ${t.muted}`}>Costo de IA del mes: {usd(d.ai.costMonth)}</p>
      <div className={`mt-3 space-y-1.5 ${tv ? 'min-h-0 flex-1 overflow-hidden' : ''}`}>
        {d.ai.agents.slice(0, 5).map((a) => (
          <div key={a.id} className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            <span className={`flex-1 truncate ${t.text}`}>{a.name}</span>
            {a.autopilot && <span className="rounded-full bg-violet-500/15 px-1.5 text-[0.625rem] font-semibold text-violet-500">piloto</span>}
            <span className={`text-xs tabular-nums ${t.muted}`}>{num(a.messagesToday)} respuestas hoy</span>
          </div>
        ))}
        {d.marketing.agents.map((a) => (
          <div key={a.id} className="flex items-center gap-2 text-sm">
            <span className={`h-2 w-2 shrink-0 rounded-full ${a.degraded ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            <span className={`flex-1 truncate ${t.text}`}>Marketing · {a.campaign}</span>
            <span className={`text-xs ${a.degraded ? 'text-amber-500' : t.muted}`}>{a.degraded ? 'copiloto forzado' : a.mode === 'autopilot' ? 'piloto automático' : a.mode === 'supervised' ? 'supervisado' : 'copiloto'}</span>
          </div>
        ))}
        {!d.ai.agents.length && !d.marketing.agents.length && <p className={`text-sm ${t.muted}`}>No hay agentes activos.</p>}
      </div>
    </Panel>
  )

  const posts = (
    <Panel t={t} tv={tv} px={px} title="Publicaciones" icon={Newspaper} href="/admin/marketing">
      <div className="grid grid-cols-3 gap-2">
        <Stat t={t} label="Salen hoy" value={d.marketing.scheduledToday} />
        <Stat t={t} label="Publicadas 7 d" value={d.marketing.publishedWeek} />
        <Stat t={t} label="Por aprobar" value={d.marketing.inReview + d.marketing.ideasPending} tone={d.marketing.inReview ? 'amber' : undefined} />
      </div>
      <p className={`mt-2 text-xs ${t.muted}`}>7 días: {num(d.marketing.reachWeek)} personas alcanzadas · {num(d.marketing.interactionsWeek)} interacciones · {num(d.marketing.blogViewsWeek)} visitas al blog</p>
      <div className={`mt-3 space-y-1.5 ${tv ? 'min-h-0 flex-1 overflow-hidden' : ''}`}>
        <p className={`text-[0.6875rem] font-semibold uppercase tracking-wide ${t.faint}`}>Próximas</p>
        {d.marketing.upcoming.length === 0 && <p className={`text-sm ${t.muted}`}>Nada programado.</p>}
        {d.marketing.upcoming.map((p) => (
          <div key={p.id} className="flex items-center gap-2 text-sm">
            <MkChannelIcon channel={p.channel} size={px(16)} />
            <span className={`flex-1 truncate ${t.text}`}>{p.agent ? '🤖  ' : ''}{p.title}</span>
            <span className={`text-xs tabular-nums ${t.muted}`}>{new Date(p.at).getTime() - now < 24 * 3600_000 ? time(p.at) : dayLabel(new Date(new Date(p.at).getTime() - 5 * 3600_000).toISOString().slice(0, 10))}</span>
          </div>
        ))}
      </div>
    </Panel>
  )

  const operation = (
    <Panel t={t} tv={tv} px={px} title="Operación" icon={CalendarCheck} href="/admin/operations">
      <div className="grid grid-cols-3 gap-2">
        <Stat t={t} label="Pendientes" value={d.bookings.pending} tone={d.bookings.pending ? 'amber' : undefined} />
        <Stat t={t} label="Confirmadas" value={d.bookings.confirmed} />
        <Stat t={t} label="En curso" value={d.bookings.inProgress} />
        <Stat t={t} label="Completadas hoy" value={d.bookings.completedToday} tone="emerald" />
        <Stat t={t} label="Canceladas hoy" value={d.bookings.cancelledToday} tone={d.bookings.cancelledToday ? 'rose' : undefined} />
        <Stat t={t} label="Casos de soporte" value={d.quality.casesOpen} tone={d.quality.casesSla ? 'rose' : undefined} />
      </div>
      <div className={`mt-3 space-y-1 border-t pt-3 text-sm ${t.divider} ${tv ? 'min-h-0 flex-1 overflow-hidden' : ''}`}>
        <p className={`flex justify-between ${t.muted}`}><span>Pagos a socios pendientes</span><span className={`font-semibold tabular-nums ${t.text}`}>{d.payouts.pending} · {money(d.payouts.pendingAmount)}</span></p>
        <p className={`flex justify-between ${t.muted}`}><span>Socios verificados / disponibles</span><span className={`font-semibold tabular-nums ${t.text}`}>{num(d.users.partnersVerified)} / {num(d.users.partnersAvailable)}</span></p>
        <p className={`flex justify-between ${t.muted}`}><span>Clientes registrados</span><span className={`font-semibold tabular-nums ${t.text}`}>{num(d.users.clients)} <span className={`text-xs font-normal ${t.muted}`}>(+{num(d.users.newWeek)} en 7 d)</span></span></p>
        <p className={`flex justify-between ${t.muted}`}><span className="flex items-center gap-1"><Star size={px(13)} className="text-amber-400" /> Calificación (30 d)</span><span className={`font-semibold tabular-nums ${t.text}`}>{d.quality.rating ?? '—'} <span className={`text-xs font-normal ${t.muted}`}>({d.quality.reviews30} reseñas)</span></span></p>
        <p className={`flex justify-between ${t.muted}`}><span>Canales conectados</span><span className={`font-semibold tabular-nums ${d.channels.problems.length ? 'text-rose-500' : t.text}`}>{d.channels.total}{d.channels.problems.length ? ` · ${d.channels.problems.length} con problemas` : ''}</span></p>
      </div>
    </Panel>
  )

  const feed = (
    <Panel t={t} tv={tv} px={px} title="Actividad en vivo" icon={Sparkles} className={tv ? 'row-span-2' : ''}>
      {d.activity.length === 0 ? <p className={`text-sm ${t.muted}`}>Sin movimiento en los últimos 3 días.</p> : (
        <div className={tv ? 'min-h-0 flex-1 overflow-hidden' : 'grid gap-x-6 md:grid-cols-2 xl:grid-cols-3'}>
          {d.activity.map((a) => {
            const meta = FEED_ICON[a.kind] ?? FEED_ICON.booking
            const Icon = meta.icon
            return (
              <div key={a.id} className={`flex items-center gap-3 border-b py-2 ${t.divider}`}>
                <span className={`rounded-lg p-1.5 ${meta.cls}`}><Icon size={px(14)} /></span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${t.text}`}>{a.text}</p>
                  {a.detail && <p className={`truncate text-[0.6875rem] ${t.muted}`}>{a.kind === 'conversation' ? channelLabel(a.detail) : a.detail}</p>}
                </div>
                <span className={`shrink-0 text-[0.6875rem] tabular-nums ${t.faint}`}>{ago(a.at, now)}</span>
              </div>
            )
          })}
        </div>
      )}
    </Panel>
  )

  // TV: a fixed 16:9 canvas (120 × 67.5 rem = 1920 × 1080 at scale 1) that fits any screen
  if (tv) {
    return (
      <div ref={rootRef} className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-slate-950">
        <div className="flex flex-col gap-4 p-6" style={{ width: '120rem', height: '67.5rem' }}>
          {header}
          {alerts}
          {kpis}
          <div className="grid min-h-0 flex-1 grid-cols-4 grid-rows-2 gap-4">
            {trend}
            {inbox}
            {feed}
            {agents}
            {posts}
            {operation}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={rootRef} className="space-y-5">
      {header}
      {alerts}
      {kpis}
      <div className="grid gap-3 xl:grid-cols-3">
        {trend}
        {inbox}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {agents}
        {posts}
        {operation}
      </div>
      {feed}
    </div>
  )
}
