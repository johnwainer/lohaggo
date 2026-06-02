import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { validateRequest } from '@/lib/validation'
import { proposalCreateSchema } from '@/lib/validation/proposal-schemas'
import { notifyNewProposal } from '@/lib/notifications/notificationService'

export const dynamic = 'force-dynamic'


const logger = createLogger('partner-proposals')

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    if (session.user.role !== 'PARTNER') {
      return NextResponse.json({ error: 'Solo partners pueden crear propuestas' }, { status: 403 })
    }

    const body = await req.json()

    const validation = await validateRequest(proposalCreateSchema, body)
    if (!validation.success) {
      return validation.error
    }

    const { serviceRequestId, price, notes } = validation.data

    // Get partner profile
    const partnerProfile = await prisma.partnerProfile.findUnique({
      where: { userId: session.user.id }
    })

    if (!partnerProfile) {
      return NextResponse.json({ error: 'Perfil de partner no encontrado' }, { status: 404 })
    }

    // Verify service request exists and is active
    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId },
      include: {
        service: true
      }
    })

    if (!serviceRequest) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
    }

    if (serviceRequest.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Esta solicitud ya no está activa' }, { status: 400 })
    }

    if (new Date(serviceRequest.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Esta solicitud ha expirado' }, { status: 400 })
    }

    if (price < serviceRequest.service.basePrice) {
      return NextResponse.json({
        error: `El precio de la propuesta no puede ser menor al precio base del servicio ($${serviceRequest.service.basePrice})`
      }, { status: 400 })
    }

    // Check if partner already has a proposal for this request
    const existingProposal = await prisma.proposal.findUnique({
      where: {
        serviceRequestId_partnerId: {
          serviceRequestId,
          partnerId: partnerProfile.id
        }
      }
    })

    if (existingProposal) {
      return NextResponse.json({ error: 'Ya has enviado una propuesta para esta solicitud' }, { status: 400 })
    }

    // Create proposal
    const proposal = await prisma.proposal.create({
      data: {
        serviceRequestId,
        partnerId: partnerProfile.id,
        price,
        notes: notes || null,
        status: 'PENDING'
      },
      include: {
        serviceRequest: {
          include: {
            service: true,
            user: {
              select: {
                name: true,
                email: true
              }
            }
          }
        }
      }
    })

    await notifyNewProposal(proposal.id)

    return NextResponse.json(proposal, { status: 201 })
  } catch (error) {
    logger.error('Error creating proposal:', error || undefined)
    return NextResponse.json(
      { error: 'Error al crear la propuesta' },
      { status: 500 }
    )
  }
}
