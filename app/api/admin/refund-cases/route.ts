import { NextRequest, NextResponse } from 'next/server'
import type { RefundStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = request.nextUrl.searchParams.get('status') as RefundStatus | null

  const refundCases = await prisma.refundCase.findMany({
    where: status ? { status } : undefined,
    include: {
      booking: { select: { id: true, status: true, scheduledDate: true, totalPrice: true } },
      payment: { select: { id: true, status: true, totalAmount: true, mercadopagoId: true } },
      user: { select: { id: true, name: true, email: true } },
      partner: { select: { id: true, user: { select: { name: true, email: true } } } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 300,
  })

  return NextResponse.json({ refundCases })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body?.reason || !body?.requestedAmount) {
    return NextResponse.json({ error: 'reason y requestedAmount son requeridos' }, { status: 400 })
  }

  const refundCase = await prisma.refundCase.create({
    data: {
      bookingId: body.bookingId || null,
      paymentId: body.paymentId || null,
      userId: body.userId || null,
      partnerId: body.partnerId || null,
      reason: body.reason,
      policyCode: body.policyCode || null,
      status: body.status || 'REQUESTED',
      requestedAmount: Number(body.requestedAmount),
      approvedAmount: body.approvedAmount !== undefined ? Number(body.approvedAmount) : null,
      currency: body.currency || 'COP',
      requestedBy: body.requestedBy || admin.email,
      reviewedBy: body.reviewedBy || null,
      reviewNotes: body.reviewNotes || null,
      externalRefundId: body.externalRefundId || null,
      metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'refund_case.create',
    entityType: 'RefundCase',
    entityId: refundCase.id,
    route: '/api/admin/refund-cases',
    details: `${refundCase.status} - ${refundCase.reason}`,
    request,
  })

  return NextResponse.json({ refundCase }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  if (!body?.id) return NextResponse.json({ error: 'id es requerido' }, { status: 400 })

  const nextStatus = body.status as RefundStatus | undefined
  const data: {
    status?: RefundStatus
    approvedAmount?: number | null
    reviewNotes?: string | null
    reviewedBy?: string | null
    processedAt?: Date
    externalRefundId?: string | null
  } = {
    ...(nextStatus ? { status: nextStatus } : {}),
    ...(body.approvedAmount !== undefined ? { approvedAmount: Number(body.approvedAmount) } : {}),
    ...(body.reviewNotes !== undefined ? { reviewNotes: body.reviewNotes || null } : {}),
    ...(body.externalRefundId !== undefined ? { externalRefundId: body.externalRefundId || null } : {}),
  }

  if (nextStatus === 'UNDER_REVIEW' || nextStatus === 'APPROVED' || nextStatus === 'REJECTED') {
    data.reviewedBy = admin.email
  }
  if (nextStatus === 'PROCESSED') {
    data.processedAt = new Date()
    data.reviewedBy = admin.email
  }

  const refundCase = await prisma.refundCase.update({
    where: { id: body.id },
    data,
  })

  if (nextStatus === 'PROCESSED' && refundCase.paymentId) {
    await prisma.payment.update({
      where: { id: refundCase.paymentId },
      data: { status: 'REFUNDED' },
    }).catch(() => null)
  }

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'refund_case.update',
    entityType: 'RefundCase',
    entityId: refundCase.id,
    route: '/api/admin/refund-cases',
    details: `Estado: ${refundCase.status}`,
    request,
  })

  return NextResponse.json({ refundCase })
}
