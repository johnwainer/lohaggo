import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'


const logger = createLogger('admin-service-requests')

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

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const serviceRequests = await prisma.serviceRequest.findMany({
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
      orderBy: { createdAt: 'desc' }
    })

    const requestIds = serviceRequests.map((r) => r.id)
    const oldest = serviceRequests.length
      ? serviceRequests[serviceRequests.length - 1].createdAt
      : null

    const notifiedByRequest = new Map<string, NotifiedPartner[]>()
    if (requestIds.length && oldest) {
      const notifications = await prisma.notification.findMany({
        where: {
          type: 'NEW_SERVICE_REQUEST',
          createdAt: { gte: oldest },
          user: { role: 'PARTNER' }
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
        if (!reqId || !requestIds.includes(reqId)) continue
        const list = notifiedByRequest.get(reqId) ?? []
        if (list.some((p) => p.userId === n.user.id)) continue
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

    const result = serviceRequests.map((r) => ({
      ...r,
      notifiedPartners: notifiedByRequest.get(r.id) ?? []
    }))

    return NextResponse.json(result)
  } catch (error) {
    logger.error('Error fetching service requests:', error || undefined)
    return NextResponse.json(
      { error: 'Error al obtener las solicitudes' },
      { status: 500 }
    )
  }
}
