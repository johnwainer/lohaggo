'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, BarChart3, Filter, Globe, Headphones, Loader2, Search, Smartphone, Target, TrendingUp, Users, Wallet } from 'lucide-react'
import { BusinessTab, FunnelTab, PeopleTab, SearchTab, ServiceTab, SupplyTab, TrafficTab } from '@/components/admin/analytics/tabs'
import PwaTab from '@/components/admin/analytics/PwaTab'
import { OriginsTab } from '@/components/admin/analytics/OriginsTab'
import { CITY_LABEL, Empty } from '@/components/admin/analytics/ui'

const TABS = [
  { key: 'business', label: 'Negocio', icon: Wallet, help: 'Dinero cobrado, comisión, ticket y ventas por servicio, categoría y ciudad.', filters: true },
  { key: 'origins', label: 'Origen', icon: Target, help: 'De dónde vienen las solicitudes: canal, campaña y pieza, de la conversación a la venta, con el costo por solicitud de la pauta.', filters: false },
  { key: 'funnel', label: 'Embudo', icon: TrendingUp, help: 'De la búsqueda al pago, siguiendo cada solicitud: dónde se pierden los clientes.', filters: true },
  { key: 'supply', label: 'Oferta y demanda', icon: BarChart3, help: 'Qué se pide frente a los socios que lo ofrecen: dónde faltan socios y qué no encuentra la gente.', filters: true },
  { key: 'people', label: 'Clientes y socios', icon: Users, help: 'Registros, cohortes (activación y repetición) y de dónde llega cada cuenta.', filters: true },
  { key: 'service', label: 'Atención', icon: Headphones, help: 'Bandeja de entrada: volumen, tiempo de primera respuesta y cuánto resuelve la IA.', filters: false },
  { key: 'search', label: 'Búsquedas', icon: Search, help: 'Todo lo que se busca en el sitio, también visitantes y búsquedas sin resultados.', filters: false },
  { key: 'traffic', label: 'Tráfico web', icon: Globe, help: 'Visitas al sitio desde Google Analytics 4: usuarios, canales, páginas y dispositivos.', filters: false },
  { key: 'app', label: 'App (PWA)', icon: Smartphone, help: 'Instalaciones de la app y permisos de notificaciones.', filters: false },
] as const
type Tab = (typeof TABS)[number]['key']
const PRESETS = [['7d', '7 días'], ['30d', '30 días'], ['90d', '90 días'], ['12m', '12 meses']] as const
const isDate = (s?: string) => Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()))

function Ga4Connect({ onSaved }: { onSaved: () => void }) {
  const [info, setInfo] = useState<{ propertyId: string | null; serviceAccountEmail: string | null; canEdit: boolean } | null>(null)
  const [propertyId, setPropertyId] = useState('')
  const [credentials, setCredentials] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    fetch('/api/admin/analytics/ga4').then((r) => r.json()).then((d) => { setInfo(d); setPropertyId(d.propertyId || '') }).catch(() => null)
  }, [])
  async function save() {
    setSaving(true)
    setError(null)
    const res = await fetch('/api/admin/analytics/ga4', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId, ...(credentials.trim() ? { credentials } : {}) }) })
    const d = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) return setError(d.error || 'No se pudo guardar')
    setCredentials('')
    setInfo(d)
    onSaved()
  }
  if (!info) return <Loader2 className="animate-spin text-gray-400" />
  return (
    <div className="max-w-2xl space-y-4 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
      <div>
        <h3 className="font-semibold text-gray-900">Conectar Google Analytics 4</h3>
        <p className="mt-1 text-sm text-gray-600">El sitio ya envía visitas a Google Analytics. Para verlas aquí, el admin las lee con una cuenta de servicio de solo lectura.</p>
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-600">
        <li>En Google Cloud, crea una cuenta de servicio, activa la «Google Analytics Data API» y descarga su clave en JSON.</li>
        <li>En Google Analytics: Administrar → Acceso a la propiedad → agrega el correo de esa cuenta como <strong>Lector</strong>.</li>
        <li>Copia el ID de la propiedad (Administrar → Detalles de la propiedad; son solo números) y pega aquí el ID y el JSON.</li>
      </ol>
      {info.serviceAccountEmail && <p className="break-all rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Cuenta de servicio guardada: {info.serviceAccountEmail}</p>}
      {!info.canEdit ? <p className="text-sm text-amber-700">Solo un superadmin puede conectar Google Analytics.</p> : (
        <>
          <label className="block space-y-1"><span className="text-sm font-medium text-gray-800">ID de la propiedad</span>
            <input className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" value={propertyId} onChange={(e) => setPropertyId(e.target.value)} placeholder="Ej. 412345678" />
          </label>
          <label className="block space-y-1"><span className="text-sm font-medium text-gray-800">Clave JSON de la cuenta de servicio {info.serviceAccountEmail && '(déjalo vacío para conservar la actual)'}</span>
            <textarea className="w-full rounded-xl border border-gray-200 px-3 py-2 font-mono text-xs" rows={6} value={credentials} onChange={(e) => setCredentials(e.target.value)} placeholder='{"type": "service_account", ...}' />
            <span className="block text-xs text-gray-500">Se guarda cifrada y nunca vuelve a mostrarse.</span>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={save} disabled={saving || !propertyId.trim() || (!credentials.trim() && !info.serviceAccountEmail)} className="inline-flex items-center gap-2 rounded-full bg-primary-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving && <Loader2 size={15} className="animate-spin" />} Guardar y probar
          </button>
        </>
      )}
    </div>
  )
}

