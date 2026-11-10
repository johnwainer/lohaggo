'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ExternalLink, Loader2 } from 'lucide-react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHANNEL_NAME, FormatPill, MK_CHANNELS, MkChannelIcon, api, fmtWhen, num, type MkChannel } from '@/components/admin/marketing/shared'
import type { Campaign } from '@/components/admin/marketing/CampaignsTab'

type Totals = { reach: number; impressions: number; likes: number; comments: number; shares: number; saves: number; clicks: number; videoViews: number; webViews: number }
type Outcomes = { conversations: number; requests: number; bookings: number }
type Stats = {
  totals: Totals & Outcomes & { engagementRate: number | null; publications: number; posts: number }
  byChannel: Array<Totals & Outcomes & { channel: MkChannel; publications: number; engagementRate: number | null }>
  byFormat: Array<{ channel: MkChannel; format: string; publications: number; totals: Totals; outcomes: Outcomes; engagementRate: number | null }>
  posts: Array<{ postId: string; title: string; campaign: string | null; channels: MkChannel[]; formats?: Partial<Record<MkChannel, string>>; totals: Totals; outcomes: Outcomes; engagementRate: number | null; inboxConversations: number; publishedAt: string | null; links: Array<{ channel: MkChannel; account: string | null; permalink: string | null }> }>
  campaigns: Array<{ campaignId: string; name: string; color: string; posts: number; totals: Totals; outcomes: Outcomes; engagementRate: number | null }>
  series: Array<{ day: string; webViews: number; published: number }>
  sources: { totals: Outcomes; channels: Array<{ key: string; label: string } & Outcomes>; requestsWithoutData: number } | null
}

const RANGES = [['7', 'Últimos 7 días'], ['30', 'Últimos 30 días'], ['90', 'Últimos 90 días']] as const
const iso = (d: Date) => d.toISOString().slice(0, 10)
const interactions = (t: Totals) => t.likes + t.comments + t.shares + t.saves
const rate = (r: number | null) => (r == null ? '—' : `${r}%`)

