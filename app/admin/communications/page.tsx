'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

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

type ServiceOption = {
  id: string
  name: string
  slug: string
  categoryId: string
  categoryName: string
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
  filteredTotal?: number
  eligible: number
  ineligible: number
  segmentCount: number
  manualIncludedCount: number
  excludedCount: number
  partnerFilterMode?: 'ALL' | 'CATEGORY' | 'SERVICE'
  partnerCategoryIds?: string[]
  partnerServiceIds?: string[]
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

type FailedDelivery = {
  id: string
  destination: string | null
  status: string
  provider: string
  providerMessageId: string | null
  errorCode: string | null
  errorMessage: string | null
  sentAt: string | null
  deliveredAt: string | null
  createdAt: string
  user: {
    id: string
    name: string | null
    email: string
    role: 'CLIENT' | 'PARTNER' | 'ADMIN'
    phone: string | null
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
  push?: {
    configured: boolean
    hasVapidPublicKey?: boolean
    hasVapidPrivateKey?: boolean
  }
}

type WaTemplate = {
  sid: string
  name: string
  language: string
  types: string[]
  body: string
  variables: Record<string, string>
  waStatus: string
  waName: string | null
  waCategory: string | null
}

type Panel = 'OVERVIEW' | 'CONFIG' | 'CAMPAIGNS' | 'CREATE' | 'ANALYTICS' | 'MAGIC_LINK'

const PANEL_OPTIONS: Array<{ id: Panel; label: string }> = [
  { id: 'OVERVIEW', label: 'Resumen' },
  { id: 'CONFIG', label: 'Configuración' },
  { id: 'CAMPAIGNS', label: 'Campañas' },
  { id: 'CREATE', label: 'Crear campaña' },
  { id: 'ANALYTICS', label: 'Analytics' },
  { id: 'MAGIC_LINK', label: '🔗 Magic Link' },
]

const CITY_OPTIONS = ['MEDELLIN', 'BOGOTA', 'CALI', 'BARRANQUILLA']

// All template variables available in the notification engine
const TEMPLATE_VARS: Array<{
  group: string
  badge: string
  note: string
  vars: Array<{ key: string; desc: string; example: string }>
}> = [
  {
    group: 'Usuario / Perfil',
    badge: 'bg-blue-100 text-blue-800',
    note: 'Datos del destinatario del mensaje',
    vars: [
      { key: 'user_name',    desc: 'Nombre completo del destinatario',          example: 'Ana Torres' },
      { key: 'client_name',  desc: 'Nombre del cliente en el evento',           example: 'Juan Pérez' },
      { key: 'partner_name', desc: 'Nombre del socio en el evento',             example: 'Carlos García' },
      { key: 'sender_name',  desc: 'La otra parte (quien envió el mensaje)',     example: 'María López' },
    ],
  },
  {
    group: 'Reserva',
    badge: 'bg-emerald-100 text-emerald-800',
    note: 'Disponible cuando la notificación está ligada a una reserva',
    vars: [
      { key: 'service_name', desc: 'Nombre del servicio contratado',            example: 'Plomería' },
      { key: 'booking_date', desc: 'Fecha programada de la reserva',            example: '15 jun 2025' },
      { key: 'booking_time', desc: 'Hora programada',                           example: '10:00 AM' },
      { key: 'price',        desc: 'Precio de la reserva o propuesta',          example: '$120.000' },
    ],
  },
  {
    group: 'Solicitud de servicio',
    badge: 'bg-violet-100 text-violet-800',
    note: 'Disponible cuando hay una solicitud de servicio asociada',
    vars: [
      { key: 'service_name', desc: 'Servicio solicitado',                       example: 'Electricidad' },
      { key: 'client_name',  desc: 'Cliente que hizo la solicitud',             example: 'Pedro Sánchez' },
      { key: 'city',         desc: 'Ciudad de la solicitud',                    example: 'Medellín' },
      { key: 'description',  desc: 'Descripción / notas de la solicitud',       example: 'Goteras en el baño' },
    ],
  },
  {
    group: 'Sistema',
    badge: 'bg-amber-100 text-amber-800',
    note: 'Generados automáticamente por el motor de notificaciones',
    vars: [
      { key: 'action_url',   desc: 'Enlace directo a la acción en la app',      example: 'https://lohaggo.com/partner?tab=bookings' },
      { key: 'app_name',     desc: 'Nombre de la plataforma',                   example: 'LoHaggo' },
    ],
  },
]

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
  const [waTemplates, setWaTemplates] = useState<WaTemplate[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>([])
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
  const [templateEditingId, setTemplateEditingId] = useState<string | null>(null)
  const [templateFeedback, setTemplateFeedback] = useState<{ type: 'ok' | 'error'; message: string } | null>(null)

  const [campForm, setCampForm] = useState({
    name: '',
    channel: 'SMS',
    contentMode: 'TEMPLATE',
    targetRole: 'CLIENT',
    targetCity: '',
    partnerFilterMode: 'ALL' as 'ALL' | 'CATEGORY' | 'SERVICE',
    partnerCategoryIds: [] as string[],
    partnerServiceIds: [] as string[],
    customSubject: '',
    customBody: '',
    templateId: '',
    waContentSid: '',
    waTemplateVariables: {} as Record<string, string>,
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
  const [selectionMode, setSelectionMode] = useState<'SEGMENT' | 'MANUAL'>('MANUAL')
  const [campaignRecipientPreview, setCampaignRecipientPreview] = useState<{
    campaignId: string
    recipients: RecipientPreview[]
    summary: RecipientSummary | null
  } | null>(null)
  const [loadingRecipients, setLoadingRecipients] = useState(false)
  const [campaignFeedback, setCampaignFeedback] = useState<{ type: 'ok' | 'error'; message: string } | null>(null)
  const [failedDeliveriesCampaign, setFailedDeliveriesCampaign] = useState<Campaign | null>(null)
  const [failedDeliveries, setFailedDeliveries] = useState<FailedDelivery[]>([])
  const [loadingFailedDeliveries, setLoadingFailedDeliveries] = useState(false)
  const [failedDeliveriesError, setFailedDeliveriesError] = useState<string | null>(null)

  // Magic link state
  const [mlGenerating, setMlGenerating] = useState(false)
  const [mlResults, setMlResults] = useState<Array<{ userId: string; name: string; token: string; url: string }> | null>(null)
  const [mlError, setMlError] = useState<string | null>(null)
  const [mlCopied, setMlCopied] = useState<string | null>(null)
  const [mlAudience, setMlAudience] = useState<'PARTNERS_WITHOUT_DOCS' | 'ALL_PARTNERS' | 'ALL_CLIENTS' | 'ALL_USERS'>('PARTNERS_WITHOUT_DOCS')
  const [mlRoleContext, setMlRoleContext] = useState<'partner' | 'client'>('partner')
  const [mlSection, setMlSection] = useState('/partner/verification')
  const [mlCustomUrl, setMlCustomUrl] = useState('')
  const [mlRequirePasswordChange, setMlRequirePasswordChange] = useState(false)

  // Ref for template body textarea — enables click-to-insert variables at cursor
  const tplBodyRef = useRef<HTMLTextAreaElement>(null)

  const selectedCampaign = useMemo(
    () => campaigns.find((item) => item.id === selectedCampaignId) || null,
    [campaigns, selectedCampaignId]
  )

  const orderedCampaigns = useMemo(
    () => [...campaigns].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [campaigns]
  )

  const recentCampaigns = orderedCampaigns.slice(0, 5)
  const channelTemplates = useMemo(
    () => templates.filter((template) => template.channel === campForm.channel),
    [templates, campForm.channel]
  )
  const selectedTemplate = useMemo(
    () => channelTemplates.find((template) => template.id === campForm.templateId) || null,
    [channelTemplates, campForm.templateId]
  )
  const selectedWaTemplate = useMemo(
    () => waTemplates.find((t) => t.sid === campForm.waContentSid) || null,
    [waTemplates, campForm.waContentSid]
  )
  const approvedWaTemplates = useMemo(
    () => waTemplates.filter((t) => t.waStatus === 'approved'),
    [waTemplates]
  )
  const partnerCategoryOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const service of serviceOptions) {
      if (!map.has(service.categoryId)) map.set(service.categoryId, service.categoryName)
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [serviceOptions])
  const filteredServiceOptions = useMemo(() => {
    if (campForm.partnerFilterMode !== 'SERVICE') return serviceOptions
    if (!campForm.partnerCategoryIds.length) return serviceOptions
    return serviceOptions.filter((service) => campForm.partnerCategoryIds.includes(service.categoryId))
  }, [serviceOptions, campForm.partnerFilterMode, campForm.partnerCategoryIds])
  const channelProviderReady = useMemo(() => {
    if (!providers) return false
    if (campForm.channel === 'EMAIL') return Boolean(providers.sendgrid.active && providers.sendgrid.hasApiKey && providers.sendgrid.fromEmail)
    if (campForm.channel === 'SMS') return Boolean(providers.twilio.active && providers.twilio.hasAuthToken && providers.twilio.smsFrom)
    if (campForm.channel === 'WHATSAPP') return Boolean(providers.twilio.active && providers.twilio.hasAuthToken && providers.twilio.whatsappFrom)
    return Boolean(providers.push?.configured)
  }, [providers, campForm.channel])
  const estimatedRecipients = selectionMode === 'MANUAL' ? recipientIncludeIds.length : (recipientSummary?.total ?? 0)
  const estimatedEligible = recipientSummary?.eligible ?? 0
  const estimatedIneligible = recipientSummary?.ineligible ?? 0
  const previewRows = recipientSummary?.filteredTotal ?? recipientSummary?.total ?? 0

  const load = async () => {
    setLoading(true)
    try {
      const [tplRes, campRes, ovRes, pvRes, waRes] = await Promise.all([
        fetch('/api/admin/messaging/templates', { cache: 'no-store' }),
        fetch('/api/admin/messaging/campaigns', { cache: 'no-store' }),
        fetch('/api/admin/messaging/overview', { cache: 'no-store' }),
        fetch('/api/admin/messaging/providers', { cache: 'no-store' }),
        fetch('/api/admin/messaging/wa-templates', { cache: 'no-store' }),
      ])
      const svcRes = await fetch('/api/admin/messaging/services', { cache: 'no-store' })
      const [tplData, campData, ovData, pvData, waData, svcData] = await Promise.all([
        tplRes.json(),
        campRes.json(),
        ovRes.json(),
        pvRes.json(),
        waRes.json(),
        svcRes.json(),
      ])
      setTemplates(tplData.templates || [])
      setWaTemplates(waData.templates || [])
      setCampaigns(campData.campaigns || [])
      setOverview(ovData)
      setProviders(pvData.providers || null)
      setServiceOptions(svcData.services || [])
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
        if (selectionMode === 'SEGMENT' && campForm.targetRole) params.set('targetRole', campForm.targetRole)
        if (campForm.targetCity) params.set('targetCity', campForm.targetCity)
        if (selectionMode === 'SEGMENT' && campForm.targetRole === 'PARTNER') {
          params.set('partnerFilterMode', campForm.partnerFilterMode)
          if (campForm.partnerCategoryIds.length) {
            params.set('partnerCategoryIds', campForm.partnerCategoryIds.join(','))
          }
          if (campForm.partnerFilterMode === 'SERVICE' && campForm.partnerServiceIds.length) {
            params.set('partnerServiceIds', campForm.partnerServiceIds.join(','))
          }
        }
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
  }, [
    activePanel,
    campForm.channel,
    campForm.targetRole,
    campForm.targetCity,
    campForm.partnerFilterMode,
    campForm.partnerCategoryIds,
    campForm.partnerServiceIds,
    recipientIncludeIds,
    recipientExcludeIds,
    selectionMode,
  ])

  useEffect(() => {
    if (campForm.targetRole === 'PARTNER') return
    if (!campForm.partnerServiceIds.length && !campForm.partnerCategoryIds.length && campForm.partnerFilterMode === 'ALL') return
    setCampForm((prev) => ({ ...prev, partnerFilterMode: 'ALL', partnerCategoryIds: [], partnerServiceIds: [] }))
  }, [campForm.targetRole, campForm.partnerFilterMode, campForm.partnerCategoryIds.length, campForm.partnerServiceIds.length])

  useEffect(() => {
    if (campForm.targetRole !== 'PARTNER') return
    if (campForm.partnerFilterMode !== 'SERVICE' && campForm.partnerServiceIds.length) {
      setCampForm((prev) => ({ ...prev, partnerServiceIds: [] }))
    }
  }, [campForm.targetRole, campForm.partnerFilterMode, campForm.partnerServiceIds.length])

  useEffect(() => {
    if (campForm.contentMode !== 'TEMPLATE') return
    if (campForm.channel === 'WHATSAPP') return // WA templates handled separately
    if (!campForm.templateId && channelTemplates.length > 0) {
      setCampForm((prev) => ({ ...prev, templateId: channelTemplates[0].id }))
      return
    }
    if (campForm.templateId && !channelTemplates.find((template) => template.id === campForm.templateId)) {
      setCampForm((prev) => ({ ...prev, templateId: channelTemplates[0]?.id || '' }))
    }
  }, [campForm.contentMode, campForm.templateId, campForm.channel, channelTemplates])

  useEffect(() => {
    if (campForm.contentMode !== 'TEMPLATE' || !selectedTemplate) return
    setCampForm((prev) => ({
      ...prev,
      customSubject: selectedTemplate.subject || prev.customSubject,
      customBody: selectedTemplate.body,
    }))
  }, [campForm.contentMode, selectedTemplate])

  const createTemplate = async () => {
    if (!tplForm.key || !tplForm.name || !tplForm.body) return
    setTemplateFeedback(null)
    const response = await fetch('/api/admin/messaging/templates', {
      method: templateEditingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(templateEditingId ? { id: templateEditingId } : {}),
        ...tplForm,
        channel: tplForm.channel,
        subject: tplForm.subject || null,
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setTemplateFeedback({ type: 'error', message: data.error || 'No se pudo guardar la plantilla' })
      return
    }
    setTemplateFeedback({ type: 'ok', message: templateEditingId ? 'Plantilla actualizada' : 'Plantilla creada' })
    setTemplateEditingId(null)
    setTplForm({ key: '', name: '', channel: 'SMS', subject: '', body: '' })
    await load()
  }

  const editTemplate = (template: Template) => {
    setTemplateEditingId(template.id)
    setTplForm({
      key: template.key,
      name: template.name,
      channel: template.channel,
      subject: template.subject || '',
      body: template.body,
    })
    setTemplateFeedback(null)
  }

  const deleteTemplate = async (id: string) => {
    setTemplateFeedback(null)
    const response = await fetch(`/api/admin/messaging/templates?id=${id}`, { method: 'DELETE' })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setTemplateFeedback({ type: 'error', message: data.error || 'No se pudo eliminar la plantilla' })
      return
    }
    if (templateEditingId === id) {
      setTemplateEditingId(null)
      setTplForm({ key: '', name: '', channel: 'SMS', subject: '', body: '' })
    }
    setTemplateFeedback({ type: 'ok', message: 'Plantilla eliminada' })
    await load()
  }

  const createCampaign = async () => {
    setCampaignFeedback(null)
    if (!campForm.name.trim()) {
      setCampaignFeedback({ type: 'error', message: 'El nombre de campaña es requerido' })
      return
    }
    const isWaTemplate = campForm.channel === 'WHATSAPP' && campForm.contentMode === 'TEMPLATE'
    if (isWaTemplate && !campForm.waContentSid) {
      setCampaignFeedback({ type: 'error', message: 'Selecciona una plantilla de WhatsApp aprobada para continuar' })
      return
    }
    if (!isWaTemplate && campForm.contentMode === 'TEMPLATE' && !campForm.templateId) {
      setCampaignFeedback({ type: 'error', message: 'Selecciona una plantilla para continuar' })
      return
    }
    if (campForm.contentMode === 'CUSTOM' && !campForm.customBody.trim()) {
      setCampaignFeedback({ type: 'error', message: 'Escribe el mensaje de la campaña' })
      return
    }
    if (campForm.targetRole === 'PARTNER' && campForm.partnerFilterMode === 'CATEGORY' && !campForm.partnerCategoryIds.length) {
      setCampaignFeedback({ type: 'error', message: 'Selecciona al menos una categoría para filtrar socios.' })
      return
    }
    if (campForm.targetRole === 'PARTNER' && campForm.partnerFilterMode === 'SERVICE' && !campForm.partnerServiceIds.length) {
      setCampaignFeedback({ type: 'error', message: 'Selecciona al menos un servicio para filtrar socios.' })
      return
    }
    if (selectionMode === 'MANUAL' && recipientIncludeIds.length === 0) {
      setCampaignFeedback({ type: 'error', message: 'Selecciona al menos un destinatario en modo manual.' })
      return
    }
    const splitA = Math.min(99, Math.max(1, Number(campForm.abSplitA) || 50))
    const splitB = 100 - splitA
    // For WA templates, send as CUSTOM with the template body so backend accepts it;
    // the real sending uses the waContentSid stored in metadata
    const backendContentMode = isWaTemplate ? 'CUSTOM' : campForm.contentMode
    const backendCustomBody = isWaTemplate
      ? (selectedWaTemplate?.body || `WA:${campForm.waContentSid}`)
      : campForm.customBody
    const response = await fetch('/api/admin/messaging/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...campForm,
        channel: campForm.channel,
        contentMode: backendContentMode,
        customBody: backendCustomBody,
        targetRole: selectionMode === 'MANUAL' ? null : (campForm.targetRole || null),
        targetCity: campForm.targetCity || null,
        partnerFilterMode: selectionMode === 'SEGMENT' && campForm.targetRole === 'PARTNER' ? campForm.partnerFilterMode : 'ALL',
        partnerCategoryIds: selectionMode === 'SEGMENT' && campForm.targetRole === 'PARTNER' ? campForm.partnerCategoryIds : [],
        partnerServiceIds:
          selectionMode === 'SEGMENT' && campForm.targetRole === 'PARTNER' && campForm.partnerFilterMode === 'SERVICE'
            ? campForm.partnerServiceIds
            : [],
        customSubject: campForm.customSubject || null,
        templateId: isWaTemplate ? null : (campForm.templateId || null),
        status: campForm.scheduledAt ? 'SCHEDULED' : 'DRAFT',
        scheduledAt: campForm.scheduledAt || null,
        abTestEnabled: campForm.abTestEnabled,
        abTestConfig: campForm.abTestEnabled
          ? {
              variants: [
                {
                  key: campForm.abVariantAKey || 'A',
                  subject: campForm.abVariantASubject || null,
                  body: campForm.abVariantABody || backendCustomBody,
                  allocation: splitA,
                },
                {
                  key: campForm.abVariantBKey || 'B',
                  subject: campForm.abVariantBSubject || null,
                  body: campForm.abVariantBBody || backendCustomBody,
                  allocation: splitB,
                },
              ],
            }
          : null,
        includeUserIds: recipientIncludeIds,
        excludeUserIds: recipientExcludeIds,
        metadata: {
          contentMode: isWaTemplate ? 'WA_TEMPLATE' : campForm.contentMode,
          source: isWaTemplate ? 'wa_template' : (campForm.contentMode === 'TEMPLATE' ? 'template' : 'custom'),
          ...(isWaTemplate ? {
            waContentSid: campForm.waContentSid,
            waTemplateName: selectedWaTemplate?.name || null,
            waTemplateVariables: campForm.waTemplateVariables,
          } : {}),
        },
      }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setCampaignFeedback({ type: 'error', message: data.error || 'No se pudo guardar la campaña' })
      return
    }
    setCampForm({
      name: '',
      channel: 'SMS',
      contentMode: 'TEMPLATE',
      targetRole: 'CLIENT',
      targetCity: '',
      partnerFilterMode: 'ALL',
      partnerCategoryIds: [],
      partnerServiceIds: [],
      customSubject: '',
      customBody: '',
      templateId: '',
      waContentSid: '',
      waTemplateVariables: {},
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
    setCampaignFeedback({ type: 'ok', message: 'Campaña guardada correctamente' })
    setRecipientSearch('')
    setRecipientIncludeIds([])
    setRecipientExcludeIds([])
    setRecipientPreview([])
    setRecipientSummary(null)
    setSelectionMode('MANUAL')
    await load()
    setActivePanel('CAMPAIGNS')
  }

  const sendCampaign = async (campaignId: string) => {
    setCampaignFeedback(null)
    const response = await fetch(`/api/admin/messaging/campaigns/${campaignId}/send`, { method: 'POST' })
    const data = await response.json().catch(() => null)
    if (!response.ok) {
      setCampaignFeedback({ type: 'error', message: data?.error || 'No se pudo enviar la campaña' })
      return
    }
    setCampaignFeedback({ type: 'ok', message: 'Campaña enviada correctamente' })
    await load()
    await loadMetrics(campaignId)
  }

  const loadFailedDeliveries = async (campaign: Campaign) => {
    setLoadingFailedDeliveries(true)
    setFailedDeliveriesError(null)
    setFailedDeliveriesCampaign(campaign)
    try {
      const response = await fetch(`/api/admin/messaging/campaigns/${campaign.id}/failed-deliveries?limit=300`, {
        cache: 'no-store',
      })
      const data = await response.json()
      if (!response.ok) {
        setFailedDeliveries([])
        setFailedDeliveriesError(data.error || 'No se pudo cargar el detalle de fallas')
        return
      }
      setFailedDeliveries(data.failedDeliveries || [])
    } catch {
      setFailedDeliveries([])
      setFailedDeliveriesError('No se pudo cargar el detalle de fallas')
    } finally {
      setLoadingFailedDeliveries(false)
    }
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

  const togglePartnerServiceId = (serviceId: string) => {
    setCampForm((prev) => ({
      ...prev,
      partnerServiceIds: prev.partnerServiceIds.includes(serviceId)
        ? prev.partnerServiceIds.filter((id) => id !== serviceId)
        : [...prev.partnerServiceIds, serviceId],
    }))
  }

  const togglePartnerCategoryId = (categoryId: string) => {
    setCampForm((prev) => ({
      ...prev,
      partnerCategoryIds: prev.partnerCategoryIds.includes(categoryId)
        ? prev.partnerCategoryIds.filter((id) => id !== categoryId)
        : [...prev.partnerCategoryIds, categoryId],
    }))
  }

  const saveTwilio = async () => {
    const payload: Record<string, unknown> = {
      provider: 'TWILIO',
      isActive: twilioForm.isActive,
      smsFrom: twilioForm.smsFrom || null,
      whatsappFrom: twilioForm.whatsappFrom || null,
    }
    if (twilioForm.accountSid.trim()) payload.accountSid = twilioForm.accountSid.trim()
    if (twilioForm.authToken.trim()) payload.authToken = twilioForm.authToken.trim()

    await fetch('/api/admin/messaging/providers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setTwilioForm((prev) => ({ ...prev, authToken: '' }))
    await load()
  }

  const saveSendgrid = async () => {
    const payload: Record<string, unknown> = {
      provider: 'SENDGRID',
      isActive: sendgridForm.isActive,
      fromEmail: sendgridForm.fromEmail,
    }
    if (sendgridForm.apiKey.trim()) payload.apiKey = sendgridForm.apiKey.trim()

    await fetch('/api/admin/messaging/providers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSendgridForm((prev) => ({ ...prev, apiKey: '' }))
    await load()
  }

  // Insert {{variable}} at cursor position in the template body textarea
  function insertVar(key: string) {
    const el = tplBodyRef.current
    if (!el) return
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const insert = `{{${key}}}`
    const next = el.value.slice(0, start) + insert + el.value.slice(end)
    setTplForm((p) => ({ ...p, body: next }))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + insert.length, start + insert.length)
    })
  }

  const ML_PARTNER_SECTIONS = [
    { value: '/partner/verification', label: 'Verificación de documentos' },
    { value: '/partner/dashboard', label: 'Panel principal' },
    { value: '/partner/services', label: 'Mis servicios' },
    { value: '/partner/bookings', label: 'Reservas' },
    { value: '/partner/profile', label: 'Perfil' },
    { value: '/partner/bank-accounts', label: 'Cuenta bancaria' },
    { value: '__custom__', label: 'URL personalizada…' },
  ]

  const ML_CLIENT_SECTIONS = [
    { value: '/client/dashboard', label: 'Panel principal' },
    { value: '/bookings', label: 'Mis reservas' },
    { value: '/profile', label: 'Perfil' },
    { value: '__custom__', label: 'URL personalizada…' },
  ]

  const mlSections = mlRoleContext === 'partner' ? ML_PARTNER_SECTIONS : ML_CLIENT_SECTIONS
  const mlRedirectUrl = mlSection === '__custom__' ? mlCustomUrl : mlSection

  async function generateMagicLinks() {
    if (mlSection === '__custom__' && !mlCustomUrl.trim()) {
      setMlError('Ingresa una URL de destino personalizada.')
      return
    }
    setMlGenerating(true)
    setMlError(null)
    setMlResults(null)
    try {
      const res = await fetch('/api/auth/magic/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audience: mlAudience,
          redirectUrl: mlRedirectUrl,
          requirePasswordChange: mlRequirePasswordChange,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error generando links')
      setMlResults(data.tokens || [])
    } catch (err: unknown) {
      setMlError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setMlGenerating(false)
    }
  }

  async function copyMagicLink(text: string, id: string) {
    await navigator.clipboard.writeText(text)
    setMlCopied(id)
    setTimeout(() => setMlCopied(null), 2000)
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
                <p className="text-sm text-gray-600">Gestión centralizada y cifrada de credenciales operativas.</p>
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4 space-y-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">Twilio (SMS/WhatsApp)</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          providers?.twilio?.active && providers?.twilio?.hasAuthToken
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {providers?.twilio?.active && providers?.twilio?.hasAuthToken ? 'Configurado' : 'Incompleto'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      SID: {providers?.twilio?.accountSid || 'n/a'} · SMS: {providers?.twilio?.smsFrom || 'n/a'} · WA: {providers?.twilio?.whatsappFrom || 'n/a'}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={twilioForm.isActive} onChange={(e) => setTwilioForm((p) => ({ ...p, isActive: e.target.checked }))} />
                    Activar Twilio
                  </label>
                  <input className="border rounded px-2 py-2 text-sm w-full" placeholder="Account SID (opcional para editar otros campos)" value={twilioForm.accountSid} onChange={(e) => setTwilioForm((p) => ({ ...p, accountSid: e.target.value }))} />
                  <input className="border rounded px-2 py-2 text-sm w-full" placeholder="Auth Token (déjalo vacío para mantener el actual)" type="password" value={twilioForm.authToken} onChange={(e) => setTwilioForm((p) => ({ ...p, authToken: e.target.value }))} />
                  <input className="border rounded px-2 py-2 text-sm w-full" placeholder="SMS From" value={twilioForm.smsFrom} onChange={(e) => setTwilioForm((p) => ({ ...p, smsFrom: e.target.value }))} />
                  <input className="border rounded px-2 py-2 text-sm w-full" placeholder="WhatsApp From" value={twilioForm.whatsappFrom} onChange={(e) => setTwilioForm((p) => ({ ...p, whatsappFrom: e.target.value }))} />
                  <button className="bg-primary-600 text-white rounded px-3 py-2 text-sm" onClick={saveTwilio}>
                    Guardar Twilio
                  </button>
                </div>

                <div className="border rounded-lg p-4 space-y-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">SendGrid (Email)</h3>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          providers?.sendgrid?.active && providers?.sendgrid?.hasApiKey
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {providers?.sendgrid?.active && providers?.sendgrid?.hasApiKey ? 'Configurado' : 'Incompleto'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      From: {providers?.sendgrid?.fromEmail || 'n/a'} · API Key: {providers?.sendgrid?.apiKey || 'n/a'}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={sendgridForm.isActive} onChange={(e) => setSendgridForm((p) => ({ ...p, isActive: e.target.checked }))} />
                    Activar SendGrid
                  </label>
                  <input className="border rounded px-2 py-2 text-sm w-full" placeholder="From Email" value={sendgridForm.fromEmail} onChange={(e) => setSendgridForm((p) => ({ ...p, fromEmail: e.target.value }))} />
                  <input className="border rounded px-2 py-2 text-sm w-full" placeholder="API Key (déjala vacía para mantener la actual)" type="password" value={sendgridForm.apiKey} onChange={(e) => setSendgridForm((p) => ({ ...p, apiKey: e.target.value }))} />
                  <button className="bg-primary-600 text-white rounded px-3 py-2 text-sm" onClick={saveSendgrid}>
                    Guardar SendGrid
                  </button>
                </div>
              </div>
              <div className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">PUSH (Web Push / PWA)</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      providers?.push?.configured
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {providers?.push?.configured ? 'Configurado' : 'Incompleto'}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  VAPID public key: {providers?.push?.hasVapidPublicKey ? 'OK' : 'Falta'} ·
                  VAPID private key: {providers?.push?.hasVapidPrivateKey ? 'OK' : 'Falta'}
                </p>
                <p className="text-xs text-gray-600">
                  Esta configuración se toma de variables de entorno del servidor. Si falta alguna llave VAPID, los envíos PUSH fallarán.
                </p>
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
                        <td className="px-3 py-2">
                          {campaign.totalFailed > 0 ? (
                            <button
                              className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                              onClick={() => void loadFailedDeliveries(campaign)}
                            >
                              {campaign.totalFailed}
                            </button>
                          ) : (
                            <span>{campaign.totalFailed}</span>
                          )}
                        </td>
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
                  {campaignRecipientPreview.summary?.partnerFilterMode && campaignRecipientPreview.summary.partnerFilterMode !== 'ALL' && (
                    <p className="text-xs text-gray-600">
                      Filtro de socios aplicado:
                      {' '}
                      <b>
                        {campaignRecipientPreview.summary.partnerFilterMode === 'CATEGORY'
                          ? `categorías (${campaignRecipientPreview.summary.partnerCategoryIds?.length || 0})`
                          : `servicios (${campaignRecipientPreview.summary.partnerServiceIds?.length || 0})`}
                      </b>
                    </p>
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

              {failedDeliveriesCampaign && (
                <div className="rounded-lg border bg-white p-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">Detalle de envíos fallidos</h3>
                      <p className="text-xs text-gray-600">
                        Campaña: <b>{failedDeliveriesCampaign.name}</b> ({failedDeliveriesCampaign.channel})
                      </p>
                    </div>
                    <button
                      className="border rounded px-2 py-1 text-xs"
                      onClick={() => {
                        setFailedDeliveriesCampaign(null)
                        setFailedDeliveries([])
                        setFailedDeliveriesError(null)
                      }}
                    >
                      Cerrar
                    </button>
                  </div>

                  {loadingFailedDeliveries && (
                    <p className="text-sm text-gray-600">Cargando detalle de fallas...</p>
                  )}

                  {failedDeliveriesError && (
                    <p className="text-sm text-rose-700">{failedDeliveriesError}</p>
                  )}

                  {!loadingFailedDeliveries && !failedDeliveriesError && (
                    <div className="max-h-80 overflow-auto rounded border">
                      <table className="min-w-full text-xs">
                        <thead className="bg-gray-50 text-gray-600">
                          <tr>
                            <th className="px-2 py-2 text-left font-medium">Usuario</th>
                            <th className="px-2 py-2 text-left font-medium">Destino</th>
                            <th className="px-2 py-2 text-left font-medium">Proveedor</th>
                            <th className="px-2 py-2 text-left font-medium">Error</th>
                            <th className="px-2 py-2 text-left font-medium">Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {failedDeliveries.map((item) => (
                            <tr key={item.id} className="border-t align-top">
                              <td className="px-2 py-2">
                                <p className="font-medium text-gray-900">{item.user.name || 'Sin nombre'}</p>
                                <p className="text-gray-500">{item.user.email}</p>
                                <p className="text-gray-500">{item.user.role}</p>
                              </td>
                              <td className="px-2 py-2 text-gray-700">{item.destination || item.user.phone || '-'}</td>
                              <td className="px-2 py-2 text-gray-700">
                                <p>{item.provider}</p>
                                {item.providerMessageId && <p className="text-gray-500 break-all">id: {item.providerMessageId}</p>}
                              </td>
                              <td className="px-2 py-2">
                                <p className="font-medium text-rose-700">{item.errorCode || 'FAILED'}</p>
                                <p className="text-gray-600 whitespace-pre-wrap break-words">
                                  {item.errorMessage || 'Sin detalle reportado por el proveedor'}
                                </p>
                              </td>
                              <td className="px-2 py-2 text-gray-600">{formatDate(item.createdAt)}</td>
                            </tr>
                          ))}
                          {failedDeliveries.length === 0 && (
                            <tr>
                              <td className="px-2 py-3 text-gray-500" colSpan={5}>
                                No hay entregas fallidas registradas para esta campaña.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {activePanel === 'CREATE' && (
            <section className="space-y-4">
              <div className="rounded-xl border bg-white p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">{templateEditingId ? 'Editar plantilla' : 'Crear plantilla'}</h2>
                  {templateEditingId && (
                    <button
                      className="border rounded px-3 py-2 text-sm"
                      onClick={() => {
                        setTemplateEditingId(null)
                        setTplForm({ key: '', name: '', channel: 'SMS', subject: '', body: '' })
                        setTemplateFeedback(null)
                      }}
                    >
                      Cancelar edición
                    </button>
                  )}
                </div>
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
                    {templateEditingId ? 'Guardar cambios' : 'Crear plantilla'}
                  </button>
                </div>
                <textarea
                  ref={tplBodyRef}
                  className="w-full border rounded px-2 py-2 text-sm min-h-[90px] font-mono"
                  placeholder="Escribe el body. Haz clic en una variable de abajo para insertarla."
                  value={tplForm.body}
                  onChange={(e) => setTplForm((p) => ({ ...p, body: e.target.value }))}
                />

                {/* Variable reference panel */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Variables disponibles — clic para insertar</p>
                  {TEMPLATE_VARS.map((group) => (
                    <div key={group.group}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${group.badge}`}>{group.group}</span>
                        <span className="text-[10px] text-slate-400">{group.note}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {group.vars.map((v) => (
                          <button
                            key={v.key}
                            type="button"
                            title={`${v.desc}\nEjemplo: ${v.example}`}
                            onClick={() => insertVar(v.key)}
                            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-mono text-slate-700 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-800 transition cursor-pointer"
                          >
                            {'{{'}
                            <span className="font-semibold">{v.key}</span>
                            {'}}'}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <p className="text-[10px] text-slate-400 pt-1">Tip: posiciona el cursor en el texto y haz clic en la variable para insertarla exactamente ahí.</p>
                </div>

                {templateFeedback && (
                  <p className={`text-sm ${templateFeedback.type === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {templateFeedback.message}
                  </p>
                )}
                <div className="overflow-x-auto rounded border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Nombre</th>
                        <th className="px-3 py-2 text-left font-medium">Key</th>
                        <th className="px-3 py-2 text-left font-medium">Canal</th>
                        <th className="px-3 py-2 text-left font-medium">Estado</th>
                        <th className="px-3 py-2 text-right font-medium">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {templates.map((template) => (
                        <tr key={template.id} className="border-t">
                          <td className="px-3 py-2 font-medium text-gray-900">{template.name}</td>
                          <td className="px-3 py-2">{template.key}</td>
                          <td className="px-3 py-2">{template.channel}</td>
                          <td className="px-3 py-2">{template.isActive ? 'ACTIVA' : 'INACTIVA'}</td>
                          <td className="px-3 py-2">
                            <div className="flex justify-end gap-2">
                              <button
                                className="border rounded px-2 py-1 text-xs"
                                onClick={() => editTemplate(template)}
                              >
                                Editar
                              </button>
                              <button
                                className="border border-rose-200 text-rose-700 rounded px-2 py-1 text-xs"
                                onClick={() => deleteTemplate(template.id)}
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {templates.length === 0 && (
                        <tr>
                          <td className="px-3 py-4 text-gray-500" colSpan={5}>
                            No hay plantillas registradas.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border bg-white p-4 space-y-3">
                <h2 className="text-lg font-semibold">Crear campaña</h2>
                <div className="rounded border bg-blue-50 px-3 py-2 text-sm text-blue-900">
                  Flujo recomendado: 1) elige canal, 2) define contenido (plantilla o mensaje libre), 3) valida destinatarios, 4) guarda y envía.
                </div>
                <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    {selectionMode === 'MANUAL' ? (
                      <span>
                        Destinatarios seleccionados: <b>{recipientIncludeIds.length}</b>
                        {recipientIncludeIds.length === 0 && <span className="ml-2 text-amber-700 text-xs">(ninguno seleccionado aún)</span>}
                      </span>
                    ) : (
                      <>
                        <span>
                          Total estimado a enviar:
                          {' '}
                          <b>{loadingRecipients ? 'Calculando...' : estimatedRecipients}</b>
                        </span>
                        {!loadingRecipients && (
                          <>
                            <span>Elegibles: <b>{estimatedEligible}</b></span>
                            <span>Sin destino: <b>{estimatedIneligible}</b></span>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className={`rounded border px-3 py-2 text-sm ${channelProviderReady ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                  {channelProviderReady
                    ? `Proveedor listo para ${campForm.channel}.`
                    : `Proveedor incompleto para ${campForm.channel}. Completa la configuración en la pestaña "Configuración".`}
                </div>
                <div className="grid md:grid-cols-3 gap-2">
                  <label className="text-xs text-gray-700 space-y-1">
                    <span className="font-medium">Nombre de la campaña</span>
                    <input className="border rounded px-2 py-2 text-sm w-full" placeholder="Ej: Reactivación clientes Medellín" value={campForm.name} onChange={(e) => setCampForm((p) => ({ ...p, name: e.target.value }))} />
                  </label>
                  <label className="text-xs text-gray-700 space-y-1">
                    <span className="font-medium">Canal de envío</span>
                    <select className="border rounded px-2 py-2 text-sm w-full" value={campForm.channel} onChange={(e) => setCampForm((p) => ({ ...p, channel: e.target.value }))}>
                      <option value="SMS">SMS</option>
                      <option value="WHATSAPP">WHATSAPP</option>
                      <option value="EMAIL">EMAIL</option>
                      <option value="PUSH">PUSH</option>
                    </select>
                  </label>
                  <label className="text-xs text-gray-700 space-y-1">
                    <span className="font-medium">Audiencia por rol</span>
                    <select className="border rounded px-2 py-2 text-sm w-full" value={campForm.targetRole} onChange={(e) => setCampForm((p) => ({ ...p, targetRole: e.target.value }))}>
                      <option value="CLIENT">CLIENTES</option>
                      <option value="PARTNER">SOCIOS</option>
                    </select>
                  </label>
                </div>
                <div className="grid md:grid-cols-3 gap-2">
                  <label className="text-xs text-gray-700 space-y-1">
                    <span className="font-medium">Fuente de contenido</span>
                    <select
                      className="border rounded px-2 py-2 text-sm w-full"
                      value={campForm.contentMode}
                      onChange={(e) => setCampForm((p) => ({ ...p, contentMode: e.target.value }))}
                    >
                      <option value="TEMPLATE">Contenido desde plantilla</option>
                      <option value="CUSTOM">Mensaje libre</option>
                    </select>
                  </label>
                  <label className="text-xs text-gray-700 space-y-1">
                    <span className="font-medium">Ciudad objetivo</span>
                    <select className="border rounded px-2 py-2 text-sm w-full" value={campForm.targetCity} onChange={(e) => setCampForm((p) => ({ ...p, targetCity: e.target.value }))}>
                      <option value="">Todas las ciudades</option>
                      {CITY_OPTIONS.map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-gray-700 space-y-1">
                    <span className="font-medium">Asunto (solo Email)</span>
                    <input className="border rounded px-2 py-2 text-sm w-full" placeholder="Ej: Oferta exclusiva hoy" value={campForm.customSubject} onChange={(e) => setCampForm((p) => ({ ...p, customSubject: e.target.value }))} />
                  </label>
                </div>
                {campForm.targetRole === 'PARTNER' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-gray-700">Filtro de socios</p>
                      <button
                        className="border rounded px-2 py-1 text-xs"
                        onClick={() =>
                          setCampForm((prev) => ({
                            ...prev,
                            partnerFilterMode: 'ALL',
                            partnerCategoryIds: [],
                            partnerServiceIds: [],
                          }))
                        }
                        type="button"
                      >
                        Limpiar selección
                      </button>
                    </div>
                    <div className="grid md:grid-cols-3 gap-2">
                      <label className="text-xs text-gray-700 space-y-1 block">
                        <span className="font-medium">Modo de selección</span>
                        <select
                          className="border rounded px-2 py-2 text-sm w-full"
                          value={campForm.partnerFilterMode}
                          onChange={(e) =>
                            setCampForm((prev) => ({
                              ...prev,
                              partnerFilterMode: e.target.value as 'ALL' | 'CATEGORY' | 'SERVICE',
                              ...(e.target.value === 'ALL' ? { partnerCategoryIds: [], partnerServiceIds: [] } : {}),
                              ...(e.target.value === 'CATEGORY' ? { partnerServiceIds: [] } : {}),
                            }))
                          }
                        >
                          <option value="ALL">Todos los socios</option>
                          <option value="CATEGORY">Por categoría</option>
                          <option value="SERVICE">Por servicio específico</option>
                        </select>
                      </label>
                    </div>
                    {(campForm.partnerFilterMode === 'CATEGORY' || campForm.partnerFilterMode === 'SERVICE') && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-700">Categorías (opcional)</p>
                        <div className="max-h-28 overflow-auto rounded border p-2">
                          <div className="grid md:grid-cols-3 gap-2">
                            {partnerCategoryOptions.map((category) => {
                              const checked = campForm.partnerCategoryIds.includes(category.id)
                              return (
                                <label key={category.id} className="flex items-center gap-2 text-xs cursor-pointer">
                                  <input type="checkbox" checked={checked} onChange={() => togglePartnerCategoryId(category.id)} />
                                  <span>{category.name}</span>
                                </label>
                              )
                            })}
                            {partnerCategoryOptions.length === 0 && <p className="text-xs text-gray-500">No hay categorías disponibles.</p>}
                          </div>
                        </div>
                      </div>
                    )}
                    {campForm.partnerFilterMode === 'SERVICE' && (
                      <>
                        <p className="text-xs font-medium text-gray-700">Servicios/oficios</p>
                    <div className="max-h-44 overflow-auto rounded border p-2">
                      <div className="grid md:grid-cols-2 gap-2">
                        {filteredServiceOptions.map((service) => {
                          const checked = campForm.partnerServiceIds.includes(service.id)
                          return (
                            <label key={service.id} className="flex items-start gap-2 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePartnerServiceId(service.id)}
                              />
                              <span>
                                <b>{service.name}</b>
                                <span className="text-gray-500"> · {service.categoryName}</span>
                              </span>
                            </label>
                          )
                        })}
                        {filteredServiceOptions.length === 0 && (
                          <p className="text-xs text-gray-500">No se pudieron cargar los oficios.</p>
                        )}
                      </div>
                    </div>
                      </>
                    )}
                    <p className="text-xs text-gray-500">
                      Modo actual:
                      {' '}
                      <b>
                        {campForm.partnerFilterMode === 'ALL'
                          ? 'todos los socios'
                          : campForm.partnerFilterMode === 'CATEGORY'
                          ? 'socios por categoría'
                          : 'socios por servicio específico'}
                      </b>
                      .
                    </p>
                  </div>
                )}
                {campForm.channel === 'WHATSAPP' && campForm.contentMode === 'TEMPLATE' ? (
                  <div className="space-y-2">
                    <label className="text-xs text-gray-700 space-y-1 block">
                      <span className="font-medium">Plantilla WhatsApp (aprobadas por Meta)</span>
                      {approvedWaTemplates.length === 0 ? (
                        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          {waTemplates.length === 0
                            ? 'No se encontraron plantillas en Twilio. Verifica las credenciales en Configuración.'
                            : 'No hay plantillas aprobadas por Meta. Solo se pueden enviar plantillas con estado "approved".'}
                        </p>
                      ) : (
                        <select
                          className="border rounded px-2 py-2 text-sm w-full"
                          value={campForm.waContentSid}
                          onChange={(e) => {
                            const sid = e.target.value
                            const tpl = waTemplates.find((t) => t.sid === sid)
                            const vars: Record<string, string> = {}
                            if (tpl?.variables) {
                              for (const key of Object.keys(tpl.variables)) {
                                vars[key] = key === '1' ? '{{user_name}}' : ''
                              }
                            }
                            setCampForm((p) => ({ ...p, waContentSid: sid, waTemplateVariables: vars }))
                          }}
                        >
                          <option value="">Selecciona una plantilla WA…</option>
                          {approvedWaTemplates.map((tpl) => (
                            <option key={tpl.sid} value={tpl.sid}>
                              {tpl.name} ({tpl.language}){tpl.waCategory ? ` · ${tpl.waCategory}` : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </label>
                    {selectedWaTemplate && (
                      <>
                        <div className="rounded border bg-gray-50 p-2 text-xs text-gray-700 whitespace-pre-wrap min-h-[60px]">
                          {selectedWaTemplate.body || 'Sin vista previa de cuerpo disponible.'}
                        </div>
                        {Object.keys(campForm.waTemplateVariables).length > 0 && (
                          <div className="rounded border p-3 space-y-2">
                            <p className="text-xs font-medium text-gray-700">Variables de la plantilla</p>
                            <p className="text-xs text-gray-500">
                              Usa <code className="bg-gray-100 px-1 rounded">{'{{user_name}}'}</code> para el nombre del destinatario,{' '}
                              <code className="bg-gray-100 px-1 rounded">{'{{user_email}}'}</code> para su correo.
                            </p>
                            <div className="space-y-1.5">
                              {Object.entries(campForm.waTemplateVariables).map(([key, val]) => (
                                <div key={key} className="flex items-center gap-2">
                                  <span className="w-10 shrink-0 rounded border bg-gray-100 px-2 py-1 text-center font-mono text-xs text-gray-600">{`{{${key}}}`}</span>
                                  <input
                                    className="flex-1 border rounded px-2 py-1 text-xs"
                                    placeholder={key === '1' ? '{{user_name}} — nombre del destinatario' : 'Valor estático (ej: https://lohaggo.com)'}
                                    value={val}
                                    onChange={(e) =>
                                      setCampForm((p) => ({
                                        ...p,
                                        waTemplateVariables: { ...p.waTemplateVariables, [key]: e.target.value },
                                      }))
                                    }
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : campForm.contentMode === 'TEMPLATE' ? (
                  <div className="space-y-2">
                    <label className="text-xs text-gray-700 space-y-1 block">
                      <span className="font-medium">Plantilla a usar</span>
                      <select className="border rounded px-2 py-2 text-sm w-full" value={campForm.templateId} onChange={(e) => setCampForm((p) => ({ ...p, templateId: e.target.value }))}>
                        <option value="">Selecciona una plantilla</option>
                        {channelTemplates.map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="text-xs font-medium text-gray-700">Vista previa del contenido</p>
                    <div className="rounded border bg-gray-50 p-2 text-xs text-gray-700 whitespace-pre-wrap min-h-[70px]">
                      {selectedTemplate ? selectedTemplate.body : 'Selecciona una plantilla para ver su contenido.'}
                    </div>
                  </div>
                ) : (
                  <label className="text-xs text-gray-700 space-y-1 block">
                    <span className="font-medium">Mensaje de la campaña</span>
                    <textarea
                      className="w-full border rounded px-2 py-2 text-sm min-h-[90px]"
                      placeholder="Escribe aquí el mensaje final..."
                      value={campForm.customBody}
                      onChange={(e) => setCampForm((p) => ({ ...p, customBody: e.target.value }))}
                    />
                  </label>
                )}
                <div className="grid md:grid-cols-3 gap-2">
                  <label className="text-xs text-gray-700 space-y-1">
                    <span className="font-medium">Programación (opcional)</span>
                    <input className="border rounded px-2 py-2 text-sm w-full" type="datetime-local" value={campForm.scheduledAt} onChange={(e) => setCampForm((p) => ({ ...p, scheduledAt: e.target.value }))} />
                  </label>
                  <label className="text-xs text-gray-700 space-y-1">
                    <span className="font-medium">Prueba A/B</span>
                    <span className="flex items-center gap-2 text-sm border rounded px-2 py-2 w-full">
                      <input type="checkbox" checked={campForm.abTestEnabled} onChange={(e) => setCampForm((p) => ({ ...p, abTestEnabled: e.target.checked }))} />
                      Activar A/B test
                    </span>
                  </label>
                  <label className="text-xs text-gray-700 space-y-1">
                    <span className="font-medium">% variante A</span>
                    <input className="border rounded px-2 py-2 text-sm w-full" type="number" min={1} max={99} placeholder="50" value={campForm.abSplitA} onChange={(e) => setCampForm((p) => ({ ...p, abSplitA: e.target.value }))} />
                  </label>
                </div>
                {campForm.abTestEnabled && (
                  <div className="grid md:grid-cols-2 gap-2">
                    <div className="border rounded p-2 space-y-2">
                      <p className="text-sm font-semibold">Variante A</p>
                      <label className="text-xs text-gray-700 space-y-1 block">
                        <span className="font-medium">Identificador</span>
                        <input className="border rounded px-2 py-2 text-sm w-full" placeholder="A" value={campForm.abVariantAKey} onChange={(e) => setCampForm((p) => ({ ...p, abVariantAKey: e.target.value }))} />
                      </label>
                      <label className="text-xs text-gray-700 space-y-1 block">
                        <span className="font-medium">Asunto A (Email)</span>
                        <input className="border rounded px-2 py-2 text-sm w-full" placeholder="Asunto variante A" value={campForm.abVariantASubject} onChange={(e) => setCampForm((p) => ({ ...p, abVariantASubject: e.target.value }))} />
                      </label>
                      <label className="text-xs text-gray-700 space-y-1 block">
                        <span className="font-medium">Mensaje A</span>
                        <textarea className="border rounded px-2 py-2 text-sm w-full min-h-[70px]" placeholder="Contenido de la variante A" value={campForm.abVariantABody} onChange={(e) => setCampForm((p) => ({ ...p, abVariantABody: e.target.value }))} />
                      </label>
                    </div>
                    <div className="border rounded p-2 space-y-2">
                      <p className="text-sm font-semibold">Variante B</p>
                      <label className="text-xs text-gray-700 space-y-1 block">
                        <span className="font-medium">Identificador</span>
                        <input className="border rounded px-2 py-2 text-sm w-full" placeholder="B" value={campForm.abVariantBKey} onChange={(e) => setCampForm((p) => ({ ...p, abVariantBKey: e.target.value }))} />
                      </label>
                      <label className="text-xs text-gray-700 space-y-1 block">
                        <span className="font-medium">Asunto B (Email)</span>
                        <input className="border rounded px-2 py-2 text-sm w-full" placeholder="Asunto variante B" value={campForm.abVariantBSubject} onChange={(e) => setCampForm((p) => ({ ...p, abVariantBSubject: e.target.value }))} />
                      </label>
                      <label className="text-xs text-gray-700 space-y-1 block">
                        <span className="font-medium">Mensaje B</span>
                        <textarea className="border rounded px-2 py-2 text-sm w-full min-h-[70px]" placeholder="Contenido de la variante B" value={campForm.abVariantBBody} onChange={(e) => setCampForm((p) => ({ ...p, abVariantBBody: e.target.value }))} />
                      </label>
                    </div>
                  </div>
                )}
                <div className="rounded-lg border p-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-gray-900">Destinatarios de la campaña</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex rounded border overflow-hidden text-xs">
                        <button
                          className={`px-3 py-1.5 ${selectionMode === 'MANUAL' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                          onClick={() => { setSelectionMode('MANUAL'); setRecipientIncludeIds([]); setRecipientExcludeIds([]) }}
                          type="button"
                        >
                          Selección manual
                        </button>
                        <button
                          className={`px-3 py-1.5 border-l ${selectionMode === 'SEGMENT' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                          onClick={() => { setSelectionMode('SEGMENT'); setRecipientIncludeIds([]); setRecipientExcludeIds([]) }}
                          type="button"
                        >
                          Segmento automático
                        </button>
                      </div>
                      <button
                        className="border rounded px-2 py-1 text-xs"
                        onClick={() => void loadRecipientPreview()}
                      >
                        Actualizar
                      </button>
                    </div>
                  </div>
                  {selectionMode === 'MANUAL' && (
                    <div className="flex flex-wrap items-center gap-2 rounded bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-900">
                      <span className="flex-1">Selección manual: busca y marca usuarios individualmente. Seleccionados: <b>{recipientIncludeIds.length}</b></span>
                      <button
                        className="rounded border border-blue-400 bg-white px-2 py-1 text-xs text-blue-800 hover:bg-blue-100"
                        onClick={() => setRecipientIncludeIds(recipientPreview.map((r) => r.id))}
                        type="button"
                      >
                        Seleccionar todos visibles
                      </button>
                      <button
                        className="rounded border border-blue-400 bg-white px-2 py-1 text-xs text-blue-800 hover:bg-blue-100"
                        onClick={() => setRecipientIncludeIds([])}
                        type="button"
                      >
                        Deseleccionar todos
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <label className="text-xs text-gray-700 space-y-1 flex-1 min-w-[220px]">
                      <span className="font-medium">Buscar destinatarios</span>
                      <input
                        className="border rounded px-2 py-2 text-sm w-full"
                        placeholder="Nombre, email o teléfono"
                        value={recipientSearch}
                        onChange={(e) => setRecipientSearch(e.target.value)}
                      />
                    </label>
                    <button
                      className="border rounded px-3 py-2 text-sm self-end"
                      onClick={() => void loadRecipientPreview()}
                    >
                      Buscar
                    </button>
                  </div>
                  {recipientSummary && (
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
                      <div className="rounded border bg-gray-50 px-2 py-1">Total: <b>{recipientSummary.total}</b></div>
                      <div className="rounded border bg-gray-50 px-2 py-1">Mostrando: <b>{previewRows}</b></div>
                      <div className="rounded border bg-gray-50 px-2 py-1">Elegibles: <b>{recipientSummary.eligible}</b></div>
                      <div className="rounded border bg-gray-50 px-2 py-1">Sin destino: <b>{recipientSummary.ineligible}</b></div>
                      <div className="rounded border bg-gray-50 px-2 py-1">Segmento: <b>{recipientSummary.segmentCount}</b></div>
                      <div className="rounded border bg-gray-50 px-2 py-1">Agregados: <b>{recipientSummary.manualIncludedCount}</b></div>
                      <div className="rounded border bg-gray-50 px-2 py-1">Excluidos: <b>{recipientSummary.excludedCount}</b></div>
                    </div>
                  )}
                  {campForm.targetRole === 'PARTNER' && (
                    <p className="text-xs text-gray-500">
                      Filtro de socios:
                      {' '}
                      <b>
                        {campForm.partnerFilterMode === 'ALL'
                          ? 'todos'
                          : campForm.partnerFilterMode === 'CATEGORY'
                          ? `categorías (${campForm.partnerCategoryIds.length})`
                          : `servicios (${campForm.partnerServiceIds.length})`}
                      </b>
                    </p>
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
                                {selectionMode === 'MANUAL' ? (
                                  <button
                                    className={`rounded px-2 py-1 ${included ? 'bg-emerald-600 text-white' : 'border'}`}
                                    onClick={() => toggleIncludeRecipient(recipient.id)}
                                  >
                                    {included ? 'Seleccionado' : 'Seleccionar'}
                                  </button>
                                ) : (
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
                                )}
                              </td>
                            </tr>
                          )
                        })}
                        {!loadingRecipients && recipientPreview.length === 0 && (
                          <tr>
                            <td className="px-2 py-3 text-gray-500" colSpan={4}>
                              {selectionMode === 'MANUAL'
                                ? 'Busca usuarios por nombre, email o teléfono para agregarlos.'
                                : 'No hay destinatarios para este segmento.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                {campForm.contentMode === 'TEMPLATE' && (
                  <textarea
                    className="w-full border rounded px-2 py-2 text-sm min-h-[90px]"
                    placeholder="(Opcional) ajusta el texto final para esta campaña"
                    value={campForm.customBody}
                    onChange={(e) => setCampForm((p) => ({ ...p, customBody: e.target.value }))}
                  />
                )}
                {campaignFeedback && (
                  <p className={`text-sm ${campaignFeedback.type === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {campaignFeedback.message}
                  </p>
                )}
                <div className="flex gap-2">
                  <button className="bg-primary-600 text-white rounded px-3 py-2 text-sm" onClick={createCampaign}>
                    Guardar campaña ({loadingRecipients ? '...' : estimatedRecipients})
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

          {activePanel === 'MAGIC_LINK' && (
            <section className="space-y-5">

              {/* Explanation */}
              <div className="rounded-xl border bg-white p-5 space-y-4">
                <h2 className="text-lg font-bold text-slate-900">Magic Link — acceso sin contraseña</h2>
                <p className="text-sm text-slate-600">
                  Genera enlaces de un solo uso para que socios o clientes entren directamente a cualquier sección del panel sin necesidad de recordar su contraseña.
                  Ideal para reactivación, incorporación, campañas de verificación, o soporte.
                </p>
                <div className="grid md:grid-cols-3 gap-3">
                  {[
                    { step: '1', color: 'blue', title: 'Configuras el link', body: 'Elige a quién va dirigido, a qué sección del panel lo llevas, y si quieres que vea el banner de crear contraseña.' },
                    { step: '2', color: 'violet', title: 'Envías la campaña', body: 'Copia las URLs o exporta el CSV. Úsalas en WhatsApp, SMS o email con la variable {{action_url}}.' },
                    { step: '3', color: 'emerald', title: 'El usuario entra sin fricción', body: 'Al hacer clic queda logueado automáticamente y aterriza en la sección que configuraste. 72 h de validez, un solo uso.' },
                  ].map((item) => (
                    <div key={item.step} className={`rounded-lg border p-4 bg-${item.color}-50 border-${item.color}-200`}>
                      <div className={`text-xs font-bold text-${item.color}-700 mb-1`}>Paso {item.step}</div>
                      <div className={`text-sm font-semibold text-${item.color}-900 mb-1`}>{item.title}</div>
                      <p className={`text-xs text-${item.color}-800`}>{item.body}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900 space-y-1">
                  <p className="font-semibold text-sm">Notas</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    <li>Cada link es de <strong>un solo uso</strong> — el segundo intento falla.</li>
                    <li>Expiran en <strong>72 horas</strong> desde su generación.</li>
                    <li>El banner de cambio de contraseña es opcional y configurable por lote.</li>
                  </ul>
                </div>
              </div>

              {/* Generator */}
              <div className="rounded-xl border bg-white p-5 space-y-5">
                <h2 className="text-base font-bold text-slate-900">Generar Magic Links</h2>

                {/* Step 1 — Audience */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">1 · Audiencia</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {([
                      { value: 'PARTNERS_WITHOUT_DOCS', label: 'Socios sin documentos aprobados', desc: 'Todos los socios que no tienen cédula + antecedentes aprobados', role: 'partner' },
                      { value: 'ALL_PARTNERS', label: 'Todos los socios', desc: 'Incluye verificados y no verificados', role: 'partner' },
                      { value: 'ALL_CLIENTS', label: 'Todos los clientes', desc: 'Todos los usuarios con rol CLIENT', role: 'client' },
                      { value: 'ALL_USERS', label: 'Todos los usuarios', desc: 'Socios y clientes', role: 'partner' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { setMlAudience(opt.value); setMlRoleContext(opt.role) }}
                        className={`text-left rounded-lg border px-4 py-3 transition ${mlAudience === opt.value ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-400' : 'border-slate-200 hover:bg-slate-50'}`}
                      >
                        <p className={`text-sm font-semibold ${mlAudience === opt.value ? 'text-blue-800' : 'text-slate-800'}`}>{opt.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 2 — Destination */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">2 · Destino dentro del panel</p>
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {mlSections.map((sec) => (
                      <button
                        key={sec.value}
                        type="button"
                        onClick={() => setMlSection(sec.value)}
                        className={`text-left rounded-lg border px-3 py-2.5 transition text-sm ${mlSection === sec.value ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-400 font-semibold text-violet-800' : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`}
                      >
                        {sec.label}
                        {sec.value !== '__custom__' && (
                          <span className="block text-xs font-mono text-slate-400 mt-0.5">{sec.value}</span>
                        )}
                      </button>
                    ))}
                  </div>
                  {mlSection === '__custom__' && (
                    <input
                      className="border rounded px-3 py-2 text-sm w-full mt-1"
                      placeholder="Ej: /partner/profile o /client/dashboard"
                      value={mlCustomUrl}
                      onChange={(e) => setMlCustomUrl(e.target.value)}
                      autoFocus
                    />
                  )}
                  {mlSection !== '__custom__' && (
                    <p className="text-xs text-slate-500">Destino seleccionado: <span className="font-mono text-slate-700">{mlSection}</span></p>
                  )}
                </div>

                {/* Step 3 — Password change banner */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">3 · Banner de cambio de contraseña</p>
                  <div className="flex gap-3">
                    {([
                      { value: false, label: 'No mostrar', desc: 'El usuario entra al panel sin ningún aviso adicional' },
                      { value: true, label: 'Mostrar banner', desc: 'Aparece un aviso persistente invitando a crear o actualizar la contraseña' },
                    ] as const).map((opt) => (
                      <button
                        key={String(opt.value)}
                        type="button"
                        onClick={() => setMlRequirePasswordChange(opt.value)}
                        className={`flex-1 text-left rounded-lg border px-4 py-3 transition ${mlRequirePasswordChange === opt.value ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-400' : 'border-slate-200 hover:bg-slate-50'}`}
                      >
                        <p className={`text-sm font-semibold ${mlRequirePasswordChange === opt.value ? 'text-emerald-800' : 'text-slate-800'}`}>{opt.label}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Summary + Generate */}
                <div className="rounded-lg bg-slate-50 border px-4 py-3 flex flex-wrap items-center gap-4">
                  <div className="flex-1 text-xs text-slate-600 space-y-0.5">
                    <p><span className="font-medium">Audiencia:</span> {mlAudience === 'PARTNERS_WITHOUT_DOCS' ? 'Socios sin documentos' : mlAudience === 'ALL_PARTNERS' ? 'Todos los socios' : mlAudience === 'ALL_CLIENTS' ? 'Todos los clientes' : 'Todos los usuarios'}</p>
                    <p><span className="font-medium">Destino:</span> <span className="font-mono">{mlRedirectUrl || '—'}</span></p>
                    <p><span className="font-medium">Banner contraseña:</span> {mlRequirePasswordChange ? 'Sí' : 'No'}</p>
                  </div>
                  <button
                    onClick={generateMagicLinks}
                    disabled={mlGenerating || (mlSection === '__custom__' && !mlCustomUrl.trim())}
                    className="shrink-0 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    {mlGenerating ? 'Generando…' : 'Generar links'}
                  </button>
                </div>

                {mlError && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{mlError}</div>
                )}

                {/* Results */}
                {mlResults !== null && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-sm font-semibold text-slate-800">{mlResults.length} links generados</span>
                      {mlResults.length === 0 && (
                        <span className="text-xs text-slate-500">— No hay usuarios en esta audiencia.</span>
                      )}
                      {mlResults.length > 0 && (
                        <button
                          onClick={() => {
                            const csv = ['userId,url', ...mlResults!.map((r) => `${r.userId},${r.url}`)].join('\n')
                            const a = document.createElement('a')
                            a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
                            a.download = `magic-links-${new Date().toISOString().slice(0, 10)}.csv`
                            a.click()
                          }}
                          className="rounded border px-3 py-1 text-xs text-slate-700 hover:bg-slate-50 transition"
                        >
                          Exportar CSV
                        </button>
                      )}
                    </div>

                    {mlResults.length > 0 && (
                      <>
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                          Copia cada URL e inclúyela en tu plantilla usando <code className="bg-emerald-100 px-1 rounded">{'{{action_url}}'}</code>. Los links son de un solo uso y expiran en 72 h.
                        </div>
                        <div className="overflow-x-auto rounded border max-h-96 overflow-y-auto">
                          <table className="min-w-full text-sm">
                            <thead className="bg-slate-50 text-slate-600 text-xs sticky top-0">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium">#</th>
                                <th className="px-3 py-2 text-left font-medium">User ID</th>
                                <th className="px-3 py-2 text-left font-medium">URL</th>
                                <th className="px-3 py-2 text-right font-medium">Copiar</th>
                              </tr>
                            </thead>
                            <tbody>
                              {mlResults.map((r, i) => (
                                <tr key={r.token} className="border-t hover:bg-slate-50">
                                  <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                                  <td className="px-3 py-2 font-mono text-xs text-slate-600">{r.userId}</td>
                                  <td className="px-3 py-2 max-w-xs">
                                    <span className="font-mono text-xs text-blue-700 break-all">{r.url}</span>
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      onClick={() => copyMagicLink(r.url, r.token)}
                                      className="rounded border px-2 py-1 text-xs hover:bg-slate-100 transition"
                                    >
                                      {mlCopied === r.token ? '✓ Copiado' : 'Copiar'}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* How to use */}
              <div className="rounded-xl border bg-white p-5 space-y-3">
                <h2 className="text-base font-bold text-slate-900">Cómo usar en una campaña de WhatsApp</h2>
                <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700">
                  <li>Genera los links arriba y exporta el CSV.</li>
                  <li>Ve a <strong>Crear campaña</strong> → canal <strong>WHATSAPP</strong> → plantilla aprobada.</li>
                  <li>Usa <code className="bg-slate-100 px-1 rounded text-xs">{'{{action_url}}'}</code> en el cuerpo donde irá el link.</li>
                  <li>En "Selección manual" busca los usuarios por ID o email y agrégalos.</li>
                  <li>El sistema reemplaza <code className="bg-slate-100 px-1 rounded text-xs">{'{{action_url}}'}</code> con el URL del magic link de cada usuario al enviar.</li>
                </ol>
                <div className="rounded bg-slate-100 px-3 py-2 text-xs font-mono text-slate-600">
                  {'Hola {{user_name}}, entra a tu panel LoHaggo con un clic: {{action_url}}'}
                </div>
              </div>

            </section>
          )}
        </>
      )}
    </div>
  )
}
