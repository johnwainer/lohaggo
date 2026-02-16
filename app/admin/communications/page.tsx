'use client'

import { useEffect, useMemo, useState } from 'react'

type Template = {
  id: string
  key: string
  name: string
  channel: 'SMS' | 'WHATSAPP' | 'EMAIL' | 'PUSH'
  subject: string | null
  body: string
  isActive: boolean
}

type Campaign = {
  id: string
  name: string
  channel: 'SMS' | 'WHATSAPP' | 'EMAIL' | 'PUSH'
  status: 'DRAFT' | 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'PARTIAL' | 'FAILED' | 'CANCELLED'
  totalRecipients: number
  totalSent: number
  totalFailed: number
  targetRole: 'CLIENT' | 'PARTNER' | 'ADMIN' | null
  targetCity: string | null
  createdAt: string
  abTestEnabled?: boolean
}

type RecipientPreview = {
  id: string
  name: string
  email: string
  phone: string | null
  role: 'CLIENT' | 'PARTNER' | 'ADMIN'
  source: 'SEGMENT' | 'MANUAL'
  destination: string | null
  eligible: boolean
  reason: string | null
}

type RecipientSummary = {
  total: number
  eligible: number
  ineligible: number
  segmentCount: number
  manualIncludedCount: number
  excludedCount: number
  includeUserIds: string[]
  excludeUserIds: string[]
}

type CampaignMetrics = {
  metrics: {
    byStatus: Record<string, number>
    byVariant: Record<string, number>
    deliverabilityRate: number
  }
}

type Overview = {
  totals: {
    campaigns: number
    recipients: number
    sent: number
    failed: number
    deliverabilityRate: number
  }
}

type ProviderState = {
  twilio: {
    active: boolean
    accountSid: string
    smsFrom: string
    whatsappFrom: string
    hasAuthToken?: boolean
  }
  sendgrid: {
    active: boolean
    fromEmail: string
    apiKey: string
    hasApiKey?: boolean
  }
}

type Panel = 'OVERVIEW' | 'CONFIG' | 'CAMPAIGNS' | 'CREATE' | 'ANALYTICS'

const PANEL_OPTIONS: Array<{ id: Panel; label: string }> = [
  { id: 'OVERVIEW', label: 'Resumen' },
  { id: 'CONFIG', label: 'Configuración' },
  { id: 'CAMPAIGNS', label: 'Campañas' },
  { id: 'CREATE', label: 'Crear campaña' },
  { id: 'ANALYTICS', label: 'Analytics' },
]

const CITY_OPTIONS = ['MEDELLIN', 'BOGOTA', 'CALI', 'BARRANQUILLA']

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
}

