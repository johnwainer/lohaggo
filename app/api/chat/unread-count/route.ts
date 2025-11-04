import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.log('[UNREAD COUNT] No session found')
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const proposalId = searchParams.get('proposalId')

    if (!proposalId) {
      console.log('[UNREAD COUNT] No proposalId provided')
      return NextResponse.json({ error: 'proposalId requerido' }, { status: 400 })
    }

    console.log('[UNREAD COUNT] Request from user:', {
      userId: session.user.id,
      role: session.user.role,
      email: session.user.email,
      proposalId
    })

    // Obtener el chat
    const chat = await prisma.chat.findUnique({
      where: { proposalId },
      select: {
        id: true,
        clientId: true,
        partnerId: true,
        serviceRequestId: true
      }
    })

    console.log('[UNREAD COUNT] Chat found:', chat)

    if (!chat) {
      console.log('[UNREAD COUNT] No chat found for proposalId:', proposalId)
      return NextResponse.json({ count: 0 })
    }

    // Verificar que el usuario sea parte del chat
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        partnerProfile: {
          select: { id: true }
        }
      }
    })

    console.log('[UNREAD COUNT] User data:', {
      userId: user?.id,
      userRole: user?.role,
      partnerProfileId: user?.partnerProfile?.id,
      chatClientId: chat.clientId,
      chatPartnerId: chat.partnerId
    })

    const isClient = chat.clientId === session.user.id
    const isPartner = user?.partnerProfile?.id === chat.partnerId

    console.log('[UNREAD COUNT] Authorization check:', {
      isClient,
      isPartner,
      willAllow: isClient || isPartner
    })

    if (!isClient && !isPartner) {
      console.log('[UNREAD COUNT] User not authorized for this chat')
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Contar mensajes no leídos del otro usuario
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

    console.log('[UNREAD COUNT] Unread messages:', {
      count: unreadMessages.length,
      messages: unreadMessages.map(m => ({
        id: m.id,
        senderId: m.senderId,
        preview: m.content.substring(0, 50),
        createdAt: m.createdAt
      }))
    })

    return NextResponse.json({ count: unreadMessages.length })
  } catch (error) {
    console.error('[UNREAD COUNT] Error:', error)
    return NextResponse.json(
      { error: 'Error al obtener mensajes no leídos' },
      { status: 500 }
    )
  }
}