'use client'

import { useEffect, useState } from 'react'

type CmsEntry = {
  id: string
  key: string
  title: string
  status: 'DRAFT' | 'PUBLISHED'
  updatedAt: string
}

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

type Rule = {
  id: string
  key: string
  name: string
  enabled: boolean
  threshold: number
  windowMinutes: number
}

export default function AdminPlatformControlPage() {
  const [cms, setCms] = useState<CmsEntry[]>([])
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [newCmsKey, setNewCmsKey] = useState('')
  const [newCmsTitle, setNewCmsTitle] = useState('')
  const [newFlagKey, setNewFlagKey] = useState('')
  const [newFlagName, setNewFlagName] = useState('')
  const [newRuleKey, setNewRuleKey] = useState('')
  const [newRuleName, setNewRuleName] = useState('')
  const [newRuleThreshold, setNewRuleThreshold] = useState('10')
  const [waBtn, setWaBtn] = useState<FloatBtn>({ id: null, enabled: false, phone: '', message: '', url: '', label: '' })
  const [helpBtn, setHelpBtn] = useState<FloatBtn>({ id: null, enabled: false, phone: '', message: '', url: '', label: '' })
  const [savingFloat, setSavingFloat] = useState(false)

  const load = async () => {
    const [cRes, fRes, rRes] = await Promise.all([
      fetch('/api/admin/cms'),
      fetch('/api/admin/feature-flags'),
      fetch('/api/admin/operational-rules'),
    ])
    const [cData, fData, rData] = await Promise.all([cRes.json(), fRes.json(), rRes.json()])
    setCms(cData.entries || [])
    const allFlags: FeatureFlag[] = fData.flags || []
    setFlags(allFlags)
    setRules(rData.rules || [])

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

  const toggleRule = async (rule: Rule) => {
    await fetch('/api/admin/operational-rules', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...rule, enabled: !rule.enabled }),
    })
    await load()
  }

  const publishCms = async (entry: CmsEntry) => {
    await fetch('/api/admin/cms', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: entry.id, title: entry.title, content: '{}', status: 'PUBLISHED' }),
    })
    await load()
  }

  const createCms = async () => {
    if (!newCmsKey.trim() || !newCmsTitle.trim()) return
    await fetch('/api/admin/cms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: newCmsKey.trim(), title: newCmsTitle.trim(), content: '{}' }),
    })
    setNewCmsKey('')
    setNewCmsTitle('')
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

  const createRule = async () => {
    if (!newRuleKey.trim() || !newRuleName.trim()) return
    await fetch('/api/admin/operational-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: newRuleKey.trim(),
        name: newRuleName.trim(),
        threshold: Number(newRuleThreshold) || 10,
        windowMinutes: 5,
      }),
    })
    setNewRuleKey('')
    setNewRuleName('')
    setNewRuleThreshold('10')
    await load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Control de Plataforma</h1>
        <p className="text-gray-600 mt-1">Control de plataforma sin necesidad de despliegue.</p>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold text-lg mb-3">CMS</h2>
        <div className="grid md:grid-cols-3 gap-2 mb-3">
          <input value={newCmsKey} onChange={(e) => setNewCmsKey(e.target.value)} placeholder="key" className="border rounded-lg px-3 py-2 text-sm" />
          <input value={newCmsTitle} onChange={(e) => setNewCmsTitle(e.target.value)} placeholder="title" className="border rounded-lg px-3 py-2 text-sm" />
          <button onClick={createCms} className="rounded-lg bg-primary-600 text-white text-sm px-3 py-2">Crear entrada</button>
        </div>
        <div className="space-y-2">
          {cms.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <p className="font-medium">{entry.title}</p>
                <p className="text-sm text-gray-500">{entry.key} · {entry.status}</p>
              </div>
              <button onClick={() => publishCms(entry)} className="px-3 py-1 rounded bg-primary-600 text-white text-sm">Publicar</button>
            </div>
          ))}
        </div>
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

        {/* Help */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">❓</span>
              <h3 className="font-semibold text-gray-800">Botón de Ayuda</h3>
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
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">URL de ayuda</label>
              <input
                value={helpBtn.url}
                onChange={e => setHelpBtn(b => ({ ...b, url: e.target.value }))}
                placeholder="/how-it-works o https://..."
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Etiqueta del tooltip</label>
              <input
                value={helpBtn.label}
                onChange={e => setHelpBtn(b => ({ ...b, label: e.target.value }))}
                placeholder="Centro de ayuda"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            onClick={() => saveFloat('help_float_button', helpBtn, { url: helpBtn.url, label: helpBtn.label })}
            disabled={savingFloat}
            className="px-4 py-2 rounded-lg bg-gray-700 text-white text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {savingFloat ? 'Guardando…' : 'Guardar Ayuda'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="font-semibold text-lg mb-3">Reglas Operativas</h2>
        <div className="grid md:grid-cols-4 gap-2 mb-3">
          <input value={newRuleKey} onChange={(e) => setNewRuleKey(e.target.value)} placeholder="rule key" className="border rounded-lg px-3 py-2 text-sm" />
          <input value={newRuleName} onChange={(e) => setNewRuleName(e.target.value)} placeholder="nombre regla" className="border rounded-lg px-3 py-2 text-sm" />
          <input value={newRuleThreshold} onChange={(e) => setNewRuleThreshold(e.target.value)} type="number" min={1} placeholder="threshold" className="border rounded-lg px-3 py-2 text-sm" />
          <button onClick={createRule} className="rounded-lg bg-primary-600 text-white text-sm px-3 py-2">Crear regla</button>
        </div>
        <div className="space-y-2">
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <p className="font-medium">{rule.name}</p>
                <p className="text-sm text-gray-500">{rule.key} · umbral {rule.threshold} en {rule.windowMinutes}m</p>
              </div>
              <button onClick={() => toggleRule(rule)} className={`px-3 py-1 rounded text-sm ${rule.enabled ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
                {rule.enabled ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
