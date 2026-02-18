'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, CircleDollarSign, Clock3, FileText, RefreshCw, ShieldAlert } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'ACTION_REQUIRED' | 'RESOLVED' | 'CLOSED'
type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
type IncidentType = 'PAYMENT_FAILURE' | 'CHARGEBACK' | 'REFUND_DISPUTE' | 'PAYOUT_FAILURE'

type RefundStatus = 'REQUESTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'PROCESSED' | 'FAILED'
type TaxDocumentStatus = 'PENDING' | 'GENERATED' | 'SENT' | 'CANCELLED' | 'ERROR'
type TaxDocumentType = 'INVOICE' | 'CREDIT_NOTE' | 'WITHHOLDING_CERTIFICATE'

type PaymentIncidentEvent = {
  id: string
  action: string
  actorEmail: string | null
  note: string | null
  createdAt: string
}

type PaymentIncident = {
  id: string
  title: string
  description: string
  incidentType: IncidentType
  status: IncidentStatus
  severity: IncidentSeverity
  assignedTo: string | null
  rootCause: string | null
  slaDueAt: string | null
  createdAt: string
  payment?: { id: string; totalAmount: number; status: string; mercadopagoId: string | null } | null
  booking?: { id: string; status: string; totalPrice: number } | null
  user?: { id: string; name: string; email: string } | null
  partner?: { id: string; user?: { name: string; email: string } | null } | null
  events: PaymentIncidentEvent[]
}

type RefundCase = {
  id: string
  reason: string
  status: RefundStatus
  requestedAmount: number
  approvedAmount: number | null
  reviewNotes: string | null
  requestedBy: string | null
  reviewedBy: string | null
  processedAt: string | null
  createdAt: string
  payment?: {
    id: string
    status: string
    totalAmount: number
    mercadopagoId: string | null
    payout?: {
      id: string
      status: string
      netAmount: number
      processedAt: string | null
    } | null
  } | null
  booking?: { id: string; status: string; totalPrice: number; service?: { id: string; name: string } | null } | null
  user?: { id: string; name: string; email: string } | null
  partner?: { id: string; user?: { name: string; email: string } | null } | null
}

type PaymentLookup = {
  id: string
  totalAmount: number
  status: string
  mercadopagoId: string | null
  booking: {
    id: string
    service: { id: string; name: string }
    user: { id: string; name: string; email: string }
    partner: { id: string; user: { id: string; name: string; email: string } } | null
  }
  payout?: {
    id: string
    status: string
    netAmount: number
  } | null
  refundSummary?: {
    processedRefundAmount: number
    openRefundExposure: number
    availableToRefund: number
  }
}

type TaxDocument = {
  id: string
  documentNumber: string
  type: TaxDocumentType
  status: TaxDocumentStatus
  totalAmount: number
  subtotalAmount: number
  taxAmount: number
  withholdingAmount: number
  currency: string
  issueDate: string | null
  dueDate: string | null
  sentAt: string | null
  generatedBy: string | null
  createdAt: string
  payment?: { id: string; status: string; totalAmount: number; bookingId: string | null } | null
  user?: { id: string; name: string; email: string } | null
}

const INCIDENT_STATUSES: IncidentStatus[] = ['OPEN', 'INVESTIGATING', 'ACTION_REQUIRED', 'RESOLVED', 'CLOSED']
const INCIDENT_SEVERITIES: IncidentSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const INCIDENT_TYPES: IncidentType[] = ['PAYMENT_FAILURE', 'CHARGEBACK', 'REFUND_DISPUTE', 'PAYOUT_FAILURE']

const REFUND_STATUSES: RefundStatus[] = ['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PROCESSED', 'FAILED']
const TAX_STATUSES: TaxDocumentStatus[] = ['PENDING', 'GENERATED', 'SENT', 'CANCELLED', 'ERROR']
const TAX_TYPES: TaxDocumentType[] = ['INVOICE', 'CREDIT_NOTE', 'WITHHOLDING_CERTIFICATE']

const incidentTypeLabel: Record<IncidentType, string> = {
  PAYMENT_FAILURE: 'Fallo de pago',
  CHARGEBACK: 'Contracargo',
  REFUND_DISPUTE: 'Disputa de reembolso',
  PAYOUT_FAILURE: 'Fallo de payout',
}

const statusLabel: Record<IncidentStatus, string> = {
  OPEN: 'Abierto',
  INVESTIGATING: 'Investigando',
  ACTION_REQUIRED: 'Acción requerida',
  RESOLVED: 'Resuelto',
  CLOSED: 'Cerrado',
}

const refundStatusLabel: Record<RefundStatus, string> = {
  REQUESTED: 'Solicitado',
  UNDER_REVIEW: 'En revisión',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  PROCESSED: 'Procesado',
  FAILED: 'Fallido',
}

const taxStatusLabel: Record<TaxDocumentStatus, string> = {
  PENDING: 'Pendiente',
  GENERATED: 'Generado',
  SENT: 'Enviado',
  CANCELLED: 'Cancelado',
  ERROR: 'Error',
}

const taxTypeLabel: Record<TaxDocumentType, string> = {
  INVOICE: 'Factura',
  CREDIT_NOTE: 'Nota crédito',
  WITHHOLDING_CERTIFICATE: 'Certificado de retención',
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('es-CO')
}

