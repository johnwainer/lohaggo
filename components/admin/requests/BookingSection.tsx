'use client'

import Link from 'next/link'
import type { BookingStatus } from '@prisma/client'
import { AlertTriangle, CalendarClock, ExternalLink, RotateCcw, Star, XCircle } from 'lucide-react'
import { BOOKING_TRANSITIONS, BOOKING_STATUS_LABEL } from '@/lib/bookings/transitions'
import { STATUS_LABEL as GUARANTEE_STATUS, TYPE_LABEL as GUARANTEE_TYPE } from '@/lib/guarantee/policy'
import type { CaseBooking } from './types'
import { BOOKING_STATUS, Chip, Field, Thumbs, btn, cop, day, statusChip, when } from './ui'

const PAY_STATUS: Record<string, string> = { PENDING: 'Pendiente', APPROVED: 'Aprobado', REJECTED: 'Rechazado', CANCELLED: 'Cancelado', REFUNDED: 'Reembolsado' }
const CONFIRMATION: Record<string, string> = { NONE: 'Sin reportes', CLIENT_REPORTED: 'El cliente reportó el pago', PARTNER_REPORTED: 'El socio reportó el pago', CONFIRMED: 'Confirmado por ambos', DISPUTED: 'En disputa' }
const METHOD: Record<string, string> = { CASH: 'Efectivo', TRANSFER: 'Transferencia', NEQUI: 'Nequi', DAVIPLATA: 'Daviplata' }
const ACTOR: Record<string, string> = { client: 'Cliente', partner: 'Socio', admin: 'Admin', system: 'Sistema', CLIENT: 'Cliente', PARTNER: 'Socio', ADMIN: 'Admin', SYSTEM: 'Sistema' }
const EVENT: Record<string, string> = { status: 'Cambio de estado', reschedule: 'Reprogramación', payment: 'Pago', created: 'Creada' }

const label = (map: Record<string, string>, v: string | null | undefined) => (v ? map[v] ?? v : '—')

export type BookingActions = {
  onStatus: (to: BookingStatus) => void
  onReschedule: () => void
  onCancel: (reopen: boolean) => void
}

