import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { apiRateLimiter } from '@/lib/rate-limit'

const logger = createLogger('chat-unread-count')

async function handleGET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const proposalId = searchParams.get('proposalId')

    if (!proposalId) {
      return NextResponse.json({ error: 'proposalId requerido' }, { status: 400 })
    }

    const chat = await prisma.chat.findUnique({
      where: { proposalId },
      select: { id: true, clientId: true, partnerId: true },
    })

    if (!chat) {
      return NextResponse.json({ count: 0 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { partnerProfile: { select: { id: true } } },
    })

    const isClient = chat.clientId === session.user.id
    const isPartner = user?.partnerProfile?.id === chat.partnerId

    if (!isClient && !isPartner) {
      logger.warn('User not authorized for chat', {
        userId: session.user.id,
        chatId: chat.id,
      })
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const count = await prisma.chatMessage.count({
      where: {
        chatId: chat.id,
        senderId: { not: session.user.id },
        read: false,
      },
    })

    return NextResponse.json({ count })
  } catch (error) {
    logger.error('Error fetching unread count', error)
    return NextResponse.json(
      { error: 'Error al obtener mensajes no leídos' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return apiRateLimiter(request, handleGET)
}