'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ChevronDown, Clock, Loader2, RefreshCw, ShieldAlert, Webhook, XCircle } from 'lucide-react'
import { ChannelIcon, channelLabel } from '@/components/admin/ChannelIcon'

type Cron = { key: string; label: string; path: string; schedule: string; everyMs: number | null; health: 'ok' | 'late' | 'failing' | 'stuck' | 'never'; lastRunAt: string | null; lastDurationMs: number | null; lastError: string | null; lastErrorAt: string | null; runs24h: number; failures24h: number; avgMs: number | null }
type Service = { key: string; name: string; level: 'ok' | 'warning' | 'error' | 'off'; detail: string }
type ErrGroup = { id: string; source: string; context: string | null; message: string; route: string | null; count: number; firstSeenAt: string; lastSeenAt: string; sample: { stack?: string; data?: unknown; ua?: string } | null }
type Overview = {
  generatedAt: string
  status: 'ok' | 'warning' | 'error'
  crons: Cron[]
  services: Service[]
  errors: ErrGroup[]
  errors24h: number
  webhooks: { byChannel: Array<{ channel: string; status: string; n: number }>; recentErrors: Array<{ id: string; channel: string; status: string; detail: string | null; createdAt: string }> }
  security: { events24h: number; blockedIps: number }
}

const HEALTH = {
  ok: { label: 'Al día', cls: 'bg-emerald-100 text-emerald-800' },
  late: { label: 'Atrasada', cls: 'bg-amber-100 text-amber-800' },
  failing: { label: 'Fallando', cls: 'bg-rose-100 text-rose-700' },
  stuck: { label: 'Colgada', cls: 'bg-rose-100 text-rose-700' },
  never: { label: 'Sin registros aún', cls: 'bg-gray-100 text-gray-600' },
} as const
const LEVEL = {
  ok: { icon: CheckCircle2, cls: 'text-emerald-500' },
  warning: { icon: AlertTriangle, cls: 'text-amber-500' },
  error: { icon: XCircle, cls: 'text-rose-500' },
  off: { icon: Clock, cls: 'text-gray-300' },
} as const

