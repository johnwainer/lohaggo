import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, auditAdminAction } from '@/lib/admin-utils'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')

  const bookings = await prisma.booking.findMany({
    where: status ? { status: status as any } : undefined,
    orderBy: { updatedAt: 'desc' },
    take: 200,
    include: {
      user: { select: { id: true, name: true, email: true } },
      partner: { include: { user: { select: { name: true, email: true } } } },
      service: { select: { id: true, name: true } },
      payment: { select: { id: true, status: true, totalAmount: true } },
    },
  })

  return NextResponse.json({ bookings })
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body?.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const updated = await prisma.booking.update({
    where: { id: body.id },
    data: {
      status: body.status,
      partnerId: body.partnerId !== undefined ? body.partnerId : undefined,
      notes: body.notes,
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'booking.workflow_update',
    entityType: 'Booking',
    entityId: updated.id,
    route: '/api/admin/workflow/bookings',
    details: `Estado: ${updated.status}`,
    request,
  })

  return NextResponse.json({ booking: updated })
}
