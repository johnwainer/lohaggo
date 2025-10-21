import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'

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
    
    if (!body.serviceRequestId || !body.price) {
      return NextResponse.json({ error: 'Solicitud y precio son requeridos' }, { status: 400 })
    }

    // Get partner profile
    const partnerProfile = await prisma.partnerProfile.findUnique({
      where: { userId: session.user.id }
    })

    if (!partnerProfile) {
      return NextResponse.json({ error: 'Perfil de partner no encontrado' }, { status: 404 })
    }

    // Verify service request exists and is active
    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id: body.serviceRequestId }
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

    // Check if partner already has a proposal for this request
    const existingProposal = await prisma.proposal.findUnique({
      where: {
        serviceRequestId_partnerId: {
          serviceRequestId: body.serviceRequestId,
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
        serviceRequestId: body.serviceRequestId,
        partnerId: partnerProfile.id,
        price: parseFloat(body.price),
        notes: body.notes || null,
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

    return NextResponse.json(proposal, { status: 201 })
  } catch (error) {
    console.error('Error creating proposal:', error)
    return NextResponse.json(
      { error: 'Error al crear la propuesta' }, 
      { status: 500 }
    )
  }
}
