import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, auditAdminAction } from '@/lib/admin-utils'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
