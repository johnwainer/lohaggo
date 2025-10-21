import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

interface ServiceRequestWithProposals {
  id: string
  address: string
  notes?: string
  city: string
  status: string
  expiresAt: string
  createdAt: string
  serviceId: string
  userId: string
  proposals: Array<{
    id: string
    status: string
  }>
  _count: {
    proposals: number
  }
}

// GET - Obtener solicitudes activas disponibles para el partner actual
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar que el usuario es un partner
    const partnerProfile = await prisma.partnerProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        services: {
          where: { active: true },
          include: {
            service: true
          }
        }
      }
    })

    if (!partnerProfile) {
      return NextResponse.json({ error: 'Solo los partners pueden ver solicitudes activas' }, { status: 403 })
    }

    // Obtener los IDs de servicios que ofrece este partner
    const serviceIds = partnerProfile.services.map(ps => ps.serviceId)

    if (serviceIds.length === 0) {
      return NextResponse.json([])
    }

    // Obtener solicitudes activas para servicios que ofrece este partner
    // Solo incluir solicitudes donde el partner no ha enviado ya una propuesta
    const activeRequests = await prisma.serviceRequest.findMany({
      where: {
        status: 'ACTIVE',
        serviceId: { in: serviceIds },
        expiresAt: { gt: new Date() }, // Solo solicitudes que no han expirado
        // Excluir solicitudes donde este partner ya envió una propuesta
        NOT: {
          proposals: {
            some: {
              partnerId: partnerProfile.id
            }
          }
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
            phone: true
          }
        },
        proposals: {
          where: {
            partnerId: partnerProfile.id
          },
          select: {
            id: true,
            status: true
          }
        },
        _count: {
          select: {
            proposals: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Filtrar solo las solicitudes donde el partner ofrece el servicio en la ciudad correspondiente
    const availableRequests = activeRequests.filter((request: ServiceRequestWithProposals) => {
      return partnerProfile.services.some(ps =>
        ps.serviceId === request.serviceId && ps.city === request.city
      )
    })

    return NextResponse.json(availableRequests)
  } catch (error) {
    console.error('Error fetching active service requests:', error)
    return NextResponse.json({ error: 'Error al obtener las solicitudes activas' }, { status: 500 })
  }
}