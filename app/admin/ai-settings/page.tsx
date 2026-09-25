'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, ArrowLeftRight, CheckCircle2, KeyRound, Loader2, PlugZap, RefreshCw, RotateCcw, Save, Trash2, XCircle, Zap } from 'lucide-react'

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
  openaiKey: string | null
  openaiModel: string
  openaiFallbackModel: string
  providerOrder: ProviderId[]
  failoverEnabled: boolean
}
type ProviderId = 'anthropic' | 'openai'
type ProviderState = { provider: ProviderId; status: 'ok' | 'degraded' | 'down'; reasonLabel: string | null; detail: string | null; downUntil: string | null; lastErrorAt: string | null; lastOkAt: string | null; failures: number }
type ModelOption = { id: string; displayName: string }
type PriceRow = { id: string | null; provider: string; model: string; inputPerMTok: number; outputPerMTok: number; cacheReadPerMTok: number; cacheWritePerMTok: number }
type CostRow = { calls: number; costUsd: number; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }
type Costs = {
  period: string
  byWorkspace: Array<CostRow & { workspaceId: string | null; name: string }>
  byAgent: Array<CostRow & { agentId: string | null; name: string }>
  byKind: Array<CostRow & { kind: string }>
  byModel: Array<CostRow & { provider: string; model: string }>
  byProvider?: Array<CostRow & { provider: string }>
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
  marketing_agent_strategy: 'Agente de marketing: estrategia',
  marketing_agent_plan: 'Agente de marketing: planificación',
  marketing_agent_draft: 'Agente de marketing: redacción',
  marketing_agent_learn: 'Agente de marketing: aprendizaje',
}

const PROVIDER_NAME: Record<string, string> = { anthropic: 'Claude (Anthropic)', openai: 'OpenAI', voyage: 'Voyage (embeddings)' }
const hhmm = (d: string | null) => (d ? new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '')

