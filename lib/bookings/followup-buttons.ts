/**
 * Quick replies of the booking follow-up templates (B30–B34, C36, C39) are applied by the server, not by the
 * AI agent: they work even when no agent covers the conversation. The person acting is the platform user
 * linked to the conversation; ownership is checked by applyFollowup.
 */
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { OpsError, type Actor, type Origin } from '@/lib/ops/origin'
import { sendToConversation } from '@/lib/inbox/send'
import type { ButtonMark } from '@/lib/messaging/wa-format'
import { applyFollowup, type FollowupAction } from '@/lib/bookings/followups'
import type { OfflineMethod } from '@/lib/payments/ops'

const logger = createLogger('followup-buttons')

export const FOLLOWUP_BUTTONS: Record<string, { action: FollowupAction; method?: OfflineMethod }> = {
  rebook_yes: { action: 'rebook' },
  rebook_wait: { action: 'wait' },
  rebook_no: { action: 'decline_rebook' },
  arrived_yes: { action: 'arrived' },
  arrived_no: { action: 'no_show' },
  service_done: { action: 'done' },
  service_not_done: { action: 'not_done' },
  arrival_started: { action: 'partner_started' },
  arrival_on_way: { action: 'partner_on_way' },
  partner_cant_go: { action: 'partner_cant_go' },
  partner_paid_cash: { action: 'partner_paid', method: 'CASH' },
  partner_paid_transfer: { action: 'partner_paid', method: 'DIRECT_TRANSFER' },
  partner_not_paid: { action: 'partner_not_paid' },
  resched_ok: { action: 'reschedule_ok' },
  resched_no: { action: 'reschedule_no' },
  price_ok: { action: 'price_ok' },
  price_no: { action: 'price_no' },
  client_here: { action: 'client_here' },
  client_cancel: { action: 'client_cancel' },
  reconfirm_yes: { action: 'reconfirm_yes' },
  reconfirm_change: { action: 'reconfirm_change' },
  reconfirm_cancel: { action: 'reconfirm_cancel' },
  here_yes: { action: 'here_yes' },
  here_later: { action: 'here_later' },
  depart_now: { action: 'partner_departing' },
}

/** The templates whose buttons are applied here: the same id on another template («Cancelar»…) goes to the agent */
export const FOLLOWUP_TEMPLATES = new Set([
  'lh_cliente_socio_sin_confirmar', 'lh_cliente_reserva_sin_confirmar', 'lh_cliente_llego_socio', 'lh_cliente_socio_no_llego',
  'lh_cliente_servicio_termino', 'lh_socio_llegada_pendiente', 'lh_socio_te_pagaron',
  'lh_cliente_cambio_fecha_propuesto', 'lh_cliente_socio_no_te_encontro', 'lh_cliente_precio_final',
  'lh_cliente_reconfirmar_cita', 'lh_cliente_reconfirmar_urgente', 'lh_cliente_socio_sale', 'lh_socio_cliente_confirmo',
])

/** Templates a typed «sí» also answers on WhatsApp (an SMS «sí» answers them always). */
const TEXT_YES_TEMPLATES = new Set(['lh_cliente_reconfirmar_cita', 'lh_cliente_reconfirmar_urgente', 'lh_cliente_socio_sale'])
const YES = new Set(['si', 'sí', 'si.', 'sí.', 'si confirmo', 'sí confirmo', 'confirmo', 'confirmado', 'si señor', 'sí señor', 'aqui estoy', 'aquí estoy', 'aqui estare', 'aquí estaré'])
/** Notices of ours a typed «sí» answers (Notification.data.kind) */
const YES_NOTICE_KINDS = ['RECONFIRM_ASK', 'RECONFIRM_URGE', 'APPOINTMENT_ON_HOLD', 'PARTNER_DEPARTING']

/** «Sí», «confirmo», «aquí estaré»… as the person types it. Pure. */
export function isPlainYes(body: string | null | undefined) {
  const t = (body ?? '').trim().toLowerCase().replace(/[!¡👍✅]+/g, '').replace(/\s+/g, ' ').trim()
  return YES.has(t)
}

/**
 * A typed «sí» confirms the appointment (or «aquí estaré» when the partner is leaving): on SMS always, on
 * WhatsApp only right after one of our confirmation templates. Only when exactly one booking of that client
 * waits for it. Answers in the same chat; false when it does not apply (the agent takes the message).
 */
