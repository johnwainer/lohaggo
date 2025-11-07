import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyNewProposal } from '@/lib/notifications/notificationService'
import { createLogger } from '@/lib/logger'
import { proposalSchema, validateRequest } from '@/lib/validation'

export const dynamic = 'force-dynamic'

const logger = createLogger('proposals')

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await req.json()

    const validation = await validateRequest(proposalSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const validatedData = validation.data

    const partnerProfile = await prisma.partnerProfile.findUnique({
      where: { userId: session.user.id }
    })

    if (!partnerProfile) {
      return NextResponse.json({ error: 'Solo los partners pueden enviar propuestas' }, { status: 403 })
    }

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id: validatedData.serviceRequestId },
      include: {
        service: true,
        photos: true
      }
    })

    if (!serviceRequest) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
    }

    if (serviceRequest.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Esta solicitud ya no está activa' }, { status: 400 })
    }

    if (validatedData.price < serviceRequest.service.basePrice) {
      return NextResponse.json({
        error: `El precio de la propuesta no puede ser menor al precio base del servicio ($${serviceRequest.service.basePrice})`
      }, { status: 400 })
    }

    const partnerService = await prisma.partnerService.findFirst({
      where: {
        partnerId: partnerProfile.id,
        serviceId: serviceRequest.serviceId,
        city: serviceRequest.city,
        active: true
      }
    })

    if (!partnerService) {
      return NextResponse.json({
        error: 'No ofreces este servicio en la ciudad solicitada'
      }, { status: 400 })
    }

    const existingProposal = await prisma.proposal.findUnique({
      where: {
        serviceRequestId_partnerId: {
          serviceRequestId: validatedData.serviceRequestId,
          partnerId: partnerProfile.id
        }
      }
    })

    if (existingProposal) {
      return NextResponse.json({ error: 'Ya has enviado una propuesta para esta solicitud' }, { status: 400 })
    }

    const proposal = await prisma.proposal.create({
      data: {
        serviceRequestId: validatedData.serviceRequestId,
        partnerId: partnerProfile.id,
        price: validatedData.price,
        notes: validatedData.description
      },
      include: {
        partner: {
          include: {
            user: {
              select: {
                name: true
              }
            }
          }
        },
        serviceRequest: {
          include: {
            service: true,
            user: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })

    await notifyNewProposal(proposal.id)

    return NextResponse.json(proposal)
  } catch (error) {
    logger.error('Error creating proposal:', error || undefined)
    return NextResponse.json({ error: 'Error al crear la propuesta' }, { status: 500 })
  }
}

// GET - Obtener propuestas del partner actual
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar que el usuario es un partner
    const partnerProfile = await prisma.partnerProfile.findUnique({
      where: { userId: session.user.id }
    })

    if (!partnerProfile) {
      return NextResponse.json({ error: 'Solo los partners pueden ver propuestas' }, { status: 403 })
    }

    const proposals = await prisma.proposal.findMany({
      where: {
        partnerId: partnerProfile.id
      },
      include: {
        serviceRequest: {
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
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(proposals)
  } catch (error) {
    logger.error('Error fetching proposals:', error || undefined)
    return NextResponse.json({ error: 'Error al obtener las propuestas' }, { status: 500 })
  }
}