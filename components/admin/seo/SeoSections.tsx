'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, Search, XCircle } from 'lucide-react'
import type { SeoCycleOutput, SeoReportOutput, SeoOverview } from '@/lib/seo/agent/views'
import { Loader2 } from 'lucide-react'
import { RUN_STATUS, RUN_TRIGGER, RUN_TYPE, btnGhost, btnPrimary, card, fmtWhen, nf, seoApi, usd } from './shared'

type Gsc = NonNullable<SeoCycleOutput['gsc']>

const GSC_STEPS: Record<Exclude<Gsc['state'], 'ok'>, { title: string; steps: (g: Gsc) => string[] }> = {
  off: {
    title: 'Search Console está apagado',
    steps: () => ['Abre «Configurar» y enciende «Usar Search Console».', 'Escribe la propiedad del sitio (por ejemplo sc-domain:lohaggo.com).', 'Ejecuta el agente de nuevo.'],
  },
  no_account: {
    title: 'Falta conectar la cuenta de Google',
    steps: () => ['Crea una cuenta de servicio en Google Cloud, activa la «Search Console API» y descarga su clave en JSON.', 'Pega la clave aquí abajo (se guarda cifrada).', 'En Search Console → Configuración → Usuarios y permisos, agrega el correo de esa cuenta como usuario de la propiedad.'],
  },
  no_access: {
    title: 'Google no deja leer esta propiedad',
    steps: (g) => [
      g.serviceEmail ? `En Search Console, entra a Configuración, Usuarios y permisos, y agrega este correo como usuario de la propiedad: ${g.serviceEmail}` : 'En Search Console, entra a Configuración, Usuarios y permisos, y agrega la cuenta conectada como usuario de la propiedad.',
      'Revisa que la propiedad escrita en «Configurar» sea exactamente la de Search Console.',
      'Pulsa «Ejecutar ahora» otra vez.',
    ],
  },
  error: {
    title: 'No se pudo leer Search Console',
    steps: () => ['Pulsa «Ejecutar ahora» para reintentar; a veces Google falla un momento.', 'Si sigue igual, revisa la propiedad en «Configurar» y los permisos en Search Console.'],
  },
}

type Probe = { serviceEmail: string | null; siteUrl: string; test: { ok: boolean; message: string } }

