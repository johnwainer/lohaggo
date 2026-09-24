'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, KeyRound, Loader2, PlugZap, RefreshCw, Save, Trash2, XCircle } from 'lucide-react'

type Settings = {
  anthropicKey: string | null
  voyageKey: string | null
  defaultModel: string
  fallbackModel: string
  embeddingModel: string
  allowAgentModelOverride: boolean
  auxDailyBudgetUsd: number
  defaultModelCheckedAt: string | null
  defaultModelCheckOk: boolean | null
}
type ModelOption = { id: string; displayName: string }
type PriceRow = { id: string | null; provider: string; model: string; inputPerMTok: number; outputPerMTok: number; cacheReadPerMTok: number; cacheWritePerMTok: number }
type CostRow = { calls: number; costUsd: number; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }
type Costs = {
  period: string
  byWorkspace: Array<CostRow & { workspaceId: string | null; name: string }>
  byAgent: Array<CostRow & { agentId: string | null; name: string }>
  byKind: Array<CostRow & { kind: string }>
  byModel: Array<CostRow & { provider: string; model: string }>
  budgets: Array<{ workspaceId: string; name: string; costCapUsd: number | null; callCap: number | null; costUsd: number; calls: number; state: string; pct: number }>
}
type TestResult = { ok: boolean; latencyMs?: number; error?: string; model?: string }

const KIND_LABEL: Record<string, string> = {
  agent_reply: 'Respuesta del agente',
  tools_round: 'Vuelta de herramientas',
  summary: 'Resumen de memoria',
  reengagement: 'Reenganche',
  flow_step: 'Paso de flujo',
  playground: 'Área de pruebas',
  embedding: 'Embeddings',
  model_test: 'Prueba de modelo',
  copilot_suggestion: 'Sugerencia de copiloto',
  comment_reply: 'Respuesta a comentario',
  comment_suggestion: 'Sugerencia para comentario',
  copywriting: 'Redacción de publicaciones',
  image_generation: 'Imágenes generadas',
}

const usd = (n: number) => `$${n.toFixed(n < 1 ? 4 : 2)}`

function TestBadge({ result }: { result: TestResult | null | undefined }) {
  if (!result) return null
  return result.ok ? (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 size={14} /> OK{result.latencyMs != null ? ` · ${result.latencyMs} ms` : ''}{result.model ? ` · ${result.model}` : ''}</span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-red-600"><XCircle size={14} /> {result.error || 'Error'}</span>
  )
}

