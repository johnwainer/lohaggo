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
      booking: {
        select: {
          id: true,
          status: true,
          scheduledDate: true,
          totalPrice: true,
          service: { select: { id: true, name: true } },
        },
      },
      payment: {
        select: {
          id: true,
          status: true,
          totalAmount: true,
          mercadopagoId: true,
          payout: {
            select: {
              id: true,
              status: true,
              netAmount: true,
              processedAt: true,
            },
          },
        },
      },
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

  const existingCases = await prisma.refundCase.findMany({
    where: { paymentId: relationData.paymentId },
    select: { id: true, status: true, requestedAmount: true, approvedAmount: true },
  })

  const blockingCase = existingCases.find((item) => ['REQUESTED', 'UNDER_REVIEW', 'APPROVED'].includes(item.status))
  if (blockingCase) {
    return NextResponse.json(
      { error: `Ya existe un caso activo para este pago (${blockingCase.id} - ${blockingCase.status})` },
      { status: 400 }
    )
  }

  const processedRefundAmount = existingCases
    .filter((item) => item.status === 'PROCESSED')
    .reduce((sum, item) => sum + (item.approvedAmount ?? item.requestedAmount), 0)
  const remainingAmount = Number((relationData.paymentTotalAmount - processedRefundAmount).toFixed(2))
  if (requestedAmount > remainingAmount) {
    return NextResponse.json(
      { error: `El pago solo tiene ${remainingAmount} disponible para reembolsar` },
      { status: 400 }
    )
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
    select: {
      status: true,
      requestedAmount: true,
      approvedAmount: true,
      paymentId: true,
      bookingId: true,
      userId: true,
      partnerId: true,
    },
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

  if ((nextStatus === 'APPROVED' || nextStatus === 'PROCESSED') && current.approvedAmount === null && approvedAmount === undefined) {
    return NextResponse.json(
      { error: 'Debes definir approvedAmount antes de aprobar o procesar un reembolso' },
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
    const allProcessedCases = await prisma.refundCase.findMany({
      where: {
        paymentId: refundCase.paymentId,
        status: 'PROCESSED',
      },
      select: {
        approvedAmount: true,
        requestedAmount: true,
      },
    })

    const totalProcessedAmount = allProcessedCases.reduce(
      (sum, item) => sum + (item.approvedAmount ?? item.requestedAmount),
      0
    )

    const payment = await prisma.payment.findUnique({
      where: { id: refundCase.paymentId },
      select: { id: true, totalAmount: true },
    })

    if (payment && totalProcessedAmount >= Number(payment.totalAmount) - 1) {
      await prisma.payment.update({
        where: { id: refundCase.paymentId },
        data: { status: 'REFUNDED' },
      }).catch(() => null)
    }

    const payout = await prisma.payout.findUnique({
      where: { paymentId: refundCase.paymentId },
      select: { id: true, status: true, netAmount: true },
    })

    if (payout) {
      const refundedAmount = refundCase.approvedAmount ?? refundCase.requestedAmount
      const isFullRefund = payment ? refundedAmount >= Number(payment.totalAmount) - 1 : false

      if ((payout.status === 'PENDING' || payout.status === 'PROCESSING') && isFullRefund) {
        await prisma.payout.update({
          where: { id: payout.id },
          data: {
            status: 'CANCELLED',
            processorStatus: 'CANCELLED_BY_REFUND',
            processorMessage: `Cancelado por reembolso ${refundCase.id}`,
            processedBy: admin.email,
            processedAt: new Date(),
          },
        })
      } else {
        const incident = await prisma.paymentIncident.create({
          data: {
            paymentId: refundCase.paymentId,
            bookingId: refundCase.bookingId,
            userId: refundCase.userId,
            partnerId: refundCase.partnerId,
            incidentType: 'REFUND_DISPUTE',
            status: 'ACTION_REQUIRED',
            severity: 'HIGH',
            source: 'refund-processor',
            title: 'Reembolso procesado con ajuste pendiente de payout',
            description:
              payout.status === 'COMPLETED'
                ? `El payout ${payout.id} ya estaba COMPLETED. Se requiere recuperación por ${payout.netAmount}.`
                : `El payout ${payout.id} está en ${payout.status} y el reembolso fue parcial. Se requiere ajuste manual.`,
            assignedTo: 'ops@lohaggo.com',
            metadata: JSON.stringify({
              refundCaseId: refundCase.id,
              payoutId: payout.id,
              payoutStatus: payout.status,
            }),
          },
        })

        await prisma.paymentIncidentEvent.create({
          data: {
            incidentId: incident.id,
            actorEmail: admin.email,
            action: 'PAYOUT_RECOVERY_REQUIRED',
            note: `Reembolso ${refundCase.id} procesado; payout ${payout.id} requiere ajuste`,
          },
        })
      }
    }
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