/** Connect the Google service account and test Search Console without leaving the SEO panel. */
function GscConnect({ canEdit, serviceEmail, onChanged }: { canEdit: boolean; serviceEmail: string | null | undefined; onChanged: () => void }) {
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState<'save' | 'test' | null>(null)
  const [result, setResult] = useState<Probe | null>(null)
  const [error, setError] = useState<string | null>(null)
  async function run(mode: 'save' | 'test') {
    setBusy(mode); setError(null)
    try {
      const r = mode === 'save' ? await seoApi<Probe>('/api/admin/seo/gsc', { method: 'PUT', json: { credentials: key } }) : await seoApi<Probe>('/api/admin/seo/gsc', { method: 'POST', json: {} })
      setResult(r)
      if (mode === 'save') setKey('')
      if (r.test.ok) onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar')
    } finally {
      setBusy(null)
    }
  }
  const email = result?.serviceEmail ?? serviceEmail
  return (
    <div className="mt-3 space-y-3 border-t border-amber-200 pt-3 text-gray-800">
      {email && (
        <div>
          <p className="text-xs">Cuenta de servicio conectada (agrégala como usuario en Search Console):</p>
          <p className="mt-1 break-all rounded-lg bg-white px-2 py-1.5 font-mono text-xs select-all">{email}</p>
        </div>
      )}
      {canEdit ? (
        <label className="block space-y-1">
          <span className="text-xs font-medium">{email ? 'Cambiar la clave JSON (opcional)' : 'Clave JSON de la cuenta de servicio'}</span>
          <textarea value={key} onChange={(e) => setKey(e.target.value)} rows={5} spellCheck={false} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 font-mono text-xs" placeholder='{"type": "service_account", ...}' />
        </label>
      ) : <p className="text-xs">Solo un superadmin puede conectar la cuenta de Google.</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        {canEdit && <button onClick={() => run('save')} disabled={busy !== null || !key.trim()} className={btnPrimary}>{busy === 'save' && <Loader2 size={15} className="animate-spin" />} Guardar y probar</button>}
        {email && <button onClick={() => run('test')} disabled={busy !== null} className={btnGhost}>{busy === 'test' && <Loader2 size={15} className="animate-spin" />} Probar conexión</button>}
      </div>
      {error && <p className="text-xs text-rose-700">{error}</p>}
      {result && <p className={`break-words text-xs ${result.test.ok ? 'text-emerald-700' : 'text-amber-900'}`}>{result.test.message}</p>}
    </div>
  )
}

export function SearchConsoleCard({ gsc, hasCycle, canEdit = false, onChanged = () => undefined }: { gsc: Gsc | undefined; hasCycle: boolean; canEdit?: boolean; onChanged?: () => void }) {
  return (
    <section className={card} aria-labelledby="seo-gsc">
      <h2 id="seo-gsc" className="flex items-center gap-2 text-base font-bold text-gray-900"><Search size={18} className="text-primary-600" /> Google Search Console</h2>
      {!gsc && <p className="mt-2 text-sm text-gray-500">{hasCycle ? 'El último ciclo no trajo datos de Search Console.' : 'Todavía no hay datos. Pulsa «Ejecutar ahora» para traerlos.'}</p>}
      {gsc && gsc.state === 'ok' && (
        <div className="mt-3 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">Clics{gsc.days ? ` (${gsc.days} días)` : ''}</p><p className="text-xl font-bold text-gray-900">{nf(gsc.clicks)}</p></div>
            <div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">Impresiones</p><p className="text-xl font-bold text-gray-900">{nf(gsc.impressions)}</p></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-1.5 text-sm font-semibold text-gray-800">Lo que más busca la gente</h3>
              {gsc.top.length === 0 ? <p className="text-sm text-gray-500">Sin consultas todavía.</p> : (
                <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                  {gsc.top.map((q) => (
                    <li key={q.query} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0 break-words text-gray-800">{q.query}</span>
                      <span className="shrink-0 text-right text-xs text-gray-500">{nf(q.clicks)} clics · {nf(q.impressions)} imp. · pos. {q.position.toFixed(1)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-1.5 text-sm font-semibold text-gray-800">Páginas que más reciben</h3>
              {gsc.topPages.length === 0 ? <p className="text-sm text-gray-500">Sin páginas todavía.</p> : (
                <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                  {gsc.topPages.map((p) => (
                    <li key={p.path} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <a href={p.path} target="_blank" rel="noreferrer" className="min-w-0 break-all text-primary-700 hover:underline">{p.path}</a>
                      <span className="shrink-0 text-right text-xs text-gray-500">{nf(p.clicks)} clics · {nf(p.impressions)} imp.</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
      {gsc && gsc.state !== 'ok' && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} className="shrink-0" /> {GSC_STEPS[gsc.state].title}</p>
          {gsc.message && <p className="mt-1 break-words text-xs">{gsc.message}</p>}
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {GSC_STEPS[gsc.state].steps(gsc).map((s) => <li key={s} className="break-words">{s}</li>)}
          </ol>
          {(gsc.state === 'no_account' || gsc.state === 'no_access' || gsc.state === 'error') && <GscConnect canEdit={canEdit} serviceEmail={gsc.serviceEmail} onChanged={onChanged} />}
        </div>
      )}
    </section>
  )
}

const SEV = {
  critical: { label: 'Grave', cls: 'bg-rose-100 text-rose-700', rank: 0 },
  warning: { label: 'Aviso', cls: 'bg-amber-100 text-amber-800', rank: 1 },
  info: { label: 'Nota', cls: 'bg-gray-100 text-gray-600', rank: 2 },
} as const

export function PagesAudit({ pages }: { pages: NonNullable<SeoCycleOutput['pages']> | undefined }) {
  const [open, setOpen] = useState(false)
  const list = pages ?? []
  const withIssues = list.filter((p) => p.issues.length > 0 || (p.status !== null && p.status >= 400)).length
  const sorted = [...list].sort((a, b) => Math.min(...[3, ...a.issues.map((i) => SEV[i.severity].rank)]) - Math.min(...[3, ...b.issues.map((i) => SEV[i.severity].rank)]))
  return (
    <section className={card}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left">
        <span>
          <span className="block text-base font-bold text-gray-900">Revisión técnica de páginas</span>
          <span className="block text-xs text-gray-500">{list.length === 0 ? 'Aún sin datos' : `${list.length} páginas revisadas, ${withIssues} con algo por arreglar`}</span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (list.length === 0 ? <p className="mt-2 text-sm text-gray-500">La revisión de páginas no ha corrido o está apagada.</p> : (
        <ul className="mt-3 space-y-2">
          {sorted.map((p) => {
            const ok = p.status !== null && p.status < 400
            return (
              <li key={p.path} className="rounded-xl border border-gray-100 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {p.issues.length === 0 && ok ? <CheckCircle2 size={15} className="shrink-0 text-emerald-500" /> : <XCircle size={15} className={`shrink-0 ${ok ? 'text-amber-500' : 'text-rose-500'}`} />}
                  <a href={p.path} target="_blank" rel="noreferrer" className="min-w-0 break-all text-sm font-medium text-primary-700 hover:underline">{p.path}</a>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'}`}>{p.status ?? 'sin respuesta'}</span>
                  <span className="text-xs text-gray-500">{nf(p.words)} palabras</span>
                </div>
                {p.issues.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {[...p.issues].sort((a, b) => SEV[a.severity].rank - SEV[b.severity].rank).map((i) => (
                      <li key={i.code} className="flex items-start gap-2 text-xs text-gray-700">
                        <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${SEV[i.severity].cls}`}>{SEV[i.severity].label}</span>
                        <span className="min-w-0 break-words">{i.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      ))}
    </section>
  )
}

function Bullets({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-gray-800">{title}</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">{items.map((t, i) => <li key={i} className="break-words">{t}</li>)}</ul>
    </div>
  )
}

export function WeeklyReport({ report }: { report: { at: string; output: SeoReportOutput } | null }) {
  return (
    <section className={card}>
      <h2 className="text-base font-bold text-gray-900">Informe semanal</h2>
      {!report ? <p className="mt-2 text-sm text-gray-500">Aún no hay informe. Se escribe cuando el agente corre con IA («Ejecutar con IA» o el ciclo semanal).</p> : (
        <div className="mt-2 space-y-4">
          <p className="text-xs text-gray-500">{fmtWhen(report.at)}</p>
          <p className="whitespace-pre-line break-words text-sm text-gray-800">{report.output.summary}</p>
          <Bullets title="Hallazgos" items={report.output.findings} />
          {report.output.forMarketing?.length > 0 && (
            <div className="rounded-xl border border-primary-100 bg-primary-50/60 p-3">
              <Bullets title="Indicaciones para marketing" items={report.output.forMarketing} />
            </div>
          )}
          <Bullets title="Propuestas" items={report.output.proposals} />
        </div>
      )}
    </section>
  )
}

export function ActivityList({ runs }: { runs: SeoOverview['runs'] }) {
  const [open, setOpen] = useState(false)
  return (
    <section className={card}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left">
        <span>
          <span className="block text-base font-bold text-gray-900">Actividad reciente</span>
          <span className="block text-xs text-gray-500">{runs.length === 0 ? 'Sin ejecuciones todavía' : `Últimas ${runs.length} ejecuciones`}</span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && runs.length > 0 && (
        <ul className="mt-2 divide-y divide-gray-100">
          {runs.map((r) => {
            const st = RUN_STATUS[r.status] ?? { label: r.status, cls: 'bg-gray-100 text-gray-600' }
            return (
              <li key={r.id} className="py-2.5">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-gray-900">{RUN_TYPE[r.type] ?? r.type}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                  <span className="text-xs text-gray-500">{RUN_TRIGGER[r.trigger] ?? r.trigger} · {fmtWhen(r.startedAt)} · {r.costUsd > 0 ? usd(r.costUsd) : 'gratis'}</span>
                </div>
                {r.error ? <p className="mt-1 break-words text-xs text-rose-700">{r.error}</p> : r.summary ? <p className="mt-1 break-words text-xs text-gray-600">{r.summary}</p> : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
