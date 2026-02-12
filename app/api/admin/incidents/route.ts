import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, auditAdminAction } from '@/lib/admin-utils'
import { getOperationalMetrics } from '@/lib/monitoring-metrics'
import { ensureDefaultOperationalRules } from '@/lib/admin-defaults'

const metricKeyToType: Record<string, string> = {
  authSession429: 'auth_session_429_spike',
  loginFailures: 'login_failures_spike',
  apiErrors: 'api_errors_spike',
}

const metricKeyToLabel: Record<string, string> = {
  authSession429: '429 en sesión',
  loginFailures: 'fallos de login',
  apiErrors: 'errores API',
}

async function triggerAutomation(adminEmail: string | null) {
  await ensureDefaultOperationalRules()
  const [rules, ops] = await Promise.all([
    prisma.operationalRule.findMany({ where: { enabled: true } }),
    Promise.resolve(getOperationalMetrics(1)),
  ])

  const created: string[] = []

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
      where: {
        type: rule.key,
        status: { in: ['OPEN', 'ACKNOWLEDGED'] },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (existing) {
      await prisma.adminIncident.update({
        where: { id: existing.id },
        data: {
          occurrences: { increment: 1 },
          lastSeenAt: new Date(),
          metadata: JSON.stringify({ count, threshold: rule.threshold }),
        },
      })
      continue
    }

    const incident = await prisma.adminIncident.create({
      data: {
        type: rule.key,
        severity: rule.key === 'login_failures_spike' ? 'HIGH' : 'CRITICAL',
        status: 'OPEN',
        title: `Alerta automática: ${rule.name}`,
        description: `Se detectaron ${count} eventos en ${rule.windowMinutes} minutos.`,
        source: 'automation',
        route: rule.key.includes('session') ? '/api/auth/session' : '/api',
        metadata: JSON.stringify({ count, threshold: rule.threshold }),
      },
    })

    created.push(incident.id)
  }

  if (created.length > 0) {
    await auditAdminAction({
      actorEmail: adminEmail,
      action: 'automation.run',
      entityType: 'AdminIncident',
      details: `Incidentes creados: ${created.join(', ')}`,
    })
  }
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await triggerAutomation(admin.email)

  const incidents = await prisma.adminIncident.findMany({
    orderBy: [{ status: 'asc' }, { severity: 'desc' }, { lastSeenAt: 'desc' }],
    take: 100,
  })

  return NextResponse.json({ incidents })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body?.title || !body?.type) {
    return NextResponse.json({ error: 'title y type son obligatorios' }, { status: 400 })
  }

  const incident = await prisma.adminIncident.create({
    data: {
      title: body.title,
      type: body.type,
      description: body.description || null,
      source: body.source || 'manual',
      route: body.route || null,
      severity: body.severity || 'MEDIUM',
      metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'incident.create',
    entityType: 'AdminIncident',
    entityId: incident.id,
    route: '/api/admin/incidents',
    details: incident.title,
    request,
  })

  return NextResponse.json({ incident }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body?.id) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  }

  const nextStatus = body.status
  const data: Record<string, unknown> = {
    status: nextStatus,
  }

  if (nextStatus === 'ACKNOWLEDGED') {
    data.acknowledgedBy = admin.email
    data.acknowledgedAt = new Date()
  }

  if (nextStatus === 'RESOLVED') {
    data.resolvedBy = admin.email
    data.resolvedAt = new Date()
  }

  const incident = await prisma.adminIncident.update({
    where: { id: body.id },
    data,
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'incident.update_status',
    entityType: 'AdminIncident',
    entityId: incident.id,
    route: '/api/admin/incidents',
    details: `Nuevo estado: ${incident.status}`,
    request,
  })

  return NextResponse.json({ incident })
}