function classForIncidentStatus(status: IncidentStatus) {
  if (status === 'OPEN') return 'bg-red-100 text-red-700'
  if (status === 'INVESTIGATING') return 'bg-amber-100 text-amber-700'
  if (status === 'ACTION_REQUIRED') return 'bg-orange-100 text-orange-700'
  if (status === 'RESOLVED') return 'bg-emerald-100 text-emerald-700'
  return 'bg-slate-200 text-slate-700'
}

function classForSeverity(severity: IncidentSeverity) {
  if (severity === 'CRITICAL') return 'bg-red-100 text-red-700'
  if (severity === 'HIGH') return 'bg-orange-100 text-orange-700'
  if (severity === 'MEDIUM') return 'bg-amber-100 text-amber-700'
  return 'bg-slate-200 text-slate-700'
}

function classForRefundStatus(status: RefundStatus) {
  if (status === 'PROCESSED') return 'bg-emerald-100 text-emerald-700'
  if (status === 'REJECTED' || status === 'FAILED') return 'bg-red-100 text-red-700'
  if (status === 'APPROVED') return 'bg-blue-100 text-blue-700'
  return 'bg-amber-100 text-amber-700'
}

function classForTaxStatus(status: TaxDocumentStatus) {
  if (status === 'SENT' || status === 'GENERATED') return 'bg-emerald-100 text-emerald-700'
  if (status === 'ERROR') return 'bg-red-100 text-red-700'
  if (status === 'CANCELLED') return 'bg-slate-200 text-slate-700'
  return 'bg-amber-100 text-amber-700'
}

