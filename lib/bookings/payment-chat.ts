/**
 * The client's «¿Cómo le pagaste?» (B14/B15), the partner's «¿Lo recibiste?» (C20/C21, C39) and the rating
 * quick replies (B16/B18) are applied by the server, never left to the AI agent: they work with no agent on the
 * conversation and with a person assigned to it. The same answers typed as text («efectivo», «sí, recibido»)
 * count only right after the prompt (it is the conversation's last outbound message), for that one booking. Ownership is checked on every action.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { OpsError, type Actor, type Origin } from '@/lib/ops/origin'
import { sendToConversation } from '@/lib/inbox/send'
import { FOLLOWUP_SENDER } from '@/lib/bookings/followup-buttons'
import type { ButtonMark } from '@/lib/messaging/wa-format'
import type { OfflineMethod } from '@/lib/payments/ops'
import {
  CLIENT_PAY_PROMPTS, PARTNER_PAY_PROMPTS, PARTNER_REJECT_REASON, isPartnerPaidYes, isUnpaidCompleted, methodWord, onlyCandidate,
  lastPromptBookingId, paymentButtonIntent, paymentMethodFromText, ratingFromText, RATE_PROMPTS, type PaymentIntent,
} from '@/lib/bookings/payment-chat-core'

const logger = createLogger('payment-chat')
const APP_URL = 'https://www.lohaggo.com'
const RATING_WINDOW_MS = 24 * 3600_000

type ChatUser = { id: string; role: string; email: string | null; isActive: boolean; partnerProfile: { id: string } | null }

const bookingSelect = {
  id: true, userId: true, partnerId: true, status: true,
  user: { select: { name: true } },
  partner: { select: { userId: true, user: { select: { name: true } } } },
  payment: { select: { status: true, confirmationStatus: true, clientReportedMethod: true } },
  review: { select: { clientToPartnerRating: true } },
} as const
type BookingRow = NonNullable<Awaited<ReturnType<typeof loadBooking>>>
const loadBooking = (id: string) => prisma.booking.findUnique({ where: { id }, select: bookingSelect })

const first = (name: string | null | undefined, fallback: string) => name?.trim().split(/\s+/)[0] || fallback
const RATE_ASK = '¿Cómo te fue? Califica del 1 al 5 (5 es excelente).'

async function loadUser(userId: string | null): Promise<ChatUser | null> {
  if (!userId) return null
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, email: true, isActive: true, partnerProfile: { select: { id: true } } } })
  return u?.isActive && (u.role === 'CLIENT' || u.role === 'PARTNER') ? u : null
}

const actorOf = (u: ChatUser): Actor => ({ userId: u.id, role: u.role === 'PARTNER' ? 'PARTNER' : 'CLIENT', email: u.email, partnerId: u.partnerProfile?.id ?? null })

/** The booking, only when it belongs to this person on the side the action is for. */
const owns = (u: ChatUser, b: BookingRow, side: 'CLIENT' | 'PARTNER') =>
  side === 'CLIENT' ? u.role === 'CLIENT' && b.userId === u.id : u.role === 'PARTNER' && Boolean(u.partnerProfile) && b.partnerId === u.partnerProfile!.id

async function setPaymentChat(conversationId: string, value: { bookingId: string; step: 'rate'; at: string } | null) {
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { customFields: true } })
  const base = conv?.customFields && typeof conv.customFields === 'object' && !Array.isArray(conv.customFields) ? { ...(conv.customFields as Record<string, unknown>) } : {}
  if (value) base.paymentChat = value
  else delete base.paymentChat
  await prisma.conversation.update({ where: { id: conversationId }, data: { customFields: base as Prisma.InputJsonValue } }).catch(() => null)
}

