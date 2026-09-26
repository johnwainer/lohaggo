'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { api, fmtDateTime, input } from '@/components/admin/marketing/shared'
import { OPENAI_STATIC_MODELS, STATIC_MODELS } from '@/lib/ai/models'
import {
  CRITERIA,
  DEFAULT_EDITORIAL,
  LOCALES,
  MAX_ROUNDS,
  SCOPES,
  STRICTNESS,
  TREATMENTS,
  formatScore,
  type EditorialSettings,
} from '@/lib/marketing/editorial-rubric'

type Stats = {
  reviewed: number
  firstPass: number
  firstApproved: number
  avgRounds: number
  correctionsPerPiece: number
  avgScore: number | null
  errors: number
  reasons: Array<{ id: string; label: string; n: number }>
  costUsd: number
  recent: Array<{ id: string; postId: string; title: string; reviewer: string; verdict: string; score: number | null; round: number; trigger: string; summary: string | null; error: string | null; costUsd: number; createdAt: string; corrections: number }>
}

const VERDICT: Record<string, string> = { approved: 'Aprobada', changes: 'Pide cambios', rejected: 'Rechazada', error: 'Falló', corrected: 'Corrigió', clean: 'Sin errores' }
const MODELS = [...STATIC_MODELS, ...OPENAI_STATIC_MODELS]

function Toggle({ on, onChange, disabled, label, help }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string; help?: string }) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <input type="checkbox" className="mt-1 h-4 w-4 accent-primary-600" checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span><span className="block text-sm font-medium text-gray-900">{label}</span>{help && <span className="block text-xs text-gray-500">{help}</span>}</span>
    </label>
  )
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{value}</p>
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </div>
  )
}

