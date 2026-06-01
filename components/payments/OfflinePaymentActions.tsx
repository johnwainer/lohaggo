'use client'

import { useEffect, useState } from 'react'
import { Banknote, ArrowRightLeft, CheckCircle, XCircle, Clock, AlertTriangle, Loader2 } from 'lucide-react'

export type OfflineMethod = 'CASH' | 'DIRECT_TRANSFER'

export interface OfflinePaymentInfo {
  id?: string
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'REFUNDED' | null
  confirmationStatus?: 'NONE' | 'CLIENT_REPORTED' | 'PARTNER_REPORTED' | 'CONFIRMED' | 'DISPUTED' | 'REJECTED_BY_PARTNER' | null
  clientReportedMethod?: OfflineMethod | 'MERCADOPAGO' | null
  clientReportedAt?: string | null
  partnerConfirmedMethod?: OfflineMethod | 'MERCADOPAGO' | null
  partnerConfirmedAt?: string | null
  partnerRejectedAt?: string | null
  rejectionReason?: string | null
}

interface Props {
  bookingId: string
  role: 'CLIENT' | 'PARTNER'
  bookingStatus: string
  payment?: OfflinePaymentInfo | null
  partnerBankAccount?: {
    bankName: string
    accountType: string
    accountNumber: string
    accountHolderName: string
    holderDocumentNumber: string
  } | null
  onChange?: () => void
}

interface PublicPaymentConfig {
  cashEnabled: boolean
  transferEnabled: boolean
  mercadoPagoEnabled: boolean
}

const methodLabel = (m?: string | null) =>
  m === 'CASH' ? 'Efectivo' : m === 'DIRECT_TRANSFER' ? 'Transferencia' : m === 'MERCADOPAGO' ? 'Mercado Pago' : '—'

