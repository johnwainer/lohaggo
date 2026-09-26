'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldCheck, SpellCheck } from 'lucide-react'
import { CHANNEL_NAME, ReviewChip, api, fmtDateTime } from '@/components/admin/marketing/shared'
import { CRITERION_LABEL, PASSING, formatScore, type CriterionId, type ReviewStatus } from '@/lib/marketing/editorial-rubric'
import type { Post, ReviewRow } from '@/components/admin/marketing/editor/types'

const VERDICT: Record<string, { label: string; cls: string }> = {
  approved: { label: 'Aprobada', cls: 'text-emerald-700' },
  changes: { label: 'Pide cambios', cls: 'text-amber-700' },
  rejected: { label: 'Rechazada', cls: 'text-rose-700' },
  error: { label: 'No se pudo hacer', cls: 'text-rose-700' },
  corrected: { label: 'Corrigió', cls: 'text-emerald-700' },
  clean: { label: 'Sin errores', cls: 'text-emerald-700' },
}
const TRIGGER: Record<string, string> = { agent: 'al redactar', manual: 'a pedido', publish: 'al aprobar o publicar' }
const FIELD: Record<string, string> = { title: 'Título', body: 'Texto', seoTitle: 'Título SEO', seoDescription: 'Descripción SEO', excerpt: 'Resumen' }

function fieldLabel(key: string) {
  if (key === 'title') return 'Título'
  if (key.startsWith('media.')) return 'Texto alternativo'
  const [ch, f] = key.split('.')
  return `${CHANNEL_NAME[ch as keyof typeof CHANNEL_NAME] ?? ch} · ${FIELD[f] ?? f}`
}

/**
 * The editorial review of this post: the editor's verdict and scores per round, the proofreader's
 * corrections (before → after), and the buttons to run it again, only proofread, or approve anyway.
 */
