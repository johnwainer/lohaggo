import { createHash, randomInt, randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { normalizePhone, parseColombianMobile, storedPhoneVariants } from '@/lib/phone'
import { CODE_MAX_PER_WINDOW, CODE_RESEND_GAP_MS, CODE_WINDOW_MS, paceError } from '@/lib/accounts/code-rate'
import { overLimit } from '@/lib/rate-limit-store'
import { linkConfirmsPhone, whatsappLinkDecision } from '@/lib/accounts/whatsapp-trust'
import { isPlaceholderEmail } from '@/lib/accounts/phone-login-core'
import { toE164, updateContact } from '@/lib/inbox/contacts'
import { sendMessageViaProvider } from '@/lib/messaging/providers'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { maskEmail } from '@/lib/ai/platform-data'
import { extractLinkCode } from '@/lib/accounts/link-code'

/**
 * Links an inbox conversation (Messenger, Instagram, an unknown WhatsApp number…) to an existing platform
 * account with a one-time code. The code goes to a destination the account already has (its phone or its
 * email), never to the current chat, so whoever confirms it owns that account.
 *
 * Privacy: `startLink` answers exactly the same whether the account exists or not, so the chat cannot be
 * used to probe which phones or emails are registered.
 */

const logger = createLogger('accounts-link')

export const LINK_CODE_TTL_MIN = 10
export const LINK_CODE_MAX_ATTEMPTS = 3
export const LINK_CODES_PER_DAY = 3

export { maskEmail, extractLinkCode }

/** "+573001234567" → "+57•••••4567" */
export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 6) return '•••'
  const country = phone.trim().startsWith('+') ? `+${digits.slice(0, Math.max(1, digits.length - 10))}` : ''
  return `${country}•••••${digits.slice(-4)}`
}

function hashCode(code: string, id: string) {
  return createHash('sha256').update(`${code.trim()}${id}`).digest('hex')
}

export type LinkCandidate = {
  userId: string
  role: 'CLIENT' | 'PARTNER' | 'ADMIN'
  name: string
  destinations: { phone?: string; email?: string }
}

/**
 * The active account behind a phone (exact E.164) or an email. Internal: callers must not tell the person
 * whether it returned something.
 */
export async function findLinkCandidate(input: { phone?: string | null; email?: string | null }): Promise<LinkCandidate | null> {
  const phone = input.phone ? toE164(normalizePhone(input.phone)) : null
  const email = input.email?.trim().toLowerCase() || null
  const or: Array<{ phone: string } | { email: string }> = []
  if (phone) or.push({ phone })
  if (email) or.push({ email })
  if (!or.length) return null

  const user = await prisma.user.findFirst({
    // Admin accounts are never linked to a chat (they would act on every booking)
    where: { isActive: true, role: { in: ['CLIENT', 'PARTNER'] }, OR: or },
    select: { id: true, role: true, name: true, phone: true, email: true },
  })
  if (!user) return null
  const userPhone = toE164(user.phone)
  return {
    userId: user.id,
    role: user.role,
    name: user.name,
    destinations: { ...(userPhone ? { phone: userPhone } : {}), ...(user.email ? { email: user.email } : {}) },
  }
}

export type StartLinkInput = {
  conversationId: string
  contactId: string
  phone?: string | null
  email?: string | null
  via: 'phone' | 'email'
  actor: { agentId: string; agentName: string }
}

export type StartLinkResult =
  | { ok: true; sentTo: string }
  | { ok: false; code: 'limit' | 'invalid' | 'send_failed'; error: string }
  | { ok: false; code: 'wait'; retryAfterSec: number; error: string }

function linkCodeMessage(code: string) {
  return `Tu código para vincular tu cuenta LoHaggo es ${code}. Vence en ${LINK_CODE_TTL_MIN} minutos. Si no lo pediste, ignóralo.`
}

