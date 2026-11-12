'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, AlertTriangle, Loader2, Play, RefreshCw, Search, Settings, Sparkles } from 'lucide-react'
import OpportunitiesSection from './OpportunitiesSection'
import SeoSettingsDialog from './SeoSettingsDialog'
import { ActivityList, PagesAudit, SearchConsoleCard, WeeklyReport } from './SeoSections'
import { RUN_STATUS, WEEK_DAYS, btnGhost, btnPrimary, card, fmtWhen, healthTone, seoApi, usd, type SeoData } from './shared'

type RunMode = 'rules' | 'ai'

const STAGES_RULES = ['Revisando las páginas del sitio…', 'Leyendo Search Console…', 'Buscando oportunidades…']
const STAGES_AI = ['Revisando las páginas del sitio…', 'Leyendo Search Console…', 'Buscando oportunidades…', 'Escribiendo los briefs con IA…', 'Redactando el informe semanal…']

function Running({ mode }: { mode: RunMode }) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const stages = mode === 'ai' ? STAGES_AI : STAGES_RULES
  const stage = stages[Math.min(stages.length - 1, Math.floor(secs / (mode === 'ai' ? 30 : 12)))]
  const mm = Math.floor(secs / 60)
  return (
    <div role="status" aria-live="polite" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
      <p className="flex items-center gap-2 font-semibold"><Loader2 size={16} className="shrink-0 animate-spin" /> {stage}</p>
      <p className="mt-1 text-xs">Lleva {mm > 0 ? `${mm} min ` : ''}{secs % 60} s. {mode === 'ai' ? 'Con IA puede tardar hasta 3 minutos.' : 'Suele tardar menos de un minuto.'} Puedes seguir mirando el panel; no cierres esta pestaña.</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-blue-100"><div className="h-full w-1/3 animate-pulse rounded-full bg-blue-500" /></div>
    </div>
  )
}

