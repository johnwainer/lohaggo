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

  const load = async () => {
    const [cRes, fRes, rRes] = await Promise.all([
      fetch('/api/admin/cms'),
      fetch('/api/admin/feature-flags'),
      fetch('/api/admin/operational-rules'),
    ])
    const [cData, fData, rData] = await Promise.all([cRes.json(), fRes.json(), rRes.json()])
    setCms(cData.entries || [])
    setFlags(fData.flags || [])
    setRules(rData.rules || [])
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
