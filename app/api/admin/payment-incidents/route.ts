import { NextRequest, NextResponse } from 'next/server'
import type { PaymentIncidentStatus, PaymentIncidentType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { calculateSlaDueAt, severityForIncident, supportQueueForIncident } from '@/lib/launch-ops'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = request.nextUrl.searchParams.get('status') as PaymentIncidentStatus | null
  const type = request.nextUrl.searchParams.get('type') as PaymentIncidentType | null

  const incidents = await prisma.paymentIncident.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(type ? { incidentType: type } : {}),
    },
    include: {
      payment: { select: { id: true, amount: true, totalAmount: true, status: true, mercadopagoId: true } },
      booking: { select: { id: true, status: true, scheduledDate: true, totalPrice: true } },
      user: { select: { id: true, name: true, email: true } },
      partner: { select: { id: true, user: { select: { name: true, email: true } } } },
      events: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
    orderBy: [{ status: 'asc' }, { severity: 'desc' }, { createdAt: 'desc' }],
    take: 300,
  })

  return NextResponse.json({ incidents })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body?.title || !body?.description || !body?.incidentType) {
    return NextResponse.json({ error: 'title, description e incidentType son requeridos' }, { status: 400 })
  }

  const incidentType = body.incidentType as PaymentIncidentType
  const severity = body.severity || severityForIncident(incidentType)
  const slaDueAt = body.slaDueAt ? new Date(body.slaDueAt) : calculateSlaDueAt(severity)

  const incident = await prisma.paymentIncident.create({
    data: {
      paymentId: body.paymentId || null,
      bookingId: body.bookingId || null,
      userId: body.userId || null,
      partnerId: body.partnerId || null,
      incidentType,
      severity,
      status: body.status || 'OPEN',
      source: body.source || 'admin',
      title: body.title,
      description: body.description,
      rootCause: body.rootCause || null,
      assignedTo: body.assignedTo || admin.email,
      slaDueAt,
      metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    },
  })

  await prisma.paymentIncidentEvent.create({
    data: {
      incidentId: incident.id,
      actorEmail: admin.email,
      action: 'INCIDENT_CREATED',
      note: `Incidente creado por ${admin.email}`,
    },
  })

  await prisma.adminSupportCase.create({
    data: {
      userId: incident.userId,
      bookingId: incident.bookingId,
      priority: incident.severity,
      status: 'OPEN',
      queue: supportQueueForIncident(incidentType),
      subject: `[${incidentType}] ${incident.title}`,
      description: incident.description,
      assignedTo: incident.assignedTo,
      slaDueAt,
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'payment_incident.create',
    entityType: 'PaymentIncident',
    entityId: incident.id,
    route: '/api/admin/payment-incidents',
    details: incident.title,
    request,
  })

  return NextResponse.json({ incident }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body?.id) return NextResponse.json({ error: 'id es requerido' }, { status: 400 })

  const nextStatus = body.status as PaymentIncidentStatus | undefined
  const updateData: {
    status?: PaymentIncidentStatus
    assignedTo?: string | null
    rootCause?: string | null
    resolvedAt?: Date | null
    closedAt?: Date | null
    acknowledgedAt?: Date | null
  } = {
    ...(nextStatus ? { status: nextStatus } : {}),
    ...(body.assignedTo !== undefined ? { assignedTo: body.assignedTo || null } : {}),
    ...(body.rootCause !== undefined ? { rootCause: body.rootCause || null } : {}),
  }

  if (nextStatus === 'INVESTIGATING' || nextStatus === 'ACTION_REQUIRED') {
    updateData.acknowledgedAt = new Date()
  }
  if (nextStatus === 'RESOLVED') {
    updateData.resolvedAt = new Date()
  }
  if (nextStatus === 'CLOSED') {
    updateData.closedAt = new Date()
  }

  const incident = await prisma.paymentIncident.update({
    where: { id: body.id },
    data: updateData,
  })

  await prisma.paymentIncidentEvent.create({
    data: {
      incidentId: incident.id,
      actorEmail: admin.email,
      action: 'INCIDENT_UPDATED',
      note: `Estado ${incident.status}${body.note ? ` · ${body.note}` : ''}`,
      metadata: JSON.stringify({
        status: incident.status,
        assignedTo: incident.assignedTo,
      }),
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'payment_incident.update',
    entityType: 'PaymentIncident',
    entityId: incident.id,
    route: '/api/admin/payment-incidents',
    details: `Estado: ${incident.status}`,
    request,
  })

  return NextResponse.json({ incident })
}
