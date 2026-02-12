import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { getOperationalMetrics } from '@/lib/monitoring-metrics'
import { prisma } from '@/lib/prisma'
import { ensureDefaultOperationalRules } from '@/lib/admin-defaults'

export async function POST() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureDefaultOperationalRules()
  const [rules, ops] = await Promise.all([
    prisma.operationalRule.findMany({ where: { enabled: true } }),
    Promise.resolve(getOperationalMetrics(1)),
  ])

  const summary = {
    created: 0,
    checked: rules.length,
  }

  for (const rule of rules) {
    const count =
      rule.key === 'auth_session_429_spike'
        ? ops.last5Minutes.authSession429
        : rule.key === 'login_failures_spike'
          ? ops.last5Minutes.loginFailures
          : rule.key === 'api_errors_spike'
            ? ops.last5Minutes.apiErrors
            : 0

    if (count < rule.threshold) continue

    const existing = await prisma.adminIncident.findFirst({
      where: { type: rule.key, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
      orderBy: { createdAt: 'desc' },
    })

    if (existing) continue

    await prisma.adminIncident.create({
      data: {
        type: rule.key,
        severity: 'CRITICAL',
        title: `Alerta automática: ${rule.name}`,
        description: `${count} eventos detectados en ventana de ${rule.windowMinutes}m`,
        source: 'automation',
        route: '/api/auth/session',
        metadata: JSON.stringify({ count, threshold: rule.threshold }),
      },
    })
    summary.created += 1
  }

  return NextResponse.json(summary)
}