/** Ajustes → Revisión editorial: the two reviewers of the workspace and how they did in the last 30 days. */
export default function EditorialTab({ workspaces }: { workspaces: Array<{ id: string; name: string }> }) {
  const [wsId, setWsId] = useState(workspaces[0]?.id || '')
  const [s, setS] = useState<EditorialSettings>(DEFAULT_EDITORIAL)
  const [saved, setSaved] = useState<EditorialSettings>(DEFAULT_EDITORIAL)
  const [stats, setStats] = useState<Stats | null>(null)
  const [defaults, setDefaults] = useState<{ editorModel: string; spellingModel: string } | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [words, setWords] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    if (!wsId) return
    const d = await api<{ settings: EditorialSettings; stats: Stats; defaults: { editorModel: string; spellingModel: string }; canEdit: boolean }>(`/api/admin/marketing/editorial?workspaceId=${wsId}`)
    setS(d.settings)
    setSaved(d.settings)
    setWords(d.settings.neverCorrect.join(', '))
    setStats(d.stats)
    setDefaults(d.defaults)
    setCanEdit(d.canEdit)
  }, [wsId])
  useEffect(() => { load().catch((e) => setMsg({ ok: false, text: e.message })) }, [load])

  const set = (patch: Partial<EditorialSettings>) => setS((x) => ({ ...x, ...patch }))
  const setCriterion = (id: string, patch: { weight?: number; enabled?: boolean }) => set({ rubric: s.rubric.map((r) => (r.id === id ? { ...r, ...patch } : r)) })
  const neverCorrect = words.split(',').map((w) => w.trim()).filter(Boolean)
  const dirty = JSON.stringify({ ...s, neverCorrect }) !== JSON.stringify(saved)

  async function save() {
    setBusy(true)
    setMsg(null)
    try {
      const d = await api<{ settings: EditorialSettings }>('/api/admin/marketing/editorial', { method: 'PUT', json: { workspaceId: wsId, settings: { ...s, neverCorrect } } })
      setS(d.settings)
      setSaved(d.settings)
      setWords(d.settings.neverCorrect.join(', '))
      setMsg({ ok: true, text: 'Revisión editorial guardada.' })
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Error' })
    } finally {
      setBusy(false)
    }
  }

  const ro = !canEdit
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : '—')

  return (
    <div className="space-y-5">
      {msg && <div className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>{msg.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />} {msg.text}</div>}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-600 max-w-3xl">Antes de que salga una pieza, un <strong>corrector</strong> arregla la ortografía y un <strong>editor experto</strong> la califica. Si el editor pide cambios, el agente la reescribe; si tras las rondas no la aprueba, queda para una persona.</p>
        {workspaces.length > 1 && <select className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm" value={wsId} onChange={(e) => setWsId(e.target.value)}>{workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>}
      </div>

      {stats && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Últimos 30 días</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Piezas revisadas" value={String(stats.reviewed)} />
            <Kpi label="Aprobadas a la primera" value={pct(stats.firstApproved, stats.firstPass)} hint={`${stats.firstApproved} de ${stats.firstPass}`} />
            <Kpi label="Rondas promedio" value={stats.avgRounds.toFixed(1).replace('.', ',')} hint="Reescrituras por pieza" />
            <Kpi label="Correcciones por pieza" value={stats.correctionsPerPiece.toFixed(1).replace('.', ',')} />
            <Kpi label="Puntaje promedio" value={stats.avgScore != null ? formatScore(Math.round(stats.avgScore * 10) / 10) : '—'} hint="Del editor, sobre 10" />
            <Kpi label="Costo" value={`US$${stats.costUsd.toFixed(2)}`} hint={stats.errors ? `${stats.errors} revisión(es) fallidas` : undefined} />
          </div>
          {stats.reasons.length > 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-sm font-semibold text-gray-900">Motivos más comunes de cambio</p>
              <div className="mt-2 flex flex-wrap gap-2">{stats.reasons.map((r) => <span key={r.id} className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800">{r.label} · {r.n}</span>)}</div>
            </div>
          )}
        </div>
      )}

      <fieldset disabled={ro} className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Corrector de ortografía</h3>
          <Toggle on={s.spellingEnabled} onChange={(v) => set({ spellingEnabled: v })} label="Corregir solo cada pieza" help="Ortografía, tildes, gramática y puntuación, sin cambiar el sentido. Nunca toca enlaces, @menciones, #hashtags, cifras ni nombres del catálogo." />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-gray-600">Variante del español
              <select className={`${input} mt-1`} value={s.spellingLocale} onChange={(e) => set({ spellingLocale: e.target.value as EditorialSettings['spellingLocale'] })}>{Object.entries(LOCALES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
            <label className="block text-xs text-gray-600">Trato con el lector
              <select className={`${input} mt-1`} value={s.treatment} onChange={(e) => set({ treatment: e.target.value as EditorialSettings['treatment'] })}>{Object.entries(TREATMENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
          </div>
          <label className="block text-xs text-gray-600">Palabras que nunca se corrigen (separadas por coma)
            <textarea className={`${input} mt-1`} rows={2} value={words} onChange={(e) => setWords(e.target.value)} placeholder="LoHaggo, parce, chévere…" />
          </label>
          <label className="block text-xs text-gray-600">Modelo
            <select className={`${input} mt-1`} value={s.spellingModel ?? ''} onChange={(e) => set({ spellingModel: e.target.value || null })}>
              <option value="">El económico de la plataforma{defaults ? ` (${defaults.spellingModel})` : ''}</option>
              {MODELS.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
            </select>
          </label>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Editor experto</h3>
          <Toggle on={s.editorEnabled} onChange={(v) => set({ editorEnabled: v })} label="Calificar cada pieza" help="Aprueba, pide cambios concretos al agente o la rechaza." />
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-xs text-gray-600">Puntaje mínimo
              <input type="number" min={5} max={10} step={0.5} className={`${input} mt-1`} value={s.minScore} onChange={(e) => set({ minScore: Number(e.target.value) })} />
            </label>
            <label className="block text-xs text-gray-600">Rondas de mejora
              <input type="number" min={0} max={MAX_ROUNDS} step={1} className={`${input} mt-1`} value={s.maxRounds} onChange={(e) => set({ maxRounds: Number(e.target.value) })} />
            </label>
            <label className="block text-xs text-gray-600">Exigencia
              <select className={`${input} mt-1`} value={s.strictness} onChange={(e) => set({ strictness: e.target.value as EditorialSettings['strictness'] })}>{Object.entries(STRICTNESS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-gray-600">Rúbrica (peso de cada criterio en el puntaje)</p>
            {CRITERIA.map((c) => {
              const r = s.rubric.find((x) => x.id === c.id) ?? { id: c.id, weight: c.weight, enabled: true }
              return (
                <div key={c.id} className="flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 accent-primary-600" checked={r.enabled} onChange={(e) => setCriterion(c.id, { enabled: e.target.checked })} />
                  <span className="min-w-0 flex-1 text-sm text-gray-800" title={c.help}>{c.label} <span className="hidden text-xs text-gray-400 sm:inline">· {c.help}</span></span>
                  <input type="number" min={0.5} max={5} step={0.5} className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-sm" value={r.weight} disabled={!r.enabled || ro} onChange={(e) => setCriterion(c.id, { weight: Number(e.target.value) })} />
                </div>
              )
            })}
          </div>
          <label className="block text-xs text-gray-600">Guía de estilo (lo que la marca quiere y no quiere)
            <textarea className={`${input} mt-1`} rows={4} value={s.styleGuide ?? ''} onChange={(e) => set({ styleGuide: e.target.value || null })} placeholder="Nunca prometas precios exactos. Frases cortas. Nada de «¿Sabías que…?»" />
          </label>
          <label className="block text-xs text-gray-600">Modelo
            <select className={`${input} mt-1`} value={s.editorModel ?? ''} onChange={(e) => set({ editorModel: e.target.value || null })}>
              <option value="">El de IA · Plataforma{defaults ? ` (${defaults.editorModel})` : ''}</option>
              {MODELS.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}
            </select>
          </label>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4 lg:col-span-2">
          <h3 className="font-semibold text-gray-900">Cuándo aplica</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Toggle on={s.required} onChange={(v) => set({ required: v })} label="Revisión obligatoria antes de publicar" help="Nada de lo que está en el alcance se programa ni se publica sin una aprobación del editor de exactamente esos textos (o un «Aprobar de todos modos»)." />
            <label className="block text-xs text-gray-600">Alcance
              <select className={`${input} mt-1`} value={s.scope} onChange={(e) => set({ scope: e.target.value as EditorialSettings['scope'] })}>{Object.entries(SCOPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <span className="mt-1 block text-[11px] text-gray-400">Las piezas de las personas se revisan al aprobarlas o publicarlas. «Revisar ortografía» está siempre en el editor.</span>
            </label>
          </div>
          {!ro && (
            <div className="flex items-center gap-3">
              <button onClick={save} disabled={busy || !dirty} className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" />} Guardar</button>
              {dirty && <span className="text-xs text-amber-700">Cambios sin guardar</span>}
            </div>
          )}
          {ro && <p className="text-xs text-gray-500">Solo quien puede publicar cambia esta configuración.</p>}
        </div>
      </fieldset>

      {stats && stats.recent.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white">
          <p className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900">Últimas revisiones</p>
          <ul className="divide-y divide-gray-100">
            {stats.recent.map((r) => (
              <li key={r.id} className="flex flex-col gap-0.5 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:gap-3">
                <span className="w-28 shrink-0 text-xs text-gray-400">{fmtDateTime(r.createdAt)}</span>
                <Link href={`/admin/marketing/posts/${r.postId}`} className="min-w-0 flex-1 truncate font-medium text-gray-800 hover:text-primary-700">{r.title}</Link>
                <span className="shrink-0 text-xs text-gray-600">
                  {r.reviewer === 'editor' ? 'Editor' : 'Ortografía'}{r.round ? ` · ronda ${r.round + 1}` : ''} · <span className={r.verdict === 'approved' || r.verdict === 'clean' || r.verdict === 'corrected' ? 'text-emerald-700' : r.verdict === 'error' || r.verdict === 'rejected' ? 'text-rose-700' : 'text-amber-700'}>{VERDICT[r.verdict] ?? r.verdict}</span>
                  {r.score != null ? ` · ${formatScore(r.score)}/10` : ''}{r.reviewer === 'spelling' && r.corrections ? ` · ${r.corrections}` : ''} · US${r.costUsd.toFixed(3)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
