import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, auditAdminAction } from '@/lib/admin-utils'

async function getAutoSignals() {
  const [highCancelUsers, suspiciousPartners] = await Promise.all([
    prisma.booking.groupBy({
      by: ['userId'],
      where: { status: 'CANCELLED' },
      _count: { _all: true },
      orderBy: { _count: { userId: 'desc' } },
      take: 10,
    }),
    prisma.proposal.groupBy({
      by: ['partnerId'],
      where: { status: 'REJECTED' },
      _count: { _all: true },
      orderBy: { _count: { partnerId: 'desc' } },
      take: 10,
    }),
  ])

  return {
    highCancelUsers: highCancelUsers.filter((u) => u._count._all >= 5),
    suspiciousPartners: suspiciousPartners.filter((p) => p._count._all >= 8),
  }
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [signals, suggestions] = await Promise.all([
    prisma.fraudSignal.findMany({
      orderBy: [{ status: 'asc' }, { severity: 'desc' }, { createdAt: 'desc' }],
      take: 200,
      include: {
        user: { select: { id: true, name: true, email: true } },
        partner: { include: { user: { select: { name: true, email: true } } } },
        booking: { select: { id: true, status: true, totalPrice: true } },
      },
    }),
    getAutoSignals(),
  ])

  return NextResponse.json({ signals, suggestions })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body?.type || !body?.reason) {
    return NextResponse.json({ error: 'type y reason requeridos' }, { status: 400 })
  }

  const signal = await prisma.fraudSignal.create({
    data: {
      type: body.type,
      reason: body.reason,
      details: body.details || null,
      severity: body.severity || 'MEDIUM',
      score: body.score ?? 50,
      userId: body.userId || null,
      partnerId: body.partnerId || null,
      bookingId: body.bookingId || null,
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'fraud_signal.create',
    entityType: 'FraudSignal',
    entityId: signal.id,
    details: signal.type,
    request,
  })

  return NextResponse.json({ signal }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body?.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const status = body.status

  const signal = await prisma.fraudSignal.update({
    where: { id: body.id },
    data: {
      status,
      severity: body.severity,
      score: body.score,
      details: body.details,
      resolvedBy: status === 'RESOLVED' ? admin.email : null,
      resolvedAt: status === 'RESOLVED' ? new Date() : null,
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'fraud_signal.update',
    entityType: 'FraudSignal',
    entityId: signal.id,
    details: `Estado: ${signal.status}`,
    request,
  })

  return NextResponse.json({ signal })
}
