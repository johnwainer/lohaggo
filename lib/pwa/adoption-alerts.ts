import { prisma } from '@/lib/prisma'

export const DEFAULT_INSTALL_THRESHOLD = Number(process.env.PWA_INSTALL_RATE_THRESHOLD || 25)
export const DEFAULT_PUSH_THRESHOLD = Number(process.env.PWA_PUSH_OPT_IN_THRESHOLD || 45)

export async function runPwaAdoptionAlerts(options?: { installThreshold?: number; pushThreshold?: number }) {
  const installThreshold = options?.installThreshold ?? DEFAULT_INSTALL_THRESHOLD
  const pushThreshold = options?.pushThreshold ?? DEFAULT_PUSH_THRESHOLD

  const now = new Date()
  const from7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const dedupeFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const signups = await prisma.user.findMany({
    where: { createdAt: { gte: from7d }, role: { in: ['CLIENT', 'PARTNER'] } },
    select: { id: true },
  })

  const userIds = new Set(signups.map((user) => user.id))

  const [installEvents, pushEvents] = await Promise.all([
    prisma.pwaTelemetryEvent.findMany({
      where: { createdAt: { gte: from7d }, eventName: 'pwa_installed' },
      select: { userId: true },
    }),
    prisma.pwaTelemetryEvent.findMany({
      where: { createdAt: { gte: from7d }, eventName: 'push_subscription_created' },
      select: { userId: true },
    }),
  ])

  const installUsers = new Set(
    installEvents.map((event) => event.userId).filter((id): id is string => Boolean(id) && userIds.has(id as string))
  )
  const pushUsers = new Set(
    pushEvents.map((event) => event.userId).filter((id): id is string => Boolean(id) && userIds.has(id as string))
  )

  const totalSignups = signups.length
  const installRate = totalSignups === 0 ? 0 : Number(((installUsers.size / totalSignups) * 100).toFixed(2))
  const pushRate = totalSignups === 0 ? 0 : Number(((pushUsers.size / totalSignups) * 100).toFixed(2))

  const alerts: Array<{ metric: string; rate: number; threshold: number }> = []
  if (totalSignups > 0 && installRate < installThreshold) {
    alerts.push({ metric: 'install_rate', rate: installRate, threshold: installThreshold })
  }
  if (totalSignups > 0 && pushRate < pushThreshold) {
    alerts.push({ metric: 'push_opt_in_rate', rate: pushRate, threshold: pushThreshold })
  }

  for (const alert of alerts) {
    const type = `PWA_ADOPTION_${alert.metric.toUpperCase()}`
    const existing = await prisma.adminIncident.findFirst({
      where: {
        type,
        status: { in: ['OPEN', 'ACKNOWLEDGED'] },
        lastSeenAt: { gte: dedupeFrom },
      },
      orderBy: { lastSeenAt: 'desc' },
    })

    if (existing) {
      await prisma.adminIncident.update({
        where: { id: existing.id },
        data: {
          occurrences: { increment: 1 },
          lastSeenAt: now,
          description: `Métrica ${alert.metric} en ${alert.rate}% (umbral ${alert.threshold}%) durante los últimos 7 días.`,
          metadata: JSON.stringify({ totalSignups, installRate, pushRate, checkedAt: now.toISOString() }),
        },
      })
      continue
    }

    await prisma.adminIncident.create({
      data: {
        type,
        severity: 'HIGH',
        status: 'OPEN',
        title: `Caída en adopción PWA (${alert.metric})`,
        description: `Métrica ${alert.metric} en ${alert.rate}% (umbral ${alert.threshold}%) durante los últimos 7 días.`,
        source: 'pwa-adoption-alerts',
        route: '/admin/pwa-adoption',
        metadata: JSON.stringify({ totalSignups, installRate, pushRate, checkedAt: now.toISOString() }),
        occurrences: 1,
        firstSeenAt: now,
        lastSeenAt: now,
      },
    })
  }

  return {
    thresholds: { installRate: installThreshold, pushOptInRate: pushThreshold },
    metrics: { totalSignups, installRate, pushRate },
    alertsTriggered: alerts.length,
  }
}