export default function ReviewPanel({ post, reviews, canEdit, canPublish, beforeAction, onDone }: {
  post: Post
  reviews: ReviewRow[]
  canEdit: boolean
  canPublish: boolean
  /** Saves pending edits first; null = the save failed */
  beforeAction: () => Promise<unknown>
  onDone: (d: { post: Post; reviews: ReviewRow[]; message: string }) => void
}) {
  const [busy, setBusy] = useState<'review' | 'spelling' | 'override' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const closed = ['publishing', 'published', 'partial', 'archived'].includes(post.status)
  const status = post.reviewStatus ?? null
  const editorRows = useMemo(() => reviews.filter((r) => r.reviewer === 'editor'), [reviews])
  const last = editorRows[0] ?? null
  // The rounds of the last review: the editor's passes back to the latest round 0
  const rounds = useMemo(() => {
    const out: ReviewRow[] = []
    for (const r of editorRows) { out.push(r); if (r.round === 0) break }
    return out.reverse()
  }, [editorRows])
  const spelling = reviews.filter((r) => r.reviewer === 'spelling')
  const lastSpelling = spelling[0] ?? null
  const corrections = spelling.filter((r) => r.changes?.length).slice(0, 3).flatMap((r) => (r.changes ?? []).map((c) => ({ ...c, at: r.createdAt })))
  const cost = reviews.reduce((n, r) => n + r.costUsd, 0)

  async function run(action: 'review' | 'spelling' | 'override') {
    if (action === 'override' && !window.confirm('Apruebas estos textos exactos aunque la revisión editorial no los aprobó. Queda registrado a tu nombre. ¿Continuar?')) return
    setBusy(action)
    setError(null)
    try {
      if ((await beforeAction()) === null) return
      const d = await api<{ post: Post; reviews: ReviewRow[]; message: string }>(`/api/admin/marketing/posts/${post.id}/review`, { method: 'POST', json: { action } })
      onDone(d)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="flex items-center gap-2 text-sm font-semibold text-gray-900"><ShieldCheck size={16} className="text-primary-600" /> Revisión editorial</p>
        <ReviewChip status={status} score={post.reviewScore} />
      </div>

      {!status && !reviews.length && <p className="text-xs text-gray-500">Aún no se ha revisado. Las piezas del agente se revisan solas al redactarse; esta puedes revisarla con los botones de abajo.</p>}
      {status === 'stale' && <p className="flex gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> Cambió después de la revisión: se revisa otra vez al aprobarla o publicarla, o ahora con «Volver a revisar».</p>}
      {status === 'overridden' && <p className="rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-800">Una persona la aprobó sin la revisión para estos textos exactos. Si se edita, vuelve a necesitar revisión.</p>}
      {status === 'failed' && <p className="flex gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-800"><AlertTriangle size={13} className="mt-0.5 shrink-0" /> La revisión no se pudo hacer{last?.error ? `: ${last.error}` : lastSpelling?.error ? `: ${lastSpelling.error}` : ''}. No sale hasta revisarla.</p>}

      {last && last.verdict !== 'error' && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className={`text-sm font-semibold ${VERDICT[last.verdict]?.cls ?? ''}`}>Editor: {VERDICT[last.verdict]?.label ?? last.verdict}</p>
            {last.score != null && <p className="text-lg font-bold tabular-nums text-gray-900">{formatScore(last.score)}<span className="text-xs font-normal text-gray-400">/10</span></p>}
          </div>
          {last.summary && <p className="text-xs text-gray-700">{last.summary}</p>}
          {last.scores?.length ? (
            <ul className="space-y-1.5">
              {last.scores.map((s) => (
                <li key={s.id} className="text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-32 shrink-0 text-gray-600">{CRITERION_LABEL[s.id as CriterionId] ?? s.id}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100"><span className={`block h-full rounded-full ${s.score >= 8 ? 'bg-emerald-500' : s.score >= 6 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${s.score * 10}%` }} /></span>
                    <span className="w-7 text-right tabular-nums text-gray-700">{formatScore(s.score)}</span>
                  </div>
                  {s.comment && <p className="ml-[8.5rem] text-[11px] text-gray-500">{s.comment}</p>}
                </li>
              ))}
            </ul>
          ) : null}
          {last.instructions?.length ? (
            <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 space-y-1">
              <p className="font-semibold">Lo que pide</p>
              {last.instructions.map((i, n) => <p key={n}>• {i.channel ? `${CHANNEL_NAME[i.channel]}: ` : ''}{i.change}{i.reason ? <span className="text-amber-700"> ({i.reason})</span> : null}</p>)}
            </div>
          ) : null}
        </div>
      )}

      {rounds.length > 1 && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Rondas con el agente</p>
          {rounds.map((r) => (
            <p key={r.id} className="flex items-center gap-2 text-xs">
              <span className="text-gray-500">Versión {r.round + 1}</span>
              <span className={VERDICT[r.verdict]?.cls}>{VERDICT[r.verdict]?.label ?? r.verdict}</span>
              {r.score != null && <span className="tabular-nums text-gray-700">{formatScore(r.score)}/10</span>}
            </p>
          ))}
        </div>
      )}

      {corrections.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400"><SpellCheck size={12} /> Correcciones de ortografía</p>
          <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
            {corrections.map((c, n) => (
              <li key={n} className="text-xs">
                <span className="text-[11px] text-gray-400">{fieldLabel(c.field)}{c.reason ? ` · ${c.reason}` : ''}</span>
                <p className="break-words"><del className="rounded bg-rose-50 px-1 text-rose-700">{c.original}</del> → <ins className="rounded bg-emerald-50 px-1 no-underline text-emerald-800">{c.corrected}</ins></p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {lastSpelling && !corrections.length && lastSpelling.verdict === 'clean' && <p className="flex items-center gap-1.5 text-xs text-emerald-700"><CheckCircle2 size={13} /> Sin errores de ortografía</p>}

      {!closed && (canEdit || canPublish) && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {canEdit && (
            <button onClick={() => run('review')} disabled={Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-full border border-primary-300 bg-white px-3 py-1.5 text-xs font-semibold text-primary-700 disabled:opacity-50">
              {busy === 'review' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Volver a revisar
            </button>
          )}
          {canEdit && (
            <button onClick={() => run('spelling')} disabled={Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-50">
              {busy === 'spelling' ? <Loader2 size={13} className="animate-spin" /> : <SpellCheck size={13} />} Revisar ortografía
            </button>
          )}
          {canPublish && status && !PASSING.includes(status as ReviewStatus) && status !== 'pending' && (
            <button onClick={() => run('override')} disabled={Boolean(busy)} className="inline-flex items-center gap-1 text-xs text-violet-700 hover:underline disabled:opacity-50">
              {busy === 'override' ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />} Aprobar de todos modos
            </button>
          )}
        </div>
      )}
      {busy === 'review' && <p className="text-[11px] text-gray-500">Revisando (hasta 1 minuto). La ortografía se corrige en el texto.</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {(last || lastSpelling) && (
        <p className="text-[11px] text-gray-400">
          Última: {fmtDateTime((last ?? lastSpelling)!.createdAt)} · {TRIGGER[(last ?? lastSpelling)!.trigger] ?? ''}{cost > 0 ? ` · costo total US$${cost.toFixed(3)}` : ''}
        </p>
      )}
    </div>
  )
}
