'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarCheck, ExternalLink, FileText, Loader2, RotateCcw, Send, Sparkles, Target, Check, XCircle } from 'lucide-react'
import { ARTICLE_KINDS, KIND_LABEL, type OpportunityKind } from '@/lib/seo/agent/types'
import type { SeoOpportunityView } from '@/lib/seo/agent/views'
import BriefDialog from './BriefDialog'
import { LEVEL_CLS, LEVEL_LABEL, card, fmtWhen, inputCls, nf, seoApi } from './shared'

const STATUS_TABS = [
  { key: 'open', label: 'Abiertas', count: 'open' },
  { key: 'briefed', label: 'Con brief', count: 'briefed' },
  { key: 'sent', label: 'En marketing', count: 'sent' },
  { key: 'done', label: 'Resueltas', count: 'done' },
  { key: 'dismissed', label: 'Descartadas', count: 'dismissed' },
] as const

const isArticle = (k: string) => (ARTICLE_KINDS as string[]).includes(k)
const kindLabel = (k: string) => KIND_LABEL[k as OpportunityKind] ?? k

const EVIDENCE_LABEL: Record<string, string> = { clicks: 'Clics', impressions: 'Impresiones', position: 'Posición', ctr: 'CTR', query: 'Búsqueda', searches: 'Búsquedas', words: 'Palabras', days: 'Días', page: 'Página', pages: 'Páginas', status: 'Estado' }

function evidenceItems(ev: unknown): Array<[string, string]> {
  if (!ev || typeof ev !== 'object' || Array.isArray(ev)) return []
  const out: Array<[string, string]> = []
  for (const [k, v] of Object.entries(ev as Record<string, unknown>)) {
    let text: string | null = null
    if (typeof v === 'number') text = Number.isInteger(v) ? nf(v) : String(Math.round(v * 100) / 100)
    else if (typeof v === 'string' && v.length <= 90) text = v
    else if (typeof v === 'boolean') text = v ? 'sí' : 'no'
    else if (Array.isArray(v) && v.length && v.every((x) => typeof x === 'string' || typeof x === 'number')) text = v.slice(0, 4).join(', ') + (v.length > 4 ? '…' : '')
    if (text) out.push([EVIDENCE_LABEL[k] ?? k.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()), text])
    if (out.length >= 5) break
  }
  return out
}

