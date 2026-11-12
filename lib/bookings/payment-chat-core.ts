/**
 * Pure decisions of the payment, «recibido» and rating replies that come through WhatsApp / SMS (the quick
 * replies of B14, B15, B16, B18, C20, C21 and what a person types instead). The server applies them without the
 * AI agent and without anyone assigned to the chat: lib/bookings/payment-chat.ts.
 */
import type { OfflineMethod } from '@/lib/payments/ops'

export type PaymentIntent =
  | { kind: 'client_report'; method: OfflineMethod }
  | { kind: 'client_not_yet' }
  | { kind: 'partner_confirm' }
  | { kind: 'partner_reject' }
  | { kind: 'rate'; stars: number }

const CLIENT_PAY_TEMPLATES = new Set(['lh_cliente_servicio_terminado_pago', 'lh_cliente_pago_pendiente'])
const PARTNER_RECEIVED_TEMPLATES = new Set(['lh_socio_pago_reportado_v2', 'lh_socio_pago_por_confirmar_v2'])
const RATE_TEMPLATES = new Set(['lh_cliente_pago_confirmado_v2', 'lh_cliente_recordatorio_calificar_v2'])
/** Templates a typed «efectivo» / «transferencia» answers (the client's B14/B15; the partner's C39 and C20/C21) */
export const CLIENT_PAY_PROMPTS = CLIENT_PAY_TEMPLATES
export const RATE_PROMPTS = RATE_TEMPLATES
export const PARTNER_PAY_PROMPTS = new Set(Array.from(PARTNER_RECEIVED_TEMPLATES).concat('lh_socio_te_pagaron'))

/** The quick-reply id, only when it was pressed on a template that asks that question. Pure. */
export function paymentButtonIntent(buttonId: string, templateName: string | null | undefined): PaymentIntent | null {
  const tpl = templateName ?? ''
  switch (buttonId) {
    case 'pay_cash': return CLIENT_PAY_TEMPLATES.has(tpl) ? { kind: 'client_report', method: 'CASH' } : null
    case 'pay_transfer': return CLIENT_PAY_TEMPLATES.has(tpl) ? { kind: 'client_report', method: 'DIRECT_TRANSFER' } : null
    case 'pay_not_yet': return CLIENT_PAY_TEMPLATES.has(tpl) ? { kind: 'client_not_yet' } : null
    case 'payment_confirm': return PARTNER_RECEIVED_TEMPLATES.has(tpl) ? { kind: 'partner_confirm' } : null
    case 'payment_reject': return PARTNER_RECEIVED_TEMPLATES.has(tpl) ? { kind: 'partner_reject' } : null
    case 'rate_5': return RATE_TEMPLATES.has(tpl) ? { kind: 'rate', stars: 5 } : null
    case 'rate_4': return RATE_TEMPLATES.has(tpl) ? { kind: 'rate', stars: 4 } : null
    default: return null
  }
}

