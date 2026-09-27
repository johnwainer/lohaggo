/**
 * Login link asked for from a chat. It always goes to the email stored on the account, never to the chat:
 * whoever opens it proves they own that inbox, so a person writing from someone else's phone gets
 * nothing they can use. Same MagicToken as the rest of the platform (single use), but short-lived and
 * without forcing a new password. When the chat is not linked the answer is the same whether the account
 * exists or not.
 */
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { sendMessageViaProvider } from '@/lib/messaging/providers'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { findLinkCandidate } from '@/lib/accounts/link'
import { maskEmail } from '@/lib/ai/platform-data'

const logger = createLogger('login-link')

export const LOGIN_LINK_TTL_MIN = 60
/** Per conversation per 24 h, and per account per hour (a chat cannot flood someone's inbox). */
export const LOGIN_LINKS_PER_CONVERSATION_DAY = 3
export const LOGIN_LINKS_PER_USER_HOUR = 3

const escapeHtml = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://www.lohaggo.com').replace(/\/+$/, '')
}

export type LoginLinkResult =
  | { ok: true; sentTo: string | null }
  | { ok: false; code: 'limit' | 'invalid' | 'email_off' | 'failed'; error: string }

/**
 * `userId` when the conversation is linked (the account is known); otherwise the phone or email the
 * person gave. Only clients and partners with an active account and an email get a link.
 */
export async function sendLoginLinkFromChat(p: { conversationId: string; userId: string | null; given?: string | null; actor: { id: string; name: string } }): Promise<LoginLinkResult> {
  const since = new Date(Date.now() - 24 * 3600_000)
  const sentToday = await prisma.conversationEvent.count({ where: { conversationId: p.conversationId, type: 'login_link', createdAt: { gte: since } } })
  if (sentToday >= LOGIN_LINKS_PER_CONVERSATION_DAY) return { ok: false, code: 'limit', error: `Ya se enviaron ${LOGIN_LINKS_PER_CONVERSATION_DAY} enlaces hoy desde esta conversación.` }

  let userId = p.userId
  let masked: string | null = null
  if (!userId) {
    const given = p.given?.trim() || ''
    if (!given) return { ok: false, code: 'invalid', error: 'Falta el correo o el teléfono con el que se registró.' }
    const isEmail = given.includes('@')
    masked = isEmail ? maskEmail(given.toLowerCase()) : null
    const candidate = await findLinkCandidate(isEmail ? { email: given } : { phone: given })
    userId = candidate?.userId ?? null
  }

  await prisma.conversationEvent.create({
    data: { conversationId: p.conversationId, type: 'login_link', actorType: 'ai', actorId: p.actor.id, actorName: p.actor.name, detail: p.userId ? 'Enlace de acceso a la cuenta vinculada' : 'Enlace de acceso pedido con datos de la persona' },
  })

  const user = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true, isActive: true } }) : null
  const eligible = user && user.isActive && user.email && (user.role === 'CLIENT' || user.role === 'PARTNER')
  // Unknown or not eligible: identical answer when the chat is not linked, nothing sent
  if (!eligible) return p.userId ? { ok: false, code: 'invalid', error: 'Esta cuenta no puede recibir enlaces de acceso.' } : { ok: true, sentTo: masked }

  const recent = await prisma.magicToken.count({ where: { userId: user.id, requirePasswordChange: false, createdAt: { gte: new Date(Date.now() - 3600_000) } } })
  if (recent >= LOGIN_LINKS_PER_USER_HOUR) return p.userId ? { ok: false, code: 'limit', error: 'Ya se enviaron varios enlaces a esta cuenta en la última hora.' } : { ok: true, sentTo: masked }

  const runtime = await getMessagingProviderRuntimeConfig()
  if (!runtime.sendgrid?.active) return { ok: false, code: 'email_off', error: 'El correo no está configurado.' }

  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + LOGIN_LINK_TTL_MIN * 60_000)
  await prisma.magicToken.create({
    data: { userId: user.id, token, redirectUrl: user.role === 'PARTNER' ? '/partner' : '/dashboard', requirePasswordChange: false, expiresAt },
  })
  const url = `${appUrl()}/auth/magic?token=${token}`
  const first = escapeHtml(user.name.split(' ')[0] || '')
  const body = [
    `Hola ${first},`,
    '',
    'Pediste por chat un enlace para entrar a tu cuenta de LoHaggo. Úsalo desde este correo:',
    '',
    `<a href="${url}">Entrar a LoHaggo</a>`,
    '',
    `Vence en ${LOGIN_LINK_TTL_MIN} minutos y solo sirve una vez. Si no lo pediste, ignora este correo: nadie puede entrar sin abrirlo.`,
  ].join('<br>')
  const res = await sendMessageViaProvider({ channel: 'EMAIL', to: user.email!, subject: 'Tu enlace para entrar a LoHaggo', body }, runtime)
  if (!res.ok) {
    logger.warn('Login link email failed', { userId: user.id, error: res.errorMessage })
    return { ok: false, code: 'failed', error: 'No se pudo enviar el correo.' }
  }
  return { ok: true, sentTo: p.userId ? maskEmail(user.email!) : masked }
}