/** Small labelled number, for the mobile cards */
function Metric({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`text-sm ${strong ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{value}</p>
    </div>
  )
}

export default function StatsTab({ workspaceId, campaigns }: { workspaceId: string; campaigns: Campaign[] }) {
  const [range, setRange] = useState('30')
  const [channel, setChannel] = useState('')
  const [campaignId, setCampaignId] = useState('')
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const to = new Date()
      const from = new Date(to.getTime() - Number(range) * 24 * 3600_000)
      const q = new URLSearchParams({ from: iso(from), to: iso(to) })
      if (workspaceId) q.set('workspaceId', workspaceId)
      if (channel) q.set('channel', channel)
      if (campaignId) q.set('campaignId', campaignId)
      setStats(await api<Stats>(`/api/admin/marketing/stats?${q}`))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [range, channel, campaignId, workspaceId])
  useEffect(() => { load() }, [load])

  const t = stats?.totals
  const kpis: Array<[string, string, string?]> = t ? [
    ['Conversaciones', num(t.conversations), 'Comentarios en la bandeja + chats de WhatsApp desde el enlace de la pieza'],
    ['Solicitudes', num(t.requests), 'Solicitudes de servicio que nombran la pieza'],
    ['Reservas', num(t.bookings), 'De esas solicitudes'],
    ['Publicaciones', num(t.publications), `${num(t.posts)} contenidos`],
    ['Alcance', num(t.reach), 'Personas únicas en redes'],
    ['Interacciones', num(interactions(t)), `${num(t.likes)} reacciones · ${num(t.comments)} comentarios`],
    ['Tasa de interacción', rate(t.engagementRate), 'Interacciones + clics / alcance'],
    ['Visitas al blog', num(t.webViews), `${num(t.clicks)} clics · ${num(t.videoViews)} reproducciones`],
  ] : []
  const src = stats?.sources

  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap items-center">
        <select className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm sm:flex-none" value={range} onChange={(e) => setRange(e.target.value)}>{RANGES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm sm:flex-none" value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="">Todos los canales</option>{MK_CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_NAME[c]}</option>)}
        </select>
        <select className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm sm:flex-none" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
          <option value="">Todas las campañas</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {loading && <Loader2 size={16} className="animate-spin text-gray-400" />}
      </div>
      <p className="text-xs text-gray-500">Lo que importa es lo que trae clientes: conversaciones, solicitudes y reservas que nombran cada pieza (por su enlace con UTM o su «ref: post-…» de WhatsApp). Las métricas de Facebook e Instagram se actualizan cada hora los primeros dos días, luego cada 6 horas y a diario hasta los 30 días.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {t && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kpis.map(([label, value, hint], i) => (
              <div key={label} className={`rounded-2xl border p-3 sm:p-4 ${i < 3 ? 'border-primary-200 bg-primary-50/40' : 'border-gray-200 bg-white'}`}>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="mt-1 text-xl font-bold text-gray-900 break-words sm:text-2xl">{value}</p>
                {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
              </div>
            ))}
          </div>

          {src && (
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">De dónde llegan los clientes</p>
                  <p className="text-xs text-gray-500">Toda la plataforma en el periodo (último toque): buscadores, ChatGPT, la bandeja, redes y pauta. Las publicaciones son una fuente entre varias.</p>
                </div>
                <Link href="/admin/analytics?tab=origins" className="inline-flex shrink-0 items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-50">Analítica → Origen <ArrowRight size={12} /></Link>
              </div>
              {src.channels.length === 0 ? <p className="mt-3 text-sm text-gray-500">Sin conversaciones ni solicitudes con origen en el periodo.</p> : (
                <ul className="mt-3 divide-y divide-gray-100">
                  {src.channels.map((c) => {
                    const share = src.totals.requests ? Math.round((c.requests / src.totals.requests) * 100) : 0
                    return (
                      <li key={c.key} className="py-2">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate font-medium text-gray-800">{c.label}</span>
                          <span className="shrink-0 text-xs text-gray-600">{num(c.conversations)} conv. · <strong className="text-gray-900">{num(c.requests)} solic.</strong> · {num(c.bookings)} reservas</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-gray-100"><div className="h-1.5 rounded-full bg-primary-500" style={{ width: `${share}%` }} /></div>
                      </li>
                    )
                  })}
                </ul>
              )}
              {src.requestsWithoutData > 0 && <p className="mt-2 text-[11px] text-gray-400">{num(src.requestsWithoutData)} solicitudes sin datos de origen.</p>}
            </div>
          )}

          {stats!.series.length > 1 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-sm font-semibold text-gray-900 mb-2">Publicaciones y visitas al blog por día</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={stats!.series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="day" tickFormatter={(d: string) => d.slice(5)} fontSize={11} />
                    <YAxis yAxisId="l" allowDecimals={false} fontSize={11} />
                    <YAxis yAxisId="r" orientation="right" allowDecimals={false} fontSize={11} />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="l" dataKey="published" name="Publicaciones" fill="#C4B5FD" radius={[6, 6, 0, 0]} />
                    <Line yAxisId="r" type="monotone" dataKey="webViews" name="Visitas al blog" stroke="#F97316" strokeWidth={2} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-sm font-semibold text-gray-900 mb-3">Por canal</p>
              {stats!.byChannel.length === 0 ? <p className="text-sm text-gray-500">Sin publicaciones en el periodo.</p> : (
                <ul className="space-y-2">
                  {stats!.byChannel.map((c) => (
                    <li key={c.channel} className="rounded-xl border border-gray-100 p-3">
                      <p className="flex items-center gap-2 text-sm font-medium text-gray-900"><MkChannelIcon channel={c.channel} size={16} />{CHANNEL_NAME[c.channel]} <span className="text-xs font-normal text-gray-500">· {c.publications} publ.</span></p>
                      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                        <Metric label={c.channel === 'WEB' ? 'Visitas' : 'Alcance'} value={num(c.channel === 'WEB' ? c.webViews : c.reach)} />
                        <Metric label="Tasa" value={c.channel === 'WEB' ? '—' : rate(c.engagementRate)} />
                        <Metric label="Conversac." value={num(c.conversations)} strong />
                        <Metric label="Solicitudes" value={num(c.requests)} strong />
                        <Metric label="Reservas" value={num(c.bookings)} strong />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-sm font-semibold text-gray-900 mb-3">Por formato</p>
              {stats!.byFormat.length === 0 ? <p className="text-sm text-gray-500">Sin publicaciones en el periodo.</p> : (
                <ul className="space-y-2">
                  {stats!.byFormat.map((f) => (
                    <li key={`${f.channel}:${f.format}`} className="rounded-xl border border-gray-100 p-3">
                      <p className="flex items-center gap-2 text-sm font-medium text-gray-900"><MkChannelIcon channel={f.channel} size={16} /><FormatPill size="xs" label={f.format} /> <span className="text-xs font-normal text-gray-500">· {f.publications} publ.</span></p>
                      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                        <Metric label={f.channel === 'WEB' ? 'Visitas' : 'Alcance'} value={num(f.channel === 'WEB' ? f.totals.webViews : f.totals.reach)} />
                        <Metric label="Tasa" value={f.channel === 'WEB' ? '—' : rate(f.engagementRate)} />
                        <Metric label="Conversac." value={num(f.outcomes.conversations)} strong />
                        <Metric label="Solicitudes" value={num(f.outcomes.requests)} strong />
                        <Metric label="Reservas" value={num(f.outcomes.bookings)} strong />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {stats!.campaigns.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-sm font-semibold text-gray-900 mb-3">Por campaña</p>
              <ul className="space-y-2">
                {stats!.campaigns.map((c) => (
                  <li key={c.campaignId} className="rounded-xl border border-gray-100 p-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-gray-900"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} /><span className="truncate">{c.name}</span> <span className="shrink-0 text-xs font-normal text-gray-500">· {c.posts} posts</span></p>
                    <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                      <Metric label="Alcance" value={num(c.totals.reach)} />
                      <Metric label="Visitas" value={num(c.totals.webViews)} />
                      <Metric label="Conversac." value={num(c.outcomes.conversations)} strong />
                      <Metric label="Solicitudes" value={num(c.outcomes.requests)} strong />
                      <Metric label="Reservas" value={num(c.outcomes.bookings)} strong />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">Publicaciones <span className="text-xs font-normal text-gray-500">(primero las que trajeron clientes)</span></p>
            {stats!.posts.length === 0 ? <p className="text-sm text-gray-500">Sin publicaciones en el periodo.</p> : (
              <>
                {/* Phones: one card per post */}
                <ul className="space-y-2 md:hidden">
                  {stats!.posts.map((p) => (
                    <li key={p.postId} className="rounded-xl border border-gray-100 p-3">
                      <Link href={`/admin/marketing/posts/${p.postId}`} className="block font-medium text-gray-900 hover:text-primary-700 line-clamp-2">{p.title}</Link>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {p.channels.map((c) => <span key={c} className="inline-flex items-center gap-0.5"><MkChannelIcon channel={c} size={12} /><FormatPill size="xs" label={p.formats?.[c] ?? CHANNEL_NAME[c]} /></span>)}
                        <span className="text-[11px] text-gray-500">{fmtWhen(p.publishedAt)}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <Metric label="Alcance" value={num(p.totals.reach)} />
                        <Metric label="Interacc." value={num(interactions(p.totals))} />
                        <Metric label="Visitas blog" value={num(p.totals.webViews)} />
                        <Metric label="Conversac." value={num(p.outcomes.conversations)} strong />
                        <Metric label="Solicitudes" value={num(p.outcomes.requests)} strong />
                        <Metric label="Reservas" value={num(p.outcomes.bookings)} strong />
                      </div>
                      {p.links.some((l) => l.permalink?.startsWith('https://')) && (
                        <span className="mt-2 flex gap-3">
                          {p.links.filter((l) => l.permalink?.startsWith('https://')).map((l, i) => (
                            <a key={i} href={l.permalink!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-primary-700"><MkChannelIcon channel={l.channel} size={13} />Ver <ExternalLink size={10} /></a>
                          ))}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {/* Wider screens: the table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-xs text-gray-500"><th className="pb-2">Publicación</th><th className="pb-2">Fecha</th><th className="pb-2 text-right">Alcance</th><th className="pb-2 text-right">Interacc.</th><th className="pb-2 text-right">Visitas blog</th><th className="pb-2 text-right" title="Comentarios en la bandeja + chats de WhatsApp desde el enlace de la pieza">Conversac.</th><th className="pb-2 text-right">Solicitudes</th><th className="pb-2 text-right">Reservas</th><th className="pb-2">Enlaces</th></tr></thead>
                    <tbody>
                      {stats!.posts.map((p) => (
                        <tr key={p.postId} className="border-t border-gray-100">
                          <td className="py-2 max-w-[260px]">
                            <Link href={`/admin/marketing/posts/${p.postId}`} className="font-medium text-gray-900 hover:text-primary-700 truncate block">{p.title}</Link>
                            <span className="mt-0.5 flex flex-wrap gap-1.5">{p.channels.map((c) => <span key={c} className="inline-flex items-center gap-0.5"><MkChannelIcon channel={c} size={12} /><FormatPill size="xs" label={p.formats?.[c] ?? CHANNEL_NAME[c]} /></span>)}</span>
                            {p.campaign && <span className="text-[11px] text-gray-500">{p.campaign}</span>}
                          </td>
                          <td className="py-2 text-xs text-gray-500 whitespace-nowrap">{fmtWhen(p.publishedAt)}</td>
                          <td className="py-2 text-right">{num(p.totals.reach)}</td>
                          <td className="py-2 text-right">{num(interactions(p.totals))}</td>
                          <td className="py-2 text-right">{num(p.totals.webViews)}</td>
                          <td className="py-2 text-right font-medium">{num(p.outcomes.conversations)}</td>
                          <td className="py-2 text-right font-medium">{num(p.outcomes.requests)}</td>
                          <td className="py-2 text-right font-medium">{num(p.outcomes.bookings)}</td>
                          <td className="py-2">
                            <span className="flex gap-1.5">
                              {p.links.filter((l) => l.permalink?.startsWith('https://')).map((l, i) => (
                                <a key={i} href={l.permalink!} target="_blank" rel="noopener noreferrer" title={`${CHANNEL_NAME[l.channel]}${l.account ? ` · ${l.account}` : ''}`} className="inline-flex items-center gap-0.5 text-gray-500 hover:text-primary-700">
                                  <MkChannelIcon channel={l.channel} size={14} /><ExternalLink size={10} />
                                </a>
                              ))}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
