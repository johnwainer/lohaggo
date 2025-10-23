import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

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
        serviceId: {
          in: partnerServiceIds
        },
        status: 'ACTIVE',
        expiresAt: {
          gte: new Date()
        }
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
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(serviceRequests)
  } catch (error) {
    console.error('Error fetching service requests for partner:', error)
    return NextResponse.json(
      { error: 'Error al obtener las solicitudes' },
      { status: 500 }
    )
  }
}