export default function AdminFinanceOpsPage() {
  const [incidents, setIncidents] = useState<PaymentIncident[]>([])
  const [refunds, setRefunds] = useState<RefundCase[]>([])
  const [taxDocs, setTaxDocs] = useState<TaxDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'incidents' | 'refunds' | 'tax'>('overview')

  const [incidentFilters, setIncidentFilters] = useState({ q: '', status: 'ALL', type: 'ALL', severity: 'ALL' })
  const [refundFilters, setRefundFilters] = useState({ q: '', status: 'ALL' })
  const [taxFilters, setTaxFilters] = useState({ q: '', status: 'ALL', type: 'ALL' })

  const [newIncident, setNewIncident] = useState({
    title: '',
    description: '',
    incidentType: 'PAYMENT_FAILURE' as IncidentType,
    severity: 'MEDIUM' as IncidentSeverity,
    assignedTo: '',
    paymentId: '',
    bookingId: '',
    userId: '',
    partnerId: '',
  })

  const [newRefund, setNewRefund] = useState({
    paymentId: '',
    reason: '',
    requestedAmount: '',
    approvedAmount: '',
    reviewNotes: '',
  })
  const [paymentCandidates, setPaymentCandidates] = useState<PaymentLookup[]>([])
  const [paymentPicker, setPaymentPicker] = useState({
    q: '',
    minAmount: '',
    maxAmount: '',
  })
  const [loadingPayments, setLoadingPayments] = useState(false)

  const [newTaxDoc, setNewTaxDoc] = useState({
    type: 'INVOICE' as TaxDocumentType,
    paymentId: '',
    userId: '',
    subtotalAmount: '',
    taxAmount: '',
    withholdingAmount: '',
    totalAmount: '',
  })

  const [incidentNotes, setIncidentNotes] = useState<Record<string, string>>({})
  const [refundPayloadById, setRefundPayloadById] = useState<Record<string, { approvedAmount: string; reviewNotes: string }>>({})

  const load = async () => {
    setLoading(true)
    setError(null)

    try {
      const incidentParams = new URLSearchParams()
      if (incidentFilters.q.trim()) incidentParams.set('q', incidentFilters.q.trim())
      if (incidentFilters.status !== 'ALL') incidentParams.set('status', incidentFilters.status)
      if (incidentFilters.type !== 'ALL') incidentParams.set('type', incidentFilters.type)
      if (incidentFilters.severity !== 'ALL') incidentParams.set('severity', incidentFilters.severity)

      const refundParams = new URLSearchParams()
      if (refundFilters.q.trim()) refundParams.set('q', refundFilters.q.trim())
      if (refundFilters.status !== 'ALL') refundParams.set('status', refundFilters.status)

      const taxParams = new URLSearchParams()
      if (taxFilters.q.trim()) taxParams.set('q', taxFilters.q.trim())
      if (taxFilters.status !== 'ALL') taxParams.set('status', taxFilters.status)
      if (taxFilters.type !== 'ALL') taxParams.set('type', taxFilters.type)

      const [incidentRes, refundRes, taxRes] = await Promise.all([
        fetch(`/api/admin/payment-incidents?${incidentParams.toString()}`, { cache: 'no-store' }),
        fetch(`/api/admin/refund-cases?${refundParams.toString()}`, { cache: 'no-store' }),
        fetch(`/api/admin/tax-documents?${taxParams.toString()}`, { cache: 'no-store' }),
      ])

      if (!incidentRes.ok || !refundRes.ok || !taxRes.ok) {
        throw new Error('No fue posible cargar finanzas operativas')
      }

      const [incidentData, refundData, taxData] = await Promise.all([incidentRes.json(), refundRes.json(), taxRes.json()])

      setIncidents(incidentData.incidents || [])
      setRefunds(refundData.refundCases || [])
      setTaxDocs(taxData.documents || [])
    } catch (loadError) {
      console.error(loadError)
      setError('Error cargando la información operativa. Intenta nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  const loadPaymentCandidates = async () => {
    setLoadingPayments(true)
    try {
      const params = new URLSearchParams()
      params.set('refundableOnly', 'true')
      if (paymentPicker.q.trim()) params.set('q', paymentPicker.q.trim())
      if (paymentPicker.minAmount.trim()) params.set('minAmount', paymentPicker.minAmount.trim())
      if (paymentPicker.maxAmount.trim()) params.set('maxAmount', paymentPicker.maxAmount.trim())

      const response = await fetch(`/api/admin/payments?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('No se pudo cargar el selector de pagos')
      const payments = (await response.json()) as PaymentLookup[]
      setPaymentCandidates(payments.filter((p) => (p.refundSummary?.availableToRefund ?? 0) > 0))
    } catch (paymentError) {
      console.error(paymentError)
      setError('No se pudo cargar pagos para reembolso')
    } finally {
      setLoadingPayments(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentFilters.status, incidentFilters.type, incidentFilters.severity, refundFilters.status, taxFilters.status, taxFilters.type])

  useEffect(() => {
    if (activeTab === 'refunds') {
      void loadPaymentCandidates()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const overview = useMemo(() => {
    const openIncidents = incidents.filter((i) => i.status !== 'RESOLVED' && i.status !== 'CLOSED').length
    const criticalIncidents = incidents.filter((i) => i.severity === 'CRITICAL' && i.status !== 'CLOSED').length
    const overdueSla = incidents.filter(
      (i) =>
        i.slaDueAt &&
        i.status !== 'RESOLVED' &&
        i.status !== 'CLOSED' &&
        new Date(i.slaDueAt).getTime() < Date.now()
    ).length

    const pendingRefunds = refunds.filter((r) => ['REQUESTED', 'UNDER_REVIEW', 'APPROVED'].includes(r.status)).length
    const pendingRefundExposure = refunds
      .filter((r) => ['REQUESTED', 'UNDER_REVIEW', 'APPROVED'].includes(r.status))
      .reduce((sum, r) => sum + (r.approvedAmount ?? r.requestedAmount), 0)

    const pendingTaxDocs = taxDocs.filter((d) => d.status === 'PENDING' || d.status === 'ERROR').length
    const pendingTaxExposure = taxDocs
      .filter((d) => d.status === 'PENDING' || d.status === 'ERROR')
      .reduce((sum, d) => sum + d.totalAmount, 0)

    return {
      openIncidents,
      criticalIncidents,
      overdueSla,
      pendingRefunds,
      pendingRefundExposure,
      pendingTaxDocs,
      pendingTaxExposure,
    }
  }, [incidents, refunds, taxDocs])

  const filteredIncidents = useMemo(() => {
    if (!incidentFilters.q.trim()) return incidents
    const q = incidentFilters.q.trim().toLowerCase()

    return incidents.filter((item) => {
      const partnerName = item.partner?.user?.name || ''
      const userName = item.user?.name || ''
      const userEmail = item.user?.email || ''

      return [item.title, item.description, item.assignedTo || '', userName, userEmail, partnerName]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [incidents, incidentFilters.q])

  const filteredRefunds = useMemo(() => {
    if (!refundFilters.q.trim()) return refunds
    const q = refundFilters.q.trim().toLowerCase()
    return refunds.filter((item) => {
      const userName = item.user?.name || ''
      const userEmail = item.user?.email || ''
      return [item.reason, item.reviewNotes || '', item.requestedBy || '', userName, userEmail].join(' ').toLowerCase().includes(q)
    })
  }, [refunds, refundFilters.q])

  const filteredTaxDocs = useMemo(() => {
    if (!taxFilters.q.trim()) return taxDocs
    const q = taxFilters.q.trim().toLowerCase()
    return taxDocs.filter((item) => {
      const userName = item.user?.name || ''
      const userEmail = item.user?.email || ''
      return [item.documentNumber, item.generatedBy || '', userName, userEmail].join(' ').toLowerCase().includes(q)
    })
  }, [taxDocs, taxFilters.q])

  const changeIncident = async (id: string, payload: Record<string, unknown>) => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/payment-incidents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...payload }),
      })
      if (!res.ok) throw new Error('No se pudo actualizar incidente')
      await load()
    } catch (changeError) {
      console.error(changeError)
      setError('No se pudo actualizar el incidente')
    } finally {
      setSaving(false)
    }
  }

  const addIncidentEvent = async (incidentId: string) => {
    const note = incidentNotes[incidentId]?.trim()
    if (!note) return

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/payment-incidents/${incidentId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'MANUAL_NOTE', note }),
      })
      if (!res.ok) throw new Error('No se pudo crear evento')
      setIncidentNotes((prev) => ({ ...prev, [incidentId]: '' }))
      await load()
    } catch (eventError) {
      console.error(eventError)
      setError('No se pudo guardar la nota del incidente')
    } finally {
      setSaving(false)
    }
  }

  const createIncident = async () => {
    if (!newIncident.title.trim() || !newIncident.description.trim()) {
      setError('Completa título y descripción para crear el incidente')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/payment-incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newIncident,
          assignedTo: newIncident.assignedTo.trim() || undefined,
          paymentId: newIncident.paymentId.trim() || undefined,
          bookingId: newIncident.bookingId.trim() || undefined,
          userId: newIncident.userId.trim() || undefined,
          partnerId: newIncident.partnerId.trim() || undefined,
        }),
      })
      if (!res.ok) throw new Error('No se pudo crear incidente')

      setNewIncident({
        title: '',
        description: '',
        incidentType: 'PAYMENT_FAILURE',
        severity: 'MEDIUM',
        assignedTo: '',
        paymentId: '',
        bookingId: '',
        userId: '',
        partnerId: '',
      })
      await load()
      setActiveTab('incidents')
    } catch (createError) {
      console.error(createError)
      setError('No se pudo crear el incidente')
    } finally {
      setSaving(false)
    }
  }

  const changeRefund = async (id: string, payload: Record<string, unknown>) => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/refund-cases', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...payload }),
      })
      if (!res.ok) throw new Error('No se pudo actualizar reembolso')
      await load()
    } catch (changeError) {
      console.error(changeError)
      setError('No se pudo actualizar el reembolso')
    } finally {
      setSaving(false)
    }
  }

  const selectPaymentForRefund = (payment: PaymentLookup) => {
    const availableToRefund = payment.refundSummary?.availableToRefund ?? payment.totalAmount
    setNewRefund((prev) => ({
      ...prev,
      paymentId: payment.id,
      requestedAmount: availableToRefund > 0 ? String(Math.round(availableToRefund)) : '',
      approvedAmount: '',
      reason: prev.reason || `Reembolso de ${payment.booking.service.name}`,
    }))
  }

  const createRefund = async () => {
    if (!newRefund.paymentId.trim() || !newRefund.reason.trim() || !newRefund.requestedAmount.trim()) {
      setError('Ingresa paymentId, razón y monto solicitado')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/refund-cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: newRefund.paymentId.trim(),
          reason: newRefund.reason.trim(),
          requestedAmount: Number(newRefund.requestedAmount),
          approvedAmount: newRefund.approvedAmount ? Number(newRefund.approvedAmount) : undefined,
          reviewNotes: newRefund.reviewNotes.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload?.error || 'No se pudo crear caso de reembolso')
      }

      setNewRefund({ paymentId: '', reason: '', requestedAmount: '', approvedAmount: '', reviewNotes: '' })
      await load()
      await loadPaymentCandidates()
      setActiveTab('refunds')
    } catch (createError) {
      console.error(createError)
      setError(createError instanceof Error ? createError.message : 'No se pudo crear el caso de reembolso')
    } finally {
      setSaving(false)
    }
  }

  const createTaxDoc = async () => {
    if (!newTaxDoc.subtotalAmount || !newTaxDoc.totalAmount) {
      setError('Ingresa subtotal y total para crear documento tributario')
      return
    }

    if ((newTaxDoc.type === 'INVOICE' || newTaxDoc.type === 'CREDIT_NOTE') && !newTaxDoc.paymentId.trim()) {
      setError('paymentId es obligatorio para factura o nota crédito')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/tax-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newTaxDoc.type,
          paymentId: newTaxDoc.paymentId.trim() || undefined,
          userId: newTaxDoc.userId.trim() || undefined,
          subtotalAmount: Number(newTaxDoc.subtotalAmount),
          taxAmount: newTaxDoc.taxAmount ? Number(newTaxDoc.taxAmount) : 0,
          withholdingAmount: newTaxDoc.withholdingAmount ? Number(newTaxDoc.withholdingAmount) : 0,
          totalAmount: Number(newTaxDoc.totalAmount),
        }),
      })

      if (!res.ok) throw new Error('No se pudo crear documento tributario')

      setNewTaxDoc({
        type: 'INVOICE',
        paymentId: '',
        userId: '',
        subtotalAmount: '',
        taxAmount: '',
        withholdingAmount: '',
        totalAmount: '',
      })
      await load()
      setActiveTab('tax')
    } catch (createError) {
      console.error(createError)
      setError('No se pudo crear el documento tributario')
    } finally {
      setSaving(false)
    }
  }

  const changeTaxDoc = async (id: string, payload: Record<string, unknown>) => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/tax-documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...payload }),
      })
      if (!res.ok) throw new Error('No se pudo actualizar documento tributario')
      await load()
    } catch (changeError) {
      console.error(changeError)
      setError('No se pudo actualizar documento tributario')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Finanzas Operativas</h1>
          <p className="mt-1 text-gray-600">
            Opera incidentes de pago, contracargos, reembolsos y facturación tributaria en un mismo flujo.
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading || saving}
          className="inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${(loading || saving) ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Incidentes abiertos" value={String(overview.openIncidents)} icon={ShieldAlert} accent="amber" />
        <MetricCard title="Incidentes críticos" value={String(overview.criticalIncidents)} icon={AlertTriangle} accent="red" />
        <MetricCard title="SLA vencidos" value={String(overview.overdueSla)} icon={Clock3} accent="orange" />
        <MetricCard title="Riesgo reembolsos" value={formatCurrency(overview.pendingRefundExposure)} icon={CircleDollarSign} accent="blue" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Backlog de reembolsos</CardTitle>
            <CardDescription>{overview.pendingRefunds} casos pendientes de cierre</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-700">
            {REFUND_STATUSES.map((status) => {
              const count = refunds.filter((item) => item.status === status).length
              if (!count) return null

              return (
                <div key={status} className="flex items-center justify-between rounded border px-3 py-2">
                  <span>{refundStatusLabel[status]}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estado tributario</CardTitle>
            <CardDescription>{overview.pendingTaxDocs} documentos pendientes o con error</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-700">
            {TAX_STATUSES.map((status) => {
              const count = taxDocs.filter((item) => item.status === status).length
              if (!count) return null
              return (
                <div key={status} className="flex items-center justify-between rounded border px-3 py-2">
                  <span>{taxStatusLabel[status]}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              )
            })}
            <div className="mt-3 rounded border bg-gray-50 px-3 py-2 text-sm font-semibold">
              Exposición tributaria pendiente: {formatCurrency(overview.pendingTaxExposure)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="space-y-4">
        <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto rounded-xl border bg-white p-1.5">
          <TabsTrigger value="overview" className="rounded-lg px-4 py-2 text-xs font-semibold">Resumen</TabsTrigger>
          <TabsTrigger value="incidents" className="rounded-lg px-4 py-2 text-xs font-semibold">Incidentes</TabsTrigger>
          <TabsTrigger value="refunds" className="rounded-lg px-4 py-2 text-xs font-semibold">Reembolsos</TabsTrigger>
          <TabsTrigger value="tax" className="rounded-lg px-4 py-2 text-xs font-semibold">Tributario</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Vista operativa</CardTitle>
              <CardDescription>
                Usa las pestañas para ejecutar acciones, crear casos y cerrar pendientes operativos.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <ActionCard
                title="Gestión de incidentes"
                description="Crear, asignar, documentar eventos y cerrar incidentes con trazabilidad."
                actionLabel="Ir a Incidentes"
                onAction={() => setActiveTab('incidents')}
              />
              <ActionCard
                title="Ciclo de reembolso"
                description="Revisar montos, aprobar/rechazar y procesar con notas internas."
                actionLabel="Ir a Reembolsos"
                onAction={() => setActiveTab('refunds')}
              />
              <ActionCard
                title="Flujo tributario"
                description="Emitir documentos, actualizar estado y controlar envíos fiscales."
                actionLabel="Ir a Tributario"
                onAction={() => setActiveTab('tax')}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incidents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Crear incidente</CardTitle>
              <CardDescription>Registra fallos de pago, contracargos o disputas con prioridad y responsable.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <Field label="Título" value={newIncident.title} onChange={(value) => setNewIncident((prev) => ({ ...prev, title: value }))} />
              <Field label="Payment ID (recomendado)" value={newIncident.paymentId} onChange={(value) => setNewIncident((prev) => ({ ...prev, paymentId: value }))} placeholder="pay_xxx" />
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Tipo</label>
                <select
                  value={newIncident.incidentType}
                  onChange={(e) => setNewIncident((prev) => ({ ...prev, incidentType: e.target.value as IncidentType }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  {INCIDENT_TYPES.map((type) => (
                    <option key={type} value={type}>{incidentTypeLabel[type]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Severidad</label>
                <select
                  value={newIncident.severity}
                  onChange={(e) => setNewIncident((prev) => ({ ...prev, severity: e.target.value as IncidentSeverity }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  {INCIDENT_SEVERITIES.map((severity) => (
                    <option key={severity} value={severity}>{severity}</option>
                  ))}
                </select>
              </div>
              <Field label="Asignado a (email)" value={newIncident.assignedTo} onChange={(value) => setNewIncident((prev) => ({ ...prev, assignedTo: value }))} />
              <Field label="Booking ID (opcional)" value={newIncident.bookingId} onChange={(value) => setNewIncident((prev) => ({ ...prev, bookingId: value }))} placeholder="book_xxx" />
              <Field label="User ID (opcional)" value={newIncident.userId} onChange={(value) => setNewIncident((prev) => ({ ...prev, userId: value }))} placeholder="usr_xxx" />
              <Field label="Partner ID (opcional)" value={newIncident.partnerId} onChange={(value) => setNewIncident((prev) => ({ ...prev, partnerId: value }))} placeholder="partner_xxx" />
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-600">Descripción</label>
                <textarea
                  value={newIncident.description}
                  onChange={(e) => setNewIncident((prev) => ({ ...prev, description: e.target.value }))}
                  className="min-h-[84px] w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <button onClick={() => void createIncident()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" disabled={saving}>
                  Crear incidente
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Incidentes y contracargos</CardTitle>
              <CardDescription>Filtro y operación detallada con timeline de eventos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-4">
                <Field label="Buscar" value={incidentFilters.q} onChange={(value) => setIncidentFilters((prev) => ({ ...prev, q: value }))} placeholder="Título, usuario, asignado..." />
                <SelectField label="Estado" value={incidentFilters.status} onChange={(value) => setIncidentFilters((prev) => ({ ...prev, status: value }))} options={['ALL', ...INCIDENT_STATUSES]} />
                <SelectField label="Tipo" value={incidentFilters.type} onChange={(value) => setIncidentFilters((prev) => ({ ...prev, type: value }))} options={['ALL', ...INCIDENT_TYPES]} />
                <SelectField label="Severidad" value={incidentFilters.severity} onChange={(value) => setIncidentFilters((prev) => ({ ...prev, severity: value }))} options={['ALL', ...INCIDENT_SEVERITIES]} />
              </div>

              <div className="space-y-3">
                {loading ? <div className="rounded-lg border p-4 text-sm">Cargando incidentes...</div> : null}

                {!loading && filteredIncidents.length === 0 ? (
                  <div className="rounded-lg border p-4 text-sm text-gray-600">Sin incidentes para estos filtros.</div>
                ) : null}

                {filteredIncidents.map((item) => (
                  <div key={item.id} className="rounded-xl border p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                        <p className="mt-1 text-xs text-gray-600">{item.description}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700">{incidentTypeLabel[item.incidentType]}</span>
                          <span className={`rounded-full px-2 py-1 ${classForIncidentStatus(item.status)}`}>{statusLabel[item.status]}</span>
                          <span className={`rounded-full px-2 py-1 ${classForSeverity(item.severity)}`}>{item.severity}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">Asignado: {item.assignedTo || 'Sin asignar'}</span>
                          {item.slaDueAt ? (
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">SLA: {formatDate(item.slaDueAt)}</span>
                          ) : null}
                        </div>
                        <div className="mt-2 text-xs text-gray-500">
                          Cliente: {item.user?.name || '-'} · Socio: {item.partner?.user?.name || '-'} · Pago: {item.payment?.id || '-'}
                        </div>
                      </div>

                      <div className="grid w-full gap-2 md:w-[360px] md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">Estado</label>
                          <select
                            value={item.status}
                            onChange={(e) => void changeIncident(item.id, { status: e.target.value as IncidentStatus })}
                            className="w-full rounded-lg border px-2 py-1.5 text-xs"
                            disabled={saving}
                          >
                            {INCIDENT_STATUSES.map((status) => (
                              <option key={status} value={status}>{statusLabel[status]}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">Asignado a</label>
                          <input
                            defaultValue={item.assignedTo || ''}
                            placeholder="email"
                            className="w-full rounded-lg border px-2 py-1.5 text-xs"
                            onBlur={(e) => {
                              const value = e.target.value.trim()
                              if (value !== (item.assignedTo || '')) {
                                void changeIncident(item.id, { assignedTo: value || null })
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs font-medium text-gray-600">Root cause</p>
                        <textarea
                          defaultValue={item.rootCause || ''}
                          className="min-h-[64px] w-full rounded-lg border px-2 py-1.5 text-xs"
                          onBlur={(e) => {
                            const value = e.target.value.trim()
                            if (value !== (item.rootCause || '')) {
                              void changeIncident(item.id, { rootCause: value || null })
                            }
                          }}
                        />
                      </div>

                      <div>
                        <p className="mb-1 text-xs font-medium text-gray-600">Timeline (últimos eventos)</p>
                        <div className="max-h-[120px] space-y-1 overflow-y-auto rounded-lg border p-2">
                          {item.events.map((evt) => (
                            <div key={evt.id} className="text-xs text-gray-600">
                              <span className="font-medium">{evt.action}</span> · {evt.actorEmail || 'system'} · {new Date(evt.createdAt).toLocaleString('es-CO')}
                              {evt.note ? <div className="text-gray-500">{evt.note}</div> : null}
                            </div>
                          ))}
                          {item.events.length === 0 ? <div className="text-xs text-gray-500">Sin eventos</div> : null}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center">
                      <input
                        value={incidentNotes[item.id] || ''}
                        onChange={(e) => setIncidentNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        placeholder="Agregar nota operativa al incidente"
                        className="flex-1 rounded-lg border px-3 py-2 text-sm"
                      />
                      <button
                        onClick={() => void addIncidentEvent(item.id)}
                        className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-gray-50"
                        disabled={saving}
                      >
                        Guardar nota
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="refunds" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Crear caso de reembolso</CardTitle>
              <CardDescription>Selecciona un pago real y crea el caso con monto controlado y trazabilidad.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2 rounded-lg border bg-gray-50 p-3">
                <p className="mb-2 text-xs font-semibold text-gray-700">Seleccionar pago</p>
                <div className="grid gap-2 md:grid-cols-4">
                  <Field label="Buscar pago/cliente/socio/servicio" value={paymentPicker.q} onChange={(value) => setPaymentPicker((prev) => ({ ...prev, q: value }))} placeholder="ID, nombre, email..." />
                  <Field label="Monto mínimo" value={paymentPicker.minAmount} onChange={(value) => setPaymentPicker((prev) => ({ ...prev, minAmount: value }))} type="number" />
                  <Field label="Monto máximo" value={paymentPicker.maxAmount} onChange={(value) => setPaymentPicker((prev) => ({ ...prev, maxAmount: value }))} type="number" />
                  <div className="flex items-end">
                    <button
                      onClick={() => void loadPaymentCandidates()}
                      className="w-full rounded-lg border px-3 py-2 text-sm font-medium hover:bg-white"
                      disabled={loadingPayments}
                    >
                      {loadingPayments ? 'Buscando...' : 'Buscar pagos'}
                    </button>
                  </div>
                </div>
                <div className="mt-3 max-h-[210px] overflow-auto rounded-lg border bg-white">
                  {loadingPayments ? (
                    <div className="p-3 text-xs text-gray-500">Cargando pagos...</div>
                  ) : paymentCandidates.length === 0 ? (
                    <div className="p-3 text-xs text-gray-500">No hay pagos disponibles para reembolso con estos filtros.</div>
                  ) : (
                    paymentCandidates.slice(0, 25).map((payment) => (
                      <div key={payment.id} className="flex flex-col gap-2 border-b p-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-gray-900">
                            {payment.booking.service.name} · {payment.booking.user.name}
                          </p>
                          <p className="truncate text-xs text-gray-600">
                            Pago: {payment.id} · Socio: {payment.booking.partner?.user.name || 'N/A'} · Estado pago: {payment.status}
                          </p>
                          <p className="text-xs text-gray-500">
                            Disponible a reembolsar: {formatCurrency(payment.refundSummary?.availableToRefund ?? 0)}
                            {' · '}
                            Payout: {payment.payout?.status || 'N/A'}
                          </p>
                        </div>
                        <button
                          onClick={() => selectPaymentForRefund(payment)}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          Usar pago
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <Field label="Payment ID (obligatorio)" value={newRefund.paymentId} onChange={(value) => setNewRefund((prev) => ({ ...prev, paymentId: value }))} placeholder="pay_xxx" />
              <Field label="Razón" value={newRefund.reason} onChange={(value) => setNewRefund((prev) => ({ ...prev, reason: value }))} />
              <Field label="Monto solicitado" value={newRefund.requestedAmount} onChange={(value) => setNewRefund((prev) => ({ ...prev, requestedAmount: value }))} type="number" />
              <Field label="Monto aprobado (opcional)" value={newRefund.approvedAmount} onChange={(value) => setNewRefund((prev) => ({ ...prev, approvedAmount: value }))} type="number" />
              <Field label="Notas (opcional)" value={newRefund.reviewNotes} onChange={(value) => setNewRefund((prev) => ({ ...prev, reviewNotes: value }))} />
              <div className="md:col-span-2">
                <button onClick={() => void createRefund()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" disabled={saving}>
                  Crear reembolso
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reembolsos y cancelaciones</CardTitle>
              <CardDescription>Ajusta montos, notas y estado final del ciclo de devolución.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Buscar" value={refundFilters.q} onChange={(value) => setRefundFilters((prev) => ({ ...prev, q: value }))} placeholder="Razón, usuario, notas..." />
                <SelectField label="Estado" value={refundFilters.status} onChange={(value) => setRefundFilters((prev) => ({ ...prev, status: value }))} options={['ALL', ...REFUND_STATUSES]} />
              </div>

              <div className="space-y-3">
                {loading ? <div className="rounded-lg border p-4 text-sm">Cargando reembolsos...</div> : null}
                {!loading && filteredRefunds.length === 0 ? <div className="rounded-lg border p-4 text-sm text-gray-600">Sin casos para estos filtros.</div> : null}

                {filteredRefunds.map((item) => {
                  const localPayload = refundPayloadById[item.id] || {
                    approvedAmount: item.approvedAmount !== null ? String(item.approvedAmount) : '',
                    reviewNotes: item.reviewNotes || '',
                  }

                  return (
                    <div key={item.id} className="rounded-xl border p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{item.reason}</p>
                          <p className="text-xs text-gray-600">
                            Solicitado por: {item.user?.name || item.requestedBy || 'N/A'} · creado {new Date(item.createdAt).toLocaleString('es-CO')}
                          </p>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${classForRefundStatus(item.status)}`}>
                          {refundStatusLabel[item.status]}
                        </span>
                      </div>

                      <div className="mt-2 grid gap-2 text-xs text-gray-600 md:grid-cols-3">
                        <div className="rounded border bg-gray-50 px-2 py-1.5">Solicitado: <span className="font-semibold">{formatCurrency(item.requestedAmount)}</span></div>
                        <div className="rounded border bg-gray-50 px-2 py-1.5">Aprobado: <span className="font-semibold">{item.approvedAmount !== null ? formatCurrency(item.approvedAmount) : '-'}</span></div>
                        <div className="rounded border bg-gray-50 px-2 py-1.5">Procesado: <span className="font-semibold">{formatDate(item.processedAt)}</span></div>
                      </div>
                      <div className="mt-2 grid gap-2 text-xs text-gray-600 md:grid-cols-3">
                        <div className="rounded border bg-gray-50 px-2 py-1.5">
                          Servicio: <span className="font-semibold">{item.booking?.service?.name || 'N/A'}</span>
                        </div>
                        <div className="rounded border bg-gray-50 px-2 py-1.5">
                          Pago: <span className="font-semibold">{item.payment?.id || 'N/A'}</span>
                        </div>
                        <div className="rounded border bg-gray-50 px-2 py-1.5">
                          Payout: <span className="font-semibold">{item.payment?.payout?.status || 'N/A'}</span>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 md:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">Estado</label>
                          <select
                            value={item.status}
                            onChange={(e) => void changeRefund(item.id, { status: e.target.value as RefundStatus })}
                            className="w-full rounded-lg border px-2 py-1.5 text-xs"
                            disabled={saving}
                          >
                            {REFUND_STATUSES.map((status) => (
                              <option key={status} value={status}>{refundStatusLabel[status]}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">Monto aprobado</label>
                          <input
                            value={localPayload.approvedAmount}
                            onChange={(e) => setRefundPayloadById((prev) => ({ ...prev, [item.id]: { ...localPayload, approvedAmount: e.target.value } }))}
                            className="w-full rounded-lg border px-2 py-1.5 text-xs"
                            type="number"
                          />
                        </div>
                        <div className="flex items-end">
                          <button
                            onClick={() =>
                              void changeRefund(item.id, {
                                approvedAmount: localPayload.approvedAmount ? Number(localPayload.approvedAmount) : null,
                                reviewNotes: localPayload.reviewNotes || null,
                              })
                            }
                            className="w-full rounded-lg border px-3 py-2 text-xs font-medium hover:bg-gray-50"
                            disabled={saving}
                          >
                            Guardar revisión
                          </button>
                        </div>
                      </div>

                      <div className="mt-2">
                        <label className="mb-1 block text-xs font-medium text-gray-600">Notas de revisión</label>
                        <textarea
                          value={localPayload.reviewNotes}
                          onChange={(e) => setRefundPayloadById((prev) => ({ ...prev, [item.id]: { ...localPayload, reviewNotes: e.target.value } }))}
                          className="min-h-[60px] w-full rounded-lg border px-2 py-1.5 text-xs"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Crear documento tributario</CardTitle>
              <CardDescription>Genera factura, nota crédito o certificado de retención con montos.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Tipo</label>
                <select
                  value={newTaxDoc.type}
                  onChange={(e) => setNewTaxDoc((prev) => ({ ...prev, type: e.target.value as TaxDocumentType }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  {TAX_TYPES.map((type) => (
                    <option key={type} value={type}>{taxTypeLabel[type]}</option>
                  ))}
                </select>
              </div>
              <Field label="Payment ID" value={newTaxDoc.paymentId} onChange={(value) => setNewTaxDoc((prev) => ({ ...prev, paymentId: value }))} placeholder="pay_xxx" />
              <Field label="User ID (si no hay pago)" value={newTaxDoc.userId} onChange={(value) => setNewTaxDoc((prev) => ({ ...prev, userId: value }))} placeholder="usr_xxx" />
              <Field label="Subtotal" value={newTaxDoc.subtotalAmount} onChange={(value) => setNewTaxDoc((prev) => ({ ...prev, subtotalAmount: value }))} type="number" />
              <Field label="Impuesto" value={newTaxDoc.taxAmount} onChange={(value) => setNewTaxDoc((prev) => ({ ...prev, taxAmount: value }))} type="number" />
              <Field label="Retención" value={newTaxDoc.withholdingAmount} onChange={(value) => setNewTaxDoc((prev) => ({ ...prev, withholdingAmount: value }))} type="number" />
              <Field label="Total" value={newTaxDoc.totalAmount} onChange={(value) => setNewTaxDoc((prev) => ({ ...prev, totalAmount: value }))} type="number" />
              <div className="flex items-end">
                <button onClick={() => void createTaxDoc()} className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" disabled={saving}>
                  Crear documento
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Facturación y tributario</CardTitle>
              <CardDescription>Controla emisión, envío y calidad de documentos fiscales.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Buscar" value={taxFilters.q} onChange={(value) => setTaxFilters((prev) => ({ ...prev, q: value }))} placeholder="Número, usuario, generado por..." />
                <SelectField label="Estado" value={taxFilters.status} onChange={(value) => setTaxFilters((prev) => ({ ...prev, status: value }))} options={['ALL', ...TAX_STATUSES]} />
                <SelectField label="Tipo" value={taxFilters.type} onChange={(value) => setTaxFilters((prev) => ({ ...prev, type: value }))} options={['ALL', ...TAX_TYPES]} />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left">
                      <th className="px-3 py-2">Documento</th>
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Total</th>
                      <th className="px-3 py-2">Estado</th>
                      <th className="px-3 py-2">Emisión</th>
                      <th className="px-3 py-2">Envío</th>
                      <th className="px-3 py-2">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-gray-500">Cargando documentos...</td>
                      </tr>
                    ) : filteredTaxDocs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-gray-500">Sin documentos para estos filtros.</td>
                      </tr>
                    ) : (
                      filteredTaxDocs.map((doc) => (
                        <tr key={doc.id} className="border-b">
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-900">{doc.documentNumber}</div>
                            <div className="text-xs text-gray-500">{doc.user?.name || doc.generatedBy || '-'}</div>
                          </td>
                          <td className="px-3 py-2">{taxTypeLabel[doc.type]}</td>
                          <td className="px-3 py-2">{formatCurrency(doc.totalAmount)}</td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${classForTaxStatus(doc.status)}`}>
                              {taxStatusLabel[doc.status]}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs">{formatDate(doc.issueDate)}</td>
                          <td className="px-3 py-2 text-xs">{formatDate(doc.sentAt)}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <select
                                value={doc.status}
                                onChange={(e) => void changeTaxDoc(doc.id, { status: e.target.value as TaxDocumentStatus })}
                                className="rounded border px-2 py-1 text-xs"
                                disabled={saving}
                              >
                                {TAX_STATUSES.map((status) => (
                                  <option key={status} value={status}>{taxStatusLabel[status]}</option>
                                ))}
                              </select>
                              <button
                                onClick={() => void changeTaxDoc(doc.id, { issueDate: new Date().toISOString(), sentAt: new Date().toISOString(), status: 'SENT' })}
                                className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
                                disabled={saving}
                              >
                                Marcar enviado
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {saving ? (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg border bg-white px-4 py-2 text-xs shadow">
          Guardando cambios operativos...
        </div>
      ) : null}
    </div>
  )
}

function MetricCard({
  title,
  value,
  icon: Icon,
  accent,
}: {
  title: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  accent: 'amber' | 'red' | 'orange' | 'blue'
}) {
  const accents: Record<typeof accent, string> = {
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    orange: 'bg-orange-100 text-orange-700',
    blue: 'bg-blue-100 text-blue-700',
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <div className="text-xs font-medium text-gray-500">{title}</div>
          <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
        </div>
        <div className={`rounded-lg p-2 ${accents[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  )
}

function ActionCard({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="mt-1 text-xs text-gray-600">{description}</p>
      <button onClick={onAction} className="mt-3 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-gray-50">
        {actionLabel}
      </button>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'number'
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border px-3 py-2 text-sm"
      />
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm">
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  )
}
