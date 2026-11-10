'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { useDialog } from '@/components/ui/use-dialog'
import { CHANNEL_NAMES, METRIC_CHANNELS, METRIC_PERIODS, formatSeconds, percent, rate, type MetricChannel, type MetricPeriod } from '@/lib/inbox/metrics-core'
import type { InboxMetrics } from '@/lib/inbox/metrics'

type Stats = { count: number; medianSeconds: number | null; p90Seconds: number | null }
type Actor = InboxMetrics['people'][number]

const n = (x: number) => x.toLocaleString('es-CO')
const stats = (s: Stats) => `${formatSeconds(s.medianSeconds)} · p90 ${formatSeconds(s.p90Seconds)}`

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-gray-50 p-3 min-w-0">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="mt-0.5 text-base sm:text-lg font-bold text-gray-900 break-words">{value}</p>
      {hint && <p className="text-[11px] text-gray-400 break-words">{hint}</p>}
    </div>
  )
}

function Section({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section>
      <h3 className="text-xs font-semibold text-gray-700">{title}</h3>
      {note && <p className="text-[11px] text-gray-400">{note}</p>}
      <div className="mt-2">{children}</div>
    </section>
  )
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <span className="flex-1 min-w-0 truncate text-gray-700">{label}</span>
      <span className="h-1.5 w-20 sm:w-28 shrink-0 overflow-hidden rounded-full bg-gray-100">
        <span className="block h-full rounded-full bg-primary-500" style={{ width: `${max ? Math.round((value / max) * 100) : 0}%` }} />
      </span>
      <span className="w-10 shrink-0 text-right font-semibold text-gray-900">{n(value)}</span>
    </li>
  )
}

function ActorList({ rows, kind }: { rows: Actor[]; kind: 'person' | 'agent' }) {
  if (!rows.length) return <p className="text-xs text-gray-400">{kind === 'person' ? 'Ninguna persona respondió en este periodo.' : 'Ningún agente de IA respondió en este periodo.'}</p>
  return (
    <ul className="divide-y rounded-2xl border">
      {rows.map((a) => (
        <li key={a.id} className="p-3 min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{a.name}</p>
          <p className="mt-0.5 text-[11px] text-gray-500 break-words">
            {n(a.conversations)} conversaciones · 1.ª respuesta {formatSeconds(a.firstResponse.medianSeconds)}
            {a.firstResponse.count ? ` (${n(a.firstResponse.count)})` : ''} · {n(a.resolved)} resueltas · CSAT {a.csatAverage === null ? '—' : `${a.csatAverage.toFixed(1)} (${n(a.csatCount)})`} · {kind === 'person' ? `${n(a.handoffs)} traspasos atendidos` : `${n(a.handoffs)} traspasos`}
          </p>
        </li>
      ))}
    </ul>
  )
}

