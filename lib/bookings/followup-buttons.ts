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
}

/** The templates whose buttons are applied here: the same id on another template («Cancelar»…) goes to the agent */
export const FOLLOWUP_TEMPLATES = new Set([
  'lh_cliente_socio_sin_confirmar', 'lh_cliente_reserva_sin_confirmar', 'lh_cliente_llego_socio', 'lh_cliente_socio_no_llego',
  'lh_cliente_servicio_termino', 'lh_socio_llegada_pendiente', 'lh_socio_te_pagaron',
])

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
  let reply: string
  try {
    reply = (await applyFollowup(actor, tpl.entityId, action, origin, { method })).message
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
