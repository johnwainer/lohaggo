'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, RefreshCw, X } from 'lucide-react'

type FeatureFlag = {
  id: string
  key: string
  name: string
  enabled: boolean
  rolloutPercentage: number
  metadata?: string | null
}

type FloatBtn = {
  id: string | null
  enabled: boolean
  phone: string       // for whatsapp
  message: string     // for whatsapp
  url: string         // for help
  label: string       // for help
}

export default function AdminPlatformControlPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [newFlagKey, setNewFlagKey] = useState('')
  const [newFlagName, setNewFlagName] = useState('')
  const [waBtn, setWaBtn] = useState<FloatBtn>({ id: null, enabled: false, phone: '', message: '', url: '', label: '' })
  const [helpBtn, setHelpBtn] = useState<FloatBtn>({ id: null, enabled: false, phone: '', message: '', url: '', label: '' })
  const [savingFloat, setSavingFloat] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const errorFrom = async (res: Response) => {
    const data = await res.json().catch(() => null)
    if (res.status === 403) return (data && typeof data.error === 'string' && data.error) || 'Solo un superadmin puede cambiar esto'
    if (res.status === 401) return 'Tu sesión venció o no tienes permiso.'
    return (data && typeof data.error === 'string' && data.error) || `El servidor respondió ${res.status}.`
  }

  const load = async () => {
    try {
      const res = await fetch('/api/admin/feature-flags')
      if (!res.ok) throw new Error(await errorFrom(res))
      const fData = await res.json()
      applyFlags(fData.flags || [])
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error && err.message !== 'Failed to fetch' ? err.message : 'Sin conexión.')
    } finally {
      setLoading(false)
    }
  }

  const applyFlags = (allFlags: FeatureFlag[]) => {
    setFlags(allFlags)

    // Hydrate floating button state from feature flags
    const waFlag = allFlags.find(f => f.key === 'whatsapp_float_button')
    const helpFlag = allFlags.find(f => f.key === 'help_float_button')
    if (waFlag) {
      const m = safeJson(waFlag.metadata)
      setWaBtn({ id: waFlag.id, enabled: waFlag.enabled, phone: m.phone ?? '', message: m.message ?? '', url: '', label: '' })
    }
    if (helpFlag) {
      const m = safeJson(helpFlag.metadata)
      setHelpBtn({ id: helpFlag.id, enabled: helpFlag.enabled, phone: '', message: '', url: m.url ?? '', label: m.label ?? '' })
    }
  }

  const safeJson = (s?: string | null): Record<string, string> => {
    try { return s ? JSON.parse(s) : {} } catch { return {} }
  }

  const saveFloat = async (key: string, btn: FloatBtn, metadata: Record<string, string>) => {
    setSavingFloat(true)
    setActionError(null)
    const body = {
      key,
      name: key === 'whatsapp_float_button' ? 'Botón WhatsApp flotante' : 'Botón Ayuda flotante',
      enabled: btn.enabled,
      rolloutPercentage: 100,
      metadata,
    }
    try {
      const res = btn.id
        ? await fetch('/api/admin/feature-flags', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: btn.id, ...body }) })
        : await fetch('/api/admin/feature-flags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error(await errorFrom(res))
      await load()
    } catch (err) {
      setActionError(`No se pudo guardar el botón: ${err instanceof Error ? err.message : 'error desconocido'}`)
    } finally {
      setSavingFloat(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const toggleFlag = async (flag: FeatureFlag) => {
    setActionError(null)
    setFlags((list) => list.map((f) => (f.id === flag.id ? { ...f, enabled: !flag.enabled } : f)))
    try {
      const res = await fetch('/api/admin/feature-flags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...flag, enabled: !flag.enabled }),
      })
      if (!res.ok) throw new Error(await errorFrom(res))
      await load()
    } catch (err) {
      setFlags((list) => list.map((f) => (f.id === flag.id ? { ...f, enabled: flag.enabled } : f)))
      setActionError(`No se pudo cambiar «${flag.name}»: ${err instanceof Error ? err.message : 'error desconocido'}`)
    }
  }

  const createFlag = async () => {
    if (!newFlagKey.trim() || !newFlagName.trim() || creating) return
    setActionError(null)
    setCreating(true)
    try {
      const res = await fetch('/api/admin/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: newFlagKey.trim(), name: newFlagName.trim(), enabled: false, rolloutPercentage: 100 }),
      })
      if (!res.ok) throw new Error(await errorFrom(res))
      setNewFlagKey('')
      setNewFlagName('')
      await load()
    } catch (err) {
      setActionError(`No se pudo crear la función: ${err instanceof Error ? err.message : 'error desconocido'}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Funciones y botones</h1>
        <p className="text-gray-600 mt-1">Enciende o apaga funciones del sitio y configura los botones flotantes, sin desplegar.</p>
      </div>

      {loadError && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle size={16} className="shrink-0" />
          <span className="min-w-0 flex-1">No se pudieron cargar las funciones. {loadError}</span>
          <button onClick={() => { setLoading(true); load() }} className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"><RefreshCw size={13} /> Reintentar</button>
        </div>
      )}

      {actionError && (
        <div role="alert" className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1 break-words">{actionError}</span>
          <button onClick={() => setActionError(null)} aria-label="Cerrar" className="shrink-0 rounded-lg p-1 hover:bg-amber-100"><X size={14} /></button>
        </div>
      )}

      <div className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold text-lg mb-3">Feature Flags</h2>
        <div className="grid md:grid-cols-3 gap-2 mb-3">
          <input value={newFlagKey} onChange={(e) => setNewFlagKey(e.target.value)} placeholder="feature key" className="border rounded-lg px-3 py-2 text-sm" />
          <input value={newFlagName} onChange={(e) => setNewFlagName(e.target.value)} placeholder="nombre" className="border rounded-lg px-3 py-2 text-sm" />
          <button onClick={createFlag} disabled={creating} className="rounded-lg bg-primary-600 text-white text-sm px-3 py-2 disabled:opacity-60">{creating ? 'Creando…' : 'Crear flag'}</button>
        </div>
        <div className="space-y-2">
          {loading && flags.length === 0 && (
            <p className="flex items-center gap-2 py-4 text-sm text-gray-400"><Loader2 size={16} className="animate-spin" /> Cargando…</p>
          )}
          {flags.map((flag) => (
            <div key={flag.id} className="flex items-center justify-between gap-3 border rounded-lg p-3">
              <div className="min-w-0">
                <p className="font-medium break-words">{flag.name}</p>
                <p className="text-sm text-gray-500 break-all">{flag.key} · rollout {flag.rolloutPercentage}%</p>
              </div>
              <button onClick={() => toggleFlag(flag)} className={`flex-shrink-0 min-h-9 px-3 py-1 rounded text-sm sm:min-h-0 ${flag.enabled ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
                {flag.enabled ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Floating Buttons ── */}
      <div className="rounded-xl border bg-white p-4 space-y-5">
        <h2 className="font-semibold text-lg">Botones flotantes</h2>
        <p className="text-sm text-gray-500 -mt-3">Se muestran en la esquina inferior derecha para todos los visitantes del sitio.</p>

        {/* WhatsApp */}
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-lg">💬</span>
              <h3 className="font-semibold text-gray-800">Botón WhatsApp</h3>
            </div>
            <label className="flex flex-shrink-0 items-center gap-2 cursor-pointer">
              <span className="text-sm text-gray-600">{waBtn.enabled ? 'Visible' : 'Oculto'}</span>
              <div
                onClick={() => setWaBtn(b => ({ ...b, enabled: !b.enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${waBtn.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${waBtn.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </div>
            </label>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Número WhatsApp (con código país)</label>
              <input
                value={waBtn.phone}
                onChange={e => setWaBtn(b => ({ ...b, phone: e.target.value }))}
                placeholder="+573001234567"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Mensaje inicial (opcional)</label>
              <input
                value={waBtn.message}
                onChange={e => setWaBtn(b => ({ ...b, message: e.target.value }))}
                placeholder="Hola, necesito ayuda con..."
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            onClick={() => saveFloat('whatsapp_float_button', waBtn, { phone: waBtn.phone, message: waBtn.message })}
            disabled={savingFloat}
            className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {savingFloat ? 'Guardando…' : 'Guardar WhatsApp'}
          </button>
        </div>

        {/* Help / Tutorial */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-lg">❓</span>
              <div>
                <h3 className="font-semibold text-gray-800">Botón de Tutorial</h3>
                <p className="text-xs text-gray-500">Muestra u oculta el botón flotante del tutorial interactivo</p>
              </div>
            </div>
            <label className="flex flex-shrink-0 items-center gap-2 cursor-pointer">
              <span className="text-sm text-gray-600">{helpBtn.enabled ? 'Visible' : 'Oculto'}</span>
              <div
                onClick={() => setHelpBtn(b => ({ ...b, enabled: !b.enabled }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${helpBtn.enabled ? 'bg-gray-700' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${helpBtn.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </div>
            </label>
          </div>
          <button
            onClick={() => saveFloat('help_float_button', helpBtn, {})}
            disabled={savingFloat}
            className="px-4 py-2 rounded-lg bg-gray-700 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {savingFloat ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

    </div>
  )
}
