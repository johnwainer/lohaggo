'use client'

import { useEffect, useState } from 'react'

type PaymentIncident = {
  id: string
  title: string
  incidentType: string
  status: 'OPEN' | 'INVESTIGATING' | 'ACTION_REQUIRED' | 'RESOLVED' | 'CLOSED'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  assignedTo: string | null
  createdAt: string
}

type RefundCase = {
  id: string
  reason: string
  status: 'REQUESTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'PROCESSED' | 'FAILED'
  requestedAmount: number
  approvedAmount: number | null
  createdAt: string
}

type TaxDocument = {
  id: string
  documentNumber: string
  type: 'INVOICE' | 'CREDIT_NOTE' | 'WITHHOLDING_CERTIFICATE'
  status: 'PENDING' | 'GENERATED' | 'SENT' | 'CANCELLED' | 'ERROR'
  totalAmount: number
  createdAt: string
}

export default function AdminFinanceOpsPage() {
  const [incidents, setIncidents] = useState<PaymentIncident[]>([])
  const [refunds, setRefunds] = useState<RefundCase[]>([])
  const [taxDocs, setTaxDocs] = useState<TaxDocument[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [incidentRes, refundRes, taxRes] = await Promise.all([
        fetch('/api/admin/payment-incidents', { cache: 'no-store' }),
        fetch('/api/admin/refund-cases', { cache: 'no-store' }),
        fetch('/api/admin/tax-documents', { cache: 'no-store' }),
      ])
      const [incidentData, refundData, taxData] = await Promise.all([
        incidentRes.json(),
        refundRes.json(),
        taxRes.json(),
      ])
      setIncidents(incidentData.incidents || [])
      setRefunds(refundData.refundCases || [])
      setTaxDocs(taxData.documents || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const updateIncident = async (id: string, status: PaymentIncident['status']) => {
    await fetch('/api/admin/payment-incidents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    await load()
  }

  const updateRefund = async (id: string, status: RefundCase['status']) => {
    await fetch('/api/admin/refund-cases', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    await load()
  }

  const updateTaxDoc = async (id: string, status: TaxDocument['status']) => {
    await fetch('/api/admin/tax-documents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    await load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Finanzas Operativas</h1>
        <p className="text-gray-600 mt-1">Incidentes de pago, reembolsos, contracargos y documentación tributaria.</p>
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-6">Cargando...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border bg-white p-4">
              <p className="text-sm text-gray-500">Incidentes abiertos</p>
              <p className="text-3xl font-bold">{incidents.filter((i) => i.status !== 'CLOSED' && i.status !== 'RESOLVED').length}</p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-sm text-gray-500">Reembolsos pendientes</p>
              <p className="text-3xl font-bold">{refunds.filter((r) => r.status !== 'PROCESSED' && r.status !== 'REJECTED').length}</p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-sm text-gray-500">Docs tributarios pendientes</p>
              <p className="text-3xl font-bold">{taxDocs.filter((d) => d.status === 'PENDING' || d.status === 'ERROR').length}</p>
            </div>
          </div>

          <section className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="text-lg font-semibold">Incidentes de pago / contracargos</h2>
            <div className="space-y-2">
              {incidents.slice(0, 25).map((item) => (
                <div key={item.id} className="border rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-gray-500">{item.incidentType} · {item.severity} · {item.assignedTo || 'sin asignar'}</p>
                  </div>
                  <select
                    value={item.status}
                    onChange={(e) => updateIncident(item.id, e.target.value as PaymentIncident['status'])}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="INVESTIGATING">INVESTIGATING</option>
                    <option value="ACTION_REQUIRED">ACTION_REQUIRED</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="text-lg font-semibold">Reembolsos y cancelaciones</h2>
            <div className="space-y-2">
              {refunds.slice(0, 25).map((item) => (
                <div key={item.id} className="border rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.reason}</p>
                    <p className="text-xs text-gray-500">
                      Solicitado: ${item.requestedAmount.toLocaleString('es-CO')} · Aprobado: {item.approvedAmount ? `$${item.approvedAmount.toLocaleString('es-CO')}` : '-'}
                    </p>
                  </div>
                  <select
                    value={item.status}
                    onChange={(e) => updateRefund(item.id, e.target.value as RefundCase['status'])}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value="REQUESTED">REQUESTED</option>
                    <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="REJECTED">REJECTED</option>
                    <option value="PROCESSED">PROCESSED</option>
                    <option value="FAILED">FAILED</option>
                  </select>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="text-lg font-semibold">Facturación y tributario</h2>
            <div className="space-y-2">
              {taxDocs.slice(0, 25).map((doc) => (
                <div key={doc.id} className="border rounded-lg p-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{doc.documentNumber}</p>
                    <p className="text-xs text-gray-500">{doc.type} · ${doc.totalAmount.toLocaleString('es-CO')}</p>
                  </div>
                  <select
                    value={doc.status}
                    onChange={(e) => updateTaxDoc(doc.id, e.target.value as TaxDocument['status'])}
                    className="border rounded px-2 py-1 text-sm"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="GENERATED">GENERATED</option>
                    <option value="SENT">SENT</option>
                    <option value="CANCELLED">CANCELLED</option>
                    <option value="ERROR">ERROR</option>
                  </select>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
