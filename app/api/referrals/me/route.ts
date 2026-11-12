import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureReferralCode } from '@/lib/referrals/service'
import { referralLink, referralShareText } from '@/lib/referrals/core'

export const dynamic = 'force-dynamic'

/** The signed-in client or partner's referral code, links and counters. */
export async function GET() {
  const session = await getServerSession(authOptions)
  const role = session?.user?.role
  const userId = session?.user?.id
  if (!userId || (role !== 'CLIENT' && role !== 'PARTNER')) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const code = await ensureReferralCode(userId)
  const [pending, name] = await Promise.all([
    prisma.referral.count({ where: { referrerId: userId, status: 'PENDING' } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ])
  const audience = role === 'PARTNER' ? 'PARTNER' : 'CLIENT'
  const link = referralLink(code.code, audience)
  return NextResponse.json({
    code: code.code,
    audience,
    link,
    shareText: referralShareText(name?.name, link, audience),
    qualified: code.qualifiedCount,
    pending,
    priority: code.priorityNotifications,
  })
}
