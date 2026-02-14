import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, auditAdminAction } from '@/lib/admin-utils'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cases = await prisma.adminSupportCase.findMany({
    orderBy: [{ status: 'asc' }, { priority: 'desc' }, { updatedAt: 'desc' }],
    take: 200,
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      booking: { select: { id: true, status: true, totalPrice: true, createdAt: true } },
      serviceRequest: { select: { id: true, status: true, createdAt: true } },
    },
  })

  return NextResponse.json({ cases })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body?.subject || !body?.description) {
    return NextResponse.json({ error: 'subject y description son obligatorios' }, { status: 400 })
  }

  const supportCase = await prisma.adminSupportCase.create({
    data: {
      subject: body.subject,
      description: body.description,
      priority: body.priority || 'MEDIUM',
      status: body.status || 'OPEN',
      userId: body.userId || null,
      role: body.role || null,
      bookingId: body.bookingId || null,
      requestId: body.requestId || null,
      queue: body.queue || 'GENERAL',
      slaDueAt: body.slaDueAt ? new Date(body.slaDueAt) : null,
      assignedTo: body.assignedTo || admin.email,
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'support_case.create',
    entityType: 'AdminSupportCase',
    entityId: supportCase.id,
    route: '/api/admin/support-cases',
    details: supportCase.subject,
    request,
  })

  return NextResponse.json({ case: supportCase }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body?.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const supportCase = await prisma.adminSupportCase.update({
    where: { id: body.id },
    data: {
      status: body.status,
      priority: body.priority,
      assignedTo: body.assignedTo,
      queue: body.queue,
      slaDueAt: body.slaDueAt ? new Date(body.slaDueAt) : body.slaDueAt === null ? null : undefined,
      firstResponseAt: body.firstResponseAt
        ? new Date(body.firstResponseAt)
        : body.markFirstResponse
          ? new Date()
          : undefined,
      resolvedAt:
        body.status === 'RESOLVED'
          ? new Date()
          : body.resolvedAt
            ? new Date(body.resolvedAt)
            : body.status === 'OPEN' || body.status === 'IN_PROGRESS'
              ? null
              : undefined,
      closedAt: body.status === 'CLOSED' ? new Date() : undefined,
      escalationLevel: body.escalationLevel,
      lastEscalatedAt: body.escalationLevel !== undefined ? new Date() : undefined,
      resolutionNote: body.resolutionNote,
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'support_case.update',
    entityType: 'AdminSupportCase',
    entityId: supportCase.id,
    route: '/api/admin/support-cases',
    details: `Estado: ${supportCase.status}`,
    request,
  })

  return NextResponse.json({ case: supportCase })
}
