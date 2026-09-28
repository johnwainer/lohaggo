/**
 * Access links a person asks for (web «recibir enlace» or the chat): a single-use MagicToken sent to the
 * account's own WhatsApp (templates B2 / C2) or, when that phone was never confirmed, to the account's
 * email. Never to a number or address the requester typed, so asking for someone else's link gives nothing.
 */
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { sendMessageViaProvider } from '@/lib/messaging/providers'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { isPlaceholderEmail } from '@/lib/accounts/phone-login-core'

const logger = createLogger('access-link')

/** C2 says 72 h; the client's link lives the same so both templates tell the truth. */
export const ACCESS_LINK_TTL_H = 72
export const ACCESS_LINKS_PER_USER_HOUR = 3

const escapeHtml = (v: string) => v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://www.lohaggo.com').replace(/\/+$/, '')

export type AccessLinkOutcome = { ok: true; via: 'whatsapp' | 'email' } | { ok: false; reason: 'not_eligible' | 'limit' | 'failed' }

/**
 * Sends the account its access link. `phoneTrusted`: the request itself proves the phone (a WhatsApp chat
 * from that number); otherwise the phone must have been confirmed before (phoneVerifiedAt) or the account
 * was born from a phone (placeholder email).
 */
export async function sendAccessLink(userId: string, opts: { phoneTrusted?: boolean } = {}): Promise<AccessLinkOutcome> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, phoneVerifiedAt: true } })
  if (!user || !user.isActive || (user.role !== 'CLIENT' && user.role !== 'PARTNER')) return { ok: false, reason: 'not_eligible' }
  const recent = await prisma.magicToken.count({ where: { userId, requirePasswordChange: false, createdAt: { gte: new Date(Date.now() - 3600_000) } } })
  if (recent >= ACCESS_LINKS_PER_USER_HOUR) return { ok: false, reason: 'limit' }

  const placeholder = isPlaceholderEmail(user.email)
  const byWhatsapp = Boolean(user.phone) && (opts.phoneTrusted || Boolean(user.phoneVerifiedAt) || placeholder)
  if (!byWhatsapp && placeholder) return { ok: false, reason: 'not_eligible' }

  const token = randomBytes(32).toString('hex')
  const row = await prisma.magicToken.create({
    data: { userId, token, redirectUrl: user.role === 'PARTNER' ? '/partner' : '/dashboard', requirePasswordChange: false, expiresAt: new Date(Date.now() + ACCESS_LINK_TTL_H * 3600_000) },
  })
  const suffix = `auth/magic?token=${token}`

  if (byWhatsapp) {
    const { waAccessLink } = await import('@/lib/messaging/wa-events')
    const res = await waAccessLink({ userId, role: user.role as 'CLIENT' | 'PARTNER', name: user.name, suffix, tokenId: row.id })
    if (res?.ok) return { ok: true, via: 'whatsapp' }
    if (placeholder) {
      await prisma.magicToken.delete({ where: { id: row.id } }).catch(() => null)
      return { ok: false, reason: 'failed' }
    }
  }

  const runtime = await getMessagingProviderRuntimeConfig()
  const url = `${appUrl()}/${suffix}`
  const body = [
    `Hola ${escapeHtml(user.name.split(' ')[0] || '')},`,
    '',
    'Pediste un enlace para entrar a tu cuenta de LoHaggo:',
    '',
    `<a href="${url}">Entrar a LoHaggo</a>`,
    '',
    `Vence en ${ACCESS_LINK_TTL_H} horas y solo sirve una vez. Si no lo pediste, ignora este correo: nadie puede entrar sin abrirlo.`,
  ].join('<br>')
  const mail = await sendMessageViaProvider({ channel: 'EMAIL', to: user.email, subject: 'Tu enlace para entrar a LoHaggo', body }, runtime)
  if (!mail.ok) {
    await prisma.magicToken.delete({ where: { id: row.id } }).catch(() => null)
    logger.warn('Access link not sent', { userId, error: mail.errorMessage })
    return { ok: false, reason: 'failed' }
  }
  return { ok: true, via: 'email' }
}
