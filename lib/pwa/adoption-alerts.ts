import { prisma } from '@/lib/prisma'

export const DEFAULT_INSTALL_THRESHOLD = Number(process.env.PWA_INSTALL_RATE_THRESHOLD || 25)
export const DEFAULT_PUSH_THRESHOLD = Number(process.env.PWA_PUSH_OPT_IN_THRESHOLD || 45)

type OpenIncident = { id: string; type: string; lastSeenAt: Date }

/**
 * At most ONE open incident per condition type: the most recent one is kept (and refreshed) while the condition
 * lasts, every duplicate is closed, and every open incident of a type whose condition cleared is closed.
 */
export function planPwaIncidents(activeTypes: string[], open: OpenIncident[], knownTypes: string[]) {
  const keep: Record<string, string> = {}
  const resolve: string[] = []
  const sorted = [...open].sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
  for (const inc of sorted) {
    if (!knownTypes.includes(inc.type) || !activeTypes.includes(inc.type) || keep[inc.type]) resolve.push(inc.id)
    else keep[inc.type] = inc.id
  }
  return { keep, resolve }
}

/** One-off cleanup: closes every open pwa-adoption-alerts incident (the detector reopens one per condition if it still holds). */
export async function resolveAllPwaAlertIncidents(by: string) {
  const r = await prisma.adminIncident.updateMany({
    where: { source: 'pwa-adoption-alerts', status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
    data: { status: 'RESOLVED', resolvedBy: by, resolvedAt: new Date() },
  })
  return r.count
}

export async function runPwaAdoptionAlerts(options?: { installThreshold?: number; pushThreshold?: number }) {
  const installThreshold = options?.installThreshold ?? DEFAULT_INSTALL_THRESHOLD
  const pushThreshold = options?.pushThreshold ?? DEFAULT_PUSH_THRESHOLD

  const now = new Date()
  const from7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

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

  const ALL_TYPES = ['PWA_ADOPTION_INSTALL_RATE', 'PWA_ADOPTION_PUSH_OPT_IN_RATE']
  const open = await prisma.adminIncident.findMany({
    where: { source: 'pwa-adoption-alerts', status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
    select: { id: true, type: true, status: true, lastSeenAt: true },
    orderBy: { lastSeenAt: 'desc' },
  })
  const plan = planPwaIncidents(alerts.map((a) => `PWA_ADOPTION_${a.metric.toUpperCase()}`), open, ALL_TYPES)
  if (plan.resolve.length) {
    await prisma.adminIncident.updateMany({
      where: { id: { in: plan.resolve }, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
      data: { status: 'RESOLVED', resolvedBy: 'Alertas de adopción (la condición ya no se cumple o estaba repetida)', resolvedAt: now },
    })
  }

  for (const alert of alerts) {
    const type = `PWA_ADOPTION_${alert.metric.toUpperCase()}`
    const keep = plan.keep[type]
    const description = `Métrica ${alert.metric} en ${alert.rate}% (umbral ${alert.threshold}%) durante los últimos 7 días.`
    const metadata = JSON.stringify({ totalSignups, installRate, pushRate, checkedAt: now.toISOString() })

    if (keep) {
      await prisma.adminIncident.update({ where: { id: keep }, data: { occurrences: { increment: 1 }, lastSeenAt: now, description, metadata } })
      continue
    }

    await prisma.adminIncident.create({
      data: {
        type,
        severity: 'HIGH',
        status: 'OPEN',
        title: `Caída en adopción PWA (${alert.metric})`,
        description,
        source: 'pwa-adoption-alerts',
        route: '/admin/analytics?tab=app',
        metadata,
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
