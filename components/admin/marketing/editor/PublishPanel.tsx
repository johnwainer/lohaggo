'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CalendarClock, ExternalLink, Loader2, Send, XCircle } from 'lucide-react'
import { CHANNEL_NAME, MkChannelIcon, PUB_STATUS, fmtDateTime, fromLocalInput, num, toLocalInput, type Account, type MkChannel } from '@/components/admin/marketing/shared'
import type { Post, Validation } from '@/components/admin/marketing/editor/types'

type Target = { channel: MkChannel; connectionId: string | null }
const key = (t: Target) => `${t.channel}:${t.connectionId || 'web'}`

export default function PublishPanel({ post, accounts, validations, canPublish, busy, issues, onPublish }: {
  post: Post
  accounts: Account[]
  validations: Partial<Record<MkChannel, Validation>>
  canPublish: boolean
  busy: boolean
  issues: Array<{ channel: string; account?: string; message: string }> | null
  onPublish: (mode: 'now' | 'schedule' | 'cancel' | 'unpublish', targets: Target[], when?: string) => void
}) {
  const channels = post.variants.map((v) => v.channel)
  const options = useMemo(() => {
    const list: Array<Target & { label: string; problem: string | null }> = []
    if (channels.includes('WEB')) list.push({ channel: 'WEB', connectionId: null, label: 'Blog de lohaggo.com', problem: null })
    for (const a of accounts) if (channels.includes(a.channel)) list.push({ channel: a.channel, connectionId: a.id, label: a.name, problem: a.problem })
    return list
  }, [accounts, channels])

  const published = new Set(post.publications.filter((p) => p.status === 'published').map((p) => key({ channel: p.channel, connectionId: p.connection?.id ?? null })))
  const [selected, setSelected] = useState<string[]>([])
  useEffect(() => {
    // Default: every healthy account not published yet
    setSelected(options.filter((o) => !o.problem && !published.has(key(o))).map(key))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length])
  const [when, setWhen] = useState(() => toLocalInput(post.scheduledAt && new Date(post.scheduledAt) > new Date() ? post.scheduledAt : new Date(Date.now() + 3600_000)))

  const targets = options.filter((o) => selected.includes(key(o))).map(({ channel, connectionId }) => ({ channel, connectionId }))
  const blocking = targets.flatMap((t) => (validations[t.channel]?.errors || []).map((e) => `${CHANNEL_NAME[t.channel]}: ${e.message}`))
  const uniqueBlocking = Array.from(new Set(blocking))
  const scheduled = post.publications.filter((p) => p.status === 'scheduled')
  const webLive = post.variants.find((v) => v.channel === 'WEB')?.webPublishedAt

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
      <p className="text-sm font-semibold text-gray-900">Publicar</p>
      {options.length === 0 ? (
        <p className="text-xs text-gray-500">Añade un canal y conecta cuentas en <Link href="/admin/channels" className="underline">Admin → Canales</Link>.</p>
      ) : (
        <div className="space-y-1.5">
          {options.map((o) => {
            const k = key(o)
            const done = published.has(k)
            return (
              <label key={k} className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${o.problem ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200'}`}>
                <input type="checkbox" className="mt-0.5" disabled={!canPublish || !!o.problem} checked={selected.includes(k)} onChange={() => setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))} />
                <MkChannelIcon channel={o.channel} size={16} />
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-gray-900">{o.label}</span>
                  {o.problem && <span className="block text-[11px] text-amber-800">{o.problem}</span>}
                  {done && !o.problem && <span className="block text-[11px] text-emerald-700">Ya publicada aquí: marcarla la publica otra vez</span>}
                </span>
              </label>
            )
          })}
        </div>
      )}

      {uniqueBlocking.length > 0 && (
        <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 space-y-0.5">
          {uniqueBlocking.map((b) => <p key={b} className="flex gap-1"><AlertCircle size={12} className="mt-0.5 shrink-0" /> {b}</p>)}
        </div>
      )}
      {issues && issues.length > 0 && (
        <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 space-y-0.5">
          {issues.map((i, n) => <p key={n}>{i.channel}{i.account ? ` (${i.account})` : ''}: {i.message}</p>)}
        </div>
      )}

      {canPublish ? (
        <div className="space-y-2">
          <button
            onClick={() => onPublish('now', targets)}
            disabled={busy || !targets.length || uniqueBlocking.length > 0}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Publicar ahora
          </button>
          <div className="flex gap-2">
            <input type="datetime-local" className="flex-1 min-w-0 rounded-xl border border-gray-200 px-2 py-2 text-sm" value={when} onChange={(e) => setWhen(e.target.value)} />
            <button
              onClick={() => { const d = fromLocalInput(when); if (d) onPublish('schedule', targets, d.toISOString()) }}
              disabled={busy || !targets.length || uniqueBlocking.length > 0 || !when}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 px-3 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-50 disabled:opacity-50"
            >
              <CalendarClock size={15} /> Programar
            </button>
          </div>
          <p className="text-[11px] text-gray-500">Hora de Bogotá. Antes de salir se valida otra vez cada canal; si una red falla por algo pasajero se reintenta sola hasta 3 veces.</p>
        </div>
      ) : (
        <p className="text-xs text-gray-500">No tienes permiso para publicar. Déjala «En revisión» para que alguien con permiso la apruebe y la publique.</p>
      )}

      {(post.publications.length > 0 || webLive) && (
        <div className="space-y-2 border-t border-gray-100 pt-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-700">Envíos</p>
            {canPublish && scheduled.length > 0 && <button onClick={() => onPublish('cancel', [])} disabled={busy} className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:underline"><XCircle size={12} /> Cancelar programación</button>}
          </div>
          {post.publications.map((p) => {
            // A failed attempt later re-sent to the same account is history, not a problem
            const superseded = p.status !== 'published' && post.publications.some((o) => o.id !== p.id && o.channel === p.channel && (o.connection?.id ?? null) === (p.connection?.id ?? null) && new Date(o.scheduledAt) >= new Date(p.scheduledAt) && o.status !== 'failed')
            return (
            <div key={p.id} className={`rounded-xl bg-gray-50 px-3 py-2 text-xs space-y-1 ${superseded ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-2">
                <MkChannelIcon channel={p.channel} size={14} />
                <span className="flex-1 truncate text-gray-800">{p.connection?.name || CHANNEL_NAME[p.channel]}</span>
                <span className={superseded ? 'text-gray-500' : PUB_STATUS[p.status]?.cls || 'text-gray-500'}>{superseded ? 'Reemplazado por un envío posterior' : PUB_STATUS[p.status]?.label || p.status}</span>
              </div>
              <p className="text-gray-500">
                {p.status === 'published' ? fmtDateTime(p.publishedAt) : `Para ${fmtDateTime(p.scheduledAt)}`}{p.attempts > 1 ? ` · intento ${p.attempts}` : ''}
                {p.permalink?.startsWith('https://') && <> · <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-primary-700 hover:underline">Ver <ExternalLink size={10} /></a></>}
              </p>
              {p.lastError && p.status !== 'published' && <p className={superseded ? 'text-gray-500' : 'text-red-600'}>{p.lastError}</p>}
              {p.metrics && (
                <p className="text-gray-600">
                  {num(p.metrics.reach)} alcance · {num(p.metrics.likes)} reacciones · {num(p.metrics.comments)} comentarios · {num(p.metrics.shares)} compartidos{p.metrics.saves ? ` · ${num(p.metrics.saves)} guardados` : ''}{p.metrics.clicks ? ` · ${num(p.metrics.clicks)} clics` : ''}
                </p>
              )}
              {p.channel === 'WEB' && p.status === 'published' && (
                <p className="text-gray-600">{num(post.variants.find((v) => v.channel === 'WEB')?.webViews ?? 0)} visitas</p>
              )}
            </div>
            )
          })}
          {canPublish && webLive && (
            <button onClick={() => { if (window.confirm('¿Quitar el artículo del sitio? Dejará de estar en el blog y en el sitemap.')) onPublish('unpublish', []) }} disabled={busy} className="text-[11px] text-red-600 hover:underline">Despublicar del sitio</button>
          )}
        </div>
      )}
    </div>
  )
}
