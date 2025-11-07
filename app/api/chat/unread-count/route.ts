import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

const logger = createLogger('chat-unread-count')

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      logger.warn('Unauthorized access attempt - no session')
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const proposalId = searchParams.get('proposalId')

    if (!proposalId) {
      logger.warn('Missing proposalId parameter', { userId: session.user.id })
      return NextResponse.json({ error: 'proposalId requerido' }, { status: 400 })
    }

    logger.debug('Fetching unread count', {
      userId: session.user.id,
      role: session.user.role,
      proposalId
    })

    const chat = await prisma.chat.findUnique({
      where: { proposalId },
      select: {
        id: true,
        clientId: true,
        partnerId: true,
        serviceRequestId: true
      }
    })

    if (!chat) {
      logger.debug('Chat not found', { proposalId })
      return NextResponse.json({ count: 0 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        partnerProfile: {
          select: { id: true }
        }
      }
    })

    const isClient = chat.clientId === session.user.id
    const isPartner = user?.partnerProfile?.id === chat.partnerId

    logger.debug('Authorization check', {
      userId: session.user.id,
      isClient,
      isPartner,
      chatId: chat.id
    })

    if (!isClient && !isPartner) {
      logger.warn('User not authorized for chat', {
        userId: session.user.id,
        chatId: chat.id
      })
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const unreadMessages = await prisma.chatMessage.findMany({
      where: {
        chatId: chat.id,
        senderId: { not: session.user.id },
        read: false
      },
      select: {
        id: true,
        senderId: true,
        content: true,
        createdAt: true
      }
    })

    logger.debug('Unread messages retrieved', {
      chatId: chat.id,
      count: unreadMessages.length
    })

    return NextResponse.json({ count: unreadMessages.length })
  } catch (error) {
    logger.error('Error fetching unread count', error)
    return NextResponse.json(
      { error: 'Error al obtener mensajes no leídos' },
      { status: 500 }
    )
  }
}