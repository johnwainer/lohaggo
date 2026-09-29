import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { Prisma } from '@prisma/client'
import { sortReviewQueue } from '@/lib/partners/document-queue'
import { pagedResponse, parseAdminPagination } from '@/lib/admin/pagination'


const logger = createLogger('admin-documents')

const STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const
type DocStatus = typeof STATUSES[number]

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const statusParam = (searchParams.get('status') || 'PENDING').toUpperCase()
    if (statusParam !== 'ALL' && !STATUSES.includes(statusParam as DocStatus)) {
      return NextResponse.json({ error: 'Estado inválido. Usa PENDING, APPROVED, REJECTED o ALL' }, { status: 400 })
    }
    const p = parseAdminPagination(searchParams)

    const where: Prisma.VerificationDocumentWhereInput = {
      ...(statusParam !== 'ALL' ? { status: statusParam as DocStatus } : {}),
      ...(p.q
        ? {
            partner: {
              user: {
                OR: [
                  { name: { contains: p.q, mode: 'insensitive' } },
                  { email: { contains: p.q, mode: 'insensitive' } },
                ],
              },
            },
          }
        : {}),
    }

    const orderBy: Prisma.VerificationDocumentOrderByWithRelationInput[] =
      statusParam === 'PENDING'
        ? [{ createdAt: 'asc' }]
        : statusParam === 'ALL'
          ? [{ status: 'asc' }, { createdAt: 'asc' }]
          : [{ createdAt: 'desc' }]

    const [documents, total] = await Promise.all([
      prisma.verificationDocument.findMany({
        where,
        include: {
          partner: {
            select: {
              id: true,
              verified: true,
              isActive: true,
              user: {
                select: {
                  name: true,
                  email: true,
                  phone: true,
                },
              },
            },
          },
        },
        orderBy,
        skip: p.skip,
        take: p.take,
      }),
      p.paged ? prisma.verificationDocument.count({ where }) : Promise.resolve(0),
    ])

    const sorted = sortReviewQueue(documents)
    if (!p.paged) return NextResponse.json(sorted)

    const partnerIds = Array.from(new Set(documents.map((d) => d.partnerId)))
    const [byStatus, pendingPerPartner] = await Promise.all([
      prisma.verificationDocument.groupBy({ by: ['status'], _count: { _all: true } }),
      partnerIds.length
        ? prisma.verificationDocument.groupBy({
            by: ['partnerId'],
            where: { status: 'PENDING', partnerId: { in: partnerIds } },
            _count: { _all: true },
          })
        : Promise.resolve([] as { partnerId: string; _count: { _all: number } }[]),
    ])
    const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0 } as Record<DocStatus, number>
    for (const row of byStatus) counts[row.status as DocStatus] = row._count._all
    const pendingByPartner: Record<string, number> = {}
    for (const row of pendingPerPartner) pendingByPartner[row.partnerId] = row._count._all

    return NextResponse.json({ ...pagedResponse(sorted, total, p), counts, pendingByPartner })
  } catch (error) {
    logger.error('Error fetching documents:', error || undefined)
    return NextResponse.json({ error: 'Error al obtener documentos' }, { status: 500 })
  }
}