/** Applies one decided action and returns what to tell the person; null when it is not theirs to do. */
async function apply(user: ChatUser, conversationId: string, channel: string, bookingId: string, intent: PaymentIntent | { kind: 'partner_method'; method: OfflineMethod } | { kind: 'partner_yes' }): Promise<{ reply: string; note: string } | null> {
  const b = await loadBooking(bookingId)
  if (!b) return null
  const actor = actorOf(user)
  const origin: Origin = { via: 'chat', channel, conversationId, agentId: FOLLOWUP_SENDER.agentId, agentName: FOLLOWUP_SENDER.agentName }
  const partner = first(b.partner?.user?.name, 'el socio')
  const client = first(b.user?.name, 'el cliente')
  const ref = `#${b.id.slice(-6).toUpperCase()}`
  try {
    switch (intent.kind) {
      case 'client_report': {
        if (!owns(user, b, 'CLIENT')) return null
        const rateAsk = b.review?.clientToPartnerRating ? '' : ` ${RATE_ASK}`
        const cs = b.payment?.confirmationStatus
        if (b.payment?.status === 'APPROVED' || cs === 'CONFIRMED') return { reply: `El pago de tu servicio con ${partner} ya está confirmado. ¡Gracias!${rateAsk}`, note: `El cliente respondió «${methodWord(intent.method)}»: el pago de ${ref} ya estaba confirmado.` }
        if (cs === 'CLIENT_REPORTED' && b.payment?.clientReportedMethod === intent.method) {
          if (!b.review?.clientToPartnerRating) await setPaymentChat(conversationId, { bookingId: b.id, step: 'rate', at: new Date().toISOString() })
          return { reply: `Ya habíamos registrado que le pagaste a ${partner} ${methodWord(intent.method)}; estamos esperando que lo confirme.${rateAsk}`, note: `El cliente repitió el reporte de pago de ${ref} (sin cambios).` }
        }
        const { reportClientPayment } = await import('@/lib/payments/ops')
        const p = await reportClientPayment(actor, b.id, { method: intent.method }, origin)
        if (!b.review?.clientToPartnerRating) await setPaymentChat(conversationId, { bookingId: b.id, step: 'rate', at: new Date().toISOString() })
        const head = p.confirmationStatus === 'CONFIRMED'
          ? `Listo, registramos que le pagaste a ${partner} ${methodWord(intent.method)} y ${partner} ya lo había confirmado: quedó pagado.`
          : p.confirmationStatus === 'DISPUTED'
            ? `Registramos que le pagaste a ${partner} ${methodWord(intent.method)}, pero no coincide con lo que anotó el socio: el equipo lo revisa y te escribe.`
            : `Listo, registramos que le pagaste a ${partner} ${methodWord(intent.method)}. Le pedimos que lo confirme.`
        return { reply: `${head}${rateAsk}`, note: `Registrado automáticamente: el cliente reportó el pago de ${ref} ${methodWord(intent.method)}.` }
      }
      case 'client_not_yet':
        if (!owns(user, b, 'CLIENT')) return null
        return { reply: `Sin problema. Cuando le pagues a ${partner}, respóndenos «efectivo» o «transferencia» y lo registramos; también puedes reportarlo en tus reservas: ${APP_URL}/dashboard?tab=bookings`, note: `El cliente dijo que aún no paga ${ref}; sin cambios.` }
      case 'rate': {
        if (!owns(user, b, 'CLIENT')) return null
        const { leaveReview } = await import('@/lib/reviews/ops')
        await leaveReview(actor, { bookingId: b.id, rating: intent.stars }, origin)
        await setPaymentChat(conversationId, null)
        return { reply: `¡Gracias por calificar a ${partner} con ${intent.stars} ${intent.stars === 1 ? 'estrella' : 'estrellas'}! Si quieres dejar un comentario, escríbelo aquí.`, note: `Registrado automáticamente: calificación de ${intent.stars} estrellas para ${ref}.` }
      }
      case 'partner_confirm':
      case 'partner_yes': {
        if (!owns(user, b, 'PARTNER')) return null
        const method = b.payment?.confirmationStatus === 'CLIENT_REPORTED' ? b.payment.clientReportedMethod : null
        if (!method || (method !== 'CASH' && method !== 'DIRECT_TRANSFER')) {
          if (b.payment?.status === 'APPROVED' || b.payment?.confirmationStatus === 'CONFIRMED') return { reply: 'El pago ya está registrado. ¡Gracias!', note: `El socio confirmó ${ref}: ya estaba registrado.` }
          return { reply: `¿Cómo te pagó ${client}? Respóndenos «efectivo» o «transferencia» y lo dejamos registrado.`, note: `El socio confirmó ${ref} sin que el cliente reportara el medio: se le preguntó cómo le pagaron.` }
        }
        return partnerPaid(actor, b, method, origin)
      }
      case 'partner_method':
        if (!owns(user, b, 'PARTNER')) return null
        return partnerPaid(actor, b, intent.method, origin)
      case 'partner_reject': {
        if (!owns(user, b, 'PARTNER')) return null
        const { rejectPartnerPayment } = await import('@/lib/payments/ops')
        await rejectPartnerPayment(actor, b.id, PARTNER_REJECT_REASON, origin)
        return { reply: `Entendido: le avisamos a ${client} que aún no recibes el pago y el equipo lo revisa.`, note: `Registrado automáticamente: el socio dice que no recibió el pago de ${ref}.` }
      }
    }
  } catch (err) {
    if (err instanceof OpsError) return { reply: err.message, note: `No se pudo aplicar la respuesta sobre ${ref}: ${err.message}` }
    throw err
  }
}

async function partnerPaid(actor: Actor, b: BookingRow, method: OfflineMethod, origin: Origin) {
  const { applyFollowup } = await import('@/lib/bookings/followups')
  const r = await applyFollowup(actor, b.id, 'partner_paid', origin, { method })
  return { reply: r.message, note: `Registrado automáticamente: el socio confirmó el pago de #${b.id.slice(-6).toUpperCase()} ${methodWord(method)}.` }
}

