'use client'

import { useId, useState } from 'react'
import { Flag } from 'lucide-react'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { CLIENT_REPORT_REASONS } from '@/lib/admin/client-report-reasons'

const REASONS = Object.entries(CLIENT_REPORT_REASONS).map(([value, label]) => ({ value, label }))

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2'

export type ReportTarget = { requestId?: string; bookingId?: string; clientName: string; serviceName: string }

/** «Reportar cliente» button: 44 px, quiet (it is not the main action of a card). */
export function ReportClientButton({ reported, onClick, className = '' }: { reported: boolean; onClick: () => void; className?: string }) {
  if (reported) {
    return (
      <p className={`inline-flex min-h-[44px] items-center gap-1.5 text-sm text-gray-600 ${className}`}>
        <Flag size={16} aria-hidden="true" /> Cliente reportado al equipo
      </p>
    )
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium text-gray-700 hover:bg-gray-100 ${focusRing} ${className}`}
    >
      <Flag size={16} aria-hidden="true" /> Reportar cliente
    </button>
  )
}

/** Sheet to report a client to the team (POST /api/partner/client-reports). */
export function ReportClientSheet({ target, onClose, onDone }: { target: ReportTarget | null; onClose: () => void; onDone: (t: ReportTarget) => void }) {
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const detailsId = useId()

  const close = () => {
    if (saving) return
    setReason(''); setDetails(''); setError(''); setSent(false)
    onClose()
  }

  const needsDetails = reason === 'OTHER'
  const valid = !!reason && (!needsDetails || details.trim().length >= 5)

  const submit = async () => {
    if (!target) return
    setError('')
    if (!valid) { setError(reason ? 'Cuéntanos qué pasó (mínimo 5 caracteres)' : 'Elige un motivo'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/partner/client-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: target.requestId, bookingId: target.bookingId, reason, details: details.trim() || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      // Already reported counts as done: the panel shows it as reported
      if (!res.ok && res.status !== 409) throw new Error(data?.error || 'No se pudo enviar el reporte')
      setSent(true)
      onDone(target)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar el reporte')
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet
      open={!!target}
      onClose={close}
      dismissible={!saving}
      title="Reportar cliente"
      description={target ? `${target.clientName} · ${target.serviceName}` : undefined}
    >
      {sent ? (
        <div role="status" className="space-y-4">
          <p className="text-sm text-gray-700">Gracias. El equipo de LoHaggo revisa el reporte y te escribe si necesita algo más. El cliente no ve este reporte.</p>
          <button type="button" onClick={close} className={`flex min-h-[48px] w-full items-center justify-center rounded-full bg-primary-600 px-5 font-semibold text-white hover:bg-primary-700 ${focusRing}`}>
            Listo
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-gray-700">¿Qué pasó?</legend>
            <div className="grid gap-2">
              {REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 text-sm font-medium transition ${reason === r.value ? 'border-primary-500 bg-primary-50 text-primary-900' : 'border-gray-200 text-gray-800 hover:border-primary-300'}`}
                >
                  <input type="radio" name="report-reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="h-5 w-5" />
                  {r.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor={detailsId} className="mb-1 block text-sm font-medium text-gray-700">
              Cuéntanos más {needsDetails ? '' : <span className="font-normal text-gray-600">(opcional)</span>}
            </label>
            <textarea
              id={detailsId}
              value={details}
              onChange={(e) => setDetails(e.target.value.slice(0, 1000))}
              rows={3}
              placeholder="Ej.: quedamos para el martes y no volvió a contestar"
              className="w-full resize-none rounded-xl border-2 border-gray-300 px-3 py-2.5 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="mt-1 text-right text-xs text-gray-600">{details.length}/1000</p>
          </div>
          <p className="text-xs text-gray-600">El cliente no ve el reporte. Solo lo revisa el equipo de LoHaggo.</p>
          {error && <p className="text-sm font-medium text-red-700" role="alert">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={close} className={`flex min-h-[48px] flex-1 items-center justify-center rounded-full border border-gray-300 bg-white px-4 font-semibold text-gray-800 hover:bg-gray-50 ${focusRing}`}>
              Volver
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving || !valid}
              className={`flex min-h-[48px] flex-1 items-center justify-center rounded-full bg-red-600 px-4 font-semibold text-white hover:bg-red-700 disabled:opacity-50 ${focusRing}`}
            >
              {saving ? 'Enviando…' : 'Enviar reporte'}
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  )
}
