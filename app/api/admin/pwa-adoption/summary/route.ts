import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { prisma } from '@/lib/prisma'

function dayKey(value: Date) {
  return value.toISOString().slice(0, 10)
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const from30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [users30d, events30d] = await Promise.all([
    prisma.user.findMany({
      where: { createdAt: { gte: from30d }, role: { in: ['CLIENT', 'PARTNER'] } },
      select: { id: true, role: true, createdAt: true },
    }),
    prisma.pwaTelemetryEvent.findMany({
      where: { createdAt: { gte: from30d } },
      select: { userId: true, eventName: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
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

  return NextResponse.json({
    generatedAt: now.toISOString(),
    rangeDays: 30,
    summary: {
      signups: totalSignups,
      installedUsers: installedUsers.size,
      pushOptInUsers: pushOptInUsers.size,
      installRate,
      pushOptInRate,
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
    daily: Array.from(dailyMap.values()),
  })
}
