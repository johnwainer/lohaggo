import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyProposalAccepted, notifyProposalRejected } from '@/lib/notifications/notificationService'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const proposalId = params.id

    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        serviceRequest: {
          include: {
            user: true,
            service: true
          }
        },
        partner: {
          include: {
            user: true
          }
        }
      }
    })

    if (!proposal) {
      return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
    }

    if (proposal.serviceRequest.userId !== session.user.id) {
      return NextResponse.json({ error: 'No tienes permiso para aceptar esta propuesta' }, { status: 403 })
    }

    if (proposal.serviceRequest.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Esta solicitud ya no está activa' }, { status: 400 })
    }

    if (proposal.status !== 'PENDING') {
      return NextResponse.json({ error: 'Esta propuesta ya no está disponible' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.proposal.update({
        where: { id: proposalId },
        data: { status: 'ACCEPTED' }
      })

      const rejectedProposals = await tx.proposal.findMany({
        where: {
          serviceRequestId: proposal.serviceRequestId,
          id: { not: proposalId }
        }
      })

      await tx.proposal.updateMany({
        where: {
          serviceRequestId: proposal.serviceRequestId,
          id: { not: proposalId }
        },
        data: { status: 'REJECTED' }
      })

      await tx.serviceRequest.update({
        where: { id: proposal.serviceRequest.id },
        data: { status: 'ACCEPTED' }
      })

      const booking = await tx.booking.create({
        data: {
          userId: proposal.serviceRequest.userId,
          serviceId: proposal.serviceRequest.serviceId,
          partnerId: proposal.partnerId,
          scheduledDate: new Date(),
          scheduledTime: '09:00',
          address: proposal.serviceRequest.address,
          notes: proposal.serviceRequest.notes,
          city: proposal.serviceRequest.city,
          status: 'PENDING',
          totalPrice: proposal.price
        },
        include: {
          service: true,
          user: {
            select: {
              name: true,
              phone: true
            }
          },
          partner: {
            include: {
              user: {
                select: {
                  name: true,
                  phone: true
                }
              }
            }
          }
        }
      })

      for (const rejectedProposal of rejectedProposals) {
        await notifyProposalRejected(rejectedProposal.id)
      }

      return booking
    })

    await notifyProposalAccepted(proposalId)

    return NextResponse.json({
      message: 'Propuesta aceptada exitosamente',
      booking: result
    })
  } catch (error) {
    console.error('Error accepting proposal:', error)
    return NextResponse.json({ error: 'Error al aceptar la propuesta' }, { status: 500 })
  }
}