function percent(part: number, total: number) {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

export default function AdminCommunicationsPage() {
  const [activePanel, setActivePanel] = useState<Panel>('OVERVIEW')

  const [templates, setTemplates] = useState<Template[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [selectedMetrics, setSelectedMetrics] = useState<CampaignMetrics | null>(null)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [providers, setProviders] = useState<ProviderState | null>(null)
  const [loading, setLoading] = useState(true)

  const [tplForm, setTplForm] = useState({
    key: '',
    name: '',
    channel: 'SMS',
    subject: '',
    body: '',
  })

  const [campForm, setCampForm] = useState({
    name: '',
    channel: 'SMS',
    targetRole: 'CLIENT',
    targetCity: '',
    customSubject: '',
    customBody: '',
    templateId: '',
    scheduledAt: '',
    abTestEnabled: false,
    abVariantAKey: 'A',
    abVariantABody: '',
    abVariantASubject: '',
    abVariantBKey: 'B',
    abVariantBBody: '',
    abVariantBSubject: '',
    abSplitA: '50',
  })
  const [twilioForm, setTwilioForm] = useState({
    isActive: true,
    accountSid: '',
    authToken: '',
    smsFrom: '',
    whatsappFrom: '',
  })
  const [sendgridForm, setSendgridForm] = useState({
    isActive: true,
    fromEmail: '',
    apiKey: '',
  })
  const [recipientSearch, setRecipientSearch] = useState('')
  const [recipientIncludeIds, setRecipientIncludeIds] = useState<string[]>([])
  const [recipientExcludeIds, setRecipientExcludeIds] = useState<string[]>([])
  const [recipientPreview, setRecipientPreview] = useState<RecipientPreview[]>([])
  const [recipientSummary, setRecipientSummary] = useState<RecipientSummary | null>(null)
  const [campaignRecipientPreview, setCampaignRecipientPreview] = useState<{
    campaignId: string
    recipients: RecipientPreview[]
    summary: RecipientSummary | null
  } | null>(null)
  const [loadingRecipients, setLoadingRecipients] = useState(false)

  const selectedCampaign = useMemo(
    () => campaigns.find((item) => item.id === selectedCampaignId) || null,
    [campaigns, selectedCampaignId]
  )

  const orderedCampaigns = useMemo(
    () => [...campaigns].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [campaigns]
  )

  const recentCampaigns = orderedCampaigns.slice(0, 5)

  const load = async () => {
    setLoading(true)
    try {
      const [tplRes, campRes, ovRes, pvRes] = await Promise.all([
        fetch('/api/admin/messaging/templates', { cache: 'no-store' }),
        fetch('/api/admin/messaging/campaigns', { cache: 'no-store' }),
        fetch('/api/admin/messaging/overview', { cache: 'no-store' }),
        fetch('/api/admin/messaging/providers', { cache: 'no-store' }),
      ])
      const [tplData, campData, ovData, pvData] = await Promise.all([tplRes.json(), campRes.json(), ovRes.json(), pvRes.json()])
      setTemplates(tplData.templates || [])
      setCampaigns(campData.campaigns || [])
      setOverview(ovData)
      setProviders(pvData.providers || null)
    } finally {
      setLoading(false)
    }
  }

  const loadMetrics = async (campaignId: string, forceAnalytics = false) => {
    const response = await fetch(`/api/admin/messaging/campaigns/${campaignId}/metrics`, { cache: 'no-store' })
    const data = await response.json()
    setSelectedMetrics(data)
    setSelectedCampaignId(campaignId)
    if (forceAnalytics) {
      setActivePanel('ANALYTICS')
    }
  }

  const loadRecipientPreview = async (options?: { forCampaignId?: string; channel?: Campaign['channel'] }) => {
    setLoadingRecipients(true)
    try {
      const params = new URLSearchParams()
      params.set('channel', options?.channel || campForm.channel)
      params.set('search', recipientSearch)
      if (options?.forCampaignId) {
        params.set('campaignId', options.forCampaignId)
      } else {
        if (campForm.targetRole) params.set('targetRole', campForm.targetRole)
        if (campForm.targetCity) params.set('targetCity', campForm.targetCity)
        if (recipientIncludeIds.length) params.set('includeUserIds', recipientIncludeIds.join(','))
        if (recipientExcludeIds.length) params.set('excludeUserIds', recipientExcludeIds.join(','))
      }

      const response = await fetch(`/api/admin/messaging/recipients?${params.toString()}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) return

      if (options?.forCampaignId) {
        setCampaignRecipientPreview({
          campaignId: options.forCampaignId,
          recipients: data.recipients || [],
          summary: data.summary || null,
        })
      } else {
        setRecipientPreview(data.recipients || [])
        setRecipientSummary(data.summary || null)
      }
    } finally {
      setLoadingRecipients(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!providers) return
    setTwilioForm((prev) => ({
      ...prev,
      isActive: providers.twilio.active,
      accountSid: '',
      smsFrom: providers.twilio.smsFrom || '',
      whatsappFrom: providers.twilio.whatsappFrom || '',
    }))
    setSendgridForm((prev) => ({
      ...prev,
      isActive: providers.sendgrid.active,
      fromEmail: providers.sendgrid.fromEmail || '',
    }))
  }, [providers])

  useEffect(() => {
    if (activePanel !== 'CREATE') return
    void loadRecipientPreview()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanel, campForm.channel, campForm.targetRole, campForm.targetCity, recipientIncludeIds, recipientExcludeIds])

  const createTemplate = async () => {
    if (!tplForm.key || !tplForm.name || !tplForm.body) return
    await fetch('/api/admin/messaging/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...tplForm,
        channel: tplForm.channel,
        subject: tplForm.subject || null,
      }),
    })
    setTplForm({ key: '', name: '', channel: 'SMS', subject: '', body: '' })
    await load()
  }

  const createCampaign = async () => {
    if (!campForm.name || !campForm.customBody) return
    const splitA = Math.min(99, Math.max(1, Number(campForm.abSplitA) || 50))
    const splitB = 100 - splitA
    await fetch('/api/admin/messaging/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...campForm,
        channel: campForm.channel,
        targetRole: campForm.targetRole || null,
        targetCity: campForm.targetCity || null,
        customSubject: campForm.customSubject || null,
        templateId: campForm.templateId || null,
        status: campForm.scheduledAt ? 'SCHEDULED' : 'DRAFT',
        scheduledAt: campForm.scheduledAt || null,
        abTestEnabled: campForm.abTestEnabled,
        abTestConfig: campForm.abTestEnabled
          ? {
              variants: [
                {
                  key: campForm.abVariantAKey || 'A',
                  subject: campForm.abVariantASubject || null,
                  body: campForm.abVariantABody || campForm.customBody,
                  allocation: splitA,
                },
                {
                  key: campForm.abVariantBKey || 'B',
                  subject: campForm.abVariantBSubject || null,
                  body: campForm.abVariantBBody || campForm.customBody,
                  allocation: splitB,
                },
              ],
            }
          : null,
        includeUserIds: recipientIncludeIds,
        excludeUserIds: recipientExcludeIds,
      }),
    })
    setCampForm({
      name: '',
      channel: 'SMS',
      targetRole: 'CLIENT',
      targetCity: '',
      customSubject: '',
      customBody: '',
      templateId: '',
      scheduledAt: '',
      abTestEnabled: false,
      abVariantAKey: 'A',
      abVariantABody: '',
      abVariantASubject: '',
      abVariantBKey: 'B',
      abVariantBBody: '',
      abVariantBSubject: '',
      abSplitA: '50',
    })
    setRecipientSearch('')
    setRecipientIncludeIds([])
    setRecipientExcludeIds([])
    setRecipientPreview([])
    setRecipientSummary(null)
    await load()
    setActivePanel('CAMPAIGNS')
  }

  const sendCampaign = async (campaignId: string) => {
    await fetch(`/api/admin/messaging/campaigns/${campaignId}/send`, { method: 'POST' })
    await load()
    await loadMetrics(campaignId)
  }

  const runScheduled = async () => {
    await fetch('/api/admin/messaging/run-scheduled', { method: 'POST' })
    await load()
  }

  const toggleIncludeRecipient = (userId: string) => {
    setRecipientExcludeIds((prev) => prev.filter((id) => id !== userId))
    setRecipientIncludeIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]))
  }

  const toggleExcludeRecipient = (userId: string) => {
    setRecipientIncludeIds((prev) => prev.filter((id) => id !== userId))
    setRecipientExcludeIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]))
  }

  const saveTwilio = async () => {
    await fetch('/api/admin/messaging/providers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'TWILIO',
        isActive: twilioForm.isActive,
        accountSid: twilioForm.accountSid,
        authToken: twilioForm.authToken,
        smsFrom: twilioForm.smsFrom || null,
        whatsappFrom: twilioForm.whatsappFrom || null,
      }),
    })
    setTwilioForm((prev) => ({ ...prev, authToken: '' }))
    await load()
  }

  const saveSendgrid = async () => {
    await fetch('/api/admin/messaging/providers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'SENDGRID',
        isActive: sendgridForm.isActive,
        fromEmail: sendgridForm.fromEmail,
        apiKey: sendgridForm.apiKey,
      }),
    })
    setSendgridForm((prev) => ({ ...prev, apiKey: '' }))
    await load()
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Comunicaciones Omnicanal</h1>
        <p className="text-gray-600 mt-1">
          Pilar de comunicacion del admin: credenciales, campañas, ejecucion y analítica operativa por SMS, WhatsApp, Email y PUSH.
        </p>
      </div>

      <nav className="rounded-xl border bg-white p-2">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {PANEL_OPTIONS.map((panel) => (
            <button
              key={panel.id}
              onClick={() => setActivePanel(panel.id)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                activePanel === panel.id ? 'bg-primary-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {panel.label}
            </button>
          ))}
        </div>
      </nav>

      {loading ? (
        <div className="rounded-xl border bg-white p-6">Cargando...</div>
      ) : (
        <>
          {activePanel === 'OVERVIEW' && (
            <section className="space-y-4">
              {overview && (
                <div className="rounded-xl border bg-white p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Campañas</p>
                    <p className="text-2xl font-bold">{overview.totals.campaigns}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Destinatarios</p>
                    <p className="text-2xl font-bold">{overview.totals.recipients}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Enviados</p>
                    <p className="text-2xl font-bold">{overview.totals.sent}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Fallidos</p>
                    <p className="text-2xl font-bold">{overview.totals.failed}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Deliverability</p>
                    <p className="text-2xl font-bold">{overview.totals.deliverabilityRate}%</p>
                  </div>
                </div>
              )}

              <div className="rounded-xl border bg-white p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">Últimas campañas</h2>
                  <button className="border rounded px-3 py-2 text-sm" onClick={() => setActivePanel('CAMPAIGNS')}>
                    Ver todas
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Campaña</th>
                        <th className="px-3 py-2 text-left font-medium">Canal</th>
                        <th className="px-3 py-2 text-left font-medium">Estado</th>
                        <th className="px-3 py-2 text-left font-medium">Enviados</th>
                        <th className="px-3 py-2 text-left font-medium">Fallidos</th>
                        <th className="px-3 py-2 text-left font-medium">Creada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentCampaigns.map((campaign) => (
                        <tr key={campaign.id} className="border-t">
                          <td className="px-3 py-2 font-medium text-gray-900">{campaign.name}</td>
                          <td className="px-3 py-2">{campaign.channel}</td>
                          <td className="px-3 py-2">{campaign.status}</td>
                          <td className="px-3 py-2">{campaign.totalSent}</td>
                          <td className="px-3 py-2">{campaign.totalFailed}</td>
                          <td className="px-3 py-2">{formatDate(campaign.createdAt)}</td>
                        </tr>
                      ))}
                      {recentCampaigns.length === 0 && (
                        <tr>
                          <td className="px-3 py-4 text-gray-500" colSpan={6}>
                            Sin campañas registradas.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {activePanel === 'CONFIG' && (
            <section className="rounded-xl border bg-white p-4 space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Configuración de proveedores</h2>
                <p className="text-sm text-gray-600">Gestion centralizada y cifrada de credenciales operativas.</p>
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4 space-y-2">
                  <div>
                    <h3 className="font-semibold">Twilio (SMS/WhatsApp)</h3>
                    <p className="text-xs text-gray-500">
                      Estado: {providers?.twilio?.active ? 'ACTIVO' : 'INACTIVO'} · SID {providers?.twilio?.accountSid || 'n/a'}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={twilioForm.isActive} onChange={(e) => setTwilioForm((p) => ({ ...p, isActive: e.target.checked }))} />
                    Activar Twilio
                  </label>
                  <input className="border rounded px-2 py-2 text-sm w-full" placeholder="Account SID" value={twilioForm.accountSid} onChange={(e) => setTwilioForm((p) => ({ ...p, accountSid: e.target.value }))} />
                  <input className="border rounded px-2 py-2 text-sm w-full" placeholder="Auth Token" type="password" value={twilioForm.authToken} onChange={(e) => setTwilioForm((p) => ({ ...p, authToken: e.target.value }))} />
                  <input className="border rounded px-2 py-2 text-sm w-full" placeholder="SMS From" value={twilioForm.smsFrom} onChange={(e) => setTwilioForm((p) => ({ ...p, smsFrom: e.target.value }))} />
                  <input className="border rounded px-2 py-2 text-sm w-full" placeholder="WhatsApp From" value={twilioForm.whatsappFrom} onChange={(e) => setTwilioForm((p) => ({ ...p, whatsappFrom: e.target.value }))} />
                  <button className="bg-primary-600 text-white rounded px-3 py-2 text-sm" onClick={saveTwilio}>
                    Guardar Twilio
                  </button>
                </div>

                <div className="border rounded-lg p-4 space-y-2">
                  <div>
                    <h3 className="font-semibold">SendGrid (Email)</h3>
                    <p className="text-xs text-gray-500">
                      Estado: {providers?.sendgrid?.active ? 'ACTIVO' : 'INACTIVO'} · From {providers?.sendgrid?.fromEmail || 'n/a'}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={sendgridForm.isActive} onChange={(e) => setSendgridForm((p) => ({ ...p, isActive: e.target.checked }))} />
                    Activar SendGrid
                  </label>
                  <input className="border rounded px-2 py-2 text-sm w-full" placeholder="From Email" value={sendgridForm.fromEmail} onChange={(e) => setSendgridForm((p) => ({ ...p, fromEmail: e.target.value }))} />
                  <input className="border rounded px-2 py-2 text-sm w-full" placeholder="API Key" type="password" value={sendgridForm.apiKey} onChange={(e) => setSendgridForm((p) => ({ ...p, apiKey: e.target.value }))} />
                  <button className="bg-primary-600 text-white rounded px-3 py-2 text-sm" onClick={saveSendgrid}>
                    Guardar SendGrid
                  </button>
                </div>
              </div>
            </section>
          )}

          {activePanel === 'CAMPAIGNS' && (
            <section className="rounded-xl border bg-white p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">Tabla de campañas</h2>
                  <p className="text-sm text-gray-600">Operación, ejecucion y acceso rapido a metricas.</p>
                </div>
                <div className="flex gap-2">
                  <button className="border rounded px-3 py-2 text-sm" onClick={runScheduled}>
                    Ejecutar programadas
                  </button>
                  <button className="bg-primary-600 text-white rounded px-3 py-2 text-sm" onClick={() => setActivePanel('CREATE')}>
                    Nueva campaña
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Nombre</th>
                      <th className="px-3 py-2 text-left font-medium">Canal</th>
                      <th className="px-3 py-2 text-left font-medium">Segmento</th>
                      <th className="px-3 py-2 text-left font-medium">Estado</th>
                      <th className="px-3 py-2 text-left font-medium">Destinatarios</th>
                      <th className="px-3 py-2 text-left font-medium">Enviados</th>
                      <th className="px-3 py-2 text-left font-medium">Fallidos</th>
                      <th className="px-3 py-2 text-left font-medium">Creada</th>
                      <th className="px-3 py-2 text-right font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderedCampaigns.map((campaign) => (
                      <tr key={campaign.id} className="border-t">
                        <td className="px-3 py-2 font-medium text-gray-900">{campaign.name}</td>
                        <td className="px-3 py-2">{campaign.channel}</td>
                        <td className="px-3 py-2">{campaign.targetRole || 'ALL'} {campaign.targetCity ? `/${campaign.targetCity}` : ''}</td>
                        <td className="px-3 py-2">{campaign.status}</td>
                        <td className="px-3 py-2">{campaign.totalRecipients}</td>
                        <td className="px-3 py-2">{campaign.totalSent}</td>
                        <td className="px-3 py-2">{campaign.totalFailed}</td>
                        <td className="px-3 py-2">{formatDate(campaign.createdAt)}</td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
                            <button
                              className="border rounded px-2 py-1 text-xs"
                              onClick={() => void loadRecipientPreview({ forCampaignId: campaign.id, channel: campaign.channel })}
                            >
                              Destinatarios
                            </button>
                            <button className="border rounded px-2 py-1 text-xs" onClick={() => loadMetrics(campaign.id, true)}>
                              Métricas
                            </button>
                            <button className="bg-primary-600 text-white rounded px-2 py-1 text-xs" onClick={() => sendCampaign(campaign.id)}>
                              Enviar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {orderedCampaigns.length === 0 && (
                      <tr>
                        <td className="px-3 py-4 text-gray-500" colSpan={9}>
                          Sin campañas registradas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {campaignRecipientPreview && (
                <div className="rounded-lg border bg-gray-50 p-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-gray-900">Vista de destinatarios de campaña</h3>
                    <button
                      className="border rounded px-2 py-1 text-xs"
                      onClick={() => setCampaignRecipientPreview(null)}
                    >
                      Cerrar
                    </button>
                  </div>
                  {campaignRecipientPreview.summary && (
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
                      <div className="rounded border bg-white px-2 py-1">Total: <b>{campaignRecipientPreview.summary.total}</b></div>
                      <div className="rounded border bg-white px-2 py-1">Elegibles: <b>{campaignRecipientPreview.summary.eligible}</b></div>
                      <div className="rounded border bg-white px-2 py-1">Sin destino: <b>{campaignRecipientPreview.summary.ineligible}</b></div>
                      <div className="rounded border bg-white px-2 py-1">Segmento: <b>{campaignRecipientPreview.summary.segmentCount}</b></div>
                      <div className="rounded border bg-white px-2 py-1">Agregados: <b>{campaignRecipientPreview.summary.manualIncludedCount}</b></div>
                      <div className="rounded border bg-white px-2 py-1">Excluidos: <b>{campaignRecipientPreview.summary.excludedCount}</b></div>
                    </div>
                  )}
                  <div className="max-h-72 overflow-auto rounded border bg-white">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-100 text-gray-600">
                        <tr>
                          <th className="px-2 py-2 text-left font-medium">Usuario</th>
                          <th className="px-2 py-2 text-left font-medium">Rol</th>
                          <th className="px-2 py-2 text-left font-medium">Origen</th>
                          <th className="px-2 py-2 text-left font-medium">Destino</th>
                          <th className="px-2 py-2 text-left font-medium">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {campaignRecipientPreview.recipients.map((recipient) => (
                          <tr key={recipient.id} className="border-t">
                            <td className="px-2 py-2">
                              <p className="font-medium text-gray-900">{recipient.name}</p>
                              <p className="text-gray-500">{recipient.email}</p>
                            </td>
                            <td className="px-2 py-2">{recipient.role}</td>
                            <td className="px-2 py-2">{recipient.source === 'MANUAL' ? 'MANUAL' : 'SEGMENTO'}</td>
                            <td className="px-2 py-2">{recipient.destination || '-'}</td>
                            <td className={`px-2 py-2 ${recipient.eligible ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {recipient.eligible ? 'OK' : recipient.reason || 'No elegible'}
                            </td>
                          </tr>
                        ))}
                        {campaignRecipientPreview.recipients.length === 0 && (
                          <tr>
                            <td className="px-2 py-3 text-gray-500" colSpan={5}>
                              No hay destinatarios para esta configuración.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}

          {activePanel === 'CREATE' && (
            <section className="space-y-4">
              <div className="rounded-xl border bg-white p-4 space-y-3">
                <h2 className="text-lg font-semibold">Crear plantilla</h2>
                <div className="grid md:grid-cols-5 gap-2">
                  <input className="border rounded px-2 py-2 text-sm" placeholder="key" value={tplForm.key} onChange={(e) => setTplForm((p) => ({ ...p, key: e.target.value }))} />
                  <input className="border rounded px-2 py-2 text-sm" placeholder="nombre" value={tplForm.name} onChange={(e) => setTplForm((p) => ({ ...p, name: e.target.value }))} />
                  <select className="border rounded px-2 py-2 text-sm" value={tplForm.channel} onChange={(e) => setTplForm((p) => ({ ...p, channel: e.target.value }))}>
                    <option value="SMS">SMS</option>
                    <option value="WHATSAPP">WHATSAPP</option>
                    <option value="EMAIL">EMAIL</option>
                    <option value="PUSH">PUSH</option>
                  </select>
                  <input className="border rounded px-2 py-2 text-sm" placeholder="subject (email)" value={tplForm.subject} onChange={(e) => setTplForm((p) => ({ ...p, subject: e.target.value }))} />
                  <button className="bg-primary-600 text-white rounded px-3 py-2 text-sm" onClick={createTemplate}>
                    Crear plantilla
                  </button>
                </div>
                <textarea className="w-full border rounded px-2 py-2 text-sm min-h-[90px]" placeholder="body con variables: {{user_name}}" value={tplForm.body} onChange={(e) => setTplForm((p) => ({ ...p, body: e.target.value }))} />
              </div>

              <div className="rounded-xl border bg-white p-4 space-y-3">
                <h2 className="text-lg font-semibold">Crear campaña</h2>
                <div className="grid md:grid-cols-3 gap-2">
                  <input className="border rounded px-2 py-2 text-sm" placeholder="nombre campaña" value={campForm.name} onChange={(e) => setCampForm((p) => ({ ...p, name: e.target.value }))} />
                  <select className="border rounded px-2 py-2 text-sm" value={campForm.channel} onChange={(e) => setCampForm((p) => ({ ...p, channel: e.target.value }))}>
                    <option value="SMS">SMS</option>
                    <option value="WHATSAPP">WHATSAPP</option>
                    <option value="EMAIL">EMAIL</option>
                    <option value="PUSH">PUSH</option>
                  </select>
                  <select className="border rounded px-2 py-2 text-sm" value={campForm.targetRole} onChange={(e) => setCampForm((p) => ({ ...p, targetRole: e.target.value }))}>
                    <option value="CLIENT">CLIENTES</option>
                    <option value="PARTNER">SOCIOS</option>
                  </select>
                </div>
                <div className="grid md:grid-cols-3 gap-2">
                  <select className="border rounded px-2 py-2 text-sm" value={campForm.templateId} onChange={(e) => setCampForm((p) => ({ ...p, templateId: e.target.value }))}>
                    <option value="">Sin plantilla</option>
                    {templates
                      .filter((t) => t.channel === campForm.channel)
                      .map((tpl) => (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.name}
                        </option>
                      ))}
                  </select>
                  <select className="border rounded px-2 py-2 text-sm" value={campForm.targetCity} onChange={(e) => setCampForm((p) => ({ ...p, targetCity: e.target.value }))}>
                    <option value="">Todas las ciudades</option>
                    {CITY_OPTIONS.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                  <input className="border rounded px-2 py-2 text-sm" placeholder="subject (email)" value={campForm.customSubject} onChange={(e) => setCampForm((p) => ({ ...p, customSubject: e.target.value }))} />
                </div>
                <div className="grid md:grid-cols-3 gap-2">
                  <input className="border rounded px-2 py-2 text-sm" type="datetime-local" value={campForm.scheduledAt} onChange={(e) => setCampForm((p) => ({ ...p, scheduledAt: e.target.value }))} />
                  <label className="flex items-center gap-2 text-sm border rounded px-2 py-2">
                    <input type="checkbox" checked={campForm.abTestEnabled} onChange={(e) => setCampForm((p) => ({ ...p, abTestEnabled: e.target.checked }))} />
                    Activar A/B test
                  </label>
                  <input className="border rounded px-2 py-2 text-sm" type="number" min={1} max={99} placeholder="% variante A" value={campForm.abSplitA} onChange={(e) => setCampForm((p) => ({ ...p, abSplitA: e.target.value }))} />
                </div>
                {campForm.abTestEnabled && (
                  <div className="grid md:grid-cols-2 gap-2">
                    <div className="border rounded p-2 space-y-2">
                      <p className="text-sm font-semibold">Variante A</p>
                      <input className="border rounded px-2 py-2 text-sm w-full" placeholder="Key A" value={campForm.abVariantAKey} onChange={(e) => setCampForm((p) => ({ ...p, abVariantAKey: e.target.value }))} />
                      <input className="border rounded px-2 py-2 text-sm w-full" placeholder="Subject A" value={campForm.abVariantASubject} onChange={(e) => setCampForm((p) => ({ ...p, abVariantASubject: e.target.value }))} />
                      <textarea className="border rounded px-2 py-2 text-sm w-full min-h-[70px]" placeholder="Body A" value={campForm.abVariantABody} onChange={(e) => setCampForm((p) => ({ ...p, abVariantABody: e.target.value }))} />
                    </div>
                    <div className="border rounded p-2 space-y-2">
                      <p className="text-sm font-semibold">Variante B</p>
                      <input className="border rounded px-2 py-2 text-sm w-full" placeholder="Key B" value={campForm.abVariantBKey} onChange={(e) => setCampForm((p) => ({ ...p, abVariantBKey: e.target.value }))} />
                      <input className="border rounded px-2 py-2 text-sm w-full" placeholder="Subject B" value={campForm.abVariantBSubject} onChange={(e) => setCampForm((p) => ({ ...p, abVariantBSubject: e.target.value }))} />
                      <textarea className="border rounded px-2 py-2 text-sm w-full min-h-[70px]" placeholder="Body B" value={campForm.abVariantBBody} onChange={(e) => setCampForm((p) => ({ ...p, abVariantBBody: e.target.value }))} />
                    </div>
                  </div>
                )}
                <div className="rounded-lg border p-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-gray-900">Destinatarios de la campaña</h3>
                    <button
                      className="border rounded px-2 py-1 text-xs"
                      onClick={() => void loadRecipientPreview()}
                    >
                      Actualizar vista previa
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      className="border rounded px-2 py-2 text-sm flex-1 min-w-[220px]"
                      placeholder="Buscar por nombre, email o teléfono"
                      value={recipientSearch}
                      onChange={(e) => setRecipientSearch(e.target.value)}
                    />
                    <button
                      className="border rounded px-3 py-2 text-sm"
                      onClick={() => void loadRecipientPreview()}
                    >
                      Buscar
                    </button>
                  </div>
                  {recipientSummary && (
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
                      <div className="rounded border bg-gray-50 px-2 py-1">Total: <b>{recipientSummary.total}</b></div>
                      <div className="rounded border bg-gray-50 px-2 py-1">Elegibles: <b>{recipientSummary.eligible}</b></div>
                      <div className="rounded border bg-gray-50 px-2 py-1">Sin destino: <b>{recipientSummary.ineligible}</b></div>
                      <div className="rounded border bg-gray-50 px-2 py-1">Segmento: <b>{recipientSummary.segmentCount}</b></div>
                      <div className="rounded border bg-gray-50 px-2 py-1">Agregados: <b>{recipientSummary.manualIncludedCount}</b></div>
                      <div className="rounded border bg-gray-50 px-2 py-1">Excluidos: <b>{recipientSummary.excludedCount}</b></div>
                    </div>
                  )}
                  <div className="max-h-72 overflow-auto rounded border">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="px-2 py-2 text-left font-medium">Usuario</th>
                          <th className="px-2 py-2 text-left font-medium">Rol</th>
                          <th className="px-2 py-2 text-left font-medium">Destino</th>
                          <th className="px-2 py-2 text-left font-medium">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recipientPreview.map((recipient) => {
                          const included = recipientIncludeIds.includes(recipient.id)
                          const excluded = recipientExcludeIds.includes(recipient.id)
                          return (
                            <tr key={recipient.id} className="border-t">
                              <td className="px-2 py-2">
                                <p className="font-medium text-gray-900">{recipient.name}</p>
                                <p className="text-gray-500">{recipient.email}</p>
                              </td>
                              <td className="px-2 py-2">{recipient.role}</td>
                              <td className={`px-2 py-2 ${recipient.eligible ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {recipient.destination || recipient.reason || 'Sin destino'}
                              </td>
                              <td className="px-2 py-2">
                                <div className="flex flex-wrap gap-1">
                                  <button
                                    className={`rounded px-2 py-1 ${included ? 'bg-emerald-600 text-white' : 'border'}`}
                                    onClick={() => toggleIncludeRecipient(recipient.id)}
                                  >
                                    {included ? 'Incluido' : 'Incluir'}
                                  </button>
                                  <button
                                    className={`rounded px-2 py-1 ${excluded ? 'bg-rose-600 text-white' : 'border'}`}
                                    onClick={() => toggleExcludeRecipient(recipient.id)}
                                  >
                                    {excluded ? 'Excluido' : 'Excluir'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                        {!loadingRecipients && recipientPreview.length === 0 && (
                          <tr>
                            <td className="px-2 py-3 text-gray-500" colSpan={4}>
                              No hay destinatarios para este segmento.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <textarea className="w-full border rounded px-2 py-2 text-sm min-h-[90px]" placeholder="mensaje campaña" value={campForm.customBody} onChange={(e) => setCampForm((p) => ({ ...p, customBody: e.target.value }))} />
                <div className="flex gap-2">
                  <button className="bg-primary-600 text-white rounded px-3 py-2 text-sm" onClick={createCampaign}>
                    Guardar campaña
                  </button>
                  <button className="border rounded px-3 py-2 text-sm" onClick={() => setActivePanel('CAMPAIGNS')}>
                    Ir a campañas
                  </button>
                </div>
              </div>
            </section>
          )}

          {activePanel === 'ANALYTICS' && (
            <section className="space-y-4">
              <div className="rounded-xl border bg-white p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">Análisis de campañas</h2>
                  <select
                    className="border rounded px-2 py-2 text-sm"
                    value={selectedCampaignId || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        void loadMetrics(e.target.value)
                      }
                    }}
                  >
                    <option value="">Selecciona una campaña</option>
                    {orderedCampaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name} ({campaign.channel})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCampaign && selectedMetrics ? (
                  <div className="space-y-4">
                    <div className="grid md:grid-cols-4 gap-3">
                      <div className="border rounded-lg p-3">
                        <p className="text-xs text-gray-500">Campaña</p>
                        <p className="font-semibold text-gray-900">{selectedCampaign.name}</p>
                      </div>
                      <div className="border rounded-lg p-3">
                        <p className="text-xs text-gray-500">Canal</p>
                        <p className="font-semibold text-gray-900">{selectedCampaign.channel}</p>
                      </div>
                      <div className="border rounded-lg p-3">
                        <p className="text-xs text-gray-500">Deliverability</p>
                        <p className="font-semibold text-gray-900">{selectedMetrics.metrics.deliverabilityRate}%</p>
                      </div>
                      <div className="border rounded-lg p-3">
                        <p className="text-xs text-gray-500">A/B test</p>
                        <p className="font-semibold text-gray-900">{selectedCampaign.abTestEnabled ? 'Activo' : 'No'}</p>
                      </div>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-4">
                      <div className="border rounded-lg p-3 space-y-2">
                        <h3 className="font-semibold text-gray-900">Estado de entregas</h3>
                        {Object.entries(selectedMetrics.metrics.byStatus).map(([key, value]) => {
                          const width = percent(value, selectedCampaign.totalRecipients)
                          return (
                            <div key={key} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-600">{key}</span>
                                <span className="font-medium text-gray-900">{value} ({width}%)</span>
                              </div>
                              <div className="h-2 rounded bg-gray-100 overflow-hidden">
                                <div className="h-full bg-primary-600" style={{ width: `${width}%` }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <div className="border rounded-lg p-3 space-y-2">
                        <h3 className="font-semibold text-gray-900">Distribucion A/B</h3>
                        {Object.entries(selectedMetrics.metrics.byVariant).length > 0 ? (
                          Object.entries(selectedMetrics.metrics.byVariant).map(([key, value]) => {
                            const totalVariants = Object.values(selectedMetrics.metrics.byVariant).reduce((acc, item) => acc + item, 0)
                            const width = percent(value, totalVariants)
                            return (
                              <div key={key} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-600">{key}</span>
                                  <span className="font-medium text-gray-900">{value} ({width}%)</span>
                                </div>
                                <div className="h-2 rounded bg-gray-100 overflow-hidden">
                                  <div className="h-full bg-emerald-500" style={{ width: `${width}%` }} />
                                </div>
                              </div>
                            )
                          })
                        ) : (
                          <p className="text-sm text-gray-500">Esta campaña no tiene variantes registradas.</p>
                        )}
                      </div>
                    </div>

                    <div className="border rounded-lg p-3">
                      <h3 className="font-semibold text-gray-900 mb-2">Tabla de estados</h3>
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600">
                          <tr>
                            <th className="px-2 py-2 text-left font-medium">Estado</th>
                            <th className="px-2 py-2 text-left font-medium">Cantidad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(selectedMetrics.metrics.byStatus).map(([key, value]) => (
                            <tr key={key} className="border-t">
                              <td className="px-2 py-2">{key}</td>
                              <td className="px-2 py-2">{value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-gray-500">
                    Selecciona una campaña para ver analítica detallada.
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
