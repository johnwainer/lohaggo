import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { PLACEHOLDER_EMAIL_DOMAIN } from '@/lib/accounts/phone-login-core'

export const ANONYMIZED_NAME = 'Usuario eliminado'

/** Unique placeholder on the no-mail domain: nothing is ever sent to it (isPlaceholderEmail). */
export const anonymizedEmail = (userId: string) => `eliminado-${userId}@${PLACEHOLDER_EMAIL_DOMAIN}`

/**
 * Right to deletion (Ley 1581): the account stops being a person. Deactivated, name/phone/email replaced, password
 * unknowable, saved addresses, saved cards and work photos removed, partner public profile hidden. Bookings, payments,
 * payouts, bank accounts and reviews stay (tax and accounting duties) but no longer point to a name.
 * Returns what was done, for the audit log.
 */
export async function anonymizeUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, partnerProfile: { select: { id: true } } } })
  if (!user) return { ok: false as const, error: 'Usuario no encontrado' }
  if (user.role === 'ADMIN') return { ok: false as const, error: 'No se anonimizan cuentas de administrador' }

  const password = await bcrypt.hash(randomBytes(24).toString('hex'), 10)
  const partnerId = user.partnerProfile?.id ?? null

  const [addresses, cards, photos] = await prisma.$transaction([
    prisma.address.deleteMany({ where: { userId } }),
    prisma.paymentMethod.deleteMany({ where: { userId } }),
    prisma.partnerWorkPhoto.deleteMany({ where: { partnerId: partnerId ?? '__none__' } }),
    prisma.magicToken.deleteMany({ where: { userId } }),
    prisma.contact.updateMany({ where: { userId }, data: { name: ANONYMIZED_NAME, phone: null, email: null, notes: null } }),
    ...(partnerId
      ? [prisma.partnerProfile.update({ where: { id: partnerId }, data: { isActive: false, isAvailable: false, isPublicProfile: false, bio: null, profileHeadline: null, slug: null, companyName: null, companyNit: null } })]
      : []),
    prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        name: ANONYMIZED_NAME,
        email: anonymizedEmail(userId),
        phone: null,
        phoneVerifiedAt: null,
        image: null,
        password,
        pushSubscription: null,
        mercadopagoCustomerId: null,
        excludedFromMarketing: true,
        marketingConsentAt: null,
        notificationsPushEnabled: false,
        notificationsEmailEnabled: false,
        notificationsWhatsappEnabled: false,
        notificationsSmsEnabled: false,
      },
    }),
  ])
  return { ok: true as const, addresses: addresses.count, cards: cards.count, photos: photos.count }
}