export default function OfflinePaymentActions({ bookingId, role, bookingStatus, payment, partnerBankAccount, onChange }: Props) {
  const [config, setConfig] = useState<PublicPaymentConfig | null>(null)
  const [modal, setModal] = useState<null | 'report' | 'confirm' | 'reject'>(null)
  const [method, setMethod] = useState<OfflineMethod>('CASH')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/payment-config/public')
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setConfig({ cashEnabled: true, transferEnabled: true, mercadoPagoEnabled: false }))
  }, [])

  if (bookingStatus !== 'COMPLETED') return null
  if (!config) return null

  const status = payment?.confirmationStatus ?? 'NONE'

  const submit = async (path: string, body: object) => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Error al procesar la solicitud')
        return
      }
      setModal(null)
      setReason('')
      setNote('')
      onChange?.()
    } finally {
      setSubmitting(false)
    }
  }

  const unreport = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/bookings/${bookingId}/payment/report-client`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Error al des-reportar')
        return
      }
      onChange?.()
    } finally {
      setSubmitting(false)
    }
  }

  const availableMethods: OfflineMethod[] = []
  if (config.cashEnabled) availableMethods.push('CASH')
  if (config.transferEnabled) availableMethods.push('DIRECT_TRANSFER')

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
      <StatusBanner status={status} role={role} payment={payment} />

      {role === 'CLIENT' && status === 'NONE' && availableMethods.length > 0 && (
        <button
          onClick={() => { setMethod(availableMethods[0]); setModal('report') }}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <CheckCircle className="w-4 h-4" /> Ya pagué
        </button>
      )}

      {role === 'CLIENT' && status === 'CLIENT_REPORTED' && (
        <button
          onClick={unreport}
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
          Des-reportar
        </button>
      )}

      {role === 'CLIENT' && status === 'REJECTED_BY_PARTNER' && availableMethods.length > 0 && (
        <button
          onClick={() => { setMethod(availableMethods[0]); setModal('report') }}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
        >
          Reportar pago nuevamente
        </button>
      )}

      {role === 'PARTNER' && status === 'CLIENT_REPORTED' && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { setMethod((payment?.clientReportedMethod as OfflineMethod) || availableMethods[0]); setModal('confirm') }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <CheckCircle className="w-4 h-4" /> Confirmar recepción
          </button>
          <button
            onClick={() => setModal('reject')}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            <XCircle className="w-4 h-4" /> Rechazar
          </button>
        </div>
      )}

      {role === 'PARTNER' && status === 'NONE' && availableMethods.length > 0 && (
        <button
          onClick={() => { setMethod(availableMethods[0]); setModal('confirm') }}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
        >
          Marcar como pagado
        </button>
      )}

      {role === 'CLIENT' && partnerBankAccount && (config.transferEnabled || payment?.clientReportedMethod === 'DIRECT_TRANSFER') && (
        <details className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm">
          <summary className="cursor-pointer font-semibold text-blue-900 flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4" /> Datos para transferir al socio
          </summary>
          <dl className="mt-2 grid grid-cols-1 gap-1 text-blue-900">
            <Row k="Banco" v={partnerBankAccount.bankName} />
            <Row k="Tipo" v={partnerBankAccount.accountType} />
            <Row k="Numero" v={partnerBankAccount.accountNumber} />
            <Row k="Titular" v={partnerBankAccount.accountHolderName} />
            <Row k="Documento" v={partnerBankAccount.holderDocumentNumber} />
          </dl>
        </details>
      )}

      {modal && (
        <Modal onClose={() => { setModal(null); setError(null) }}>
          {modal === 'report' && (
            <ReportClientForm
              method={method}
              setMethod={setMethod}
              note={note}
              setNote={setNote}
              available={availableMethods}
              onCancel={() => setModal(null)}
              onSubmit={() => submit(`/api/bookings/${bookingId}/payment/report-client`, { method, note: note || undefined })}
              submitting={submitting}
              error={error}
            />
          )}
          {modal === 'confirm' && (
            <ConfirmPartnerForm
              method={method}
              setMethod={setMethod}
              available={availableMethods}
              clientReportedMethod={payment?.clientReportedMethod as OfflineMethod | undefined}
              onCancel={() => setModal(null)}
              onSubmit={() => submit(`/api/bookings/${bookingId}/payment/confirm-partner`, { method })}
              submitting={submitting}
              error={error}
            />
          )}
          {modal === 'reject' && (
            <RejectPartnerForm
              reason={reason}
              setReason={setReason}
              onCancel={() => setModal(null)}
              onSubmit={() => submit(`/api/bookings/${bookingId}/payment/reject-partner`, { reason })}
              submitting={submitting}
              error={error}
            />
          )}
        </Modal>
      )}
    </div>
  )
}

function StatusBanner({ status, role, payment }: { status: string; role: 'CLIENT' | 'PARTNER'; payment?: OfflinePaymentInfo | null }) {
  if (status === 'CONFIRMED') {
    return (
      <Badge tone="emerald" icon={<CheckCircle className="w-4 h-4" />}>
        Pago confirmado · {methodLabel(payment?.partnerConfirmedMethod || payment?.clientReportedMethod)}
      </Badge>
    )
  }
  if (status === 'CLIENT_REPORTED') {
    return role === 'CLIENT' ? (
      <Badge tone="amber" icon={<Clock className="w-4 h-4" />}>
        Reportado: {methodLabel(payment?.clientReportedMethod)} · esperando confirmación del socio
      </Badge>
    ) : (
      <Badge tone="amber" icon={<Clock className="w-4 h-4" />}>
        Cliente reportó pago en {methodLabel(payment?.clientReportedMethod)}
      </Badge>
    )
  }
  if (status === 'PARTNER_REPORTED') {
    return role === 'PARTNER' ? (
      <Badge tone="amber" icon={<Clock className="w-4 h-4" />}>
        Marcaste como pagado · esperando confirmación del cliente
      </Badge>
    ) : (
      <Badge tone="amber" icon={<Clock className="w-4 h-4" />}>
        El socio reportó haber recibido el pago. Confirma desde abajo.
      </Badge>
    )
  }
  if (status === 'DISPUTED') {
    return (
      <Badge tone="red" icon={<AlertTriangle className="w-4 h-4" />}>
        Discrepancia: cliente reportó {methodLabel(payment?.clientReportedMethod)}, socio reportó {methodLabel(payment?.partnerConfirmedMethod)}. Un administrador revisará el caso.
      </Badge>
    )
  }
  if (status === 'REJECTED_BY_PARTNER') {
    return (
      <Badge tone="red" icon={<XCircle className="w-4 h-4" />}>
        El socio rechazó el pago reportado{payment?.rejectionReason ? ` · ${payment.rejectionReason}` : ''}
      </Badge>
    )
  }
  return role === 'CLIENT' ? (
    <Badge tone="slate" icon={<Banknote className="w-4 h-4" />}>Pago pendiente · marca cuando hayas pagado al socio</Badge>
  ) : (
    <Badge tone="slate" icon={<Banknote className="w-4 h-4" />}>Esperando que el cliente reporte el pago</Badge>
  )
}

function Badge({ tone, icon, children }: { tone: 'emerald' | 'amber' | 'red' | 'slate'; icon: React.ReactNode; children: React.ReactNode }) {
  const tones = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    red: 'bg-red-50 border-red-200 text-red-800',
    slate: 'bg-slate-100 border-slate-200 text-slate-700',
  }
  return (
    <div className={`inline-flex items-start gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${tones[tone]}`}>
      <span className="mt-0.5">{icon}</span>
      <span>{children}</span>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-blue-200/50 last:border-0 py-1">
      <dt className="text-xs text-blue-700">{k}</dt>
      <dd className="font-mono text-sm text-blue-900">{v}</dd>
    </div>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function ReportClientForm(props: {
  method: OfflineMethod
  setMethod: (m: OfflineMethod) => void
  note: string
  setNote: (n: string) => void
  available: OfflineMethod[]
  onCancel: () => void
  onSubmit: () => void
  submitting: boolean
  error: string | null
}) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); props.onSubmit() }} className="space-y-4">
      <h3 className="text-lg font-bold">¿Cómo pagaste?</h3>
      <p className="text-sm text-gray-600">Selecciona el método y reporta el pago. El socio recibirá una notificación para confirmar la recepción.</p>
      <div className="space-y-2">
        {props.available.includes('CASH') && (
          <MethodOption value="CASH" current={props.method} onChange={props.setMethod} icon={<Banknote className="w-5 h-5 text-emerald-600" />} label="Efectivo" description="Pagué en efectivo al socio" />
        )}
        {props.available.includes('DIRECT_TRANSFER') && (
          <MethodOption value="DIRECT_TRANSFER" current={props.method} onChange={props.setMethod} icon={<ArrowRightLeft className="w-5 h-5 text-blue-600" />} label="Transferencia" description="Transferí a la cuenta del socio" />
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nota (opcional)</label>
        <textarea
          value={props.note}
          onChange={(e) => props.setNote(e.target.value)}
          maxLength={500}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          placeholder="Ej: Pagué $50,000 al llegar"
        />
      </div>
      {props.error && <p className="text-sm text-red-600">{props.error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={props.onCancel} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium">Cancelar</button>
        <button type="submit" disabled={props.submitting} className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
          {props.submitting ? 'Reportando…' : 'Confirmar'}
        </button>
      </div>
    </form>
  )
}

function ConfirmPartnerForm(props: {
  method: OfflineMethod
  setMethod: (m: OfflineMethod) => void
  available: OfflineMethod[]
  clientReportedMethod?: OfflineMethod
  onCancel: () => void
  onSubmit: () => void
  submitting: boolean
  error: string | null
}) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); props.onSubmit() }} className="space-y-4">
      <h3 className="text-lg font-bold">Confirmar recepción del pago</h3>
      <p className="text-sm text-gray-600">
        {props.clientReportedMethod
          ? <>El cliente reportó haber pagado en <strong>{methodLabel(props.clientReportedMethod)}</strong>. Confirma el método que efectivamente recibiste.</>
          : 'Selecciona cómo recibiste el pago.'}
      </p>
      <div className="space-y-2">
        {props.available.includes('CASH') && (
          <MethodOption value="CASH" current={props.method} onChange={props.setMethod} icon={<Banknote className="w-5 h-5 text-emerald-600" />} label="Efectivo" description="Recibí efectivo" />
        )}
        {props.available.includes('DIRECT_TRANSFER') && (
          <MethodOption value="DIRECT_TRANSFER" current={props.method} onChange={props.setMethod} icon={<ArrowRightLeft className="w-5 h-5 text-blue-600" />} label="Transferencia" description="Recibí transferencia en mi cuenta" />
        )}
      </div>
      {props.error && <p className="text-sm text-red-600">{props.error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={props.onCancel} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium">Cancelar</button>
        <button type="submit" disabled={props.submitting} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
          {props.submitting ? 'Confirmando…' : 'Confirmar'}
        </button>
      </div>
    </form>
  )
}

function RejectPartnerForm(props: {
  reason: string
  setReason: (r: string) => void
  onCancel: () => void
  onSubmit: () => void
  submitting: boolean
  error: string | null
}) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); props.onSubmit() }} className="space-y-4">
      <h3 className="text-lg font-bold">Rechazar pago reportado</h3>
      <p className="text-sm text-gray-600">Explica por qué rechazas el pago. El cliente recibirá tu motivo y podrá reportar el pago nuevamente.</p>
      <textarea
        value={props.reason}
        onChange={(e) => props.setReason(e.target.value)}
        minLength={5}
        maxLength={500}
        rows={4}
        required
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        placeholder="Ej: No he recibido el efectivo aún"
      />
      {props.error && <p className="text-sm text-red-600">{props.error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={props.onCancel} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium">Cancelar</button>
        <button type="submit" disabled={props.submitting || props.reason.length < 5} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
          {props.submitting ? 'Rechazando…' : 'Rechazar pago'}
        </button>
      </div>
    </form>
  )
}

function MethodOption({ value, current, onChange, icon, label, description }: { value: OfflineMethod; current: OfflineMethod; onChange: (v: OfflineMethod) => void; icon: React.ReactNode; label: string; description: string }) {
  const active = current === value
  return (
    <label className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${active ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'}`}>
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1">
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-600">{description}</p>
      </div>
      <input type="radio" checked={active} onChange={() => onChange(value)} className="mt-1 accent-primary-600" />
    </label>
  )
}