/**
 * Sends a 6-digit code to the account that has the phone/email the person gave. When no such account exists
 * (or it lacks that destination) nothing is created or sent, but the answer is identical: the person is told
 * the code went to the masked phone/email they gave. At most LINK_CODES_PER_DAY per conversation per 24 h.
 */
export async function startLink(p: StartLinkInput): Promise<StartLinkResult> {
  const given = (p.via === 'phone' ? p.phone : p.email)?.trim() || ''
  if (!given) return { ok: false, code: 'invalid', error: p.via === 'phone' ? 'Teléfono requerido' : 'Correo requerido' }
  const masked = p.via === 'phone' ? maskPhone(normalizePhone(given) ?? given) : maskEmail(given.toLowerCase())
  if (masked === '—' || masked === '•••') return { ok: false, code: 'invalid', error: p.via === 'phone' ? 'Teléfono inválido' : 'Correo inválido' }
  if (p.via === 'phone') {
    const mobile = parseColombianMobile(given)
    if (!mobile.ok && mobile.reason === 'landline') return { ok: false, code: 'invalid', error: mobile.error }
  }

  const since = new Date(Date.now() - 24 * 3600_000)
  const sentToday = await prisma.contactLinkCode.count({ where: { conversationId: p.conversationId, createdAt: { gte: since } } })
  if (sentToday >= LINK_CODES_PER_DAY) {
    return { ok: false, code: 'limit', error: `Ya se enviaron ${LINK_CODES_PER_DAY} códigos hoy en esta conversación. Intenta mañana.` }
  }
  // One per minute and three per 15 minutes, per chat and per destination. Every call counts, with or
  // without an account behind the data, so the pace never tells whether the account exists.
  const paceKey = p.via === 'phone' ? (normalizePhone(given) ?? given) : given.toLowerCase()
  const [gap, perChat, perDestination] = await Promise.all([
    overLimit(`linkcode:gap:${p.conversationId}`, CODE_RESEND_GAP_MS, 1),
    overLimit(`linkcode:win:${p.conversationId}`, CODE_WINDOW_MS, CODE_MAX_PER_WINDOW),
    overLimit(`linkcode:dest:${paceKey}`, CODE_WINDOW_MS, CODE_MAX_PER_WINDOW),
  ])
  const window = perChat.blocked ? perChat : perDestination.blocked ? perDestination : null
  if (window) return { ok: false, code: 'wait', retryAfterSec: window.retryAfterSec, error: paceError('too_many', window.retryAfterSec) }
  if (gap.blocked) return { ok: false, code: 'wait', retryAfterSec: gap.retryAfterSec, error: paceError('too_soon', gap.retryAfterSec) }

  const candidate = await findLinkCandidate(p.via === 'phone' ? { phone: given } : { email: given })
  const destination = candidate?.destinations[p.via]
  // Unknown account or no such destination: same answer, nothing stored, nothing sent
  if (!candidate || !destination) return { ok: true, sentTo: masked }

  const id = randomUUID()
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const sentTo = p.via === 'phone' ? maskPhone(destination) : maskEmail(destination)
  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MIN * 60_000)
  await prisma.contactLinkCode.create({
    data: { id, contactId: p.contactId, conversationId: p.conversationId, userId: candidate.userId, codeHash: hashCode(code, id), sentTo, expiresAt },
  })

  const runtime = await getMessagingProviderRuntimeConfig()
  let sent = false
  if (p.via === 'phone') {
    // A1 (AUTHENTICATION template) reaches the phone even outside the 24 h window; free text, then SMS, while Meta has not approved it
    const { waLinkCode } = await import('@/lib/messaging/wa-events')
    const tpl = await waLinkCode({ userId: candidate.userId, phone: destination, code, codeId: id })
    const wa = tpl?.ok ? { ok: true } : await sendMessageViaProvider({ channel: 'WHATSAPP', to: destination, body: linkCodeMessage(code) }, runtime)
    sent = wa.ok
    if (!sent) {
      const sms = await sendMessageViaProvider({ channel: 'SMS', to: destination, body: linkCodeMessage(code) }, runtime)
      sent = sms.ok
    }
  } else {
    const mail = await sendMessageViaProvider({ channel: 'EMAIL', to: destination, subject: 'Tu código para vincular tu cuenta LoHaggo', body: linkCodeMessage(code) }, runtime)
    sent = mail.ok
  }

  if (!sent) {
    await prisma.contactLinkCode.delete({ where: { id } }).catch(() => null)
    logger.warn('Link code could not be sent', { conversationId: p.conversationId, via: p.via })
    return { ok: false, code: 'send_failed', error: 'No pudimos enviar el código en este momento. Intenta más tarde.' }
  }

  logger.info('Link code sent', { conversationId: p.conversationId, via: p.via, by: p.actor.agentId })
  return { ok: true, sentTo }
}