/** How the inbox is doing: only real replies count (no templates, surveys, holding messages or notices). */
export default function InboxMetricsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dialogProps, titleId } = useDialog(open, onClose)
  const [days, setDays] = useState<MetricPeriod>(7)
  const [channel, setChannel] = useState<MetricChannel | ''>('')
  const [data, setData] = useState<InboxMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const query = `days=${days}${channel ? `&channel=${channel}` : ''}`

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/admin/inbox/metrics?${query}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(d.error || `No se pudieron calcular las métricas (HTTP ${r.status})`)
        if (!cancelled) setData(d)
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudieron calcular las métricas') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, query])

  if (!open) return null
  const fr = data?.firstResponse
  const funnel = data?.funnel.total

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={onClose} />
      <div {...dialogProps} className="relative w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-t-3xl sm:rounded-3xl bg-white p-4 sm:p-5 shadow-xl focus:outline-none">
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-base font-bold text-gray-900">Métricas de la bandeja</h2>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Periodo" className="inline-flex rounded-full bg-gray-100 p-0.5">
            {METRIC_PERIODS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                aria-pressed={days === d}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${days === d ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}
              >
                {d} días
              </button>
            ))}
          </div>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as MetricChannel | '')}
            aria-label="Canal"
            className="rounded-full border bg-white px-3 py-1 text-xs font-semibold text-gray-700"
          >
            <option value="">Todos los canales</option>
            {METRIC_CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_NAMES[c]}</option>)}
          </select>
          <a
            href={`/api/admin/inbox/metrics/export?${query}`}
            download
            className="ml-auto inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </a>
        </div>

        <div className="mt-4" aria-live="polite">
          {loading && !data && <p className="text-sm text-gray-500">Calculando…</p>}
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          {data && fr && funnel && (
            <div className={`space-y-5 ${loading ? 'opacity-60' : ''}`}>
              <Section title="Primera respuesta (mediana · p90)" note="Solo respuestas reales: sin plantillas, encuestas, mensajes de espera ni avisos automáticos.">
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="IA" value={formatSeconds(fr.ai.medianSeconds)} hint={`p90 ${formatSeconds(fr.ai.p90Seconds)} · ${n(fr.ai.count)} conversaciones`} />
                  <Stat label="Persona" value={formatSeconds(fr.human.medianSeconds)} hint={`p90 ${formatSeconds(fr.human.p90Seconds)} · ${n(fr.human.count)} · desde el mensaje o el traspaso`} />
                  <Stat label="En horario del equipo" value={formatSeconds(fr.insideHours.medianSeconds)} hint={`p90 ${formatSeconds(fr.insideHours.p90Seconds)} · ${n(fr.insideHours.count)}`} />
                  <Stat label="Fuera de horario" value={formatSeconds(fr.outsideHours.medianSeconds)} hint={`p90 ${formatSeconds(fr.outsideHours.p90Seconds)} · ${n(fr.outsideHours.count)}`} />
                </div>
                <p className="mt-1.5 text-[11px] text-gray-500">Todas: {stats(fr.any)} · {n(fr.unanswered)} sin respuesta</p>
              </Section>

              <Section title="Resolución">
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="Tiempo hasta resolver" value={formatSeconds(data.resolution.medianSeconds)} hint={`p90 ${formatSeconds(data.resolution.p90Seconds)} · ${n(data.resolution.resolved)} resueltas`} />
                  <Stat label="Resueltas solo por la IA" value={percent(data.ai.rate)} hint={`${n(data.ai.byAi)} de ${n(data.ai.closed)} resueltas con respuesta`} />
                  <Stat label="Cerradas por inactividad" value={n(data.autoClosed)} hint="El contacto dejó de responder" />
                  <Stat label="Reabiertas" value={n(data.reopened)} hint="El contacto volvió a escribir tras el cierre" />
                </div>
              </Section>

              <Section title={`Traspasos de la IA a una persona · ${percent(data.handoffs.rate)}`} note={`${n(data.handoffs.total)} de ${n(data.ai.involved)} conversaciones con IA`}>
                {data.handoffs.top.length === 0 ? (
                  <p className="text-xs text-gray-400">La IA no traspasó conversaciones en este periodo.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {data.handoffs.top.map((h) => <Bar key={h.reason} label={h.reason} value={h.count} max={data.handoffs.top[0].count} />)}
                  </ul>
                )}
              </Section>

              <Section title={`Satisfacción (CSAT) · ${data.csat.average === null ? '—' : `${data.csat.average.toFixed(1)} / 5`}`} note={`${n(data.csat.answered)} respuestas de ${n(data.csat.asked)} encuestas (${percent(rate(data.csat.answered, data.csat.asked))})`}>
                <ul className="space-y-1.5">
                  {[5, 4, 3, 2, 1].map((s) => <Bar key={s} label={`${s} ★`} value={data.csat.distribution[s - 1]} max={Math.max(...data.csat.distribution)} />)}
                </ul>
              </Section>

              <Section title="Conversión" note="Solicitud en los 7 días y reserva en los 14 días siguientes al primer mensaje (desde el chat o por la misma cuenta).">
                <ul className="space-y-1.5">
                  <Bar label="Conversaciones" value={funnel.conversations} max={funnel.conversations} />
                  <Bar label={`Con cuenta (${n(funnel.newAccounts)} nuevas o vinculadas en el chat)`} value={funnel.withAccount} max={funnel.conversations} />
                  <Bar label={`Con solicitud · ${percent(rate(funnel.requests, funnel.conversations))}`} value={funnel.requests} max={funnel.conversations} />
                  <Bar label={`Con reserva · ${percent(rate(funnel.bookings, funnel.conversations))}`} value={funnel.bookings} max={funnel.conversations} />
                </ul>
                {data.funnel.byChannel.length > 1 && (
                  <div className="mt-3 overflow-x-auto rounded-2xl border">
                    <table className="w-full min-w-[320px] text-[11px]">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium">Canal</th>
                          <th className="px-2 py-1.5 text-right font-medium">Conv.</th>
                          <th className="px-2 py-1.5 text-right font-medium">Cuenta</th>
                          <th className="px-2 py-1.5 text-right font-medium">Solic.</th>
                          <th className="px-2 py-1.5 text-right font-medium">Reserva</th>
                          <th className="px-2 py-1.5 text-right font-medium">1.ª resp.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {data.funnel.byChannel.map((c) => (
                          <tr key={c.channel}>
                            <td className="px-2 py-1.5 text-gray-700">{CHANNEL_NAMES[c.channel] ?? c.channel}</td>
                            <td className="px-2 py-1.5 text-right font-semibold text-gray-900">{n(c.conversations)}</td>
                            <td className="px-2 py-1.5 text-right">{n(c.withAccount)}</td>
                            <td className="px-2 py-1.5 text-right">{n(c.requests)}</td>
                            <td className="px-2 py-1.5 text-right">{n(c.bookings)}</td>
                            <td className="px-2 py-1.5 text-right">{formatSeconds(c.firstResponse.medianSeconds)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              <Section title="Por persona">
                <ActorList rows={data.people} kind="person" />
              </Section>

              <Section title="Por agente de IA">
                <ActorList rows={data.agents} kind="agent" />
              </Section>

              <Section title="Sugerencias del copiloto" note={`${n(data.copilot.generated)} generadas · ${percent(data.copilot.useRate)} enviadas (tal cual o editadas)`}>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {([['Usadas', data.copilot.used], ['Editadas', data.copilot.edited], ['Insertadas', data.copilot.inserted], ['Descartadas', data.copilot.discarded], ['Ignoradas', data.copilot.ignored], ['Vencidas', data.copilot.expired], ['Pendientes', data.copilot.pending]] as const).map(([label, value]) => (
                    <span key={label} className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-700">{label} <b className="text-gray-900">{n(value)}</b></span>
                  ))}
                </div>
              </Section>

              <p className="text-[11px] text-gray-400">
                Sobre {n(data.conversations)} conversaciones en las que el contacto escribió en el periodo, medidas desde su primer mensaje del periodo (sin pruebas ni comentarios).
                {data.truncated ? ' Se leyeron solo las más recientes: el periodo tiene más conversaciones.' : ''}
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="rounded-full border px-4 py-2.5 sm:py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cerrar</button>
        </div>
      </div>
    </div>
  )
}
