import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await context.params
  const body = await request.json()
  if (!body?.action) {
    return NextResponse.json({ error: 'action es requerido' }, { status: 400 })
  }

  const event = await prisma.paymentIncidentEvent.create({
    data: {
      incidentId: id,
      actorEmail: admin.email,
      action: String(body.action),
      note: body.note ? String(body.note) : null,
      metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'payment_incident.event',
    entityType: 'PaymentIncidentEvent',
    entityId: event.id,
    route: '/api/admin/payment-incidents/[id]/events',
    details: `Incident ${id} · ${event.action}`,
    request,
  })

  return NextResponse.json({ event }, { status: 201 })
}
