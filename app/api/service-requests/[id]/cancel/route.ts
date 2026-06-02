import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyProposalRejected } from '@/lib/notifications/notificationService'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const logger = createLogger('service-requests-cancel')

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await params

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        proposals: { select: { id: true, status: true } },
      },
    })

    if (!serviceRequest) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
    }
    if (serviceRequest.userId !== session.user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }
    if (serviceRequest.status !== 'ACTIVE') {
      return NextResponse.json(
        { error: 'Solo se pueden cancelar solicitudes activas' },
        { status: 400 }
      )
    }

    const pendingProposalIds = serviceRequest.proposals
      .filter((p) => p.status === 'PENDING')
      .map((p) => p.id)

    await prisma.$transaction([
      prisma.serviceRequest.update({
        where: { id },
        data: { status: 'CANCELLED' },
      }),
      ...(pendingProposalIds.length > 0
        ? [
            prisma.proposal.updateMany({
              where: { id: { in: pendingProposalIds } },
              data: { status: 'REJECTED' },
            }),
          ]
        : []),
    ])

    for (const proposalId of pendingProposalIds) {
      try {
        await notifyProposalRejected(proposalId)
      } catch (err) {
        logger.warn('Notify rejected failed (non-fatal)', { proposalId, err })
      }
    }

    return NextResponse.json({ ok: true, cancelledProposals: pendingProposalIds.length })
  } catch (error) {
    logger.error('Error cancelling service request', error)
    return NextResponse.json({ error: 'Error al cancelar la solicitud' }, { status: 500 })
  }
}
