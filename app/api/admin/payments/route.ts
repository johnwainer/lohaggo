import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'


const logger = createLogger('admin-payments')

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const query = searchParams.get('q')?.trim()
    const partnerId = searchParams.get('partnerId')?.trim()
    const clientId = searchParams.get('clientId')?.trim()
    const serviceId = searchParams.get('serviceId')?.trim()
    const refundableOnly = searchParams.get('refundableOnly') === 'true'
    const minAmount = searchParams.get('minAmount')
    const maxAmount = searchParams.get('maxAmount')

    const where: any = {}
    if (status && status !== 'ALL') {
      where.status = status
    }
    if (clientId) {
      where.userId = clientId
    }
    if (partnerId) {
      where.booking = { ...(where.booking || {}), partnerId }
    }
    if (serviceId) {
      where.booking = { ...(where.booking || {}), serviceId }
    }
    if (minAmount || maxAmount) {
      where.totalAmount = {
        ...(minAmount ? { gte: Number(minAmount) } : {}),
        ...(maxAmount ? { lte: Number(maxAmount) } : {}),
      }
    }
    if (refundableOnly) {
      where.status = { in: ['APPROVED', 'REFUNDED'] }
    }
    if (query) {
      where.OR = [
        { id: { contains: query, mode: 'insensitive' } },
        { mercadopagoId: { contains: query, mode: 'insensitive' } },
        { booking: { id: { contains: query, mode: 'insensitive' } } },
        { booking: { service: { name: { contains: query, mode: 'insensitive' } } } },
        { booking: { user: { name: { contains: query, mode: 'insensitive' } } } },
        { booking: { user: { email: { contains: query, mode: 'insensitive' } } } },
        { booking: { partner: { user: { name: { contains: query, mode: 'insensitive' } } } } },
        { booking: { partner: { user: { email: { contains: query, mode: 'insensitive' } } } } },
      ]
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        booking: {
          include: {
            service: true,
            user: true,
            partner: {
              include: {
                user: true,
              },
            },
          },
        },
        payout: true,
        refundCases: {
          select: {
            id: true,
            status: true,
            requestedAmount: true,
            approvedAmount: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
    const enriched = payments.map((payment) => {
      const processedRefundAmount = payment.refundCases
        .filter((r) => r.status === 'PROCESSED')
        .reduce((sum, r) => sum + (r.approvedAmount ?? r.requestedAmount), 0)
      const openRefundExposure = payment.refundCases
        .filter((r) => ['REQUESTED', 'UNDER_REVIEW', 'APPROVED'].includes(r.status))
        .reduce((sum, r) => sum + (r.approvedAmount ?? r.requestedAmount), 0)
      const availableToRefund = Math.max(0, Number(payment.totalAmount) - processedRefundAmount - openRefundExposure)

      return {
        ...payment,
        refundSummary: {
          processedRefundAmount,
          openRefundExposure,
          availableToRefund,
        },
      }
    })

    return NextResponse.json(enriched)
  } catch (error) {
    logger.error('Error al obtener pagos:', error)
    return NextResponse.json(
      { error: 'Error al obtener pagos' },
      { status: 500 }
    )
  }
}
