import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'


const logger = createLogger('chats')

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const proposalId = searchParams.get('proposalId')

    if (proposalId) {
      const chat = await prisma.chat.findUnique({
        where: { proposalId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' }
          }
        }
      })

      if (!chat) {
        return NextResponse.json({ error: 'Chat no encontrado' }, { status: 404 })
      }

      let isAuthorized = false

      if (chat.clientId === session.user.id) {
        isAuthorized = true
      } else if (session.user.role === 'PARTNER') {
        const partnerProfile = await prisma.partnerProfile.findUnique({
          where: { userId: session.user.id }
        })
        if (partnerProfile && chat.partnerId === partnerProfile.id) {
          isAuthorized = true
        }
      }

      if (!isAuthorized) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      }

      return NextResponse.json(chat)
    }

    const isPartner = session.user.role === 'PARTNER'
    const partnerProfile = isPartner
      ? await prisma.partnerProfile.findUnique({
          where: { userId: session.user.id }
        })
      : null

    const chats = await prisma.chat.findMany({
      where: isPartner
        ? { partnerId: partnerProfile?.id }
        : { clientId: session.user.id },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { updatedAt: 'desc' }
    })

    return NextResponse.json(chats)
  } catch (error) {
    logger.error('Error fetching chats:', error || undefined)
    return NextResponse.json({ error: 'Error al obtener chats' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { proposalId } = await request.json()

    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        serviceRequest: true,
        partner: true
      }
    })

    if (!proposal) {
      return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
    }

    if (
      proposal.serviceRequest.userId !== session.user.id &&
      proposal.partner.userId !== session.user.id
    ) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const existingChat = await prisma.chat.findUnique({
      where: { proposalId }
    })

    if (existingChat) {
      return NextResponse.json(existingChat)
    }

    const chat = await prisma.chat.create({
      data: {
        proposalId,
        serviceRequestId: proposal.serviceRequestId,
        clientId: proposal.serviceRequest.userId,
        partnerId: proposal.partnerId
      },
      include: {
        messages: true
      }
    })

    return NextResponse.json(chat)
  } catch (error) {
    logger.error('Error creating chat:', error || undefined)
    return NextResponse.json({ error: 'Error al crear chat' }, { status: 500 })
  }
}