function OpportunityCard({ o, agentId, onChanged }: { o: SeoOpportunityView; agentId: string | null; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dismissing, setDismissing] = useState(false)
  const [reason, setReason] = useState('')
  const [showBrief, setShowBrief] = useState(false)
  const article = isArticle(o.kind)
  const evidence = evidenceItems(o.evidence)
  const closed = o.status === 'done' || o.status === 'dismissed'

  async function act(action: 'brief' | 'send' | 'dismiss' | 'done' | 'reopen') {
    setBusy(action); setError(null)
    try {
      await seoApi(`/api/admin/seo/opportunities/${o.id}`, { json: { action, ...(action === 'dismiss' ? { reason: reason.trim() || null } : {}) } })
      setDismissing(false); setReason('')
      await onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la acción')
    } finally {
      setBusy(null)
    }
  }

  const btn = 'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full px-3.5 text-sm font-medium disabled:opacity-50 sm:min-h-[36px]'
  const solid = `${btn} bg-primary-600 text-white hover:bg-primary-700`
  const line = `${btn} border border-gray-200 bg-white text-gray-700 hover:bg-gray-50`
  const spin = (a: string) => busy === a && <Loader2 size={15} className="animate-spin" />

  return (
    <li className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-[11px] font-semibold text-primary-700">{kindLabel(o.kind)}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${LEVEL_CLS[o.impact] ?? LEVEL_CLS.low}`}>Impacto {LEVEL_LABEL[o.impact] ?? o.impact}</span>
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-700">Esfuerzo {LEVEL_LABEL[o.effort] ?? o.effort}</span>
        <span className="ml-auto text-xs text-gray-400" title="Puntaje de prioridad">{Math.round(o.score)} pts</span>
      </div>
      <h3 className="mt-2 break-words text-sm font-bold text-gray-900">{o.title}</h3>
      {o.detail && <p className="mt-1 whitespace-pre-line break-words text-sm text-gray-600">{o.detail}</p>}
      <div className="mt-2 space-y-1 text-xs text-gray-600">
        {o.targetUrl && <p className="flex items-start gap-1.5"><ExternalLink size={13} className="mt-0.5 shrink-0 text-gray-400" /><a href={o.targetUrl} target="_blank" rel="noreferrer" className="min-w-0 break-all text-primary-700 hover:underline">{o.targetUrl}</a></p>}
        {o.keyword && <p className="flex items-start gap-1.5"><Target size={13} className="mt-0.5 shrink-0 text-gray-400" /><span className="min-w-0 break-words">Palabra clave: <strong className="font-semibold text-gray-800">{o.keyword}</strong></span></p>}
      </div>
      {evidence.length > 0 && (
        <dl className="mt-2 flex flex-wrap gap-1.5">
          {evidence.map(([k, v]) => <div key={k} className="rounded-lg bg-gray-50 px-2 py-1 text-xs"><dt className="inline text-gray-500">{k}: </dt><dd className="inline break-words font-medium text-gray-800">{v}</dd></div>)}
        </dl>
      )}
      {o.status === 'dismissed' && o.dismissedReason && <p className="mt-2 break-words text-xs text-gray-500">Motivo: {o.dismissedReason}</p>}
      {o.resolvedAt && closed && <p className="mt-1 text-xs text-gray-400">{o.status === 'done' ? 'Resuelta' : 'Descartada'} el {fmtWhen(o.resolvedAt)}</p>}

      {dismissing && (
        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <label htmlFor={`why-${o.id}`} className="text-xs font-medium text-gray-700">Motivo (opcional)</label>
          <input id={`why-${o.id}`} className={`${inputCls} mt-1`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Por qué no se hará" autoFocus />
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={() => act('dismiss')} disabled={busy !== null} className={solid}>{spin('dismiss')} Descartar</button>
            <button onClick={() => { setDismissing(false); setReason('') }} disabled={busy !== null} className={line}>Cancelar</button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-2 break-words rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
      {busy === 'brief' && <p className="mt-2 text-xs text-gray-500" role="status">Escribiendo el brief con IA. Puede tardar hasta un par de minutos.</p>}

      {!dismissing && (
        <div className="mt-3 flex flex-wrap gap-2">
          {o.status === 'open' && article && <button onClick={() => act('brief')} disabled={busy !== null} className={solid}>{spin('brief') || <Sparkles size={15} />} {busy === 'brief' ? 'Escribiendo…' : 'Generar brief'}</button>}
          {o.brief && <button onClick={() => setShowBrief(true)} className={line}><FileText size={15} /> Ver brief</button>}
          {o.status === 'briefed' && article && !o.marketingIdeaId && <button onClick={() => act('send')} disabled={busy !== null} className={solid}>{spin('send') || <Send size={15} />} Enviar a marketing</button>}
          {o.marketingIdeaId && (agentId
            ? <Link href={`/admin/marketing?agente=${agentId}`} className={`${btn} bg-emerald-50 text-emerald-800 hover:bg-emerald-100`}><CalendarCheck size={15} /> En el calendario de marketing</Link>
            : <span className={`${btn} bg-emerald-50 text-emerald-800`}><CalendarCheck size={15} /> En el calendario de marketing</span>)}
          {!closed && <button onClick={() => act('done')} disabled={busy !== null} className={line}>{spin('done') || <Check size={15} />} Marcar hecha</button>}
          {!closed && <button onClick={() => setDismissing(true)} disabled={busy !== null} className={line}><XCircle size={15} /> Descartar</button>}
          {closed && <button onClick={() => act('reopen')} disabled={busy !== null} className={line}>{spin('reopen') || <RotateCcw size={15} />} Reabrir</button>}
        </div>
      )}
      {showBrief && o.brief && <BriefDialog title={o.title} brief={o.brief} onClose={() => setShowBrief(false)} />}
    </li>
  )
}

export default function OpportunitiesSection({ items, counts, agentId, tablesReady, onChanged }: {
  items: SeoOpportunityView[]
  counts: Record<'open' | 'briefed' | 'sent' | 'done' | 'dismissed', number>
  agentId: string | null
  tablesReady: boolean
  onChanged: () => Promise<void>
}) {
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]['key']>('open')
  const [kind, setKind] = useState('')
  const kinds = useMemo(() => Array.from(new Set(items.map((o) => o.kind))).sort((a, b) => kindLabel(a).localeCompare(kindLabel(b), 'es')), [items])
  const shown = useMemo(() => items.filter((o) => o.status === status && (!kind || o.kind === kind)).sort((a, b) => b.score - a.score), [items, status, kind])

  return (
    <section className={card} aria-labelledby="seo-opps">
      <h2 id="seo-opps" className="text-base font-bold text-gray-900">Oportunidades</h2>
      <p className="mt-0.5 text-xs text-gray-500">Cosas que el agente encontró para atraer más clientes desde Google, las más importantes primero.</p>
      {!tablesReady ? <p className="mt-3 text-sm text-gray-500">Aparecerán aquí cuando se aplique el SQL del agente.</p> : (
        <>
          <div role="tablist" aria-label="Estado" className="mt-3 flex gap-1 overflow-x-auto rounded-2xl bg-gray-100 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {STATUS_TABS.map((t) => (
              <button key={t.key} role="tab" aria-selected={status === t.key} onClick={() => setStatus(t.key)} className={`min-h-[44px] shrink-0 whitespace-nowrap rounded-xl px-3 text-sm font-medium sm:min-h-[36px] ${status === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                {t.label} <span className="ml-0.5 text-xs text-gray-500">{counts[t.count]}</span>
              </button>
            ))}
          </div>
          <div className="mt-3">
            <label htmlFor="seo-kind" className="sr-only">Filtrar por tipo</label>
            <select id="seo-kind" value={kind} onChange={(e) => setKind(e.target.value)} className={`${inputCls} sm:w-auto sm:min-w-[14rem]`}>
              <option value="">Todos los tipos</option>
              {kinds.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}
            </select>
          </div>
          {(status === 'done' || status === 'dismissed') && <p className="mt-2 text-xs text-gray-400">Se muestran las de los últimos 14 días.</p>}
          {shown.length === 0 ? <p className="mt-4 rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">No hay oportunidades en esta vista.</p> : (
            <ul className="mt-3 space-y-3">{shown.map((o) => <OpportunityCard key={o.id} o={o} agentId={agentId} onChanged={onChanged} />)}</ul>
          )}
        </>
      )}
    </section>
  )
}
