'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Loader2 } from 'lucide-react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHANNEL_NAME, MK_CHANNELS, MkChannelIcon, api, fmtDate, num, type MkChannel } from '@/components/admin/marketing/shared'
import type { Campaign } from '@/components/admin/marketing/CampaignsTab'

type Totals = { reach: number; impressions: number; likes: number; comments: number; shares: number; saves: number; clicks: number; videoViews: number; webViews: number }
type Stats = {
  totals: Totals & { engagementRate: number | null; publications: number; posts: number }
  byChannel: Array<Totals & { channel: MkChannel; publications: number; engagementRate: number | null }>
  posts: Array<{ postId: string; title: string; campaign: string | null; channels: MkChannel[]; totals: Totals; engagementRate: number | null; inboxConversations: number; publishedAt: string | null; links: Array<{ channel: MkChannel; account: string | null; permalink: string | null }> }>
  campaigns: Array<{ campaignId: string; name: string; color: string; posts: number; totals: Totals; engagementRate: number | null }>
  series: Array<{ day: string; webViews: number; published: number }>
}

const RANGES = [['7', 'Últimos 7 días'], ['30', 'Últimos 30 días'], ['90', 'Últimos 90 días']] as const
const iso = (d: Date) => d.toISOString().slice(0, 10)
const interactions = (t: Totals) => t.likes + t.comments + t.shares + t.saves

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
    ['Publicaciones', num(t.publications), `${num(t.posts)} contenidos`],
    ['Alcance', num(t.reach), 'Personas únicas en redes'],
    ['Impresiones / vistas', num(t.impressions)],
    ['Interacciones', num(interactions(t)), `${num(t.likes)} reacciones · ${num(t.comments)} comentarios`],
    ['Tasa de interacción', t.engagementRate == null ? '—' : `${t.engagementRate}%`, 'Interacciones + clics / alcance'],
    ['Clics', num(t.clicks)],
    ['Visitas al blog', num(t.webViews)],
    ['Reproducciones de video', num(t.videoViews)],
  ] : []

  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap items-center">
        <select className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" value={range} onChange={(e) => setRange(e.target.value)}>{RANGES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" value={channel} onChange={(e) => setChannel(e.target.value)}>
          <option value="">Todos los canales</option>{MK_CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_NAME[c]}</option>)}
        </select>
        <select className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
          <option value="">Todas las campañas</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {loading && <Loader2 size={16} className="animate-spin text-gray-400" />}
      </div>
      <p className="text-xs text-gray-500">Las métricas de Facebook e Instagram se actualizan cada hora los primeros dos días, luego cada 6 horas y a diario hasta los 30 días. Las visitas del blog se cuentan en tiempo real, sin cookies.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {t && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kpis.map(([label, value, hint]) => (
              <div key={label} className="rounded-2xl border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
                {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
              </div>
            ))}
          </div>

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
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-gray-500"><th className="pb-2">Canal</th><th className="pb-2 text-right">Publ.</th><th className="pb-2 text-right">Alcance</th><th className="pb-2 text-right">Interacc.</th><th className="pb-2 text-right">Tasa</th></tr></thead>
                  <tbody>
                    {stats!.byChannel.map((c) => (
                      <tr key={c.channel} className="border-t border-gray-100">
                        <td className="py-2"><span className="inline-flex items-center gap-2"><MkChannelIcon channel={c.channel} size={16} />{CHANNEL_NAME[c.channel]}</span></td>
                        <td className="py-2 text-right">{c.publications}</td>
                        <td className="py-2 text-right">{c.channel === 'WEB' ? `${num(c.webViews)} visitas` : num(c.reach)}</td>
                        <td className="py-2 text-right">{c.channel === 'WEB' ? '—' : num(interactions(c))}</td>
                        <td className="py-2 text-right">{c.engagementRate == null ? '—' : `${c.engagementRate}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-sm font-semibold text-gray-900 mb-3">Por campaña</p>
              {stats!.campaigns.length === 0 ? <p className="text-sm text-gray-500">Ninguna publicación del periodo pertenece a una campaña.</p> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-gray-500"><th className="pb-2">Campaña</th><th className="pb-2 text-right">Posts</th><th className="pb-2 text-right">Alcance</th><th className="pb-2 text-right">Visitas</th><th className="pb-2 text-right">Tasa</th></tr></thead>
                  <tbody>
                    {stats!.campaigns.map((c) => (
                      <tr key={c.campaignId} className="border-t border-gray-100">
                        <td className="py-2"><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />{c.name}</span></td>
                        <td className="py-2 text-right">{c.posts}</td>
                        <td className="py-2 text-right">{num(c.totals.reach)}</td>
                        <td className="py-2 text-right">{num(c.totals.webViews)}</td>
                        <td className="py-2 text-right">{c.engagementRate == null ? '—' : `${c.engagementRate}%`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 overflow-x-auto">
            <p className="text-sm font-semibold text-gray-900 mb-3">Publicaciones</p>
            {stats!.posts.length === 0 ? <p className="text-sm text-gray-500">Sin publicaciones en el periodo.</p> : (
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr className="text-left text-xs text-gray-500"><th className="pb-2">Publicación</th><th className="pb-2">Fecha</th><th className="pb-2 text-right">Alcance</th><th className="pb-2 text-right">Interacc.</th><th className="pb-2 text-right">Clics</th><th className="pb-2 text-right">Visitas blog</th><th className="pb-2 text-right">En bandeja</th><th className="pb-2">Enlaces</th></tr></thead>
                <tbody>
                  {stats!.posts.map((p) => (
                    <tr key={p.postId} className="border-t border-gray-100">
                      <td className="py-2 max-w-[260px]">
                        <Link href={`/admin/marketing/posts/${p.postId}`} className="font-medium text-gray-900 hover:text-primary-700 truncate block">{p.title}</Link>
                        {p.campaign && <span className="text-[11px] text-gray-500">{p.campaign}</span>}
                      </td>
                      <td className="py-2 text-xs text-gray-500">{fmtDate(p.publishedAt)}</td>
                      <td className="py-2 text-right">{num(p.totals.reach)}</td>
                      <td className="py-2 text-right">{num(interactions(p.totals))}</td>
                      <td className="py-2 text-right">{num(p.totals.clicks)}</td>
                      <td className="py-2 text-right">{num(p.totals.webViews)}</td>
                      <td className="py-2 text-right" title="Conversaciones de comentarios abiertas en la bandeja">{p.inboxConversations}</td>
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
            )}
          </div>
        </>
      )}
    </div>
  )
}