const ago = (iso: string | null) => {
  if (!iso) return '—'
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (m < 1) return 'ahora'
  if (m < 60) return `hace ${m} min`
  if (m < 1440) return `hace ${Math.round(m / 60)} h`
  return `hace ${Math.round(m / 1440)} d`
}
const every = (ms: number | null) => (!ms ? '—' : ms < 3600_000 ? `cada ${ms / 60_000} min` : ms < 86_400_000 ? `cada ${ms / 3600_000} h` : 'diaria')
const dur = (ms: number | null) => (ms == null ? '—' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1).replace('.', ',')} s`)

/**
 * Is the platform working inside: scheduled jobs, external services, application errors, webhooks
 * and security. Refreshes every minute.
 */
export default function SystemHealthPage() {
  const [d, setD] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/system', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
      setD(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  async function resolve(ids: string[]) {
    await fetch('/api/admin/system', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ errorIds: ids }) }).catch(() => null)
    load()
  }

  if (!d) return <div className="flex items-center gap-2 py-16 text-gray-500">{error ? <><AlertTriangle size={16} /> {error}</> : <><Loader2 className="animate-spin" size={16} /> Revisando la plataforma…</>}</div>

  const banner = d.status === 'ok'
    ? { cls: 'border-emerald-200 bg-emerald-50 text-emerald-800', icon: CheckCircle2, text: 'Todo funciona: tareas automáticas al día y servicios conectados.' }
    : d.status === 'warning'
      ? { cls: 'border-amber-200 bg-amber-50 text-amber-900', icon: AlertTriangle, text: 'Hay cosas por revisar (abajo, marcadas en amarillo o rojo).' }
      : { cls: 'border-rose-200 bg-rose-50 text-rose-800', icon: XCircle, text: 'Algo importante está fallando: revisa lo marcado en rojo.' }
  const hasHistory = d.crons.some((c) => c.health !== 'never')

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Salud del sistema</h1>
          <p className="mt-1 text-sm text-gray-500">¿La plataforma funciona por dentro? Tareas automáticas, servicios externos, errores, webhooks y seguridad.</p>
        </div>
        <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualizar</button>
      </div>
      <div className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium ${banner.cls}`}><banner.icon size={18} /> {banner.text}</div>

      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-3">
          <h2 className="font-semibold text-gray-900">Tareas automáticas</h2>
          <p className="text-xs text-gray-500">Las que Vercel corre solas. Si una falla dos veces seguidas se abre un incidente en <Link href="/admin/operations" className="underline">Casos e incidentes</Link>, y se cierra cuando vuelve a funcionar.{!hasHistory && ' El registro empieza con esta versión: las verás llenarse en los próximos minutos.'}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500"><tr><th className="py-2 pr-3">Tarea</th><th className="px-3">Estado</th><th className="px-3">Frecuencia</th><th className="px-3">Última vez</th><th className="px-3 text-right">Duración</th><th className="pl-3 text-right">24 h (fallos)</th></tr></thead>
            <tbody>
              {d.crons.map((c) => (
                <tr key={c.key} className="border-t border-gray-100 align-top">
                  <td className="py-2 pr-3"><p className="text-gray-900">{c.label}</p><p className="font-mono text-[11px] text-gray-400">{c.path}</p>{c.lastError && <p className="mt-1 text-xs text-rose-600">Último error {ago(c.lastErrorAt)}: {c.lastError.slice(0, 180)}</p>}</td>
                  <td className="px-3"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${HEALTH[c.health].cls}`}>{HEALTH[c.health].label}</span></td>
                  <td className="whitespace-nowrap px-3 text-gray-600">{every(c.everyMs)}</td>
                  <td className="whitespace-nowrap px-3 text-gray-600">{ago(c.lastRunAt)}</td>
                  <td className="whitespace-nowrap px-3 text-right tabular-nums text-gray-600">{dur(c.lastDurationMs)}</td>
                  <td className="whitespace-nowrap pl-3 text-right tabular-nums"><span className="text-gray-900">{c.runs24h}</span>{c.failures24h > 0 && <span className="ml-1 font-semibold text-rose-600">({c.failures24h})</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-semibold text-gray-900">Servicios e integraciones</h2>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {d.services.map((s) => {
            const L = LEVEL[s.level]
            return (
              <div key={s.key} className="flex items-start gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
                <L.icon size={18} className={`mt-0.5 shrink-0 ${L.cls}`} />
                <div className="min-w-0"><p className="text-sm font-medium text-gray-900">{s.name}</p><p className="text-xs text-gray-500">{s.detail}</p></div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-gray-900">Errores de la aplicación</h2>
            <p className="text-xs text-gray-500">Del servidor y de los navegadores de los usuarios, agrupados. {d.errors24h} grupos activos en las últimas 24 h. Uno resuelto vuelve a aparecer si el error se repite.</p>
          </div>
          {d.errors.length > 0 && <button onClick={() => { if (window.confirm('¿Marcar todos como resueltos?')) resolve(d.errors.map((e) => e.id)) }} className="text-xs text-primary-700 hover:underline">Marcar todos como resueltos</button>}
        </div>
        {d.errors.length === 0 ? <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 size={16} /> Sin errores pendientes.</p> : (
          <div className="divide-y divide-gray-100">
            {d.errors.map((e) => (
              <div key={e.id} className="py-2.5">
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${e.source === 'client' ? 'bg-sky-100 text-sky-800' : 'bg-violet-100 text-violet-800'}`}>{e.source === 'client' ? 'navegador' : 'servidor'}</span>
                  <button onClick={() => setOpen(open === e.id ? null : e.id)} className="min-w-0 flex-1 text-left">
                    <p className="break-words text-sm text-gray-900">{e.message}</p>
                    <p className="text-[11px] text-gray-500">{e.context ? `${e.context} · ` : ''}{e.route ? `${e.route} · ` : ''}{e.count} {e.count === 1 ? 'vez' : 'veces'} · última {ago(e.lastSeenAt)} · primera {ago(e.firstSeenAt)}</p>
                  </button>
                  <ChevronDown size={14} className={`mt-1 shrink-0 text-gray-400 transition ${open === e.id ? 'rotate-180' : ''}`} />
                  <button onClick={() => resolve([e.id])} className="shrink-0 text-xs text-primary-700 hover:underline">Resuelto</button>
                </div>
                {open === e.id && <pre className="mt-2 max-h-60 overflow-auto rounded-xl bg-gray-900 p-3 text-[11px] leading-relaxed text-gray-100">{JSON.stringify(e.sample, null, 2)}</pre>}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-900"><Webhook size={16} className="text-primary-500" /> Webhooks (24 h)</h2>
          {d.webhooks.byChannel.length === 0 ? <p className="text-sm text-gray-500">Sin eventos en 24 h.</p> : (
            <div className="space-y-1.5">
              {Array.from(new Set(d.webhooks.byChannel.map((w) => w.channel))).map((ch) => {
                const rows = d.webhooks.byChannel.filter((w) => w.channel === ch)
                return (
                  <div key={ch} className="flex items-center gap-2 text-sm">
                    <ChannelIcon channel={ch} size={16} />
                    <span className="flex-1 text-gray-800">{channelLabel(ch)}</span>
                    {rows.map((r) => <span key={r.status} className={`rounded-full px-2 py-0.5 text-[11px] ${r.status === 'OK' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{r.status} {r.n}</span>)}
                  </div>
                )
              })}
            </div>
          )}
          {d.webhooks.recentErrors.length > 0 && (
            <div className="mt-3 space-y-1 border-t border-gray-100 pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Últimos con problema</p>
              {d.webhooks.recentErrors.map((w) => <p key={w.id} className="text-xs text-gray-600"><span className="text-gray-400">{ago(w.createdAt)}</span> · {channelLabel(w.channel)} · {w.status}{w.detail ? `: ${w.detail.slice(0, 140)}` : ''}</p>)}
            </div>
          )}
          <Link href="/admin/channels" className="mt-3 inline-block text-xs text-primary-700 hover:underline">Ver el registro completo en Canales</Link>
        </section>
        <section className="rounded-2xl border border-gray-200 bg-white p-4">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-gray-900"><ShieldAlert size={16} className="text-primary-500" /> Seguridad</h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-gray-50 px-3 py-2"><p className="text-[11px] text-gray-500">Eventos de seguridad (24 h)</p><p className="text-lg font-bold tabular-nums text-gray-900">{d.security.events24h}</p></div>
            <div className="rounded-xl bg-gray-50 px-3 py-2"><p className="text-[11px] text-gray-500">IPs bloqueadas</p><p className="text-lg font-bold tabular-nums text-gray-900">{d.security.blockedIps}</p></div>
          </div>
          <p className="mt-2 text-xs text-gray-500">Intentos sospechosos detectados por el sitio; las IPs con muchos eventos se bloquean solas.</p>
          <Link href="/admin/security" className="mt-3 inline-block text-xs text-primary-700 hover:underline">Abrir Seguridad</Link>
        </section>
      </div>
      <p className="text-[11px] text-gray-400">Para un monitor externo de disponibilidad (UptimeRobot, Better Stack…): <span className="font-mono">https://www.lohaggo.com/api/health</span> responde 200 si la app y la base de datos funcionan.</p>
    </div>
  )
}