export type ConfirmLinkResult =
  | { ok: true; userId: string; role: 'CLIENT' | 'PARTNER' | 'ADMIN'; name: string }
  | { ok: false; code: 'expired' | 'locked' | 'invalid'; error: string }
  | { ok: false; code: 'wrong'; remaining: number; error: string }


/**
 * Checks the code against the latest unused, unexpired one of the conversation. Each try counts; after
 * LINK_CODE_MAX_ATTEMPTS wrong tries the code is locked. On success the contact (and its conversations)
 * get the user, and the conversation shows an `account_linked` event.
 */
export async function confirmLink(p: { conversationId: string; contactId: string; code: string; actor?: { agentId: string; agentName: string } }): Promise<ConfirmLinkResult> {
  // Something that is not a code does not spend an attempt
  const code = extractLinkCode(p.code)
  if (!code) return { ok: false, code: 'invalid', error: 'El código son 6 dígitos.' }
  const row = await prisma.contactLinkCode.findFirst({
    where: { conversationId: p.conversationId, contactId: p.contactId, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
  if (!row) return { ok: false, code: 'expired', error: 'No hay un código vigente. Pide uno nuevo.' }

  const updated = await prisma.contactLinkCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } })
  if (updated.attempts > LINK_CODE_MAX_ATTEMPTS) return { ok: false, code: 'locked', error: 'Demasiados intentos. Pide un código nuevo.' }

  if (hashCode(code, row.id) !== row.codeHash) {
    const remaining = LINK_CODE_MAX_ATTEMPTS - updated.attempts
    if (remaining <= 0) return { ok: false, code: 'locked', error: 'Demasiados intentos. Pide un código nuevo.' }
    return { ok: false, code: 'wrong', remaining, error: `Código incorrecto. Te quedan ${remaining} ${remaining === 1 ? 'intento' : 'intentos'}.` }
  }

  const user = await prisma.user.findUnique({ where: { id: row.userId }, select: { id: true, role: true, name: true, email: true, isActive: true, phoneVerifiedAt: true } })
  if (!user?.isActive || user.role === 'ADMIN') return { ok: false, code: 'expired', error: 'La cuenta ya no está activa.' }
  // A code that went to the account's phone confirms that phone
  if (!user.phoneVerifiedAt && row.sentTo && !row.sentTo.includes('@')) {
    try { await prisma.user.update({ where: { id: user.id }, data: { phoneVerifiedAt: new Date() } }) } catch { /* the link still works */ }
  }

  await prisma.contactLinkCode.update({ where: { id: row.id }, data: { usedAt: new Date() } })
  await updateContact(p.contactId, { userId: user.id })

  const conversation = await prisma.conversation.findUnique({ where: { id: p.conversationId }, select: { id: true, workspaceId: true } })
  await prisma.conversationEvent.create({
    data: {
      conversationId: p.conversationId, type: 'account_linked', actorType: 'ai',
      actorId: p.actor?.agentId ?? null, actorName: p.actor?.agentName ?? null,
      detail: `Vinculado por código a ${maskEmail(user.email)}`,
    },
  })
  if (conversation) emitInboxEvent({ type: 'status-update', conversationId: conversation.id, workspaceId: conversation.workspaceId })

  logger.info('Conversation linked to account by code', { conversationId: p.conversationId, userId: user.id })
  return { ok: true, userId: user.id, role: user.role, name: user.name }
}

