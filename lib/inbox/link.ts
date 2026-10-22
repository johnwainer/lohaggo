import { prisma } from '@/lib/prisma'
import { normalizeContactAddress } from '@/lib/messaging/contact-address'

/**
 * Rules for linking a chat to a platform account by hand: never an admin (a chat reaching an admin account
 * would reach any booking), and never through a phone several active accounts share. Pure.
 */
export function linkRefusal(user: { role: string; isActive?: boolean } | null, sharedPhones: Array<{ phone: string; accounts: number }>): string | null {
  if (!user) return 'Usuario no encontrado'
  if (user.isActive === false) return 'La cuenta está desactivada'
  if (user.role !== 'CLIENT' && user.role !== 'PARTNER') return 'Solo se puede vincular una cuenta de cliente o de socio'
  const shared = sharedPhones.find((p) => p.accounts > 1)
  if (shared) return `El teléfono ${shared.phone} lo tienen ${shared.accounts} cuentas activas: corrige el duplicado antes de vincular`
  return null
}

function e164(raw: string | null | undefined) {
  const p = raw?.trim() ? normalizeContactAddress(raw) : ''
  return /^\+\d{8,15}$/.test(p) ? p : null
}

/** Throws with a message for the team when the account may not be linked (see linkRefusal). */
export async function assertLinkableUser(userId: string, ...phones: Array<string | null | undefined>) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, phone: true, isActive: true } })
  const unique = Array.from(new Set([user?.phone, ...phones].map((p) => e164(p)).filter((p): p is string => Boolean(p))))
  const sharedPhones = await Promise.all(unique.map(async (phone) => ({
    phone,
    accounts: await prisma.user.count({ where: { phone, isActive: true, role: { in: ['CLIENT', 'PARTNER'] } } }),
  })))
  const refusal = linkRefusal(user, sharedPhones)
  if (refusal) throw new Error(refusal)
  return user!
}
