'use client'

import { useEffect, useState } from 'react'

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

  const load = async () => {
    const fData = await (await fetch('/api/admin/feature-flags')).json()
    const allFlags: FeatureFlag[] = fData.flags || []
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
    const body = {
      key,
      name: key === 'whatsapp_float_button' ? 'Botón WhatsApp flotante' : 'Botón Ayuda flotante',
      enabled: btn.enabled,
      rolloutPercentage: 100,
      metadata,
    }
    if (btn.id) {
      await fetch('/api/admin/feature-flags', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: btn.id, ...body }) })
    } else {
      await fetch('/api/admin/feature-flags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }
    setSavingFloat(false)
    await load()
  }

  useEffect(() => {
    load()
  }, [])

  const toggleFlag = async (flag: FeatureFlag) => {
    await fetch('/api/admin/feature-flags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...flag, enabled: !flag.enabled }),
    })
    await load()
  }

  const createFlag = async () => {
    if (!newFlagKey.trim() || !newFlagName.trim()) return
    await fetch('/api/admin/feature-flags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: newFlagKey.trim(), name: newFlagName.trim(), enabled: false, rolloutPercentage: 100 }),
    })
    setNewFlagKey('')
    setNewFlagName('')
    await load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Funciones y botones</h1>
        <p className="text-gray-600 mt-1">Enciende o apaga funciones del sitio y configura los botones flotantes, sin desplegar.</p>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold text-lg mb-3">Feature Flags</h2>
        <div className="grid md:grid-cols-3 gap-2 mb-3">
          <input value={newFlagKey} onChange={(e) => setNewFlagKey(e.target.value)} placeholder="feature key" className="border rounded-lg px-3 py-2 text-sm" />
          <input value={newFlagName} onChange={(e) => setNewFlagName(e.target.value)} placeholder="nombre" className="border rounded-lg px-3 py-2 text-sm" />
          <button onClick={createFlag} className="rounded-lg bg-primary-600 text-white text-sm px-3 py-2">Crear flag</button>
        </div>
        <div className="space-y-2">
          {flags.map((flag) => (
            <div key={flag.id} className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <p className="font-medium">{flag.name}</p>
                <p className="text-sm text-gray-500">{flag.key} · rollout {flag.rolloutPercentage}%</p>
              </div>
              <button onClick={() => toggleFlag(flag)} className={`px-3 py-1 rounded text-sm ${flag.enabled ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">💬</span>
              <h3 className="font-semibold text-gray-800">Botón WhatsApp</h3>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">❓</span>
              <div>
                <h3 className="font-semibold text-gray-800">Botón de Tutorial</h3>
                <p className="text-xs text-gray-500">Muestra u oculta el botón flotante del tutorial interactivo</p>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
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