export type WhatsappLinkResult =
  | { ok: true; userId: string; role: 'CLIENT' | 'PARTNER'; name: string; already: boolean }
  | { ok: false; reason: 'not_whatsapp' | 'no_contact' | 'none' | 'ambiguous' | 'admin' | 'inactive' }

/**
 * A WhatsApp chat is the proof that the person holds that number: when exactly one active client or
 * partner account has it, the chat is linked to it without a code (as userByPhone already did when the
 * contact was created). The phone counts as confirmed (phoneVerifiedAt) only for accounts whose phone came
 * from a chat (linkConfirmsPhone). Phones stored in older formats (without +57) are found too.
 */
export async function linkByWhatsappNumber(p: { conversationId: string; actor?: { agentId: string; agentName: string } }): Promise<WhatsappLinkResult> {
  const conv = await prisma.conversation.findUnique({ where: { id: p.conversationId }, select: { id: true, workspaceId: true, channel: true, contactPhone: true, contactId: true, userId: true } })
  if (!conv || conv.channel !== 'WHATSAPP') return { ok: false, reason: 'not_whatsapp' }
  const phone = toE164(conv.contactPhone)
  if (!phone) return { ok: false, reason: 'not_whatsapp' }
  if (!conv.contactId) return { ok: false, reason: 'no_contact' }

  if (conv.userId) {
    const linked = await prisma.user.findUnique({ where: { id: conv.userId }, select: { id: true, role: true, name: true, phone: true, email: true, isActive: true, phoneVerifiedAt: true, acquisition: true } })
    if (!linked || linked.role === 'ADMIN') return { ok: false, reason: 'admin' }
    if (!linked.isActive) return { ok: false, reason: 'inactive' }
    if (!linked.phoneVerifiedAt && toE164(normalizePhone(linked.phone)) === phone && linkConfirmsPhone(linked, isPlaceholderEmail)) {
      await prisma.user.update({ where: { id: linked.id }, data: { phoneVerifiedAt: new Date() } }).catch(() => null)
    }
    return { ok: true, userId: linked.id, role: linked.role, name: linked.name, already: true }
  }

  const accounts = await prisma.user.findMany({ where: { phone: { in: storedPhoneVariants(phone) } }, select: { id: true, role: true, isActive: true, name: true, email: true, phoneVerifiedAt: true, acquisition: true }, take: 3 })
  const decision = whatsappLinkDecision(accounts)
  if (!decision.link) return { ok: false, reason: decision.reason }
  const user = accounts.find((a) => a.id === decision.userId)!

  await updateContact(conv.contactId, { userId: user.id })
  // The stored phone takes the canonical form so the rest of the platform (templates, login) finds it
  await prisma.user.update({ where: { id: user.id }, data: { phone, ...(!user.phoneVerifiedAt && linkConfirmsPhone(user, isPlaceholderEmail) ? { phoneVerifiedAt: new Date() } : {}) } }).catch(() => null)
  await prisma.conversationEvent.create({
    data: {
      conversationId: conv.id, type: 'account_linked', actorType: p.actor ? 'ai' : 'system',
      actorId: p.actor?.agentId ?? null, actorName: p.actor?.agentName ?? null,
      detail: `Vinculado por su número de WhatsApp a ${maskEmail(user.email)}`,
    },
  }).catch(() => null)
  emitInboxEvent({ type: 'status-update', conversationId: conv.id, workspaceId: conv.workspaceId })
  logger.info('Conversation linked to account by WhatsApp number', { conversationId: conv.id, userId: user.id })
  return { ok: true, userId: user.id, role: user.role as 'CLIENT' | 'PARTNER', name: user.name, already: false }
}
