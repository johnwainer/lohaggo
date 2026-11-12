import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { generateReferralCode, normalizeReferralCode, qualifiesReferral, rewardFor } from '@/lib/referrals/core'

const logger = createLogger('referrals')

/** The person's referral code, created on first use. */
export async function ensureReferralCode(userId: string) {
  const existing = await prisma.referralCode.findUnique({ where: { userId } })
  if (existing) return existing
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await prisma.referralCode.create({ data: { userId, code: generateReferralCode() } })
    } catch (err) {
      // Unique conflict on code (retry) or on userId (another request created it first)
      const again = await prisma.referralCode.findUnique({ where: { userId } })
      if (again) return again
      if (attempt === 5) throw err
    }
  }
  throw new Error('No se pudo crear el código de referido')
}

/** Links a new account to whoever's ?ref= brought it. Never throws for bad input: no code, own code, unknown code = nothing. */
export async function attachReferral(referredId: string, rawCode: unknown) {
  const code = normalizeReferralCode(rawCode)
  if (!code) return null
  const owner = await prisma.referralCode.findUnique({ where: { code }, select: { userId: true } })
  if (!owner || owner.userId === referredId) return null
  const done = await prisma.referral.findUnique({ where: { referredId }, select: { id: true } })
  if (done) return null
  const referral = await prisma.referral.create({ data: { referrerId: owner.userId, referredId } })
  await prisma.user.update({ where: { id: referredId }, data: { referredByUserId: owner.userId } })
  return referral
}

/**
 * Qualifies pending referrals whose referred person has a first booking completed and paid, credits the
 * referrer's counter (partners also get the priority-notification flag) and tells them. Idempotent: only
 * PENDING rows move, with a status-guarded update.
 */
export async function qualifyReferrals(now = new Date(), limit = 200) {
  const pending = await prisma.referral.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' }, take: limit, select: { id: true, referrerId: true, referredId: true, referrer: { select: { role: true, name: true } } } })
  let qualified = 0
  for (const r of pending) {
    const first = await prisma.booking.findFirst({
      where: { userId: r.referredId },
      orderBy: { createdAt: 'asc' },
      select: { status: true, payment: { select: { status: true, confirmationStatus: true } } },
    })
    if (!first || !qualifiesReferral({ bookingStatus: first.status, payment: first.payment })) continue
    const claimed = await prisma.referral.updateMany({ where: { id: r.id, status: 'PENDING' }, data: { status: 'QUALIFIED', qualifiedAt: now } })
    if (claimed.count !== 1) continue
    const code = await ensureReferralCode(r.referrerId)
    const reward = rewardFor(r.referrer.role, code.qualifiedCount)
    await prisma.referralCode.update({ where: { id: code.id }, data: { qualifiedCount: { increment: 1 }, ...(reward.priorityNotifications ? { priorityNotifications: true } : {}) } })
    qualified++
    try {
      const { createNotification } = await import('@/lib/notifications/notificationService')
      await createNotification({
        userId: r.referrerId,
        type: 'ACHIEVEMENT_UNLOCKED',
        title: 'Tu referido completó su primer servicio',
        message: `Gracias por recomendar LoHaggo. Ya llevas ${reward.qualifiedCount} ${reward.qualifiedCount === 1 ? 'referido' : 'referidos'} que completaron su primer servicio.`,
        data: { url: r.referrer.role === 'PARTNER' ? '/partner' : '/dashboard', referralId: r.id },
        channels: ['PUSH'],
      })
    } catch (err) {
      logger.warn('Referral notice failed', { referralId: r.id, err: err instanceof Error ? err.message : err })
    }
  }
  return { checked: pending.length, qualified }
}