export default function AiSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [voyageModels, setVoyageModels] = useState<Array<{ id: string; label: string }>>([])
  const [models, setModels] = useState<ModelOption[]>([])
  const [modelsSource, setModelsSource] = useState('')
  const [modelsWarning, setModelsWarning] = useState<string | null>(null)
  const [pricing, setPricing] = useState<PriceRow[]>([])
  const [costs, setCosts] = useState<Costs | null>(null)
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7))

  const [anthropicKey, setAnthropicKey] = useState('')
  const [voyageKey, setVoyageKey] = useState('')
  const [form, setForm] = useState<Partial<Settings>>({})
  const [saving, setSaving] = useState(false)
  const [tests, setTests] = useState<Record<string, TestResult | null>>({})
  const [testing, setTesting] = useState<string | null>(null)
  const [newPrice, setNewPrice] = useState<PriceRow>({ id: null, provider: 'anthropic', model: '', inputPerMTok: 0, outputPerMTok: 0, cacheReadPerMTok: 0, cacheWritePerMTok: 0 })
  const [capDraft, setCapDraft] = useState<Record<string, { cost: string; calls: string }>>({})

  const loadCosts = useCallback(async (p: string) => {
    const res = await fetch(`/api/admin/ai/costs?period=${p}`)
    if (res.ok) setCosts(await res.json())
  }, [])

  const loadModels = useCallback(async (refresh = false) => {
    const res = await fetch(`/api/admin/ai/models${refresh ? '?refresh=1' : ''}`)
    const data = await res.json().catch(() => ({}))
    setModels(data.models || [])
    setModelsSource(data.source || '')
    setModelsWarning(data.warning || null)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, p] = await Promise.all([fetch('/api/admin/ai/settings'), fetch('/api/admin/ai/pricing')])
      const sd = await s.json().catch(() => ({}))
      if (!s.ok) throw new Error(sd.error || 'No se pudo cargar')
      setSettings(sd.settings)
      setVoyageModels(sd.voyageModels || [])
      setForm({})
      const pd = await p.json().catch(() => ({}))
      setPricing(pd.pricing || [])
      await Promise.all([loadModels(), loadCosts(period)])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [loadModels, loadCosts, period])

  useEffect(() => { load() }, [load])

  const value = <K extends keyof Settings>(k: K): Settings[K] | undefined => (form[k] !== undefined ? (form[k] as Settings[K]) : settings?.[k])

  async function save(extra: Record<string, unknown> = {}) {
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { ...form, ...extra }
      if (anthropicKey.trim()) body.anthropicKey = anthropicKey.trim()
      if (voyageKey.trim()) body.voyageKey = voyageKey.trim()
      const res = await fetch('/api/admin/ai/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar')
      setAnthropicKey('')
      setVoyageKey('')
      if (data.defaultModelCheck) setTests((t) => ({ ...t, [`model:${data.defaultModelCheck.model}`]: data.defaultModelCheck }))
      setNotice('Ajustes guardados.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function testProvider(provider: 'anthropic' | 'voyage') {
    setTesting(provider)
    const key = provider === 'anthropic' ? anthropicKey : voyageKey
    const res = await fetch('/api/admin/ai/settings/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, key: key || undefined, model: value('embeddingModel') }) })
    const data = await res.json().catch(() => ({ ok: false, error: 'Error' }))
    setTests((t) => ({ ...t, [provider]: data }))
    setTesting(null)
  }

  async function testModel(model: string) {
    setTesting(`model:${model}`)
    const res = await fetch('/api/admin/ai/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }) })
    const data = await res.json().catch(() => ({ ok: false, error: 'Error' }))
    setTests((t) => ({ ...t, [`model:${model}`]: data }))
    setTesting(null)
  }

  async function savePrice(row: PriceRow, del = false) {
    const res = await fetch('/api/admin/ai/pricing', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...row, delete: del }) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError(data.error || 'Error'); return }
    const p = await fetch('/api/admin/ai/pricing').then((r) => r.json())
    setPricing(p.pricing || [])
    setNotice(del ? 'Tarifa eliminada.' : 'Tarifa guardada.')
  }

  async function saveCap(workspaceId: string) {
    const d = capDraft[workspaceId]
    if (!d) return
    const res = await fetch('/api/admin/ai/limits', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId, costCapUsd: d.cost, callCap: d.calls }) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError(data.error || 'Error'); return }
    setNotice('Tope actualizado.')
    await loadCosts(period)
  }

  if (loading && !settings) {
    return <div className="p-6 flex items-center gap-2 text-gray-500"><Loader2 className="animate-spin" size={18} /> Cargando…</div>
  }

  const modelSelect = (key: 'defaultModel' | 'fallbackModel') => (
    <div className="flex items-center gap-2 flex-wrap">
      <select value={value(key) || ''} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} className="border border-gray-200 rounded-xl px-3 py-2 text-sm min-w-[240px]">
        {[...models, ...(models.some((m) => m.id === value(key)) ? [] : [{ id: value(key) || '', displayName: value(key) || '' }])].map((m) => (
          <option key={m.id} value={m.id}>{m.displayName} · {m.id}</option>
        ))}
      </select>
      <button onClick={() => testModel(value(key) || '')} disabled={testing !== null} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
        {testing === `model:${value(key)}` ? <Loader2 size={14} className="animate-spin" /> : <PlugZap size={14} />} Probar modelo
      </button>
      <TestBadge result={tests[`model:${value(key)}`]} />
    </div>
  )

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agentes IA · Plataforma</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Claves, modelos, tarifas y coste. Los agentes se configuran en{' '}
            <Link href="/admin/ai-agents" className="text-primary-600 font-medium hover:underline">Agentes IA</Link>.
          </p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50">
          <RefreshCw size={15} /> Actualizar
        </button>
      </div>

      {error && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle size={16} /> {error}</div>}
      {notice && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><CheckCircle2 size={16} /> {notice}</div>}

      {/* Keys */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2"><KeyRound size={18} /> Claves (cifradas en base de datos)</h2>
        {([
          ['anthropic', 'Anthropic (Claude)', settings?.anthropicKey, anthropicKey, setAnthropicKey, 'sk-ant-…'],
          ['voyage', 'Voyage AI (embeddings)', settings?.voyageKey, voyageKey, setVoyageKey, 'pa-…'],
        ] as const).map(([provider, label, masked, draft, setDraft, placeholder]) => (
          <div key={provider} className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-sm font-medium text-gray-700">{label}</label>
              <span className="text-xs text-gray-500">{masked ? `Guardada: ${masked}` : 'Sin configurar'}</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <input type="password" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={masked ? 'Escribe una nueva para reemplazarla' : placeholder} className="flex-1 min-w-[240px] border border-gray-200 rounded-xl px-3 py-2 text-sm" autoComplete="off" />
              <button onClick={() => testProvider(provider)} disabled={testing !== null || (!draft && !masked)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                {testing === provider ? <Loader2 size={14} className="animate-spin" /> : <PlugZap size={14} />} Probar conexión
              </button>
              {masked && (
                <button onClick={() => { if (window.confirm(`¿Eliminar la clave de ${label}?`)) save({ [provider === 'anthropic' ? 'anthropicKey' : 'voyageKey']: null }) }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-sm text-red-600 hover:bg-red-50">
                  <Trash2 size={14} /> Quitar
                </button>
              )}
            </div>
            <TestBadge result={tests[provider]} />
            {provider === 'voyage' && !masked && <p className="text-xs text-amber-700">Sin clave de Voyage la base de conocimiento funciona en modo léxico (búsqueda por palabras).</p>}
          </div>
        ))}
      </section>

      {/* Models */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold text-gray-900">Modelos</h2>
          <button onClick={() => loadModels(true)} className="inline-flex items-center gap-1.5 text-xs text-primary-600 hover:underline"><RefreshCw size={12} /> Releer de la API</button>
        </div>
        <p className="text-xs text-gray-500">
          Lista {modelsSource === 'api' ? 'leída de GET /v1/models con tu clave' : modelsSource === 'api-cache' ? 'de la última lectura de la API' : 'de respaldo (estática)'}.
          {modelsWarning ? ` ${modelsWarning}` : ''}
        </p>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Modelo por defecto</label>
          {modelSelect('defaultModel')}
          {settings?.defaultModelCheckedAt && (
            <p className="text-xs text-gray-500">
              Última comprobación: {new Date(settings.defaultModelCheckedAt).toLocaleString('es-CO')} · {settings.defaultModelCheckOk ? 'responde' : 'no respondió'}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Modelo de reserva (529 persistente, resúmenes)</label>
          {modelSelect('fallbackModel')}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Modelo de embeddings</label>
            <select value={value('embeddingModel') || ''} onChange={(e) => setForm((f) => ({ ...f, embeddingModel: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
              {voyageModels.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <p className="text-xs text-gray-500">Cambiarlo obliga a reindexar el conocimiento.</p>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Tope diario de llamadas auxiliares (USD)</label>
            <input type="number" min={0} step="0.5" value={value('auxDailyBudgetUsd') ?? 0} onChange={(e) => setForm((f) => ({ ...f, auxDailyBudgetUsd: Number(e.target.value) }))} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            <p className="text-xs text-gray-500">Resúmenes de memoria y reenganches. Al superarlo se omiten, nunca bloquean la respuesta.</p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={Boolean(value('allowAgentModelOverride'))} onChange={(e) => setForm((f) => ({ ...f, allowAgentModelOverride: e.target.checked }))} />
          Permitir que cada agente use un modelo distinto al de la plataforma
        </label>
        <button onClick={() => save()} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Guardar ajustes
        </button>
      </section>

      {/* Pricing */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Tarifas (USD por millón de tokens)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500">
              <tr className="text-left">
                <th className="py-2 pr-3">Proveedor</th><th className="pr-3">Modelo</th><th className="pr-3">Entrada</th><th className="pr-3">Salida</th><th className="pr-3">Caché leída</th><th className="pr-3">Caché escrita</th><th />
              </tr>
            </thead>
            <tbody>
              {[...pricing, newPrice].map((row, i) => {
                const isNew = i === pricing.length
                const update = (patch: Partial<PriceRow>) => {
                  if (isNew) setNewPrice((p) => ({ ...p, ...patch }))
                  else setPricing((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)))
                }
                return (
                  <tr key={isNew ? 'new' : `${row.provider}:${row.model}`} className="border-t border-gray-100">
                    <td className="py-2 pr-3">
                      {isNew ? (
                        <select value={row.provider} onChange={(e) => update({ provider: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-1">
                          <option value="anthropic">anthropic</option><option value="voyage">voyage</option>
                        </select>
                      ) : row.provider}
                    </td>
                    <td className="pr-3">{isNew ? <input value={row.model} onChange={(e) => update({ model: e.target.value })} placeholder="modelo" className="border border-gray-200 rounded-lg px-2 py-1 w-44" /> : <span className="font-mono text-xs">{row.model}{row.id ? '' : ' (por defecto)'}</span>}</td>
                    {(['inputPerMTok', 'outputPerMTok', 'cacheReadPerMTok', 'cacheWritePerMTok'] as const).map((k) => (
                      <td key={k} className="pr-3"><input type="number" step="0.01" min={0} value={row[k]} onChange={(e) => update({ [k]: Number(e.target.value) })} className="border border-gray-200 rounded-lg px-2 py-1 w-20" /></td>
                    ))}
                    <td className="whitespace-nowrap">
                      <button onClick={() => savePrice(row)} disabled={!row.model} className="text-primary-600 hover:underline text-xs mr-3 disabled:opacity-40">{isNew ? 'Añadir' : 'Guardar'}</button>
                      {!isNew && row.id && <button onClick={() => savePrice(row, true)} className="text-red-600 hover:underline text-xs">Quitar</button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Costs */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="font-semibold text-gray-900">Coste</h2>
          <input type="month" value={period} onChange={(e) => { setPeriod(e.target.value); loadCosts(e.target.value) }} className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm" />
        </div>
        {costs && (
          <div className="grid lg:grid-cols-2 gap-6">
            {([
              ['Por cuenta (workspace)', costs.byWorkspace.map((r) => ({ label: r.name, ...r }))],
              ['Por agente', costs.byAgent.map((r) => ({ label: r.name, ...r }))],
              ['Por tipo de llamada', costs.byKind.map((r) => ({ label: KIND_LABEL[r.kind] || r.kind, ...r }))],
              ['Por modelo (el que respondió)', costs.byModel.map((r) => ({ label: `${r.provider} · ${r.model}`, ...r }))],
            ] as const).map(([title, rows]) => (
              <div key={title}>
                <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>
                {rows.length === 0 ? <p className="text-xs text-gray-400">Sin llamadas en este periodo.</p> : (
                  <table className="w-full text-xs">
                    <thead className="text-gray-500"><tr className="text-left"><th className="py-1">Nombre</th><th>Llamadas</th><th>Tokens (ent/sal)</th><th>Caché leída</th><th className="text-right">Coste</th></tr></thead>
                    <tbody>
                      {[...rows].sort((a, b) => b.costUsd - a.costUsd).map((r) => (
                        <tr key={r.label} className="border-t border-gray-100">
                          <td className="py-1 pr-2">{r.label}</td>
                          <td>{r.calls}</td>
                          <td>{r.inputTokens.toLocaleString('es-CO')} / {r.outputTokens.toLocaleString('es-CO')}</td>
                          <td>{r.cacheReadTokens.toLocaleString('es-CO')}</td>
                          <td className="text-right font-medium">{usd(r.costUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Caps */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Tope mensual por cuenta</h2>
        <p className="text-xs text-gray-500">Aviso al 80 %. Al 100 % los agentes dejan de contestar y traspasan a una persona. Vacío = sin tope.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500"><tr className="text-left"><th className="py-2">Workspace</th><th>Uso del mes</th><th>Tope USD</th><th>Tope llamadas</th><th /></tr></thead>
            <tbody>
              {costs?.budgets.map((b) => {
                const d = capDraft[b.workspaceId] ?? { cost: b.costCapUsd?.toString() ?? '', calls: b.callCap?.toString() ?? '' }
                const set = (patch: Partial<typeof d>) => setCapDraft((c) => ({ ...c, [b.workspaceId]: { ...d, ...patch } }))
                return (
                  <tr key={b.workspaceId} className="border-t border-gray-100">
                    <td className="py-2 pr-3">{b.name}</td>
                    <td className="pr-3">
                      <span className={b.state === 'blocked' ? 'text-red-600 font-medium' : b.state === 'warn' ? 'text-amber-600 font-medium' : 'text-gray-700'}>
                        {usd(b.costUsd)} · {b.calls} llamadas{b.costCapUsd != null || b.callCap != null ? ` · ${b.pct}%` : ''}
                      </span>
                    </td>
                    <td className="pr-3"><input type="number" min={0} step="1" value={d.cost} onChange={(e) => set({ cost: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-1 w-24" /></td>
                    <td className="pr-3"><input type="number" min={0} step="10" value={d.calls} onChange={(e) => set({ calls: e.target.value })} className="border border-gray-200 rounded-lg px-2 py-1 w-24" /></td>
                    <td><button onClick={() => saveCap(b.workspaceId)} className="text-primary-600 hover:underline text-xs">Guardar</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
