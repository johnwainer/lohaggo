import { NextRequest, NextResponse } from 'next/server'
import type { RefundStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'

async function resolveRefundRelations(input: {
  paymentId?: string | null
  bookingId?: string | null
  userId?: string | null
  partnerId?: string | null
}) {
  const paymentId = input.paymentId || null
  let bookingId = input.bookingId || null
  let userId = input.userId || null
  let partnerId = input.partnerId || null

  if (!paymentId) {
    throw new Error('paymentId es obligatorio para un reembolso')
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      userId: true,
      bookingId: true,
      totalAmount: true,
      status: true,
      booking: { select: { partnerId: true } },
    },
  })
  if (!payment) throw new Error('paymentId inválido')
  if (payment.status !== 'APPROVED' && payment.status !== 'REFUNDED') {
    throw new Error(`El pago está en estado ${payment.status}; no es elegible para reembolso`)
  }

  if (bookingId && bookingId !== payment.bookingId) {
    throw new Error('bookingId no coincide con paymentId')
  }
  if (userId && userId !== payment.userId) {
    throw new Error('userId no coincide con paymentId')
  }
  if (partnerId && payment.booking.partnerId && partnerId !== payment.booking.partnerId) {
    throw new Error('partnerId no coincide con paymentId')
  }

  bookingId = payment.bookingId
  userId = payment.userId
  partnerId = partnerId || payment.booking.partnerId || null

  return {
    paymentId,
    bookingId,
    userId,
    partnerId,
    paymentTotalAmount: payment.totalAmount,
  }
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = request.nextUrl.searchParams.get('status') as RefundStatus | null
  const query = request.nextUrl.searchParams.get('q')?.trim()

  const refundCases = await prisma.refundCase.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(query
        ? {
            OR: [
              { reason: { contains: query, mode: 'insensitive' } },
              { reviewNotes: { contains: query, mode: 'insensitive' } },
              { requestedBy: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
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

  let relationData: {
    paymentId: string
    bookingId: string
    userId: string
    partnerId: string | null
    paymentTotalAmount: number
  }
  try {
    relationData = await resolveRefundRelations({
      paymentId: body.paymentId,
      bookingId: body.bookingId,
      userId: body.userId,
      partnerId: body.partnerId,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Relaciones inválidas' }, { status: 400 })
  }

  const requestedAmount = Number(body.requestedAmount)
  const approvedAmount = body.approvedAmount !== undefined && body.approvedAmount !== null
    ? Number(body.approvedAmount)
    : null

  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    return NextResponse.json({ error: 'requestedAmount debe ser un valor positivo' }, { status: 400 })
  }
  if (requestedAmount > relationData.paymentTotalAmount) {
    return NextResponse.json({ error: 'requestedAmount no puede superar el total pagado' }, { status: 400 })
  }
  if (approvedAmount !== null && (!Number.isFinite(approvedAmount) || approvedAmount < 0 || approvedAmount > requestedAmount)) {
    return NextResponse.json({ error: 'approvedAmount debe estar entre 0 y requestedAmount' }, { status: 400 })
  }

  const refundCase = await prisma.refundCase.create({
    data: {
      paymentId: relationData.paymentId,
      bookingId: relationData.bookingId,
      userId: relationData.userId,
      partnerId: relationData.partnerId,
      reason: body.reason,
      policyCode: body.policyCode || null,
      status: body.status || 'REQUESTED',
      requestedAmount,
      approvedAmount,
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

  const current = await prisma.refundCase.findUnique({
    where: { id: body.id },
    select: { status: true, requestedAmount: true, paymentId: true },
  })
  if (!current) return NextResponse.json({ error: 'Caso de reembolso no encontrado' }, { status: 404 })

  const nextStatus = body.status as RefundStatus | undefined
  if (nextStatus) {
    const allowedTransitions: Record<RefundStatus, RefundStatus[]> = {
      REQUESTED: ['UNDER_REVIEW', 'REJECTED'],
      UNDER_REVIEW: ['APPROVED', 'REJECTED', 'FAILED'],
      APPROVED: ['PROCESSED', 'FAILED'],
      REJECTED: [],
      PROCESSED: [],
      FAILED: ['UNDER_REVIEW', 'APPROVED'],
    }
    if (!allowedTransitions[current.status].includes(nextStatus) && nextStatus !== current.status) {
      return NextResponse.json(
        { error: `Transición inválida de ${current.status} a ${nextStatus}` },
        { status: 400 }
      )
    }
  }

  const approvedAmount =
    body.approvedAmount !== undefined && body.approvedAmount !== null
      ? Number(body.approvedAmount)
      : undefined
  if (approvedAmount !== undefined && (!Number.isFinite(approvedAmount) || approvedAmount < 0 || approvedAmount > current.requestedAmount)) {
    return NextResponse.json({ error: 'approvedAmount inválido para este caso' }, { status: 400 })
  }

  if (nextStatus === 'PROCESSED' && current.status !== 'APPROVED') {
    return NextResponse.json(
      { error: 'Solo casos APPROVED pueden pasar a PROCESSED' },
      { status: 400 }
    )
  }

  const data: {
    status?: RefundStatus
    approvedAmount?: number | null
    reviewNotes?: string | null
    reviewedBy?: string | null
    processedAt?: Date
    externalRefundId?: string | null
  } = {
    ...(nextStatus ? { status: nextStatus } : {}),
    ...(approvedAmount !== undefined ? { approvedAmount } : {}),
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
