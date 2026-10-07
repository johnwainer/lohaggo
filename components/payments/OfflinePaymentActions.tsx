'use client'

import { useEffect, useId, useState } from 'react'
import { Banknote, ArrowRightLeft, CheckCircle, XCircle, Clock, AlertTriangle, Loader2, RotateCcw, X } from 'lucide-react'
import { useDialog } from '@/components/ui/use-dialog'

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2'
const btnBase = `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${focusRing}`
const fieldClass = 'w-full rounded-2xl border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500'

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
        setError(data.error || 'No pudimos procesar la solicitud. Inténtalo de nuevo.')
        return
      }
      setModal(null)
      setReason('')
      setNote('')
      onChange?.()
    } catch {
      setError('No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.')
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
        setError(data.error || 'No pudimos deshacer el reporte. Inténtalo de nuevo.')
        return
      }
      onChange?.()
    } catch {
      setError('No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  const availableMethods: OfflineMethod[] = []
  if (config.cashEnabled) availableMethods.push('CASH')
  if (config.transferEnabled) availableMethods.push('DIRECT_TRANSFER')

  if (payment?.status === 'REFUNDED') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <Badge tone="slate" icon={<RotateCcw className="w-4 h-4" aria-hidden="true" />}>Pago reembolsado</Badge>
      </div>
    )
  }

  const closeModal = () => { setModal(null); setError(null) }
  const modalTitle = modal === 'report' ? '¿Cómo pagaste?' : modal === 'confirm' ? 'Confirmar recepción del pago' : 'Rechazar pago reportado'

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
      <StatusBanner status={status} role={role} payment={payment} />

      {role === 'CLIENT' && status === 'NONE' && availableMethods.length > 0 && (
        <button
          type="button"
          onClick={() => { setMethod(availableMethods[0]); setModal('report') }}
          className={`w-full ${btnBase} bg-primary-600 text-white hover:bg-primary-700`}
        >
          <CheckCircle className="w-4 h-4" aria-hidden="true" /> Ya pagué
        </button>
      )}

      {role === 'CLIENT' && status === 'PARTNER_REPORTED' && availableMethods.length > 0 && (
        <button
          onClick={() => { setMethod((payment?.partnerConfirmedMethod as OfflineMethod) || availableMethods[0]); setModal('report') }}
          type="button"
          className={`w-full ${btnBase} bg-emerald-700 text-white hover:bg-emerald-800`}
        >
          <CheckCircle className="w-4 h-4" aria-hidden="true" /> Confirmar pago
        </button>
      )}

      {role === 'CLIENT' && status === 'CLIENT_REPORTED' && (
        <button
          onClick={unreport}
          disabled={submitting}
          type="button"
          className={`w-full ${btnBase} border border-slate-300 bg-white font-medium text-slate-700 hover:bg-slate-100`}
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <XCircle className="w-4 h-4" aria-hidden="true" />}
          Deshacer reporte
        </button>
      )}

      {role === 'CLIENT' && status === 'REJECTED_BY_PARTNER' && availableMethods.length > 0 && (
        <button
          type="button"
          onClick={() => { setMethod(availableMethods[0]); setModal('report') }}
          className={`w-full ${btnBase} bg-primary-600 text-white hover:bg-primary-700`}
        >
          Reportar pago nuevamente
        </button>
      )}

      {role === 'PARTNER' && status === 'CLIENT_REPORTED' && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => { setMethod((payment?.clientReportedMethod as OfflineMethod) || availableMethods[0]); setModal('confirm') }}
            type="button"
            className={`${btnBase} bg-emerald-700 text-white hover:bg-emerald-800`}
          >
            <CheckCircle className="w-4 h-4" aria-hidden="true" /> Confirmar recepción
          </button>
          <button
            type="button"
            onClick={() => setModal('reject')}
            className={`${btnBase} border border-red-300 bg-white text-red-700 hover:bg-red-50`}
          >
            <XCircle className="w-4 h-4" aria-hidden="true" /> Rechazar
          </button>
        </div>
      )}

      {role === 'PARTNER' && status === 'NONE' && availableMethods.length > 0 && (
        <button
          type="button"
          onClick={() => { setMethod(availableMethods[0]); setModal('confirm') }}
          className={`w-full ${btnBase} border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50`}
        >
          <CheckCircle className="w-4 h-4" aria-hidden="true" /> Marcar como recibido
        </button>
      )}

      {!modal && error && (
        <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {role === 'CLIENT' && partnerBankAccount && (config.transferEnabled || payment?.clientReportedMethod === 'DIRECT_TRANSFER') && (
        <details className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm">
          <summary className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl font-semibold text-blue-900 ${focusRing}`}>
            <ArrowRightLeft className="w-4 h-4" aria-hidden="true" /> Datos para transferir al socio
          </summary>
          <dl className="mt-2 grid grid-cols-1 gap-1 text-blue-900">
            <Row k="Banco" v={partnerBankAccount.bankName} />
            <Row k="Tipo" v={partnerBankAccount.accountType} />
            <Row k="Número" v={partnerBankAccount.accountNumber} />
            <Row k="Titular" v={partnerBankAccount.accountHolderName} />
            <Row k="Documento" v={partnerBankAccount.holderDocumentNumber} />
          </dl>
        </details>
      )}

      {modal && (
        <Modal title={modalTitle} onClose={closeModal} dismissible={!submitting}>
          {modal === 'report' && (
            <ReportClientForm
              method={method}
              setMethod={setMethod}
              note={note}
              setNote={setNote}
              available={availableMethods}
              onCancel={closeModal}
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
              onCancel={closeModal}
              onSubmit={() => submit(`/api/bookings/${bookingId}/payment/confirm-partner`, { method })}
              submitting={submitting}
              error={error}
            />
          )}
          {modal === 'reject' && (
            <RejectPartnerForm
              reason={reason}
              setReason={setReason}
              onCancel={closeModal}
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
      <Badge tone="emerald" icon={<CheckCircle className="w-4 h-4" aria-hidden="true" />}>
        Pago confirmado · {methodLabel(payment?.partnerConfirmedMethod || payment?.clientReportedMethod)}
      </Badge>
    )
  }
  if (status === 'CLIENT_REPORTED') {
    return role === 'CLIENT' ? (
      <Badge tone="amber" icon={<Clock className="w-4 h-4" aria-hidden="true" />}>
        Reportado: {methodLabel(payment?.clientReportedMethod)} · esperando confirmación del socio
      </Badge>
    ) : (
      <Badge tone="amber" icon={<Clock className="w-4 h-4" aria-hidden="true" />}>
        Cliente reportó pago en {methodLabel(payment?.clientReportedMethod)}
      </Badge>
    )
  }
  if (status === 'PARTNER_REPORTED') {
    return role === 'PARTNER' ? (
      <Badge tone="emerald" icon={<CheckCircle className="w-4 h-4" aria-hidden="true" />}>
        Marcaste el pago como recibido · {methodLabel(payment?.partnerConfirmedMethod)}
      </Badge>
    ) : (
      <Badge tone="amber" icon={<Clock className="w-4 h-4" aria-hidden="true" />}>
        El socio reportó haber recibido el pago. Confirma desde abajo.
      </Badge>
    )
  }
  if (status === 'DISPUTED') {
    return (
      <Badge tone="red" icon={<AlertTriangle className="w-4 h-4" aria-hidden="true" />}>
        Discrepancia: cliente reportó {methodLabel(payment?.clientReportedMethod)}, socio reportó {methodLabel(payment?.partnerConfirmedMethod)}. Un administrador revisará el caso.
      </Badge>
    )
  }
  if (status === 'REJECTED_BY_PARTNER') {
    return (
      <Badge tone="red" icon={<XCircle className="w-4 h-4" aria-hidden="true" />}>
        El socio rechazó el pago reportado{payment?.rejectionReason ? ` · ${payment.rejectionReason}` : ''}
      </Badge>
    )
  }
  return role === 'CLIENT' ? (
    <Badge tone="slate" icon={<Banknote className="w-4 h-4" aria-hidden="true" />}>Pago pendiente · marca cuando hayas pagado al socio</Badge>
  ) : (
    <Badge tone="slate" icon={<Banknote className="w-4 h-4" aria-hidden="true" />}>El cliente aún no reporta el pago. Si ya te pagó, márcalo como recibido.</Badge>
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
    <div role="status" className={`inline-flex items-start gap-2 rounded-2xl border px-3 py-2 text-sm font-medium ${tones[tone]}`}>
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

function Modal({ title, children, onClose, dismissible = true }: { title: string; children: React.ReactNode; onClose: () => void; dismissible?: boolean }) {
  const { dialogProps, titleId } = useDialog(true, onClose, { dismissible })
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={dismissible ? onClose : undefined} />
      <div
        {...dialogProps}
        className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-xl focus:outline-none sm:rounded-3xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 id={titleId} className="text-lg font-bold text-gray-900">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Cerrar" className={`-mr-2 -mt-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 ${focusRing}`}>
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FormError({ error }: { error: string | null }) {
  if (!error) return null
  return <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
}

function FormButtons({ onCancel, submitting, disabled, label, busyLabel, tone }: { onCancel: () => void; submitting: boolean; disabled?: boolean; label: string; busyLabel: string; tone: string }) {
  return (
    <div className="flex gap-2">
      <button type="button" onClick={onCancel} className={`flex-1 ${btnBase} border border-gray-300 bg-white font-medium text-gray-700 hover:bg-gray-50`}>Cancelar</button>
      <button type="submit" disabled={submitting || disabled} className={`flex-1 ${btnBase} text-white ${tone}`}>
        {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {submitting ? busyLabel : label}
      </button>
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
  const noteId = useId()
  return (
    <form onSubmit={(e) => { e.preventDefault(); props.onSubmit() }} className="space-y-4">
      <p className="text-sm text-gray-600">Selecciona el método y reporta el pago. El socio recibirá una notificación para confirmar la recepción.</p>
      <fieldset className="space-y-2">
        <legend className="sr-only">Método de pago</legend>
        {props.available.includes('CASH') && (
          <MethodOption value="CASH" current={props.method} onChange={props.setMethod} icon={<Banknote className="w-5 h-5 text-emerald-600" />} label="Efectivo" description="Pagué en efectivo al socio" />
        )}
        {props.available.includes('DIRECT_TRANSFER') && (
          <MethodOption value="DIRECT_TRANSFER" current={props.method} onChange={props.setMethod} icon={<ArrowRightLeft className="w-5 h-5 text-blue-600" />} label="Transferencia" description="Transferí a la cuenta del socio" />
        )}
      </fieldset>
      <div>
        <label htmlFor={noteId} className="block text-sm font-medium text-gray-700 mb-1">Nota (opcional)</label>
        <textarea
          id={noteId}
          value={props.note}
          onChange={(e) => props.setNote(e.target.value)}
          maxLength={500}
          rows={2}
          className={fieldClass}
          placeholder="Ej.: pagué $50.000 al llegar"
        />
      </div>
      <FormError error={props.error} />
      <FormButtons onCancel={props.onCancel} submitting={props.submitting} label="Confirmar" busyLabel="Reportando…" tone="bg-primary-600 hover:bg-primary-700" />
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
      <p className="text-sm text-gray-600">
        {props.clientReportedMethod
          ? <>El cliente reportó haber pagado en <strong>{methodLabel(props.clientReportedMethod)}</strong>. Confirma el método que efectivamente recibiste.</>
          : 'Selecciona cómo recibiste el pago.'}
      </p>
      <fieldset className="space-y-2">
        <legend className="sr-only">Método con el que recibiste el pago</legend>
        {props.available.includes('CASH') && (
          <MethodOption value="CASH" current={props.method} onChange={props.setMethod} icon={<Banknote className="w-5 h-5 text-emerald-600" />} label="Efectivo" description="Recibí efectivo" />
        )}
        {props.available.includes('DIRECT_TRANSFER') && (
          <MethodOption value="DIRECT_TRANSFER" current={props.method} onChange={props.setMethod} icon={<ArrowRightLeft className="w-5 h-5 text-blue-600" />} label="Transferencia" description="Recibí transferencia en mi cuenta" />
        )}
      </fieldset>
      <FormError error={props.error} />
      <FormButtons onCancel={props.onCancel} submitting={props.submitting} label="Confirmar" busyLabel="Confirmando…" tone="bg-emerald-700 hover:bg-emerald-800" />
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
  const reasonId = useId()
  const tooShort = props.reason.trim().length < 5
  return (
    <form onSubmit={(e) => { e.preventDefault(); props.onSubmit() }} className="space-y-4">
      <p id={`${reasonId}-desc`} className="text-sm text-gray-600">Explica por qué rechazas el pago. El cliente recibirá tu motivo y podrá reportar el pago nuevamente.</p>
      <label htmlFor={reasonId} className="-mb-2 block text-sm font-medium text-gray-700">Motivo del rechazo</label>
      <textarea
        id={reasonId}
        aria-describedby={`${reasonId}-desc${tooShort ? ` ${reasonId}-hint` : ''}`}
        value={props.reason}
        onChange={(e) => props.setReason(e.target.value)}
        minLength={5}
        maxLength={500}
        rows={4}
        required
        className={fieldClass}
        placeholder="Ej.: no he recibido el efectivo aún"
      />
      {tooShort && <p id={`${reasonId}-hint`} className="-mt-2 text-sm text-gray-600">Escribe al menos 5 caracteres</p>}
      <FormError error={props.error} />
      <FormButtons onCancel={props.onCancel} submitting={props.submitting} disabled={tooShort} label="Rechazar pago" busyLabel="Rechazando…" tone="bg-red-600 hover:bg-red-700" />
    </form>
  )
}

function MethodOption({ value, current, onChange, icon, label, description }: { value: OfflineMethod; current: OfflineMethod; onChange: (v: OfflineMethod) => void; icon: React.ReactNode; label: string; description: string }) {
  const active = current === value
  return (
    <label className={`flex min-h-[44px] items-start gap-3 p-3 border rounded-2xl cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-primary-500 ${active ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:bg-gray-50'}`}>
      <div className="mt-0.5" aria-hidden="true">{icon}</div>
      <div className="flex-1">
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-600">{description}</p>
      </div>
      <input type="radio" name="offline-payment-method" value={value} checked={active} onChange={() => onChange(value)} className="mt-1 h-5 w-5 accent-primary-600 focus-visible:outline-none" />
    </label>
  )
}