export function BookingSection({ booking: b, busy, actions, onOpenImage }: { booking: CaseBooking; busy: boolean; actions: BookingActions; onOpenImage: (urls: string[], i: number) => void }) {
  const status = b.status as BookingStatus
  const options = (BOOKING_TRANSITIONS[status] ?? []).filter((o) => o.by.includes('admin'))
  const forward = options.filter((o) => o.to !== 'CANCELLED')
  const canCancel = options.some((o) => o.to === 'CANCELLED')
  const canReschedule = status === 'PENDING' || status === 'CONFIRMED'
  const mismatch = b.proposalPrice != null && Math.abs(b.totalPrice - b.proposalPrice) > 1
  const before = b.photos.filter((p) => p.kind === 'before').map((p) => p.url)
  const after = b.photos.filter((p) => p.kind !== 'before').map((p) => p.url)
  const pay = b.payment
  const review = b.review

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={`Reserva #${b.ref}`}>{statusChip(BOOKING_STATUS, b.status)}</Field>
        <Field label="Fecha del servicio">{day(b.scheduledDate)} · {b.scheduledTime}</Field>
        <Field label="Precio">
          <span className={mismatch ? 'font-bold text-red-600' : 'font-semibold'}>{cop(b.totalPrice)}</span>
          {b.proposalPrice != null && <span className="text-gray-500"> · propuesta {cop(b.proposalPrice)}</span>}
          {mismatch && <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-600"><AlertTriangle className="h-3.5 w-3.5" /> No coincide con la propuesta aceptada</p>}
        </Field>
      </div>

      {(forward.length > 0 || canCancel || canReschedule) && (
        <div className="flex flex-wrap gap-2">
          {forward.map((o) => (
            <button key={o.to} type="button" disabled={busy} onClick={() => actions.onStatus(o.to)} className={btn.ghost}>
              Pasar a «{BOOKING_STATUS_LABEL[o.to]}»
            </button>
          ))}
          {canReschedule && <button type="button" disabled={busy} onClick={actions.onReschedule} className={btn.ghost}><CalendarClock className="h-4 w-4" /> Reprogramar</button>}
          {canCancel && <button type="button" disabled={busy} onClick={() => actions.onCancel(false)} className={`${btn.ghost} text-red-600`}><XCircle className="h-4 w-4" /> Cancelar</button>}
          {canCancel && <button type="button" disabled={busy} onClick={() => actions.onCancel(true)} className={`${btn.ghost} text-red-600`}><RotateCcw className="h-4 w-4" /> Cancelar y reabrir a otros socios</button>}
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Historial</p>
        {!b.events.length ? <p className="text-sm text-gray-400">Sin eventos.</p> : (
          <ol className="relative space-y-3 border-l border-gray-200 pl-4">
            {b.events.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary-400 ring-2 ring-white" />
                <p className="text-sm font-semibold text-gray-900">
                  {label(EVENT, e.type)}{e.to ? `: ${e.from ? `${BOOKING_STATUS_LABEL[e.from as BookingStatus] ?? e.from} → ` : ''}${BOOKING_STATUS_LABEL[e.to as BookingStatus] ?? e.to}` : ''}
                </p>
                <p className="text-xs text-gray-500">{when(e.at)} · {label(ACTOR, e.actorType)}{e.origin && e.origin !== 'app' ? ` · ${e.origin}` : ''}</p>
                {e.detail && <p className="mt-0.5 break-words text-sm text-gray-700">{e.detail}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>

      {(before.length > 0 || after.length > 0) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Fotos antes ({before.length})</p>
            {before.length ? <Thumbs urls={before} onOpen={onOpenImage} /> : <p className="text-sm text-gray-400">Sin fotos.</p>}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Fotos después ({after.length})</p>
            {after.length ? <Thumbs urls={after} onOpen={onOpenImage} /> : <p className="text-sm text-gray-400">Sin fotos.</p>}
          </div>
        </div>
      )}

      <div id="pago" className="scroll-mt-20 rounded-2xl border border-gray-100 bg-gray-50/60 p-3 sm:p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Pago</p>
        {!pay ? <p className="text-sm text-gray-500">Sin registro de pago.</p> : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Estado">{label(PAY_STATUS, pay.status)} · {cop(pay.totalAmount)}{pay.paidAt ? ` · pagado ${when(pay.paidAt)}` : ''}</Field>
            <Field label="Confirmación">
              <span className={pay.confirmationStatus === 'DISPUTED' ? 'font-bold text-red-600' : ''}>{label(CONFIRMATION, pay.confirmationStatus)}</span>
            </Field>
            <Field label="Reportado por el cliente">{pay.clientReportedMethod ? `${label(METHOD, pay.clientReportedMethod)}${pay.clientReportedAt ? ` · ${when(pay.clientReportedAt)}` : ''}` : '—'}</Field>
            <Field label="Confirmado por el socio">{pay.partnerConfirmedMethod ? `${label(METHOD, pay.partnerConfirmedMethod)}${pay.partnerConfirmedAt ? ` · ${when(pay.partnerConfirmedAt)}` : ''}` : '—'}</Field>
          </div>
        )}
      </div>

      {review && (review.clientToPartnerRating != null || review.partnerToClientRating != null) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {review.clientToPartnerRating != null && (
            <Field label="Reseña del cliente al socio">
              <span className="inline-flex items-center gap-1 font-semibold"><Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {review.clientToPartnerRating}/5</span>
              {review.clientToPartnerComment && <p className="mt-0.5 text-gray-600">«{review.clientToPartnerComment}»</p>}
            </Field>
          )}
          {review.partnerToClientRating != null && (
            <Field label="Reseña del socio al cliente">
              <span className="inline-flex items-center gap-1 font-semibold"><Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {review.partnerToClientRating}/5</span>
              {review.partnerToClientComment && <p className="mt-0.5 text-gray-600">«{review.partnerToClientComment}»</p>}
            </Field>
          )}
        </div>
      )}

      {b.guaranteeClaims.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Reclamos de garantía</p>
            <Link href="/admin/guarantee" className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline">Resolver en Garantía <ExternalLink className="h-3 w-3" /></Link>
          </div>
          <ul className="space-y-2">
            {b.guaranteeClaims.map((g) => (
              <li key={g.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2"><Chip cls="bg-white text-amber-800">{label(GUARANTEE_TYPE, g.type)}</Chip><Chip cls="bg-amber-100 text-amber-800">{label(GUARANTEE_STATUS, g.status)}</Chip><span className="text-xs text-amber-700">{when(g.createdAt)}</span></div>
                <p className="mt-1 break-words text-amber-900">{g.description}</p>
                {g.photoUrls.length > 0 && <div className="mt-2"><Thumbs urls={g.photoUrls} onOpen={onOpenImage} size="h-14 w-14" /></div>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {b.refundCases.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Reembolsos</p>
          <ul className="space-y-1 text-sm text-gray-700">
            {b.refundCases.map((r) => <li key={r.id}>#{r.id.slice(-6)} · {r.status} · {cop(r.approvedAmount ?? r.requestedAmount)} · {when(r.createdAt)}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