/** The answer in the same chat; an internal note and a `payment_chat` event for whoever looks at the conversation. */
async function deliver(conversationId: string, result: { reply: string; note: string }, button: string | null) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } })
  if (!conversation) return
  const sent = await sendToConversation({ conversation, message: result.reply, sender: FOLLOWUP_SENDER })
  if (!sent.ok) logger.warn('Payment reply not sent', { conversationId, error: sent.error })
  await prisma.conversationEvent.create({ data: { conversationId, type: 'payment_chat', actorType: 'system', actorName: FOLLOWUP_SENDER.agentName, detail: `${button ? `${button} · ` : ''}${result.note}`.slice(0, 900) } }).catch(() => null)
  // A person owns the chat (or the reply did not go out): they must see what the server did
  if (conversation.assignedToId || !sent.ok) {
    await prisma.conversationMessage.create({
      data: { conversationId, direction: 'OUTBOUND', isInternal: true, status: 'SENT', senderType: 'AUTOMATION', body: `${result.note}${sent.ok ? ` Respondimos: «${result.reply.slice(0, 200)}»` : ' La respuesta NO se pudo enviar: escríbele tú.'}` },
    }).catch(() => null)
  }
}

/** A quick reply of B14, B15, B16, B18, C20 or C21. False when it is not one of those (the agent takes it). */
export async function handlePaymentButton(p: { conversationId: string; userId: string | null; channel?: string; button: ButtonMark | null }): Promise<boolean> {
  const btn = p.button
  const tpl = btn?.template
  // The template this button answers could not be told (Twilio sent no reply sid): «Efectivo» / «Transferencia» still
  // count when exactly one booking was asked about
  if (btn && (!tpl || tpl.entityType !== 'Booking' || !tpl.entityId)) {
    if (btn.id !== 'pay_cash' && btn.id !== 'pay_transfer') return false
    return handlePaymentText({ conversationId: p.conversationId, userId: p.userId, channel: p.channel ?? 'WHATSAPP', body: btn.id === 'pay_cash' ? 'efectivo' : 'transferencia' })
  }
  if (!btn || !tpl || !tpl.entityId) return false
  const intent = paymentButtonIntent(btn.id, tpl.name)
  if (!intent) return false
  const user = await loadUser(p.userId)
  if (!user) return false
  if (intent.kind.startsWith('partner') !== (user.role === 'PARTNER')) return false
  try {
    const result = await apply(user, p.conversationId, p.channel ?? 'WHATSAPP', tpl.entityId, intent)
    if (!result) return false
    await deliver(p.conversationId, result, `${btn.id} «${btn.text}»`)
    return true
  } catch (err) {
    logger.warn('Payment button failed', { conversationId: p.conversationId, button: btn.id, err: err instanceof Error ? err.message : err })
    return false
  }
}

const PROMPT_WINDOW_PARTNER_MS = 24 * 3600_000
const PROMPT_WINDOW_CLIENT_MS = 48 * 3600_000
const SMS_SEND_TOLERANCE_MS = 60_000

/** The last visible message we (or a person) sent in the conversation; internal notes are not messages to the person. */
const lastOutbound = (conversationId: string) =>
  prisma.conversationMessage.findFirst({
    where: { conversationId, direction: 'OUTBOUND', isInternal: false },
    orderBy: { sentAt: 'desc' },
    select: { sentAt: true, body: true, sentById: true },
  })
type LastOut = Awaited<ReturnType<typeof lastOutbound>>

/** The unpaid, completed bookings of this person among `ids`. */
async function unpaidAmong(user: ChatUser, ids: string[]) {
  if (!ids.length) return []
  const rows = await prisma.booking.findMany({
    where: { id: { in: ids }, ...(user.role === 'PARTNER' ? { partnerId: user.partnerProfile?.id ?? '__none__' } : { userId: user.id }) },
    select: { id: true, status: true, payment: { select: { status: true, confirmationStatus: true } } },
  })
  return rows.filter(isUnpaidCompleted)
}

/**
 * The bookings a typed payment answer may act on. WhatsApp: only the one the conversation's last outbound message
 * (a payment prompt, under 24 h for a partner, 48 h for a client) asked about. SMS (client only): bookings a
 * payment SMS was actually sent to this person for in the last 48 h, with nothing sent in the chat since.
 */
