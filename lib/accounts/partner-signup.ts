import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { accessLinkMessage, createAccessLink, emailAccessLink } from '@/lib/accounts/from-contact'
import { sendMessageViaProvider } from '@/lib/messaging/providers'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { toE164 } from '@/lib/inbox/contacts'

/**
 * Self sign-up of a partner from /unete: the server picks a random password nobody sees, keeps the new
 * partner signed in through a short single-use handoff token, and sends a 72 h access link (email and,
 * when there is a provider, WhatsApp) that asks for a new password on first entry.
 */

const logger = createLogger('partner-signup')

/** Minutes the browser that just registered has to exchange the handoff token for a session. */
export const SESSION_HANDOFF_TTL_MIN = 10

/** 192 random bits, URL-safe: never shown to anyone, only hashed. */
export function generateStrongPassword() {
  return randomBytes(24).toString('base64url')
}

/** Single-use, short-lived token the registering browser exchanges at /api/auth/magic/validate. */
export async function createSessionHandoffToken(userId: string) {
  const token = randomBytes(32).toString('hex')
  await prisma.magicToken.create({
    data: {
      userId,
      token,
      redirectUrl: '/partner/verification',
      requirePasswordChange: false,
      expiresAt: new Date(Date.now() + SESSION_HANDOFF_TTL_MIN * 60_000),
    },
  })
  return token
}

export type AccessLinkDelivery = { email: boolean; whatsapp: boolean }

/** Creates the access link (requirePasswordChange) and sends it; never throws. */
export async function deliverPartnerAccessLink(user: { id: string; email: string; name: string; phone?: string | null }): Promise<AccessLinkDelivery> {
  const sent: AccessLinkDelivery = { email: false, whatsapp: false }
  try {
    const { url } = await createAccessLink(user.id, 'PARTNER')
    const [mail, wa] = await Promise.allSettled([
      emailAccessLink(user.email, user.name, 'PARTNER', url),
      (async () => {
        const to = toE164(user.phone)
        if (!to) return { ok: false }
        const runtime = await getMessagingProviderRuntimeConfig()
        return sendMessageViaProvider({ channel: 'WHATSAPP', to, body: accessLinkMessage(user.name, 'PARTNER', url) }, runtime)
      })(),
    ])
    sent.email = mail.status === 'fulfilled' && mail.value.ok
    sent.whatsapp = wa.status === 'fulfilled' && Boolean(wa.value.ok)
    if (!sent.email) logger.warn('Access link email not sent', { userId: user.id, reason: mail.status === 'fulfilled' && !mail.value.ok ? mail.value.error : 'exception' })
  } catch (err) {
    logger.error('Access link could not be created', { userId: user.id, err })
  }
  return sent
}
