import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { PLACEHOLDER_EMAIL_DOMAIN } from '@/lib/accounts/phone-login-core'
import { maskAccountNumber } from '@/lib/admin/pagination'

export const ANONYMIZED_NAME = 'Usuario eliminado'

/** Unique placeholder on the no-mail domain: nothing is ever sent to it (isPlaceholderEmail). */
export const anonymizedEmail = (userId: string) => `eliminado-${userId}@${PLACEHOLDER_EMAIL_DOMAIN}`

export const DELETED_MESSAGE = '[Mensaje eliminado a solicitud del titular]'
export const DELETED_DOCUMENT_NOTE = 'Archivo eliminado a solicitud del titular (Ley 1581)'

/** Why an account cannot be anonymized yet (pure: counts in, admin-facing messages out). */
export function anonymizeBlockers(c: { activeBookings: number; unsettledPayments: number; unsettledPayouts: number }): string[] {
  const out: string[] = []
  if (c.activeBookings > 0) out.push(`tiene ${c.activeBookings} reserva(s) activa(s) (pendiente, confirmada o en curso)`)
  if (c.unsettledPayments > 0) out.push(`tiene ${c.unsettledPayments} pago(s) sin liquidar`)
  if (c.unsettledPayouts > 0) out.push(`tiene ${c.unsettledPayouts} pago(s) al socio sin liquidar`)
  return out
}

export function anonymizeRefusal(blockers: string[]): string | null {
  return blockers.length ? `No se puede anonimizar todavía: la cuenta ${blockers.join(', ')}. Resuélvelo o espera a que termine y vuelve a intentarlo.` : null
}

const ACTIVE = ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] as const

async function countBlockers(userId: string, partnerId: string | null) {
  const who = [{ userId }, ...(partnerId ? [{ partnerId }] : [])]
  const [activeBookings, unsettledPayments, unsettledPayouts] = await Promise.all([
    prisma.booking.count({ where: { status: { in: [...ACTIVE] }, OR: who } }),
    prisma.payment.count({ where: { status: 'PENDING', OR: [{ userId }, ...(partnerId ? [{ booking: { partnerId } }] : [])] } }),
    partnerId ? prisma.payout.count({ where: { partnerId, status: { in: ['PENDING', 'PROCESSING'] } } }) : Promise.resolve(0),
  ])
  return { activeBookings, unsettledPayments, unsettledPayouts }
}

/**
 * Right to deletion (Ley 1581): the account stops being a person. Refused while there are active bookings or unsettled
 * payments/payouts. Removed: name/phone/email/photo (replaced), password, saved addresses and cards, work photos, partner
 * public profile, verification document files (row kept for audit, URL emptied), bank holder data and account number
 * (masked), WhatsApp/chat contact name and phone and the messages the contact wrote. Retained (tax and accounting
 * duties, without contact data): bookings, payments, payouts and reviews.
 * Returns what was done, for the audit log.
 */
export async function anonymizeUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, phone: true, partnerProfile: { select: { id: true } } } })
  if (!user) return { ok: false as const, error: 'Usuario no encontrado' }
  if (user.role === 'ADMIN') return { ok: false as const, error: 'No se anonimizan cuentas de administrador' }

  const blockers = anonymizeBlockers(await countBlockers(userId, user.partnerProfile?.id ?? null))
  const refusal = anonymizeRefusal(blockers)
  if (refusal) return { ok: false as const, error: refusal }

  const password = await bcrypt.hash(randomBytes(24).toString('hex'), 10)
  const partnerId = user.partnerProfile?.id ?? null

  const phoneVariants = user.phone ? [user.phone, user.phone.replace(/^\+/, '')] : []
  const convs = await prisma.conversation.findMany({ where: { OR: [{ userId }, ...(phoneVariants.length ? [{ contactPhone: { in: phoneVariants } }] : [])] }, select: { id: true } })
  const convIds = convs.map((c) => c.id)
  const banks = partnerId ? await prisma.partnerBankAccount.findMany({ where: { partnerId }, select: { id: true, accountNumber: true, holderDocumentNumber: true } }) : []

  const [addresses, cards, photos, docs] = await prisma.$transaction([
    prisma.address.deleteMany({ where: { userId } }),
    prisma.paymentMethod.deleteMany({ where: { userId } }),
    prisma.partnerWorkPhoto.deleteMany({ where: { partnerId: partnerId ?? '__none__' } }),
    prisma.verificationDocument.updateMany({ where: { partnerId: partnerId ?? '__none__' }, data: { documentUrl: '', publicId: null, rejectionReason: DELETED_DOCUMENT_NOTE } }),
    prisma.magicToken.deleteMany({ where: { userId } }),
    ...convs.map((c) => prisma.conversation.update({ where: { id: c.id }, data: { contactName: ANONYMIZED_NAME, contactPhone: `eliminado-${c.id}`, lastMessageBody: null, aiSummary: null, postCaption: null } })),
    prisma.conversationMessage.updateMany({ where: { conversationId: { in: convIds }, direction: 'INBOUND' }, data: { body: DELETED_MESSAGE, mediaUrl: null, mediaName: null } }),
    ...banks.map((b) => prisma.partnerBankAccount.update({ where: { id: b.id }, data: { accountNumber: maskAccountNumber(b.accountNumber) ?? '', accountHolderName: ANONYMIZED_NAME, holderDocumentNumber: maskAccountNumber(b.holderDocumentNumber) ?? '', isActive: false, isDefault: false, mercadoPagoRecipientId: null } })),
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
  return { ok: true as const, addresses: addresses.count, cards: cards.count, photos: photos.count, documents: docs.count, conversations: convIds.length, bankAccounts: banks.length }
}