export async function handleTextYes(p: { conversationId: string; userId: string | null; channel: string; body: string; lastTemplate?: { name?: string; at?: string; entityType?: string | null; entityId?: string | null } | null }): Promise<boolean> {
  if (!p.userId || !isPlainYes(p.body)) return false
  let onlyBooking: string | null = null
  if (p.channel === 'WHATSAPP') {
    const t = p.lastTemplate
    const fresh = t?.at && Date.now() - Date.parse(t.at) < 24 * 3600_000
    if (!t?.name || !TEXT_YES_TEMPLATES.has(t.name) || !fresh) return false
    onlyBooking = t.entityType === 'Booking' && t.entityId ? t.entityId : null
  } else if (p.channel === 'SMS') {
    // Only right after one of our confirmation notices (an «sí» to anything else is for the team)
    const recent = await prisma.notification.findFirst({
      where: { userId: p.userId, createdAt: { gte: new Date(Date.now() - 24 * 3600_000) }, OR: YES_NOTICE_KINDS.map((k) => ({ data: { contains: `"kind":"${k}"` } })) },
      orderBy: { createdAt: 'desc' }, select: { data: true },
    })
    if (!recent) return false
    try { onlyBooking = (JSON.parse(recent.data ?? '{}') as { bookingId?: string }).bookingId ?? null } catch { onlyBooking = null }
  } else return false
  const assigned = await prisma.conversation.findUnique({ where: { id: p.conversationId }, select: { assignedToId: true } })
  if (assigned?.assignedToId) return false
  const user = await prisma.user.findUnique({ where: { id: p.userId }, select: { id: true, role: true, email: true, isActive: true } })
  if (!user?.isActive || user.role !== 'CLIENT') return false
  const actor: Actor = { userId: user.id, role: 'CLIENT', email: user.email }
  const { followupViews } = await import('@/lib/bookings/followups')
  const upcoming = await prisma.booking.findMany({ where: { userId: user.id, status: 'CONFIRMED', scheduledDate: { gte: new Date(Date.now() - 2 * 24 * 3600_000), lte: new Date(Date.now() + 3 * 24 * 3600_000) } }, select: { id: true } })
  const views = await followupViews(actor, upcoming.map((b) => b.id))
  const waiting = Object.entries(views).filter(([id, v]) => (v.actions.includes('here_yes') || v.actions.includes('reconfirm_yes')) && (!onlyBooking || id === onlyBooking))
  if (waiting.length !== 1) return false
  const [bookingId, view] = waiting[0]
  const conversation = await prisma.conversation.findUnique({ where: { id: p.conversationId } })
  if (!conversation) return false
  const origin: Origin = { via: 'chat', channel: conversation.channel, conversationId: conversation.id, agentId: FOLLOWUP_SENDER.agentId, agentName: FOLLOWUP_SENDER.agentName }
  let reply: string
  try {
    reply = (await applyFollowup(actor, bookingId, view.actions.includes('here_yes') ? 'here_yes' : 'reconfirm_yes', origin)).message
  } catch (err) {
    if (!(err instanceof OpsError)) return false
    reply = err.message
  }
  const sent = await sendToConversation({ conversation, message: reply, sender: FOLLOWUP_SENDER })
  if (!sent.ok) logger.warn('Text yes reply not sent', { conversationId: p.conversationId, error: sent.error })
  return true
}

export const isFollowupButton = (id: string) => Object.prototype.hasOwnProperty.call(FOLLOWUP_BUTTONS, id)

export const FOLLOWUP_SENDER = { type: 'AI' as const, agentId: 'booking-followup', agentName: 'Seguimiento automático' }

/**
 * Applies the pressed button and answers in the same chat. Returns false when it is not one of these buttons
 * or the booking or person cannot be told apart (the AI agent takes it, as with any other button).
 */
export async function handleFollowupButton(p: { conversationId: string; userId: string | null; button: ButtonMark | null }): Promise<boolean> {
  const btn = p.button
  if (!btn || !isFollowupButton(btn.id)) return false
  const tpl = btn.template
  if (!p.userId || !tpl || !FOLLOWUP_TEMPLATES.has(tpl.name) || tpl.entityType !== 'Booking' || !tpl.entityId) return false

  const user = await prisma.user.findUnique({ where: { id: p.userId }, select: { id: true, role: true, email: true, isActive: true, partnerProfile: { select: { id: true } } } })
  if (!user?.isActive || user.role === 'ADMIN') return false
  const actor: Actor = { userId: user.id, role: user.role === 'PARTNER' ? 'PARTNER' : 'CLIENT', email: user.email, partnerId: user.partnerProfile?.id ?? null }
  const conversation = await prisma.conversation.findUnique({ where: { id: p.conversationId } })
  if (!conversation) return false
  const origin: Origin = { via: 'chat', channel: conversation.channel, conversationId: conversation.id, agentId: FOLLOWUP_SENDER.agentId, agentName: FOLLOWUP_SENDER.agentName }

  const { action, method } = FOLLOWUP_BUTTONS[btn.id]
  // A button only answers the side it was sent to (a partner's «Voy a salir», a client's «Confirmo»)
  if (action === 'partner_departing' && actor.role !== 'PARTNER') return false
  let reply: string
  try {
    // The template's send time: a button answers the proposal of that message, never a newer one
    const sentAt = tpl.at ? new Date(tpl.at) : undefined
    reply = (await applyFollowup(actor, tpl.entityId, action, origin, { method, sentAt: sentAt && !Number.isNaN(sentAt.getTime()) ? sentAt : undefined })).message
  } catch (err) {
    if (!(err instanceof OpsError)) {
      logger.warn('Follow-up button failed', { conversationId: p.conversationId, button: btn.id, err: err instanceof Error ? err.message : err })
      return false
    }
    reply = err.message
  }
  const sent = await sendToConversation({ conversation, message: reply, sender: FOLLOWUP_SENDER })
  if (!sent.ok) logger.warn('Follow-up reply not sent', { conversationId: p.conversationId, error: sent.error })
  return true
}
