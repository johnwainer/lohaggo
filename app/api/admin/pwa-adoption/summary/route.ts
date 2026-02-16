import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { prisma } from '@/lib/prisma'

function dayKey(value: Date) {
  return value.toISOString().slice(0, 10)
}

type VariantStats = {
  signups: number
  installs: number
  pushOptIns: number
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const from30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [users30d, events30d, profiles30d, outreachCandidates] = await Promise.all([
    prisma.user.findMany({
      where: { createdAt: { gte: from30d }, role: { in: ['CLIENT', 'PARTNER'] } },
      select: { id: true, role: true, createdAt: true },
    }),
    prisma.pwaTelemetryEvent.findMany({
      where: { createdAt: { gte: from30d } },
      select: { userId: true, eventName: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.pwaAdoptionProfile.findMany({
      where: {
        user: {
          createdAt: { gte: from30d },
          role: { in: ['CLIENT', 'PARTNER'] },
        },
      },
      select: {
        userId: true,
        abVariant: true,
        installedAt: true,
        pushEnabledAt: true,
      },
    }),
    prisma.user.findMany({
      where: {
        role: { in: ['CLIENT', 'PARTNER'] },
        createdAt: { lte: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },
        pwaAdoptionProfile: {
          installedAt: null,
          promptAttemptsWindow: { gte: 2 },
        },
      },
      select: { id: true, role: true },
      take: 500,
    }),
  ])

  const userIds = new Set(users30d.map((user) => user.id))

  const installedUsers = new Set<string>()
  const pushOptInUsers = new Set<string>()

  const installsByRole = { CLIENT: 0, PARTNER: 0 }
  const pushByRole = { CLIENT: 0, PARTNER: 0 }

  const dailyMap = new Map<string, { date: string; signups: number; installs: number; pushOptIns: number }>()
  for (let i = 0; i < 30; i += 1) {
    const date = new Date(now.getTime() - (29 - i) * 24 * 60 * 60 * 1000)
    const key = dayKey(date)
    dailyMap.set(key, { date: key, signups: 0, installs: 0, pushOptIns: 0 })
  }

  for (const user of users30d) {
    const key = dayKey(user.createdAt)
    const bucket = dailyMap.get(key)
    if (bucket) bucket.signups += 1
  }

  for (const event of events30d) {
    const key = dayKey(event.createdAt)
    const bucket = dailyMap.get(key)

    if (event.eventName === 'pwa_installed' && event.userId && userIds.has(event.userId)) {
      installedUsers.add(event.userId)
      if (event.role === 'CLIENT') installsByRole.CLIENT += 1
      if (event.role === 'PARTNER') installsByRole.PARTNER += 1
      if (bucket) bucket.installs += 1
    }

    if (event.eventName === 'push_subscription_created' && event.userId && userIds.has(event.userId)) {
      pushOptInUsers.add(event.userId)
      if (event.role === 'CLIENT') pushByRole.CLIENT += 1
      if (event.role === 'PARTNER') pushByRole.PARTNER += 1
      if (bucket) bucket.pushOptIns += 1
    }
  }

  const totalSignups = users30d.length
  const installRate = totalSignups === 0 ? 0 : Number(((installedUsers.size / totalSignups) * 100).toFixed(2))
  const pushOptInRate = totalSignups === 0 ? 0 : Number(((pushOptInUsers.size / totalSignups) * 100).toFixed(2))

  const clientSignups = users30d.filter((user) => user.role === 'CLIENT').length
  const partnerSignups = users30d.filter((user) => user.role === 'PARTNER').length

  const nowMs = now.getTime()
  const usersWithProfile = users30d
    .map((user) => {
      const profile = profiles30d.find((item) => item.userId === user.id)
      return { user, profile }
    })
    .filter((item) => Boolean(item.profile))

  const signupsD0 = usersWithProfile.filter((item) => nowMs - item.user.createdAt.getTime() <= 24 * 60 * 60 * 1000).length
  const installedD0 = usersWithProfile.filter(
    (item) =>
      nowMs - item.user.createdAt.getTime() <= 24 * 60 * 60 * 1000 &&
      item.profile?.installedAt &&
      item.profile.installedAt.getTime() - item.user.createdAt.getTime() <= 24 * 60 * 60 * 1000
  ).length

  const signupsD7Eligible = usersWithProfile.filter((item) => nowMs - item.user.createdAt.getTime() >= 7 * 24 * 60 * 60 * 1000).length
  const installedD7 = usersWithProfile.filter(
    (item) =>
      nowMs - item.user.createdAt.getTime() >= 7 * 24 * 60 * 60 * 1000 &&
      item.profile?.installedAt &&
      item.profile.installedAt.getTime() - item.user.createdAt.getTime() <= 7 * 24 * 60 * 60 * 1000
  ).length

  const variantStats: Record<string, VariantStats> = {
    A: { signups: 0, installs: 0, pushOptIns: 0 },
    B: { signups: 0, installs: 0, pushOptIns: 0 },
  }

  for (const item of usersWithProfile) {
    const variant = item.profile?.abVariant === 'B' ? 'B' : 'A'
    variantStats[variant].signups += 1
    if (item.profile?.installedAt) variantStats[variant].installs += 1
    if (item.profile?.pushEnabledAt) variantStats[variant].pushOptIns += 1
  }

  return NextResponse.json({
    generatedAt: now.toISOString(),
    rangeDays: 30,
    summary: {
      signups: totalSignups,
      installedUsers: installedUsers.size,
      pushOptInUsers: pushOptInUsers.size,
      installRate,
      pushOptInRate,
      installRateD0: signupsD0 === 0 ? 0 : Number(((installedD0 / signupsD0) * 100).toFixed(2)),
      installRateD7: signupsD7Eligible === 0 ? 0 : Number(((installedD7 / signupsD7Eligible) * 100).toFixed(2)),
      signupsD0,
      signupsD7Eligible,
      outreachCandidates: outreachCandidates.length,
      outreachCandidatesClient: outreachCandidates.filter((item) => item.role === 'CLIENT').length,
      outreachCandidatesPartner: outreachCandidates.filter((item) => item.role === 'PARTNER').length,
    },
    byRole: {
      CLIENT: {
        signups: clientSignups,
        installs: installsByRole.CLIENT,
        pushOptIns: pushByRole.CLIENT,
      },
      PARTNER: {
        signups: partnerSignups,
        installs: installsByRole.PARTNER,
        pushOptIns: pushByRole.PARTNER,
      },
    },
    byVariant: {
      A: {
        ...variantStats.A,
        installRate: variantStats.A.signups === 0 ? 0 : Number(((variantStats.A.installs / variantStats.A.signups) * 100).toFixed(2)),
        pushOptInRate: variantStats.A.signups === 0 ? 0 : Number(((variantStats.A.pushOptIns / variantStats.A.signups) * 100).toFixed(2)),
      },
      B: {
        ...variantStats.B,
        installRate: variantStats.B.signups === 0 ? 0 : Number(((variantStats.B.installs / variantStats.B.signups) * 100).toFixed(2)),
        pushOptInRate: variantStats.B.signups === 0 ? 0 : Number(((variantStats.B.pushOptIns / variantStats.B.signups) * 100).toFixed(2)),
      },
    },
    daily: Array.from(dailyMap.values()),
  })
}