const norm = (body: string | null | undefined) =>
  (body ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.,;:!¡"'«»👍✅🙏]+/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * «efectivo», «en efectivo», «transferencia», «le pagué por transferencia», «ya le pagué en efectivo» → the method.
 * Null for questions, negations, both methods at once or anything long (that is a conversation, not an answer).
 */
export function paymentMethodFromText(body: string | null | undefined): OfflineMethod | null {
  if ((body ?? '').includes('?')) return null
  const t = norm(body)
  if (!t || t.split(' ').length > 8) return null
  if (/\b(no|nunca|aun no|todavia no|tampoco|sin)\b/.test(t)) return null
  const cash = /\b(efectivo|cash)\b/.test(t)
  const transfer = /\b(transferencia|transferi|transferido|transferir|nequi|daviplata|pse)\b/.test(t)
  if (cash === transfer) return null
  return cash ? 'CASH' : 'DIRECT_TRANSFER'
}

/** The partner's «sí», «recibido», «ya me pagaron» to «¿ya te pagó?» / «¿lo recibiste?». */
export function isPartnerPaidYes(body: string | null | undefined) {
  return /^(si |claro )?(si|claro|listo|recibido|(ya )?recibi|lo recibi|(ya )?me (pago|pagaron))( el dinero| todo| completo)?$/.test(norm(body))
}

/** «5», «4 estrellas»: a rating typed after we asked for it. */
export function ratingFromText(body: string | null | undefined): number | null {
  const m = norm(body).match(/^([1-5])( estrellas?| ⭐+)?$/)
  return m ? Number(m[1]) : null
}

export type PromptMark = { name?: string; at?: string; entityType?: string | null; entityId?: string | null }

/**
 * The bookings a conversation was asked about with one of these templates in the last `windowMs` (its last
 * template plus the recent ones, without repeats). Pure.
 */
export function promptedBookingIds(fields: unknown, names: ReadonlySet<string>, now: number, windowMs = 48 * 3600_000): string[] {
  const f = (fields && typeof fields === 'object' ? fields : {}) as { lastTemplate?: PromptMark; recentTemplates?: PromptMark[] }
  const marks = [f.lastTemplate, ...(Array.isArray(f.recentTemplates) ? f.recentTemplates : [])]
  const ids = new Set<string>()
  for (const m of marks) {
    if (!m?.name || !names.has(m.name) || m.entityType !== 'Booking' || !m.entityId || !m.at) continue
    const at = Date.parse(m.at)
    if (!Number.isFinite(at) || now - at > windowMs || at > now + 60_000) continue
    ids.add(m.entityId)
  }
  return Array.from(ids)
}

/** A template and its OUTBOUND message are written with the same instant; anything later is something else we (or a person) said. */
export const SAME_MESSAGE_MS = 5_000

/**
 * The booking a typed answer may act on: the one the conversation's LAST outbound message asked about, and only
 * when that message is itself one of `names` (the template mark and the last outbound row are the same message),
 * is younger than `windowMs`, and nothing visible (a person, the agent, another template or reply) came after it.
 * Internal notes do not count as outbound. Null otherwise. Pure.
 */
export function lastPromptBookingId(fields: unknown, names: ReadonlySet<string>, lastOutboundAt: number | null, now: number, windowMs: number): string | null {
  if (lastOutboundAt == null || !Number.isFinite(lastOutboundAt)) return null
  const m = ((fields && typeof fields === 'object' ? fields : {}) as { lastTemplate?: PromptMark }).lastTemplate
  if (!m?.name || !names.has(m.name) || m.entityType !== 'Booking' || !m.entityId || !m.at) return null
  const at = Date.parse(m.at)
  if (!Number.isFinite(at) || now - at > windowMs || at > now + 60_000) return null
  if (Math.abs(lastOutboundAt - at) > SAME_MESSAGE_MS) return null
  return m.entityId
}

/** The one booking to act on: exactly one candidate, never a guess between several. */
export function onlyCandidate<T extends { id: string }>(candidates: T[]): T | null {
  return candidates.length === 1 ? candidates[0] : null
}

/** A booking is a candidate for a typed payment report while it is completed and not paid or already reported. */
export function isUnpaidCompleted(b: { status: string; payment: { status?: string | null; confirmationStatus?: string | null } | null }) {
  if (b.status !== 'COMPLETED') return false
  return b.payment?.status !== 'APPROVED' && b.payment?.confirmationStatus !== 'CONFIRMED'
}

/**
 * The client answered a payment prompt (pay_cash / pay_transfer / typed method) and, `staleAfterMs` later, the
 * booking is still completed and unpaid with nothing reported: it needs a person. Pure.
 */
export function paymentReplyStale(p: { lastButtonId: string | null; lastButtonAt: string | null; now: number; completedAt: number; confirmationStatus: string; rejectedAt?: number | null; staleAfterMs?: number }) {
  if (p.confirmationStatus !== 'NONE' && p.confirmationStatus !== 'REJECTED_BY_PARTNER') return false
  if (!p.lastButtonId || !/^pay_(cash|transfer)$/.test(p.lastButtonId) || !p.lastButtonAt) return false
  const at = Date.parse(p.lastButtonAt)
  if (!Number.isFinite(at) || at < p.completedAt) return false
  // The button predates the partner's rejection: the client already answered, the team has the case
  if (p.confirmationStatus === 'REJECTED_BY_PARTNER' && p.rejectedAt != null && at <= p.rejectedAt) return false
  return p.now - at >= (p.staleAfterMs ?? 2 * 3600_000)
}

export const methodWord = (m: OfflineMethod) => (m === 'CASH' ? 'en efectivo' : 'por transferencia')

export const PARTNER_REJECT_REASON = 'El socio indicó por WhatsApp que no recibió el pago'
