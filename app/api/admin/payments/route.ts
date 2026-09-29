import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { attachAgentNames } from '@/lib/ops/origin-labels'
import { pagedResponse, parseAdminPagination } from '@/lib/admin/pagination'

const USER_SAFE = { select: { id: true, name: true, email: true, phone: true } } as const


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
    const p = parseAdminPagination(searchParams)

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

    const paymentsQuery = prisma.payment.findMany({
      where,
      include: {
        booking: {
          include: {
            service: true,
            user: USER_SAFE,
            partner: {
              include: {
                user: USER_SAFE,
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
      skip: p.skip,
      take: p.take,
    })
    const [payments, total, stats] = await Promise.all([
      paymentsQuery,
      p.paged ? prisma.payment.count({ where }) : Promise.resolve(0),
      p.paged && searchParams.get('stats') === '1' ? paymentStats(where) : Promise.resolve(null),
    ])
    const withAgents = await attachAgentNames(payments)
    const enriched = withAgents.map((payment) => {
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

    if (!p.paged) return NextResponse.json(enriched)
    return NextResponse.json({ ...pagedResponse(enriched, total, p), ...(stats ? { stats } : {}) })
  } catch (error) {
    logger.error('Error al obtener pagos:', error)
    return NextResponse.json(
      { error: 'Error al obtener pagos' },
      { status: 500 }
    )
  }
}

async function paymentStats(where: any) {
  const [byStatus, partnerCommission] = await Promise.all([
    prisma.payment.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
      _sum: { totalAmount: true, clientCommission: true },
    }),
    prisma.payout.aggregate({
      where: { payment: { AND: [where, { status: 'APPROVED' }] } },
      _sum: { partnerCommission: true },
    }),
  ])
  const row = (status: string) => byStatus.find((r) => r.status === status)
  const approved = row('APPROVED')
  const pending = row('PENDING')
  const totalPartnerCommission = partnerCommission._sum.partnerCommission ?? 0
  const totalClientCommission = approved?._sum.clientCommission ?? 0
  return {
    total: byStatus.reduce((sum, r) => sum + r._count._all, 0),
    pending: pending?._count._all ?? 0,
    approved: approved?._count._all ?? 0,
    totalApproved: approved?._sum.totalAmount ?? 0,
    totalPending: pending?._sum.totalAmount ?? 0,
    totalClientCommission,
    totalPartnerCommission,
    totalAppRevenue: totalClientCommission + totalPartnerCommission,
  }
}