function ProviderStatus({ state, hasKey }: { state: ProviderState | undefined; hasKey: boolean }) {
  if (!hasKey) return <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">Sin clave</span>
  if (!state || state.status === 'ok') return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Funcionando</span>
  const down = state.status === 'down' && state.downUntil && new Date(state.downUntil).getTime() > Date.now()
  if (down) return <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"><span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Caído: {state.reasonLabel} · se reintenta a las {hhmm(state.downUntil)}</span>
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {state.status === 'down' ? 'Se probará en la próxima llamada' : `Con fallos (${state.failures} seguidos)`}{state.reasonLabel ? `: ${state.reasonLabel}` : ''}</span>
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

  const [providers, setProviders] = useState<ProviderState[]>([])
  const [openaiModels, setOpenaiModels] = useState<ModelOption[]>([])
  const [openaiModelsWarning, setOpenaiModelsWarning] = useState<string | null>(null)
  const [openaiKey, setOpenaiKey] = useState('')
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
    const o = await fetch(`/api/admin/ai/models?provider=openai${refresh ? '&refresh=1' : ''}`).then((r) => r.json()).catch(() => ({}))
    setOpenaiModels(o.models || [])
    setOpenaiModelsWarning(o.warning || null)
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
      setProviders(sd.providers || [])
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
      if (openaiKey.trim()) body.openaiKey = openaiKey.trim()
      const res = await fetch('/api/admin/ai/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar')
      setAnthropicKey('')
      setVoyageKey('')
      setOpenaiKey('')
      if (data.openaiModelCheck) setTests((t) => ({ ...t, [`model:${data.openaiModelCheck.model}`]: data.openaiModelCheck }))
      if (data.defaultModelCheck) setTests((t) => ({ ...t, [`model:${data.defaultModelCheck.model}`]: data.defaultModelCheck }))
      setNotice('Ajustes guardados.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function providerAction(provider: ProviderId, action: 'reset' | 'simulate_down') {
    if (action === 'simulate_down' && !window.confirm(`¿Simular una caída de ${PROVIDER_NAME[provider]} durante 5 minutos? Las llamadas irán al otro proveedor (puede tardar hasta 15 s en aplicarse en todos los servidores).`)) return
    const res = await fetch('/api/admin/ai/providers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, action }) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError(data.error || 'Error'); return }
    setNotice(action === 'reset' ? `${PROVIDER_NAME[provider]}: se probará de nuevo en la próxima llamada.` : `${PROVIDER_NAME[provider]} marcado como caído durante 5 minutos (prueba).`)
    await load()
  }

  async function testProvider(provider: 'anthropic' | 'voyage' | 'openai') {
    setTesting(provider)
    const key = provider === 'anthropic' ? anthropicKey : provider === 'openai' ? openaiKey : voyageKey
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

  const modelSelect = (key: 'defaultModel' | 'fallbackModel' | 'openaiModel' | 'openaiFallbackModel', list: ModelOption[] = models) => (
    <div className="flex items-center gap-2 flex-wrap">
      <select value={value(key) || ''} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} className="border border-gray-200 rounded-xl px-3 py-2 text-sm min-w-[240px]">
        {[...list, ...(list.some((m) => m.id === value(key)) ? [] : [{ id: value(key) || '', displayName: value(key) || '' }])].map((m) => (
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

      {/* Text providers */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2"><ArrowLeftRight size={18} /> Proveedores de IA de texto</h2>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl">Si el primero falla por falta de crédito, clave inválida, límite o caída, la misma respuesta se pide al segundo antes de pasar la conversación a una persona. El tope mensual de cada cuenta suma los dos y nunca cambia de proveedor.</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm text-gray-700 flex items-center gap-2">
              Primero
              <select value={(value('providerOrder') || ['anthropic', 'openai'])[0]} onChange={(e) => setForm((f) => ({ ...f, providerOrder: e.target.value === 'openai' ? ['openai', 'anthropic'] : ['anthropic', 'openai'] }))} className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm">
                <option value="anthropic">Claude (Anthropic)</option>
                <option value="openai">OpenAI</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={value('failoverEnabled') !== false} onChange={(e) => setForm((f) => ({ ...f, failoverEnabled: e.target.checked }))} />
              Cambiar automáticamente al otro si falla
            </label>
          </div>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          {([
            ['anthropic', settings?.anthropicKey, anthropicKey, setAnthropicKey, 'sk-ant-…'],
            ['openai', settings?.openaiKey, openaiKey, setOpenaiKey, 'sk-…'],
          ] as const).map(([provider, masked, draft, setDraft, placeholder]) => {
            const state = providers.find((p) => p.provider === provider)
            const position = (value('providerOrder') || ['anthropic', 'openai']).indexOf(provider)
            return (
              <div key={provider} className="rounded-2xl border border-gray-200 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{PROVIDER_NAME[provider]}</span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">{position === 0 ? 'Principal' : 'Respaldo'}</span>
                  </div>
                  <ProviderStatus state={state} hasKey={Boolean(masked)} />
                </div>
                {state?.detail && state.status !== 'ok' && <p className="text-xs text-gray-500 break-words">{state.detail}</p>}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span><KeyRound size={12} className="inline mr-1" />{masked ? `Guardada: ${masked}` : 'Sin clave'}</span>
                  {state?.lastOkAt && <span>Última respuesta: {new Date(state.lastOkAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</span>}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <input type="password" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={masked ? 'Escribe una nueva para reemplazarla' : placeholder} className="flex-1 min-w-[200px] border border-gray-200 rounded-xl px-3 py-2 text-sm" autoComplete="off" />
                  <button onClick={() => testProvider(provider)} disabled={testing !== null || (!draft && !masked)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                    {testing === provider ? <Loader2 size={14} className="animate-spin" /> : <PlugZap size={14} />} Probar clave
                  </button>
                  {masked && (
                    <button onClick={() => { if (window.confirm(`¿Eliminar la clave de ${PROVIDER_NAME[provider]}?`)) save({ [provider === 'anthropic' ? 'anthropicKey' : 'openaiKey']: null }) }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-sm text-red-600 hover:bg-red-50">
                      <Trash2 size={14} /> Quitar
                    </button>
                  )}
                </div>
                <TestBadge result={tests[provider]} />
                {provider === 'openai' && (
                  <div className="space-y-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-700">Modelo principal (reemplaza a los modelos grandes de Claude)</label>
                      {modelSelect('openaiModel', openaiModels)}
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-700">Modelo económico (reemplaza al modelo de reserva y a Haiku; resúmenes)</label>
                      {modelSelect('openaiFallbackModel', openaiModels)}
                    </div>
                    {openaiModelsWarning && <p className="text-xs text-gray-500">{openaiModelsWarning}</p>}
                  </div>
                )}
                {masked && (
                  <div className="flex gap-2 flex-wrap pt-1">
                    {state && state.status !== 'ok' && (
                      <button onClick={() => providerAction(provider, 'reset')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-700 hover:bg-gray-50"><RotateCcw size={13} /> Forzar reintento</button>
                    )}
                    <button onClick={() => providerAction(provider, 'simulate_down')} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-gray-300 text-xs text-gray-500 hover:bg-gray-50"><Zap size={13} /> Simular caída 5 min (prueba)</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <button onClick={() => save()} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Guardar proveedores
        </button>
      </section>

      {/* Embeddings key */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><KeyRound size={18} /> Voyage AI (embeddings del conocimiento)</h2>
          <span className="text-xs text-gray-500">{settings?.voyageKey ? `Guardada: ${settings.voyageKey}` : 'Sin configurar'}</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <input type="password" value={voyageKey} onChange={(e) => setVoyageKey(e.target.value)} placeholder={settings?.voyageKey ? 'Escribe una nueva para reemplazarla' : 'pa-…'} className="flex-1 min-w-[240px] border border-gray-200 rounded-xl px-3 py-2 text-sm" autoComplete="off" />
          <button onClick={() => testProvider('voyage')} disabled={testing !== null || (!voyageKey && !settings?.voyageKey)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            {testing === 'voyage' ? <Loader2 size={14} className="animate-spin" /> : <PlugZap size={14} />} Probar conexión
          </button>
          {voyageKey && <button onClick={() => save()} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary-600 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"><Save size={14} /> Guardar</button>}
          {settings?.voyageKey && (
            <button onClick={() => { if (window.confirm('¿Eliminar la clave de Voyage AI?')) save({ voyageKey: null }) }} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-sm text-red-600 hover:bg-red-50">
              <Trash2 size={14} /> Quitar
            </button>
          )}
        </div>
        <TestBadge result={tests.voyage} />
        <p className="text-xs text-gray-500">Los embeddings siempre van con Voyage: mezclar vectores de dos modelos rompe la búsqueda. {settings?.voyageKey ? 'Si Voyage falla, el agente busca por palabras.' : 'Sin clave, el conocimiento funciona en modo léxico (búsqueda por palabras).'}</p>
      </section>

      {/* Models */}
      <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold text-gray-900">Modelos de Claude</h2>
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
                          <option value="anthropic">anthropic</option><option value="openai">openai</option><option value="voyage">voyage</option>
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
              ['Por proveedor (el que respondió)', (costs.byProvider ?? []).map((r) => ({ label: PROVIDER_NAME[r.provider] ?? r.provider, ...r }))],
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