function AnalyticsInner() {
  const router = useRouter()
  const sp = useSearchParams()
  const tab = (TABS.some((t) => t.key === sp.get('tab')) ? sp.get('tab') : 'business') as Tab
  const [preset, setPreset] = useState('30d')
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null)
  const [city, setCity] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [model, setModel] = useState<'last' | 'first'>('last')
  const [options, setOptions] = useState<{ categories: Array<{ id: string; name: string }>; cities: string[] } | null>(null)
  const [data, setData] = useState<{ tab: Tab; period: { label: string }; data: Record<string, unknown> & { configured?: boolean } } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const meta = TABS.find((t) => t.key === tab)!
  // A custom range counts only once both dates are valid and in order; until then nothing is reloaded
  const rangeFrom = custom && isDate(custom.from) && isDate(custom.to) && custom.from <= custom.to ? custom.from : null
  const rangeTo = rangeFrom ? custom!.to : null
  const rangeReversed = Boolean(custom && isDate(custom.from) && isDate(custom.to) && custom.from > custom.to)
  const pending = Boolean(custom) && !rangeFrom
  // Only the latest request may write the result: a slow earlier one is aborted and ignored
  const seq = useRef(0)
  const inflight = useRef<AbortController | null>(null)
  useEffect(() => () => inflight.current?.abort(), [])

  useEffect(() => { fetch('/api/admin/analytics?tab=options').then((r) => r.json()).then(setOptions).catch(() => null) }, [])

  const load = useCallback(async () => {
    if (pending) return
    inflight.current?.abort()
    const id = ++seq.current
    if (tab === 'app') { inflight.current = null; setLoading(false); return }
    const ctrl = new AbortController()
    inflight.current = ctrl
    setData(null)
    setLoading(true)
    setError(null)
    const q = new URLSearchParams({ tab })
    if (rangeFrom && rangeTo) { q.set('from', rangeFrom); q.set('to', rangeTo) } else q.set('preset', preset)
    if (meta.filters && city) q.set('city', city)
    if (meta.filters && categoryId) q.set('categoryId', categoryId)
    if (tab === 'origins') q.set('model', model)
    try {
      const res = await fetch(`/api/admin/analytics?${q}`, { signal: ctrl.signal })
      const d = await res.json()
      if (id !== seq.current) return
      if (!res.ok) throw new Error(d.error || `Error ${res.status}`)
      setData({ ...d, tab })
    } catch (err) {
      if (id !== seq.current || ctrl.signal.aborted) return
      setError(err instanceof Error ? err.message : 'Error')
      setData(null)
    } finally {
      if (id === seq.current) setLoading(false)
    }
  }, [tab, preset, rangeFrom, rangeTo, pending, city, categoryId, meta.filters, model])
  useEffect(() => { load() }, [load])

  // Only the data fetched for this tab: another tab's shape would break the charts while switching
  const d = data?.tab === tab ? data.data : undefined
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analítica</h1>
          <p className="mt-1 text-sm text-gray-500">Cómo va el negocio en el tiempo y por qué. Lo que pasa ahora está en el Dashboard.</p>
        </div>
        {tab !== 'app' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex w-full rounded-xl border border-gray-200 bg-white p-0.5 text-sm sm:inline-flex sm:w-auto">
              {PRESETS.map(([k, label]) => (
                <button key={k} onClick={() => { setCustom(null); setPreset(k) }} className={`flex-1 whitespace-nowrap rounded-lg px-2 py-1.5 sm:flex-none sm:px-3 ${!custom && preset === k ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>{label}</button>
              ))}
            </div>
            <div className="flex w-full items-center gap-1 text-sm sm:w-auto">
              <input type="date" className="min-w-0 flex-1 rounded-xl border border-gray-200 px-2 py-1.5 sm:flex-none" value={custom?.from ?? ''} onChange={(e) => setCustom((c) => ({ from: e.target.value, to: c?.to || e.target.value }))} />
              <span className="text-gray-400">–</span>
              <input type="date" className="min-w-0 flex-1 rounded-xl border border-gray-200 px-2 py-1.5 sm:flex-none" value={custom?.to ?? ''} onChange={(e) => setCustom((c) => ({ from: c?.from || e.target.value, to: e.target.value }))} />
            </div>
            {rangeReversed && <p className="w-full text-xs text-red-600 sm:w-auto">La fecha inicial debe ser anterior o igual a la final.</p>}
          </div>
        )}
      </div>

      <nav className="flex flex-wrap gap-1 rounded-2xl border border-gray-200 bg-white p-1.5 sm:flex-nowrap sm:overflow-x-auto sm:[scrollbar-width:none]" aria-label="Pestañas">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => router.replace(`/admin/analytics?tab=${key}`, { scroll: false })} className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm sm:px-3 ${tab === key ? 'bg-primary-600 font-semibold text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-500">{meta.help}{data?.period && tab !== 'app' ? <span className="ml-2 whitespace-nowrap text-gray-400">· {data.period.label}</span> : null}</p>
        {meta.filters && options && (
          <div className="flex w-full items-center gap-2 text-sm sm:w-auto">
            <Filter size={14} className="shrink-0 text-gray-400" />
            <select className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 sm:flex-none" value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">Todas las ciudades</option>
              {options.cities.map((c) => <option key={c} value={c}>{CITY_LABEL[c] ?? c}</option>)}
            </select>
            <select className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 sm:flex-none" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Todas las categorías</option>
              {options.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {tab === 'app' ? <PwaTab /> : error ? (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}</div>
          {tab === 'traffic' && <Ga4Connect onSaved={load} />}
        </div>
      ) : !d || loading ? (
        <div className="flex items-center gap-2 py-16 text-gray-500"><Loader2 size={18} className="animate-spin" /> Calculando…</div>
      ) : tab === 'business' ? <BusinessTab d={d} />
        : tab === 'origins' ? <OriginsTab d={d} model={model} onModel={setModel} />
        : tab === 'funnel' ? <FunnelTab d={d} />
        : tab === 'supply' ? <SupplyTab d={d} />
        : tab === 'people' ? <PeopleTab d={d} />
        : tab === 'service' ? <ServiceTab d={d} />
        : tab === 'search' ? <SearchTab d={d} />
        : tab === 'traffic' ? (d.configured === false ? <Ga4Connect onSaved={load} /> : <TrafficTab d={d} />)
        : <Empty>Pestaña no disponible.</Empty>}
    </div>
  )
}

export default function AnalyticsPage() {
  return <Suspense fallback={null}><AnalyticsInner /></Suspense>
}
