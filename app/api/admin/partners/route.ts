import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { Prisma } from '@prisma/client'
import { maskAccountNumber, pagedResponse, parseAdminPagination } from '@/lib/admin/pagination'

export const dynamic = 'force-dynamic'


const logger = createLogger('admin-partners')

const FILTERS = ['all', 'verified', 'unverified', 'active', 'no_services', 'new7d'] as const
type PartnerFilter = typeof FILTERS[number]

function filterWhere(filter: PartnerFilter): Prisma.PartnerProfileWhereInput {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  switch (filter) {
    case 'verified': return { verified: true }
    case 'unverified': return { verified: false }
    case 'active': return { bookings: { some: {} } }
    case 'no_services': return { services: { none: {} } }
    case 'new7d': return { user: { createdAt: { gt: sevenDaysAgo } } }
    default: return {}
  }
}

async function partnerStats() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [total, verified, withServices, active, new7d, withProposals, avg, byCity, byService] = await Promise.all([
    prisma.partnerProfile.count(),
    prisma.partnerProfile.count({ where: { verified: true } }),
    prisma.partnerProfile.count({ where: { services: { some: {} } } }),
    prisma.partnerProfile.count({ where: { bookings: { some: {} } } }),
    prisma.partnerProfile.count({ where: { user: { createdAt: { gt: sevenDaysAgo } } } }),
    prisma.partnerProfile.count({ where: { proposals: { some: {} } } }),
    prisma.partnerProfile.aggregate({ _avg: { rating: true } }),
    prisma.partnerProfile.groupBy({ by: ['city'], _count: { _all: true } }),
    prisma.partnerService.groupBy({ by: ['serviceId'], _count: { _all: true } }),
  ])
  const services = byService.length
    ? await prisma.service.findMany({
        where: { id: { in: byService.map((s) => s.serviceId) } },
        select: { id: true, name: true },
      })
    : []
  const serviceName = new Map(services.map((s) => [s.id, s.name]))
  return {
    total,
    verified,
    withServices,
    active,
    new7d,
    withProposals,
    avgRating: (avg._avg.rating ?? 0).toFixed(1),
    cityBreakdown: byCity
      .map((c) => [String(c.city), c._count._all] as [string, number])
      .sort((a, b) => b[1] - a[1]),
    serviceBreakdown: byService
      .map((s) => [serviceName.get(s.serviceId) ?? 'Servicio', s._count._all] as [string, number])
      .sort((a, b) => b[1] - a[1]),
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const p = parseAdminPagination(searchParams)
    const filterParam = searchParams.get('filter') || 'all'
    if (!FILTERS.includes(filterParam as PartnerFilter)) {
      return NextResponse.json({ error: 'Filtro inválido' }, { status: 400 })
    }

    const where: Prisma.PartnerProfileWhereInput = {
      ...filterWhere(filterParam as PartnerFilter),
      ...(p.q
        ? {
            OR: [
              { user: { name: { contains: p.q, mode: 'insensitive' } } },
              { user: { email: { contains: p.q, mode: 'insensitive' } } },
              { user: { phone: { contains: p.q } } },
            ],
          }
        : {}),
    }

    const [rows, total] = await Promise.all([
      prisma.partnerProfile.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              image: true,
              createdAt: true,
              excludedFromMarketing: true,
            }
          },
          services: {
            include: {
              service: {
                select: {
                  name: true,
                  icon: true,
                }
              }
            }
          },
          _count: {
            select: {
              bookings: true,
              proposals: true,
            }
          },
          bankAccounts: {
            where: { isActive: true },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
            take: 1,
            select: {
              id: true,
              bankName: true,
              accountType: true,
              accountNumber: true,
              isDefault: true,
              mercadoPagoRecipientId: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: p.skip,
        take: p.take,
      }),
      p.paged ? prisma.partnerProfile.count({ where }) : Promise.resolve(0),
    ])

    const partners = rows.map((row) => ({
      ...row,
      bankAccounts: row.bankAccounts.map((b) => ({ ...b, accountNumber: maskAccountNumber(b.accountNumber) })),
    }))

    if (!p.paged) return NextResponse.json(partners)

    const withStats = searchParams.get('stats') === '1'
    return NextResponse.json({
      ...pagedResponse(partners, total, p),
      ...(withStats ? { stats: await partnerStats() } : {}),
    })
  } catch (error) {
    logger.error('Error fetching partners:', error || undefined)
    return NextResponse.json({ error: 'Error al obtener socios' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { partnerId, verified } = body

    const partner = await prisma.partnerProfile.update({
      where: { id: partnerId },
      data: { verified }
    })

    return NextResponse.json(partner)
  } catch (error) {
    logger.error('Error updating partner:', error || undefined)
    return NextResponse.json({ error: 'Error al actualizar socio' }, { status: 500 })
  }
}
