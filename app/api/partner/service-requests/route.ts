import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { recordPromptContext } from '@/lib/pwa/adoption-strategy'

export const dynamic = 'force-dynamic'


const logger = createLogger('partner-service-requests')

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (session.user.role !== 'PARTNER') {
      return NextResponse.json({ error: 'Solo partners pueden acceder' }, { status: 403 })
    }

    // Get partner profile
    const partnerProfile = await prisma.partnerProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        services: {
          include: {
            service: true
          }
        }
      }
    })

    if (!partnerProfile) {
      return NextResponse.json({ error: 'Perfil de partner no encontrado' }, { status: 404 })
    }

    // Get service IDs that this partner offers
    const partnerServiceIds = partnerProfile.services.map(ps => ps.serviceId)

    // Get active service requests for services this partner offers
    const serviceRequests = await prisma.serviceRequest.findMany({
      where: {
        OR: [
          {
            // General requests for services this partner offers
            serviceId: {
              in: partnerServiceIds
            },
            partnerId: null,
            status: 'ACTIVE',
            expiresAt: {
              gte: new Date()
            }
          },
          {
            // Direct requests to this partner
            partnerId: partnerProfile.id,
            status: 'ACTIVE',
            expiresAt: {
              gte: new Date()
            }
          }
        ]
      },
      include: {
        service: {
          include: {
            category: true
          }
        },
        user: {
          select: {
            name: true,
            email: true,
            phone: true
          }
        },
        proposals: {
          where: {
            partnerId: partnerProfile.id
          }
        },
        photos: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    const hasRecentLead = serviceRequests.some((item) => {
      const createdAt = new Date(item.createdAt)
      return createdAt.getTime() >= Date.now() - 2 * 60 * 60 * 1000
    })

    if (hasRecentLead) {
      await recordPromptContext(session.user.id, 'PARTNER_LEAD_RECEIVED', {
        recentLeads: serviceRequests.length,
      }).catch(() => undefined)
    }

    return NextResponse.json(serviceRequests)
  } catch (error) {
    logger.error('Error fetching service requests for partner:', error)
    return NextResponse.json(
      { error: 'Error al obtener las solicitudes' },
      { status: 500 }
    )
  }
}
