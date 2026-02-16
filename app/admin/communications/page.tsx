'use client'

import { useEffect, useMemo, useState } from 'react'

type Template = {
  id: string
  key: string
  name: string
  channel: 'SMS' | 'WHATSAPP' | 'EMAIL'
  subject: string | null
  body: string
  isActive: boolean
}

type Campaign = {
  id: string
  name: string
  channel: 'SMS' | 'WHATSAPP' | 'EMAIL'
  status: 'DRAFT' | 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'PARTIAL' | 'FAILED' | 'CANCELLED'
  totalRecipients: number
  totalSent: number
  totalFailed: number
  targetRole: 'CLIENT' | 'PARTNER' | 'ADMIN' | null
  targetCity: string | null
  createdAt: string
  abTestEnabled?: boolean
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

export default function AdminCommunicationsPage() {
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

  const selectedCampaign = useMemo(
    () => campaigns.find((item) => item.id === selectedCampaignId) || null,
    [campaigns, selectedCampaignId]
  )

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

  const loadMetrics = async (campaignId: string) => {
    const response = await fetch(`/api/admin/messaging/campaigns/${campaignId}/metrics`, { cache: 'no-store' })
    const data = await response.json()
    setSelectedMetrics(data)
    setSelectedCampaignId(campaignId)
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
    await load()
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
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Comunicaciones Omnicanal</h1>
        <p className="text-gray-600 mt-1">Campañas SMS, WhatsApp y Email con trazabilidad, métricas y control de entrega.</p>
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-6">Cargando...</div>
      ) : (
        <>
          {overview && (
            <section className="rounded-xl border bg-white p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
              <div><p className="text-xs text-gray-500">Campañas</p><p className="text-2xl font-bold">{overview.totals.campaigns}</p></div>
              <div><p className="text-xs text-gray-500">Destinatarios</p><p className="text-2xl font-bold">{overview.totals.recipients}</p></div>
              <div><p className="text-xs text-gray-500">Enviados</p><p className="text-2xl font-bold">{overview.totals.sent}</p></div>
              <div><p className="text-xs text-gray-500">Fallidos</p><p className="text-2xl font-bold">{overview.totals.failed}</p></div>
              <div><p className="text-xs text-gray-500">Deliverability</p><p className="text-2xl font-bold">{overview.totals.deliverabilityRate}%</p></div>
            </section>
          )}

          <section className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="text-lg font-semibold">Credenciales de Proveedores (Admin Managed)</h2>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="border rounded p-3 space-y-2">
                <h3 className="font-medium">Twilio (SMS/WhatsApp)</h3>
                <p className="text-xs text-gray-500">
                  Estado actual: {providers?.twilio?.active ? 'ACTIVO' : 'INACTIVO'} · SID {providers?.twilio?.accountSid || 'n/a'}
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={twilioForm.isActive} onChange={(e) => setTwilioForm((p) => ({ ...p, isActive: e.target.checked }))} />
                  Activar Twilio
                </label>
                <input className="border rounded px-2 py-2 text-sm w-full" placeholder="Account SID" value={twilioForm.accountSid} onChange={(e) => setTwilioForm((p) => ({ ...p, accountSid: e.target.value }))} />
                <input className="border rounded px-2 py-2 text-sm w-full" placeholder="Auth Token" type="password" value={twilioForm.authToken} onChange={(e) => setTwilioForm((p) => ({ ...p, authToken: e.target.value }))} />
                <input className="border rounded px-2 py-2 text-sm w-full" placeholder="SMS From" value={twilioForm.smsFrom} onChange={(e) => setTwilioForm((p) => ({ ...p, smsFrom: e.target.value }))} />
                <input className="border rounded px-2 py-2 text-sm w-full" placeholder="WhatsApp From" value={twilioForm.whatsappFrom} onChange={(e) => setTwilioForm((p) => ({ ...p, whatsappFrom: e.target.value }))} />
                <button className="bg-primary-600 text-white rounded px-3 py-2 text-sm" onClick={saveTwilio}>Guardar Twilio</button>
              </div>

              <div className="border rounded p-3 space-y-2">
                <h3 className="font-medium">SendGrid (Email)</h3>
                <p className="text-xs text-gray-500">
                  Estado actual: {providers?.sendgrid?.active ? 'ACTIVO' : 'INACTIVO'} · From {providers?.sendgrid?.fromEmail || 'n/a'}
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={sendgridForm.isActive} onChange={(e) => setSendgridForm((p) => ({ ...p, isActive: e.target.checked }))} />
                  Activar SendGrid
                </label>
                <input className="border rounded px-2 py-2 text-sm w-full" placeholder="From Email" value={sendgridForm.fromEmail} onChange={(e) => setSendgridForm((p) => ({ ...p, fromEmail: e.target.value }))} />
                <input className="border rounded px-2 py-2 text-sm w-full" placeholder="API Key" type="password" value={sendgridForm.apiKey} onChange={(e) => setSendgridForm((p) => ({ ...p, apiKey: e.target.value }))} />
                <button className="bg-primary-600 text-white rounded px-3 py-2 text-sm" onClick={saveSendgrid}>Guardar SendGrid</button>
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="text-lg font-semibold">Crear plantilla</h2>
            <div className="grid md:grid-cols-5 gap-2">
              <input className="border rounded px-2 py-2 text-sm" placeholder="key" value={tplForm.key} onChange={(e) => setTplForm((p) => ({ ...p, key: e.target.value }))} />
              <input className="border rounded px-2 py-2 text-sm" placeholder="nombre" value={tplForm.name} onChange={(e) => setTplForm((p) => ({ ...p, name: e.target.value }))} />
              <select className="border rounded px-2 py-2 text-sm" value={tplForm.channel} onChange={(e) => setTplForm((p) => ({ ...p, channel: e.target.value }))}>
                <option value="SMS">SMS</option>
                <option value="WHATSAPP">WHATSAPP</option>
                <option value="EMAIL">EMAIL</option>
              </select>
              <input className="border rounded px-2 py-2 text-sm" placeholder="subject (email)" value={tplForm.subject} onChange={(e) => setTplForm((p) => ({ ...p, subject: e.target.value }))} />
              <button className="bg-primary-600 text-white rounded px-3 py-2 text-sm" onClick={createTemplate}>Crear</button>
            </div>
            <textarea className="w-full border rounded px-2 py-2 text-sm min-h-[80px]" placeholder="body con variables: {{user_name}}" value={tplForm.body} onChange={(e) => setTplForm((p) => ({ ...p, body: e.target.value }))} />
          </section>

          <section className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="text-lg font-semibold">Crear campaña</h2>
            <div className="grid md:grid-cols-3 gap-2">
              <input className="border rounded px-2 py-2 text-sm" placeholder="nombre campaña" value={campForm.name} onChange={(e) => setCampForm((p) => ({ ...p, name: e.target.value }))} />
              <select className="border rounded px-2 py-2 text-sm" value={campForm.channel} onChange={(e) => setCampForm((p) => ({ ...p, channel: e.target.value }))}>
                <option value="SMS">SMS</option>
                <option value="WHATSAPP">WHATSAPP</option>
                <option value="EMAIL">EMAIL</option>
              </select>
              <select className="border rounded px-2 py-2 text-sm" value={campForm.targetRole} onChange={(e) => setCampForm((p) => ({ ...p, targetRole: e.target.value }))}>
                <option value="CLIENT">CLIENTES</option>
                <option value="PARTNER">SOCIOS</option>
              </select>
            </div>
            <div className="grid md:grid-cols-3 gap-2">
              <select className="border rounded px-2 py-2 text-sm" value={campForm.templateId} onChange={(e) => setCampForm((p) => ({ ...p, templateId: e.target.value }))}>
                <option value="">Sin plantilla</option>
                {templates.filter((t) => t.channel === campForm.channel).map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                ))}
              </select>
              <select className="border rounded px-2 py-2 text-sm" value={campForm.targetCity} onChange={(e) => setCampForm((p) => ({ ...p, targetCity: e.target.value }))}>
                <option value="">Todas las ciudades</option>
                <option value="MEDELLIN">MEDELLIN</option>
                <option value="BOGOTA">BOGOTA</option>
                <option value="CALI">CALI</option>
                <option value="BARRANQUILLA">BARRANQUILLA</option>
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
            <textarea className="w-full border rounded px-2 py-2 text-sm min-h-[90px]" placeholder="mensaje campaña" value={campForm.customBody} onChange={(e) => setCampForm((p) => ({ ...p, customBody: e.target.value }))} />
            <div className="flex gap-2">
              <button className="bg-primary-600 text-white rounded px-3 py-2 text-sm" onClick={createCampaign}>Crear campaña</button>
              <button className="border rounded px-3 py-2 text-sm" onClick={runScheduled}>Ejecutar programadas</button>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="text-lg font-semibold">Campañas</h2>
            <div className="space-y-2">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="border rounded p-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{campaign.name}</p>
                    <p className="text-xs text-gray-500">
                      {campaign.channel} · {campaign.status} · target {campaign.targetRole || 'ALL'} {campaign.targetCity ? `/${campaign.targetCity}` : ''}
                    </p>
                    <p className="text-xs text-gray-500">
                      recipients {campaign.totalRecipients} · sent {campaign.totalSent} · failed {campaign.totalFailed}
                    </p>
                    <p className="text-xs text-gray-500">A/B: {campaign.abTestEnabled ? 'ON' : 'OFF'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="border rounded px-2 py-1 text-sm" onClick={() => loadMetrics(campaign.id)}>Métricas</button>
                    <button className="bg-primary-600 text-white rounded px-2 py-1 text-sm" onClick={() => sendCampaign(campaign.id)}>Enviar</button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {selectedCampaign && selectedMetrics && (
            <section className="rounded-xl border bg-white p-4 space-y-2">
              <h2 className="text-lg font-semibold">Métricas: {selectedCampaign.name}</h2>
              <p className="text-sm text-gray-600">Deliverability: {selectedMetrics.metrics.deliverabilityRate}%</p>
              <div className="grid md:grid-cols-3 gap-2">
                {Object.entries(selectedMetrics.metrics.byStatus).map(([key, value]) => (
                  <div key={key} className="border rounded p-3">
                    <p className="text-xs text-gray-500">{key}</p>
                    <p className="text-xl font-bold">{value}</p>
                  </div>
                ))}
              </div>
              <h3 className="font-medium mt-2">A/B por variante</h3>
              <div className="grid md:grid-cols-3 gap-2">
                {Object.entries(selectedMetrics.metrics.byVariant).map(([key, value]) => (
                  <div key={key} className="border rounded p-3">
                    <p className="text-xs text-gray-500">{key}</p>
                    <p className="text-xl font-bold">{value}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