export default function SeoAgentPanel() {
  const [data, setData] = useState<SeoData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState<RunMode | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [runDone, setRunDone] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])

  const load = useCallback(async () => {
    try {
      const d = await seoApi<SeoData>('/api/admin/seo')
      if (!alive.current) return
      setData(d)
      setError(null)
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : 'No se pudo cargar el panel')
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // A cycle started elsewhere (the weekly cron, another admin) keeps showing as running: check back until it ends
  const remoteRunning = data?.lastCycle?.status === 'running' && !running
  useEffect(() => {
    if (!remoteRunning) return
    const t = setInterval(load, 15_000)
    return () => clearInterval(t)
  }, [remoteRunning, load])

  async function run(mode: RunMode) {
    setRunning(mode); setRunError(null); setRunDone(null)
    try {
      const r = await seoApi<{ ok?: boolean; summary?: string; error?: string }>('/api/admin/seo/run', { json: { withAi: mode === 'ai' } })
      setRunDone(r.summary || 'Listo: el ciclo terminó.')
    } catch (e) {
      setRunError(e instanceof Error ? e.message : 'No se pudo ejecutar el agente')
    } finally {
      setRunning(null)
      await load()
    }
  }

  if (loading && !data) return <div className="flex items-center justify-center gap-2 py-20 text-sm text-gray-500"><Loader2 size={18} className="animate-spin" /> Cargando…</div>
  if (!data) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 py-6">
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><AlertCircle size={16} className="mt-0.5 shrink-0" /> {error || 'No se pudo cargar el panel'}</div>
        <button onClick={() => { setLoading(true); load() }} className={btnGhost}><RefreshCw size={15} /> Reintentar</button>
      </div>
    )
  }

  const { config, tablesReady, spend, lastCycle, lastReport, counts } = data
  const out = lastCycle?.output ?? null
  const health = out?.health
  const tone = health ? healthTone(health.score) : null
  const budgetPct = spend.budget > 0 ? Math.min(100, Math.round((spend.month / spend.budget) * 100)) : spend.month > 0 ? 100 : 0
  const cycleSt = lastCycle ? RUN_STATUS[lastCycle.status] ?? { label: lastCycle.status, cls: 'bg-gray-100 text-gray-600' } : null
  const blocked = running !== null || !tablesReady || remoteRunning

  return (
    <div className="mx-auto max-w-6xl space-y-4 py-1 pb-24 sm:space-y-5 sm:p-6">
      <div className="flex items-start gap-3 sm:items-center sm:gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-orange-400 text-white shadow-sm sm:h-12 sm:w-12"><Search size={22} /></span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold leading-tight text-gray-900 sm:text-2xl">Agente de SEO</h1>
          <p className="mt-0.5 text-sm text-gray-500">Vigila cómo aparece LoHaggo en Google y te dice qué mejorar para que lleguen más clientes.</p>
        </div>
        <button onClick={() => { setLoading(true); load() }} disabled={loading || running !== null} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 sm:h-10 sm:w-10" title="Actualizar" aria-label="Actualizar"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
      </div>

      {!tablesReady && (
        <div role="alert" className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">Falta aplicar el SQL del agente de SEO en Supabase</p>
            <p className="mt-0.5 break-words">Pega el archivo <code className="rounded bg-white px-1 py-0.5 text-xs">migrations/20261113010000_seo_agent.sql</code> en el SQL Editor de Supabase. Mientras tanto no se puede ejecutar el agente ni guardar datos; la configuración se muestra con los valores por defecto.</p>
          </div>
        </div>
      )}
      {error && <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}</div>}

      <section className={card} aria-label="Resumen del agente">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Salud del SEO</p>
            {health && tone ? (
              <>
                <p className="mt-1 flex items-baseline gap-2"><span className={`text-4xl font-bold ${tone.text}`}>{health.score}</span><span className="text-sm text-gray-500">de 100 · {tone.label}</span></p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={health.score} aria-label="Puntaje de salud"><div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${health.score}%` }} /></div>
                <ul className="mt-3 space-y-2">
                  {health.parts.map((p) => {
                    const t = healthTone(p.score)
                    return (
                      <li key={p.label}>
                        <div className="flex items-center justify-between gap-3 text-xs"><span className="min-w-0 break-words text-gray-700">{p.label}</span><span className={`shrink-0 font-semibold ${t.text}`}>{p.score}</span></div>
                        <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${t.bar}`} style={{ width: `${p.score}%` }} /></div>
                      </li>
                    )
                  })}
                </ul>
              </>
            ) : <p className="mt-2 text-sm text-gray-500">Todavía sin medir. Pulsa «Ejecutar ahora» para calcularla.</p>}
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${config.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'}`}>{config.enabled ? 'Encendido' : 'Apagado'}</span>
              <span className="text-xs text-gray-500">{config.enabled ? `Ciclo semanal: ${WEEK_DAYS[config.weeklyDay]?.toLowerCase()}` : 'No corre solo; los botones manuales funcionan'}</span>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Último ciclo</p>
              {lastCycle && cycleSt ? (
                <div className="mt-1 space-y-1">
                  <p className="flex flex-wrap items-center gap-2"><span className="text-gray-800">{fmtWhen(lastCycle.at)}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cycleSt.cls}`}>{cycleSt.label}</span><span className="text-xs text-gray-500">{lastCycle.trigger === 'manual' ? 'manual' : 'automático'}</span></p>
                  {lastCycle.summary && <p className="break-words text-xs text-gray-600">{lastCycle.summary}</p>}
                  {lastCycle.error && <p className="break-words rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{lastCycle.error}</p>}
                  {out?.aiNote && <p className="break-words text-xs text-gray-500">{out.aiNote}</p>}
                  {out?.unavailable && out.unavailable.length > 0 && <p className="break-words text-xs text-amber-700">No se pudo revisar: {out.unavailable.join(', ')}</p>}
                </div>
              ) : <p className="mt-1 text-gray-500">Aún no ha corrido.</p>}
            </div>
            <div>
              <div className="flex items-center justify-between gap-3 text-xs"><span className="font-semibold uppercase tracking-wide text-gray-500">Gasto de IA del mes</span><span className="text-gray-700">{usd(spend.month)} de {usd(spend.budget)}</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={budgetPct} aria-label="Presupuesto usado"><div className={`h-full rounded-full ${budgetPct >= 90 ? 'bg-rose-500' : budgetPct >= 70 ? 'bg-amber-500' : 'bg-primary-500'}`} style={{ width: `${budgetPct}%` }} /></div>
              {budgetPct >= 100 && <p className="mt-1 text-xs text-rose-700">Se llegó al tope: el agente sigue con las reglas gratis y no escribe con IA.</p>}
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3 border-t border-gray-100 pt-4">
          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <button onClick={() => run('rules')} disabled={blocked} className={btnPrimary}>{running === 'rules' ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} {running === 'rules' ? 'Ejecutando…' : 'Ejecutar ahora'}</button>
            {data.canEdit && <button onClick={() => run('ai')} disabled={blocked} className={btnGhost}>{running === 'ai' ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {running === 'ai' ? 'Ejecutando con IA…' : 'Ejecutar con IA'}</button>}
            <button onClick={() => setSettingsOpen(true)} className={btnGhost}><Settings size={16} /> Configurar</button>
          </div>
          <p className="text-xs text-gray-500"><strong className="font-semibold text-gray-700">Ejecutar ahora</strong> solo usa reglas y es gratis. <strong className="font-semibold text-gray-700">Ejecutar con IA</strong> además escribe briefs y el informe, y gasta del presupuesto mensual.</p>
          {running && <Running mode={running} />}
          {remoteRunning && <p role="status" className="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900"><Loader2 size={15} className="animate-spin" /> Hay un ciclo corriendo ahora mismo. Se actualizará solo cuando termine.</p>}
          {runError && <p role="alert" className="break-words rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{runError}</p>}
          {runDone && !runError && <p role="status" className="break-words rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{runDone}</p>}
        </div>
      </section>

      <SearchConsoleCard gsc={out?.gsc} hasCycle={Boolean(lastCycle)} canEdit={data.canEdit} onChanged={load} />

      <OpportunitiesSection
        items={data.opportunities}
        counts={counts}
        agentId={data.marketing.agentId}
        tablesReady={tablesReady}
        onChanged={load}
      />
      {tablesReady && !data.marketing.agentId && <p className="-mt-2 px-1 text-xs text-amber-700">No hay un agente de marketing para el sitio web: «Enviar a marketing» no tendrá calendario donde caer.</p>}

      <PagesAudit pages={out?.pages} />
      <WeeklyReport report={lastReport} />
      <ActivityList runs={data.runs} />

      {settingsOpen && <SeoSettingsDialog config={config} defaults={data.defaults} canEdit={data.canEdit} onClose={() => setSettingsOpen(false)} onSaved={load} />}
    </div>
  )
}