async function candidates(user: ChatUser, channel: string, fields: unknown, last: LastOut, now: number) {
  if (channel === 'SMS') {
    if (user.role !== 'CLIENT') return []
    const logs = await prisma.notificationDispatchLog.findMany({
      where: {
        userId: user.id, channel: 'SMS', status: { in: ['SENT', 'DELIVERED'] }, createdAt: { gte: new Date(now - PROMPT_WINDOW_CLIENT_MS) },
        notificationType: { in: ['BOOKING_COMPLETED', 'PAYMENT_PENDING_REMINDER'] },
      },
      select: { createdAt: true, notification: { select: { data: true } } },
    })
    const floor = last ? last.sentAt.getTime() - SMS_SEND_TOLERANCE_MS : 0
    const ids = logs.filter((l) => l.createdAt.getTime() >= floor).map((l) => {
      try { return (JSON.parse(l.notification?.data ?? '{}') as { bookingId?: string }).bookingId ?? '' } catch { return '' }
    }).filter(Boolean)
    return unpaidAmong(user, Array.from(new Set(ids)))
  }
  const id = lastPromptBookingId(fields, user.role === 'PARTNER' ? PARTNER_PAY_PROMPTS : CLIENT_PAY_PROMPTS, last?.sentAt.getTime() ?? null, now, user.role === 'PARTNER' ? PROMPT_WINDOW_PARTNER_MS : PROMPT_WINDOW_CLIENT_MS)
  return id ? unpaidAmong(user, [id]) : []
}

/** The booking a bare rating digit answers: the rating ask we just sent (in-chat after a payment report, or the rating template). */
function ratingBookingId(fields: unknown, last: LastOut, now: number): string | null {
  if (!last || now - last.sentAt.getTime() > RATING_WINDOW_MS) return null
  const fromTemplate = lastPromptBookingId(fields, RATE_PROMPTS, last.sentAt.getTime(), now, RATING_WINDOW_MS)
  if (fromTemplate) return fromTemplate
  const chat = (fields as { paymentChat?: { bookingId?: string; step?: string; at?: string } } | null)?.paymentChat
  const fresh = chat?.step === 'rate' && chat.bookingId && chat.at && now - Date.parse(chat.at) < RATING_WINDOW_MS
  return fresh && !last.sentById && last.body.includes(RATE_ASK) ? chat!.bookingId! : null
}

/** An inbound message that was not a handled reply ends the «waiting for a rating» step. */
export async function clearPaymentStep(conversationId: string) {
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { customFields: true } })
  if ((conv?.customFields as { paymentChat?: unknown } | null)?.paymentChat) await setPaymentChat(conversationId, null)
}

/**
 * «efectivo» / «transferencia» (and «sí, recibido» from a partner) typed right after our payment prompt, or a
 * rating digit typed right after we asked for one. Each needs that prompt to be the conversation's last outbound
 * message (nothing from a person or the agent after it), so a generic «sí» to something else never moves money.
 * Over SMS only the client's payment report applies. False when it does not apply or is ambiguous (the agent or
 * the team takes the message).
 */
export async function handlePaymentText(p: { conversationId: string; userId: string | null; channel: string; body: string }, now = Date.now()): Promise<boolean> {
  if (p.channel !== 'WHATSAPP' && p.channel !== 'SMS') return false
  const conv = await prisma.conversation.findUnique({ where: { id: p.conversationId }, select: { customFields: true } })
  const fields = conv?.customFields ?? null
  const hadStep = Boolean((fields as { paymentChat?: unknown } | null)?.paymentChat)
  const finish = async (handled: boolean) => {
    if (!handled && hadStep) await setPaymentChat(p.conversationId, null)
    return handled
  }
  const method = paymentMethodFromText(p.body)
  const stars = ratingFromText(p.body)
  const partnerYes = isPartnerPaidYes(p.body)
  if (!method && !stars && !partnerYes) return finish(false)
  const user = await loadUser(p.userId)
  if (!user) return finish(false)
  const sms = p.channel === 'SMS'
  if (sms && (user.role !== 'CLIENT' || !method)) return finish(false)
  try {
    const last = await lastOutbound(p.conversationId)
    let result: { reply: string; note: string } | null = null
    if (stars && user.role === 'CLIENT') {
      const bookingId = ratingBookingId(fields, last, now)
      if (bookingId) result = await apply(user, p.conversationId, p.channel, bookingId, { kind: 'rate', stars })
    } else if (method || (partnerYes && user.role === 'PARTNER')) {
      const only = onlyCandidate(await candidates(user, p.channel, fields, last, now))
      if (only) {
        const intent = user.role === 'PARTNER' ? (method ? { kind: 'partner_method' as const, method } : { kind: 'partner_yes' as const }) : method ? { kind: 'client_report' as const, method } : null
        if (intent) result = await apply(user, p.conversationId, p.channel, only.id, intent)
      }
    }
    if (!result) return finish(false)
    await deliver(p.conversationId, result, `texto «${p.body.trim().slice(0, 60)}»`)
    return true
  } catch (err) {
    logger.warn('Payment text failed', { conversationId: p.conversationId, err: err instanceof Error ? err.message : err })
    return false
  }
}
