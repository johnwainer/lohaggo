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
  startedAt?: string | null
  completedAt?: string | null
  scheduledAt?: string | null
  customBody?: string | null
  customSubject?: string | null
  metadata?: string | null
  template?: { id: string; key: string; name: string } | null
  abTestEnabled?: boolean
  abTestConfig?: string | null
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
  metaWhatsApp?: {
    active: boolean
    wabaId: string
    phoneNumberId: string
    hasAccessToken?: boolean
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
  source?: 'meta' | 'twilio'
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
    note: 'Generados automáticamente. action_url genera un magic link único por destinatario al enviar la campaña.',
    vars: [
      { key: 'action_url',   desc: 'Magic Link único por destinatario — se genera automáticamente al enviar. Configura destino y banner en la sección "Magic Link" de la campaña.',  example: 'https://lohaggo.com/auth/magic?token=xxx' },
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
    partnerWithoutDocs: false,
    partnerWithoutStudies: false,
    customSubject: '',
    customBody: '',
    templateId: '',
    waContentSid: '',
    waTemplateVariables: {} as Record<string, string>,
    magicLinkRedirectUrl: '/partner/dashboard',
    magicLinkCustomUrl: '',
    magicLinkRequirePasswordChange: false,
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
  const [metaForm, setMetaForm] = useState({
    isActive: true,
    accessToken: '',
    wabaId: '',
    phoneNumberId: '',
  })
  const [recipientSearch, setRecipientSearch] = useState('')
  const [recipientIncludeIds, setRecipientIncludeIds] = useState<string[]>([])
  const [recipientIncludeDetails, setRecipientIncludeDetails] = useState<{ id: string; name: string; email: string }[]>([])
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
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set())
  const [failedDeliveriesCampaign, setFailedDeliveriesCampaign] = useState<Campaign | null>(null)
  const [failedDeliveries, setFailedDeliveries] = useState<FailedDelivery[]>([])
  const [loadingFailedDeliveries, setLoadingFailedDeliveries] = useState(false)
  const [failedDeliveriesError, setFailedDeliveriesError] = useState<string | null>(null)
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null)
  const [syncingTemplates, setSyncingTemplates] = useState(false)
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null)

  // Magic link state

  // Ref for template body textarea — enables click-to-insert variables at cursor
  const tplBodyRef = useRef<HTMLTextAreaElement>(null)
  // Ref for campaign custom body textarea — same cursor-insert behaviour
  const campBodyRef = useRef<HTMLTextAreaElement>(null)

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
      const [tplRes, campRes, ovRes, pvRes, waRes, svcRes] = await Promise.all([
        fetch('/api/admin/messaging/templates', { cache: 'no-store' }),
        fetch('/api/admin/messaging/campaigns', { cache: 'no-store' }),
        fetch('/api/admin/messaging/overview', { cache: 'no-store' }),
        fetch('/api/admin/messaging/providers', { cache: 'no-store' }),
        fetch('/api/admin/messaging/wa-templates', { cache: 'no-store' }),
        fetch('/api/admin/messaging/services', { cache: 'no-store' }),
      ])
      const [tplData, campData, ovData, pvData, waData, svcData] = await Promise.all([
        tplRes.json().catch(() => ({ templates: [] })),
        campRes.json().catch(() => ({ campaigns: [] })),
        ovRes.json().catch(() => null),
        pvRes.json().catch(() => ({ providers: null })),
        waRes.json().catch(() => ({ templates: [] })),
        svcRes.json().catch(() => ({ services: [] })),
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

  const syncWaTemplates = async () => {
    setSyncingTemplates(true)
    setSyncFeedback(null)
    try {
      const res = await fetch('/api/admin/messaging/wa-templates/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al sincronizar')
      setSyncFeedback(`✓ ${data.count} plantillas sincronizadas`)
      // Reload WA templates into state
      const waRes = await fetch('/api/admin/messaging/wa-templates', { cache: 'no-store' })
      const waData = await waRes.json().catch(() => ({ templates: [] }))
      setWaTemplates(waData.templates || [])
    } catch (e: any) {
      setSyncFeedback(`Error: ${e.message}`)
    } finally {
      setSyncingTemplates(false)
      setTimeout(() => setSyncFeedback(null), 5000)
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

  const campaignRecipientPreviewRef = useRef<HTMLDivElement>(null)

  const loadRecipientPreview = async (options?: { forCampaignId?: string; channel?: Campaign['channel'] }) => {
    setLoadingRecipients(true)
    try {
      const params = new URLSearchParams()
      params.set('channel', options?.channel || campForm.channel)
      // Don't send recipientSearch when loading a saved campaign — the search is only for the CREATE panel.
      if (!options?.forCampaignId) params.set('search', recipientSearch)
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
          if (campForm.partnerWithoutDocs) params.set('partnerWithoutDocs', 'true')
          if (campForm.partnerWithoutStudies) params.set('partnerWithoutStudies', 'true')
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
        setTimeout(() => campaignRecipientPreviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
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

  // Auto-refresh while any campaign is processing
  useEffect(() => {
    const hasProcessing = campaigns.some((c) => c.status === 'PROCESSING')
    if (!hasProcessing) return
    const timer = setInterval(async () => {
      const res = await fetch('/api/admin/messaging/campaigns', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setCampaigns(data.campaigns || [])
    }, 4000)
    return () => clearInterval(timer)
  }, [campaigns])

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
    if (providers.metaWhatsApp) {
      setMetaForm((prev) => ({
        ...prev,
        isActive: providers.metaWhatsApp!.active,
        wabaId: providers.metaWhatsApp!.wabaId || '',
        phoneNumberId: providers.metaWhatsApp!.phoneNumberId || '',
      }))
    }
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
    campForm.partnerWithoutDocs,
    campForm.partnerWithoutStudies,
    recipientIncludeIds,
    recipientExcludeIds,
    selectionMode,
  ])

  useEffect(() => {
    if (activePanel !== 'CREATE') return
    const timer = setTimeout(() => { void loadRecipientPreview() }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientSearch])

  useEffect(() => {
    if (campForm.targetRole === 'PARTNER') return
    if (!campForm.partnerServiceIds.length && !campForm.partnerCategoryIds.length && campForm.partnerFilterMode === 'ALL' && !campForm.partnerWithoutDocs && !campForm.partnerWithoutStudies) return
    setCampForm((prev) => ({ ...prev, partnerFilterMode: 'ALL', partnerCategoryIds: [], partnerServiceIds: [], partnerWithoutDocs: false, partnerWithoutStudies: false }))
  }, [campForm.targetRole, campForm.partnerFilterMode, campForm.partnerCategoryIds.length, campForm.partnerServiceIds.length, campForm.partnerWithoutDocs, campForm.partnerWithoutStudies])

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
        partnerWithoutDocs: selectionMode === 'SEGMENT' && campForm.targetRole === 'PARTNER' ? campForm.partnerWithoutDocs : false,
        partnerWithoutStudies: selectionMode === 'SEGMENT' && campForm.targetRole === 'PARTNER' ? campForm.partnerWithoutStudies : false,
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
          magicLinkRedirectUrl: campForm.magicLinkRedirectUrl === '__custom__'
            ? campForm.magicLinkCustomUrl || '/partner/dashboard'
            : campForm.magicLinkRedirectUrl,
          magicLinkRequirePasswordChange: campForm.magicLinkRequirePasswordChange,
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
      partnerWithoutDocs: false,
      partnerWithoutStudies: false,
      customSubject: '',
      customBody: '',
      templateId: '',
      waContentSid: '',
      waTemplateVariables: {},
      magicLinkRedirectUrl: '/partner/dashboard',
      magicLinkCustomUrl: '',
      magicLinkRequirePasswordChange: false,
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
    setRecipientIncludeDetails([])
    setRecipientExcludeIds([])
    setRecipientPreview([])
    setRecipientSummary(null)
    setSelectionMode('MANUAL')
    await load()
    setActivePanel('CAMPAIGNS')
  }

  const sendCampaign = async (campaignId: string) => {
    const campaign = campaigns.find((c) => c.id === campaignId)
    if (!campaign) return

    const isSent = campaign.status === 'SENT'
    const confirmMsg = isSent
      ? `Esta campaña ya fue enviada (${campaign.totalSent} mensajes). ¿Enviar de nuevo a todos los destinatarios?`
      : `¿Confirmas el envío de "${campaign.name}"? Esta acción no se puede deshacer.`
    if (!window.confirm(confirmMsg)) return

    setCampaignFeedback(null)
    setSendingIds((prev) => new Set(prev).add(campaignId))

    try {
      const response = await fetch(`/api/admin/messaging/campaigns/${campaignId}/send`, { method: 'POST' })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setCampaignFeedback({ type: 'error', message: data?.error || 'No se pudo enviar la campaña' })
        return
      }
      const result = data?.campaign
      const failureSample: Array<{ errorCode: string | null; errorMessage: string | null; destination: string }> = data?.failureSample || []
      const status = result?.status as string | undefined
      const sent = result?.totalSent ?? 0
      const failed = result?.totalFailed ?? 0
      const total = result?.totalRecipients ?? 0

      if (status === 'FAILED') {
        const firstError = failureSample[0]
        const detail = firstError?.errorMessage || firstError?.errorCode || 'Sin detalle del proveedor'
        setCampaignFeedback({ type: 'error', message: `Campaña fallida (${failed}/${total} fallaron). Error: ${detail}` })
      } else if (status === 'PARTIAL') {
        const firstError = failureSample[0]
        const detail = firstError?.errorMessage || firstError?.errorCode || ''
        setCampaignFeedback({ type: 'error', message: `Envío parcial: ${sent} enviados, ${failed} fallaron.${detail ? ` Error: ${detail}` : ''}` })
      } else {
        setCampaignFeedback({ type: 'ok', message: `✓ Campaña enviada: ${sent} de ${total} mensajes entregados.` })
      }
      await load()
      await loadMetrics(campaignId)
    } finally {
      setSendingIds((prev) => { const next = new Set(prev); next.delete(campaignId); return next })
    }
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

  const toggleIncludeRecipient = (user: { id: string; name: string; email: string }) => {
    setRecipientExcludeIds((prev) => prev.filter((id) => id !== user.id))
    setRecipientIncludeIds((prev) => {
      if (prev.includes(user.id)) {
        setRecipientIncludeDetails((d) => d.filter((u) => u.id !== user.id))
        return prev.filter((id) => id !== user.id)
      }
      setRecipientIncludeDetails((d) => [...d, { id: user.id, name: user.name, email: user.email }])
      return [...prev, user.id]
    })
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

  const saveMetaWhatsApp = async () => {
    const payload: Record<string, unknown> = {
      provider: 'META_WHATSAPP',
      isActive: metaForm.isActive,
      wabaId: metaForm.wabaId || null,
      phoneNumberId: metaForm.phoneNumberId || null,
    }
    if (metaForm.accessToken.trim()) payload.accessToken = metaForm.accessToken.trim()

    await fetch('/api/admin/messaging/providers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setMetaForm((prev) => ({ ...prev, accessToken: '' }))
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

  // Insert {{variable}} at cursor in the campaign custom body textarea
  function insertCampVar(key: string) {
    const el = campBodyRef.current
    if (!el) return
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const insert = `{{${key}}}`
    const next = el.value.slice(0, start) + insert + el.value.slice(end)
    setCampForm((p) => ({ ...p, customBody: next }))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + insert.length, start + insert.length)
    })
  }

  function smsSegments(text: string) {
    if (!text) return { chars: 0, segments: 0 }
    const chars = text.length
    const limit = chars > 160 ? 153 : 160
    return { chars, segments: Math.ceil(chars / limit) }
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
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">Meta WhatsApp (Cloud API)</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        providers?.metaWhatsApp?.active && providers?.metaWhatsApp?.hasAccessToken
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {providers?.metaWhatsApp?.active && providers?.metaWhatsApp?.hasAccessToken ? 'Configurado' : 'Incompleto'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    WABA ID: {providers?.metaWhatsApp?.wabaId || 'n/a'} · Phone ID: {providers?.metaWhatsApp?.phoneNumberId || 'n/a'} · Token: {providers?.metaWhatsApp?.hasAccessToken ? 'OK' : 'Falta'}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={metaForm.isActive} onChange={(e) => setMetaForm((p) => ({ ...p, isActive: e.target.checked }))} />
                  Activar Meta WhatsApp
                </label>
                <input className="border rounded px-2 py-2 text-sm w-full" placeholder="WABA ID (WhatsApp Business Account ID)" value={metaForm.wabaId} onChange={(e) => setMetaForm((p) => ({ ...p, wabaId: e.target.value }))} />
                <input className="border rounded px-2 py-2 text-sm w-full" placeholder="Phone Number ID" value={metaForm.phoneNumberId} onChange={(e) => setMetaForm((p) => ({ ...p, phoneNumberId: e.target.value }))} />
                <input className="border rounded px-2 py-2 text-sm w-full" placeholder="Access Token (déjalo vacío para mantener el actual)" type="password" value={metaForm.accessToken} onChange={(e) => setMetaForm((p) => ({ ...p, accessToken: e.target.value }))} />
                <button className="bg-primary-600 text-white rounded px-3 py-2 text-sm" onClick={saveMetaWhatsApp}>
                  Guardar Meta WhatsApp
                </button>
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
              {campaignFeedback && (
                <div className={`rounded-lg px-4 py-3 text-sm ${campaignFeedback.type === 'ok' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                  {campaignFeedback.message}
                  <button className="ml-3 text-xs underline opacity-70 hover:opacity-100" onClick={() => setCampaignFeedback(null)}>Cerrar</button>
                </div>
              )}
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
                        <td className="px-3 py-2">
                          {(() => {
                            const s = campaign.status
                            const cfg: Record<string, { label: string; cls: string }> = {
                              DRAFT:      { label: 'Borrador',    cls: 'bg-gray-100 text-gray-600' },
                              SCHEDULED:  { label: 'Programada',  cls: 'bg-blue-100 text-blue-700' },
                              PROCESSING: { label: 'Procesando…', cls: 'bg-yellow-100 text-yellow-700 animate-pulse' },
                              SENT:       { label: 'Enviada',     cls: 'bg-emerald-100 text-emerald-700' },
                              PARTIAL:    { label: 'Parcial',     cls: 'bg-orange-100 text-orange-700' },
                              FAILED:     { label: 'Fallida',     cls: 'bg-rose-100 text-rose-700' },
                              CANCELLED:  { label: 'Cancelada',   cls: 'bg-gray-100 text-gray-500' },
                            }
                            const { label, cls } = cfg[s] || { label: s, cls: 'bg-gray-100 text-gray-600' }
                            return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>
                          })()}
                        </td>
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
                              onClick={() => setDetailCampaign(campaign)}
                            >
                              Ver
                            </button>
                            <button
                              className="border rounded px-2 py-1 text-xs"
                              onClick={() => void loadRecipientPreview({ forCampaignId: campaign.id, channel: campaign.channel })}
                            >
                              Destinatarios
                            </button>
                            <button className="border rounded px-2 py-1 text-xs" onClick={() => loadMetrics(campaign.id, true)}>
                              Métricas
                            </button>
                            {(() => {
                              const isSending = sendingIds.has(campaign.id)
                              const isProcessing = campaign.status === 'PROCESSING'
                              const isSent = campaign.status === 'SENT'
                              if (isSending) {
                                return (
                                  <span className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs bg-primary-100 text-primary-700 font-semibold">
                                    <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                                    </svg>
                                    Enviando…
                                  </span>
                                )
                              }
                              if (isProcessing) {
                                return (
                                  <span className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs bg-yellow-100 text-yellow-700 font-semibold animate-pulse">
                                    <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                                    </svg>
                                    Procesando…
                                  </span>
                                )
                              }
                              return (
                                <button
                                  className={`rounded px-2 py-1 text-xs font-semibold text-white transition ${isSent ? 'bg-gray-400 hover:bg-primary-600' : 'bg-primary-600 hover:bg-primary-700'}`}
                                  onClick={() => void sendCampaign(campaign.id)}
                                >
                                  {isSent ? 'Reenviar' : 'Enviar'}
                                </button>
                              )
                            })()}
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
                <div ref={campaignRecipientPreviewRef} className="rounded-lg border bg-gray-50 p-3 space-y-3">
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

          {/* Campaign detail modal */}
          {detailCampaign && (() => {
            let meta: Record<string, unknown> = {}
            try { meta = JSON.parse(detailCampaign.metadata ?? '{}') } catch { /* ignore */ }
            const contentMode = (meta.contentMode as string) || 'CUSTOM'
            const isWa = contentMode === 'WA_TEMPLATE'
            const waVars = (meta.waTemplateVariables as Record<string, string>) || {}
            const waName = meta.waTemplateName as string | null
            const waSid = meta.waContentSid as string | null
            const mlUrl = meta.magicLinkRedirectUrl as string | null
            const mlBanner = Boolean(meta.magicLinkRequirePasswordChange)
            const body = detailCampaign.customBody || ''
            const subject = detailCampaign.customSubject || ''
            const usedVars = ['user_name', 'user_email', 'action_url'].filter(
              (v) => body.includes(`{{${v}}}`) || subject.includes(`{{${v}}}`) || Object.values(waVars).some((val) => val.includes(v))
            )
            const usesActionUrl = usedVars.includes('action_url') || Object.values(waVars).some((v) => v.includes('action_url'))

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDetailCampaign(null)}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-start justify-between gap-3 p-5 border-b">
                    <div>
                      <h2 className="text-base font-bold text-gray-900">{detailCampaign.name}</h2>
                      <p className="text-xs text-gray-500 mt-0.5">{detailCampaign.channel} · {detailCampaign.status} · {detailCampaign.targetRole || 'MANUAL'}{detailCampaign.targetCity ? ` / ${detailCampaign.targetCity}` : ''}</p>
                    </div>
                    <button onClick={() => setDetailCampaign(null)} className="rounded-lg p-1.5 hover:bg-gray-100 transition text-gray-500">✕</button>
                  </div>

                  <div className="p-5 space-y-5">
                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-3 text-xs text-gray-600">
                      <div><span className="font-medium block text-gray-800">Creada</span>{formatDate(detailCampaign.createdAt)}</div>
                      {detailCampaign.scheduledAt && <div><span className="font-medium block text-gray-800">Programada</span>{formatDate(detailCampaign.scheduledAt)}</div>}
                      {detailCampaign.startedAt && <div><span className="font-medium block text-gray-800">Iniciada</span>{formatDate(detailCampaign.startedAt)}</div>}
                      {detailCampaign.completedAt && <div><span className="font-medium block text-gray-800">Completada</span>{formatDate(detailCampaign.completedAt)}</div>}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Destinatarios', value: detailCampaign.totalRecipients, color: 'gray' },
                        { label: 'Enviados', value: detailCampaign.totalSent, color: 'emerald' },
                        { label: 'Fallidos', value: detailCampaign.totalFailed, color: detailCampaign.totalFailed > 0 ? 'rose' : 'gray' },
                      ].map((s) => (
                        <div key={s.label} className={`rounded-lg border p-2.5 text-center bg-${s.color}-50 border-${s.color}-200`}>
                          <p className={`text-lg font-bold text-${s.color}-700`}>{s.value}</p>
                          <p className={`text-xs text-${s.color}-600`}>{s.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Content */}
                    {isWa ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Plantilla WhatsApp</p>
                        {waName && <p className="text-sm text-gray-800 font-medium">{waName}</p>}
                        {waSid && <p className="text-xs font-mono text-gray-500">{waSid}</p>}
                        {Object.keys(waVars).length > 0 && (
                          <div className="rounded border bg-gray-50 divide-y text-xs">
                            {Object.entries(waVars).map(([k, v]) => (
                              <div key={k} className="flex items-center gap-2 px-3 py-1.5">
                                <span className="font-mono text-gray-500 w-8">{`{{${k}}}`}</span>
                                <span className="text-gray-800">{v}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                          Contenido {detailCampaign.template ? `· Plantilla: ${detailCampaign.template.name}` : '· Personalizado'}
                        </p>
                        {subject && (
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Asunto</p>
                            <p className="text-sm text-gray-800 font-medium">{subject}</p>
                          </div>
                        )}
                        {body && (
                          <div className="rounded border bg-gray-50 px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap">{body}</div>
                        )}
                      </div>
                    )}

                    {/* Variables used */}
                    {usedVars.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Variables usadas</p>
                        <div className="flex flex-wrap gap-2">
                          {usedVars.map((v) => (
                            <span key={v} className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-mono text-indigo-800">{`{{${v}}}`}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Magic link config */}
                    {usesActionUrl && (
                      <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-3 space-y-1 text-xs">
                        <p className="font-semibold text-indigo-800 text-sm">Configuración del Magic Link</p>
                        <p className="text-indigo-700"><span className="font-medium">Destino:</span> <span className="font-mono">{mlUrl || '/partner/dashboard'}</span></p>
                        <p className="text-indigo-700"><span className="font-medium">Banner cambio de contraseña:</span> {mlBanner ? 'Sí' : 'No'}</p>
                      </div>
                    )}

                    {/* A/B test */}
                    {detailCampaign.abTestEnabled && detailCampaign.abTestConfig && (() => {
                      try {
                        const ab = JSON.parse(detailCampaign.abTestConfig!) as { variants?: Array<{ key: string; body: string; subject?: string; allocation: number }> }
                        return (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Prueba A/B</p>
                            <div className="grid grid-cols-2 gap-2">
                              {(ab.variants || []).map((v) => (
                                <div key={v.key} className="rounded border p-2.5 bg-gray-50 space-y-1">
                                  <p className="text-xs font-bold text-gray-700">Variante {v.key} · {v.allocation}%</p>
                                  {v.subject && <p className="text-xs text-gray-500">Asunto: {v.subject}</p>}
                                  <p className="text-xs text-gray-700 line-clamp-3 whitespace-pre-wrap">{v.body}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      } catch { return null }
                    })()}
                  </div>
                </div>
              </div>
            )
          })()}

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
                            partnerWithoutDocs: false,
                            partnerWithoutStudies: false,
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
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={campForm.partnerWithoutDocs}
                          onChange={(e) => setCampForm((prev) => ({ ...prev, partnerWithoutDocs: e.target.checked }))}
                        />
                        <span>Sin documentos verificados <span className="text-gray-400">(cédula/pasaporte/PEP)</span></span>
                      </label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={campForm.partnerWithoutStudies}
                          onChange={(e) => setCampForm((prev) => ({ ...prev, partnerWithoutStudies: e.target.checked }))}
                        />
                        <span>Sin estudios verificados <span className="text-gray-400">(diplomas/certificados)</span></span>
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
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-medium text-gray-700">Plantilla WhatsApp (aprobadas por Meta)</span>
                      <div className="flex items-center gap-2">
                        {syncFeedback && (
                          <span className={`text-xs ${syncFeedback.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
                            {syncFeedback}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={syncWaTemplates}
                          disabled={syncingTemplates}
                          className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 px-2.5 py-1 rounded-lg border border-primary-200 hover:bg-primary-50 transition-colors disabled:opacity-50"
                        >
                          {syncingTemplates ? (
                            <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                          ) : (
                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          )}
                          Sincronizar con Meta
                        </button>
                      </div>
                    </div>
                    <label className="text-xs text-gray-700 space-y-1 block">
                      {approvedWaTemplates.length === 0 ? (
                        <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          {waTemplates.length === 0
                            ? 'No se encontraron plantillas. Usa "Sincronizar con Meta" para cargarlas.'
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
                            // Twilio templates carry a variables dict; Meta templates need body parsing
                            const varKeys = tpl?.variables && Object.keys(tpl.variables).length > 0
                              ? Object.keys(tpl.variables)
                              : Array.from(new Set(Array.from(tpl?.body?.matchAll(/\{\{(\d+)\}\}/g) ?? []).map((m) => m[1]))).sort()
                            for (const key of varKeys) {
                              vars[key] = key === '1' ? '{{user_name}}' : ''
                            }
                            setCampForm((p) => ({ ...p, waContentSid: sid, waTemplateVariables: vars }))
                          }}
                        >
                          <option value="">Selecciona una plantilla WA…</option>
                          {approvedWaTemplates.map((tpl) => (
                            <option key={tpl.sid} value={tpl.sid}>
                              {tpl.name} ({tpl.language}){tpl.waCategory ? ` · ${tpl.waCategory}` : ''}{tpl.source === 'meta' ? ' [Meta]' : tpl.source === 'twilio' ? ' [Twilio]' : ''}
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
                              Variables disponibles:{' '}
                              <code className="bg-gray-100 px-1 rounded">{'{{user_name}}'}</code> nombre,{' '}
                              <code className="bg-gray-100 px-1 rounded">{'{{user_email}}'}</code> correo,{' '}
                              <code className="bg-gray-100 px-1 rounded">{'{{action_url}}'}</code> magic link personalizado.
                            </p>
                            {Object.values(campForm.waTemplateVariables).some((v) => v.includes('action_url')) && (
                              <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                                Estás usando <code>{'{{action_url}}'}</code>. Configura el destino del magic link más abajo.
                              </div>
                            )}
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
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">Mensaje de la campaña</span>
                      {campForm.channel === 'SMS' && (() => {
                        const { chars, segments } = smsSegments(campForm.customBody || '')
                        return (
                          <span className={`text-[10px] font-mono ${segments > 1 ? 'text-orange-600' : 'text-gray-400'}`}>
                            {chars} car. · {segments} segmento{segments !== 1 ? 's' : ''}
                          </span>
                        )
                      })()}
                    </div>

                    {/* Variable chips */}
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="text-[10px] text-gray-400 shrink-0">Insertar:</span>
                      {[
                        { key: 'user_name', label: 'Nombre' },
                        { key: 'user_email', label: 'Email' },
                        { key: 'action_url', label: 'Magic link' },
                      ].map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => insertCampVar(key)}
                          className="rounded border border-dashed border-primary-300 bg-primary-50 px-2 py-0.5 text-[11px] font-mono text-primary-700 hover:bg-primary-100 transition"
                        >
                          {`{{${key}}}`}
                          <span className="ml-1 font-sans text-gray-500 not-italic">{label}</span>
                        </button>
                      ))}
                    </div>

                    <textarea
                      ref={campBodyRef}
                      className="w-full border rounded px-2 py-2 text-sm min-h-[100px] font-mono"
                      placeholder={campForm.channel === 'SMS'
                        ? 'Ej: Hola {{user_name}}, tienes una nueva reserva en LoHaggo. Ingresa aquí: {{action_url}}'
                        : 'Escribe el mensaje. Usa {{user_name}}, {{user_email}}, {{action_url}} para personalizar.'}
                      value={campForm.customBody}
                      onChange={(e) => setCampForm((p) => ({ ...p, customBody: e.target.value }))}
                    />

                    {/* Live preview with sample data */}
                    {campForm.customBody && (
                      <div className="rounded border border-gray-200 bg-gray-50 p-2 space-y-1">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Vista previa (datos de ejemplo)</p>
                        <p className="text-xs text-gray-700 whitespace-pre-wrap break-words">
                          {campForm.customBody
                            .replace(/\{\{\s*user_name\s*\}\}/g, 'Carlos Rodríguez')
                            .replace(/\{\{\s*user_email\s*\}\}/g, 'carlos@example.com')
                            .replace(/\{\{\s*action_url\s*\}\}/g, 'https://lohaggo.com/auth/magic?token=abc123')}
                        </p>
                        {campForm.channel === 'SMS' && (() => {
                          const rendered = campForm.customBody
                            .replace(/\{\{\s*user_name\s*\}\}/g, 'Carlos Rodríguez')
                            .replace(/\{\{\s*user_email\s*\}\}/g, 'carlos@example.com')
                            .replace(/\{\{\s*action_url\s*\}\}/g, 'https://lohaggo.com/auth/magic?token=abc123')
                          const { chars, segments } = smsSegments(rendered)
                          return (
                            <p className={`text-[10px] ${segments > 1 ? 'text-orange-600' : 'text-gray-400'}`}>
                              Renderizado: {chars} car. · {segments} segmento{segments !== 1 ? 's' : ''}
                              {segments > 1 && ' — se cobran múltiples SMS'}
                            </p>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                )}
                {(() => {
                  const usesActionUrl =
                    Object.values(campForm.waTemplateVariables).some((v) => v.includes('action_url')) ||
                    (campForm.customBody || '').includes('{{action_url}}') ||
                    (campForm.customSubject || '').includes('{{action_url}}') ||
                    (selectedTemplate?.body || '').includes('{{action_url}}') ||
                    (selectedTemplate?.subject || '').includes('{{action_url}}')
                  if (!usesActionUrl) return null
                  const campSections = campForm.targetRole === 'CLIENT' ? ML_CLIENT_SECTIONS : ML_PARTNER_SECTIONS
                  return (
                    <div className="rounded border border-indigo-200 bg-indigo-50 p-3 space-y-2">
                      <p className="text-xs font-semibold text-indigo-800">Configuración del Magic Link (action_url)</p>
                      <p className="text-xs text-indigo-700">Se generará automáticamente un link de acceso para cada destinatario. Configura a dónde se redirige al ingresar.</p>
                      <label className="text-xs text-gray-700 space-y-1 block">
                        <span className="font-medium">Destino después de iniciar sesión</span>
                        <div className="grid grid-cols-2 gap-1.5 mt-1">
                          {campSections.map((sec) => (
                            <button
                              key={sec.value}
                              type="button"
                              onClick={() => setCampForm((p) => ({ ...p, magicLinkRedirectUrl: sec.value }))}
                              className={`text-left rounded border px-2 py-1.5 text-xs transition-colors ${campForm.magicLinkRedirectUrl === sec.value ? 'border-indigo-500 bg-indigo-100 text-indigo-800 font-medium' : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300'}`}
                            >
                              {sec.label}
                            </button>
                          ))}
                        </div>
                        {campForm.magicLinkRedirectUrl === '__custom__' && (
                          <input
                            className="border rounded px-2 py-1.5 text-xs w-full mt-1"
                            placeholder="/ruta/personalizada"
                            value={campForm.magicLinkCustomUrl}
                            onChange={(e) => setCampForm((p) => ({ ...p, magicLinkCustomUrl: e.target.value }))}
                          />
                        )}
                      </label>
                      <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={campForm.magicLinkRequirePasswordChange}
                          onChange={(e) => setCampForm((p) => ({ ...p, magicLinkRequirePasswordChange: e.target.checked }))}
                        />
                        Pedir cambio de contraseña al ingresar
                      </label>
                    </div>
                  )
                })()}
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
                  {/* Header row */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-gray-900">Destinatarios de la campaña</h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex rounded border overflow-hidden text-xs">
                        <button
                          className={`px-3 py-1.5 ${selectionMode === 'MANUAL' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                          onClick={() => { setSelectionMode('MANUAL'); setRecipientIncludeIds([]); setRecipientIncludeDetails([]); setRecipientExcludeIds([]); setRecipientSearch('') }}
                          type="button"
                        >
                          Selección manual
                        </button>
                        <button
                          className={`px-3 py-1.5 border-l ${selectionMode === 'SEGMENT' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                          onClick={() => { setSelectionMode('SEGMENT'); setRecipientIncludeIds([]); setRecipientIncludeDetails([]); setRecipientExcludeIds([]) }}
                          type="button"
                        >
                          Segmento automático
                        </button>
                      </div>
                      <button
                        className="border rounded px-2 py-1 text-xs"
                        onClick={() => void loadRecipientPreview()}
                        type="button"
                      >
                        Actualizar
                      </button>
                    </div>
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <input
                      className="border rounded px-3 py-2 text-sm w-full pr-8"
                      placeholder={selectionMode === 'MANUAL' ? 'Busca por nombre, email o teléfono para agregar usuarios...' : 'Filtrar por nombre, email o teléfono...'}
                      value={recipientSearch}
                      onChange={(e) => setRecipientSearch(e.target.value)}
                    />
                    {loadingRecipients && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">...</span>
                    )}
                    {!loadingRecipients && recipientSearch && (
                      <button
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-sm"
                        onClick={() => setRecipientSearch('')}
                        type="button"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Selected users chip list (manual mode) */}
                  {selectionMode === 'MANUAL' && recipientIncludeIds.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700">Seleccionados ({recipientIncludeIds.length})</span>
                        <button
                          className="text-xs text-rose-600 hover:underline"
                          onClick={() => { setRecipientIncludeIds([]); setRecipientIncludeDetails([]) }}
                          type="button"
                        >
                          Limpiar todo
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-auto">
                        {recipientIncludeDetails.map((u) => (
                          <span
                            key={u.id}
                            className="inline-flex items-center gap-1 rounded-full bg-primary-100 text-primary-800 text-xs px-2.5 py-1"
                          >
                            <span className="max-w-[140px] truncate">{u.name || u.email}</span>
                            <button
                              type="button"
                              className="ml-0.5 rounded-full hover:bg-primary-200 p-0.5 leading-none"
                              onClick={() => toggleIncludeRecipient(u)}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stats summary */}
                  {recipientSummary && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {selectionMode === 'SEGMENT' && <span className="rounded border bg-gray-50 px-2 py-1">Total segmento: <b>{recipientSummary.total}</b></span>}
                      {selectionMode === 'SEGMENT' && <span className="rounded border bg-gray-50 px-2 py-1">Elegibles: <b>{recipientSummary.eligible}</b></span>}
                      {selectionMode === 'SEGMENT' && <span className="rounded border bg-gray-50 px-2 py-1">Sin destino: <b>{recipientSummary.ineligible}</b></span>}
                      {selectionMode === 'SEGMENT' && recipientIncludeIds.length > 0 && <span className="rounded border bg-emerald-50 text-emerald-800 px-2 py-1">Agregados: <b>{recipientIncludeIds.length}</b></span>}
                      {selectionMode === 'SEGMENT' && recipientExcludeIds.length > 0 && <span className="rounded border bg-rose-50 text-rose-800 px-2 py-1">Excluidos: <b>{recipientSummary.excludedCount}</b></span>}
                      {campForm.targetRole === 'PARTNER' && selectionMode === 'SEGMENT' && (
                        <span className="rounded border bg-gray-50 px-2 py-1">Filtro:&nbsp;
                          <b>{campForm.partnerFilterMode === 'ALL' ? 'todos' : campForm.partnerFilterMode === 'CATEGORY' ? `categorías (${campForm.partnerCategoryIds.length})` : `servicios (${campForm.partnerServiceIds.length})`}</b>
                        </span>
                      )}
                      {recipientSearch && <span className="rounded border bg-amber-50 text-amber-800 px-2 py-1">Resultados: <b>{recipientSummary.total}</b></span>}
                    </div>
                  )}

                  {/* Results table */}
                  <div className="max-h-72 overflow-auto rounded border">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-50 text-gray-600 sticky top-0">
                        <tr>
                          <th className="w-8 px-2 py-2"></th>
                          <th className="px-2 py-2 text-left font-medium">Usuario</th>
                          <th className="px-2 py-2 text-left font-medium">Rol</th>
                          <th className="px-2 py-2 text-left font-medium">Destino</th>
                          {selectionMode === 'SEGMENT' && <th className="px-2 py-2 text-left font-medium">Excluir</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {selectionMode === 'MANUAL' && !recipientSearch && recipientPreview.length === 0 && !loadingRecipients && (
                          <tr>
                            <td className="px-3 py-4 text-gray-400 text-center" colSpan={4}>
                              Escribe para buscar usuarios y agregarlos a la campaña.
                            </td>
                          </tr>
                        )}
                        {recipientPreview.map((recipient) => {
                          const included = recipientIncludeIds.includes(recipient.id)
                          const excluded = recipientExcludeIds.includes(recipient.id)
                          return (
                            <tr
                              key={recipient.id}
                              className={`border-t cursor-pointer transition-colors ${included ? 'bg-emerald-50 hover:bg-emerald-100' : excluded ? 'bg-rose-50 hover:bg-rose-100 opacity-60' : 'hover:bg-gray-50'}`}
                              onClick={() => {
                                if (selectionMode === 'MANUAL' || selectionMode === 'SEGMENT') {
                                  toggleIncludeRecipient(recipient)
                                }
                              }}
                            >
                              <td className="px-2 py-2 text-center">
                                <input
                                  type="checkbox"
                                  readOnly
                                  checked={included}
                                  className="rounded"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <p className="font-medium text-gray-900">{recipient.name}</p>
                                <p className="text-gray-500">{recipient.email}</p>
                              </td>
                              <td className="px-2 py-2 text-gray-600">{recipient.role === 'PARTNER' ? 'Socio' : 'Cliente'}</td>
                              <td className={`px-2 py-2 ${recipient.eligible ? 'text-emerald-700' : 'text-rose-600'}`}>
                                {recipient.destination || recipient.reason || 'Sin destino'}
                              </td>
                              {selectionMode === 'SEGMENT' && (
                                <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    className={`rounded px-2 py-1 text-xs ${excluded ? 'bg-rose-600 text-white' : 'border hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300'}`}
                                    onClick={() => toggleExcludeRecipient(recipient.id)}
                                  >
                                    {excluded ? 'Excluido' : 'Excluir'}
                                  </button>
                                </td>
                              )}
                            </tr>
                          )
                        })}
                        {!loadingRecipients && recipientPreview.length === 0 && (selectionMode === 'SEGMENT' || recipientSearch) && (
                          <tr>
                            <td className="px-2 py-3 text-gray-400 text-center" colSpan={selectionMode === 'SEGMENT' ? 5 : 4}>
                              {recipientSearch ? 'Sin resultados para esta búsqueda.' : 'No hay destinatarios para este segmento.'}
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

        </>
      )}
    </div>
  )
}
