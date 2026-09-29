import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { attachAgentNames } from '@/lib/ops/origin-labels'
import type { Prisma, ServiceRequestStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'


const logger = createLogger('admin-service-requests')

const PAGE_SIZE = 50
const MAX_IDS = 200
const STATUSES: ServiceRequestStatus[] = ['ACTIVE', 'ACCEPTED', 'EXPIRED', 'CANCELLED']

type NotifiedPartner = {
  userId: string
  name: string | null
  email: string | null
  phone: string | null
  partnerId: string | null
  isDirect: boolean
  notifiedAt: string
  read: boolean
}

/**
 * Admin list of service requests, newest first, 50 per page.
 * Query: status (ACTIVE|ACCEPTED|EXPIRED|CANCELLED), origin (app|chat), cursor (id of the last item
 * received), limit (1-100), ids (comma separated, up to 200: exactly those requests, no paging).
 * Response: { items, nextCursor, hasMore, stats? } — stats (counts per status under the origin
 * filter, and total proposals) only on the first page.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true }
    })

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const sp = req.nextUrl.searchParams
    const statusParam = sp.get('status')
    const status = STATUSES.find((s) => s === statusParam) ?? null
    const originParam = sp.get('origin')
    const origin = originParam === 'app' || originParam === 'chat' ? originParam : null
    const cursor = sp.get('cursor') || null
    const limitRaw = Number(sp.get('limit'))
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 100) : PAGE_SIZE
    const ids = (sp.get('ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, MAX_IDS)

    const originWhere: Prisma.ServiceRequestWhereInput =
      origin === 'chat' ? { origin: 'chat' } : origin === 'app' ? { NOT: { origin: 'chat' } } : {}
    const where: Prisma.ServiceRequestWhereInput = ids.length
      ? { id: { in: ids } }
      : { ...originWhere, ...(status ? { status } : {}) }

    const page = await prisma.serviceRequest.findMany({
      where,
      include: {
        service: {
          select: { name: true, icon: true }
        },
        user: {
          select: { id: true, name: true, email: true, phone: true }
        },
        partner: {
          select: {
            id: true,
            user: { select: { id: true, name: true, email: true, phone: true } }
          }
        },
        photos: { select: { url: true, order: true } },
        proposals: {
          include: {
            partner: {
              select: {
                id: true,
                user: { select: { id: true, name: true, email: true, phone: true } }
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        _count: { select: { proposals: true } }
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(ids.length
        ? {}
        : { take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) })
    })

    const hasMore = !ids.length && page.length > limit
    const serviceRequests = hasMore ? page.slice(0, limit) : page
    const nextCursor = hasMore ? serviceRequests[serviceRequests.length - 1].id : null

    const requestIds = new Set(serviceRequests.map((r) => r.id))
    const oldest = serviceRequests.reduce<Date | null>((min, r) => (!min || r.createdAt < min ? r.createdAt : min), null)

    const notifiedByRequest = new Map<string, NotifiedPartner[]>()
    if (requestIds.size && oldest) {
      const notifications = await prisma.notification.findMany({
        where: {
          type: 'NEW_SERVICE_REQUEST',
          createdAt: { gte: oldest },
          user: { role: 'PARTNER' },
          OR: Array.from(requestIds, (id) => ({ data: { contains: id } }))
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              partnerProfile: { select: { id: true } }
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      })

      const seen = new Set<string>()
      for (const n of notifications) {
        if (!n.data) continue
        let parsed: any
        try {
          parsed = JSON.parse(n.data)
        } catch {
          continue
        }
        if (parsed?.recipient === 'CLIENT') continue
        const reqId = parsed?.serviceRequestId
        if (!reqId || !requestIds.has(reqId)) continue
        const key = `${reqId}:${n.user.id}`
        if (seen.has(key)) continue
        seen.add(key)
        const list = notifiedByRequest.get(reqId) ?? []
        list.push({
          userId: n.user.id,
          name: n.user.name,
          email: n.user.email,
          phone: n.user.phone,
          partnerId: n.user.partnerProfile?.id ?? null,
          isDirect: Boolean(parsed?.isDirect),
          notifiedAt: n.createdAt.toISOString(),
          read: n.read
        })
        notifiedByRequest.set(reqId, list)
      }
    }

    const withAgents = await attachAgentNames(serviceRequests)
    const proposalsWithAgents = await attachAgentNames(serviceRequests.flatMap((r) => r.proposals))
    const proposalsByRequest = new Map<string, typeof proposalsWithAgents>()
    for (const p of proposalsWithAgents) {
      const list = proposalsByRequest.get(p.serviceRequestId) ?? []
      list.push(p)
      proposalsByRequest.set(p.serviceRequestId, list)
    }
    const items = withAgents.map((r) => ({
      ...r,
      proposals: proposalsByRequest.get(r.id) ?? [],
      notifiedPartners: notifiedByRequest.get(r.id) ?? []
    }))

    let stats: Record<string, number> | undefined
    if (!cursor && !ids.length) {
      const [byStatus, proposals] = await Promise.all([
        prisma.serviceRequest.groupBy({ by: ['status'], where: originWhere, _count: { _all: true } }),
        prisma.proposal.count({ where: { serviceRequest: originWhere } })
      ])
      const count = (s: ServiceRequestStatus) => byStatus.find((g) => g.status === s)?._count._all ?? 0
      stats = {
        total: byStatus.reduce((sum, g) => sum + g._count._all, 0),
        active: count('ACTIVE'),
        accepted: count('ACCEPTED'),
        expired: count('EXPIRED'),
        cancelled: count('CANCELLED'),
        proposals
      }
    }

    return NextResponse.json({ items, nextCursor, hasMore, ...(stats ? { stats } : {}) })
  } catch (error) {
    logger.error('Error fetching service requests:', error || undefined)
    return NextResponse.json(
      { error: 'Error al obtener las solicitudes' },
      { status: 500 }
    )
  }
}
