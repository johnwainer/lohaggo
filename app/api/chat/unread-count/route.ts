import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
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

    console.log('[UNREAD COUNT] Usuario:', session.user.id, 'Role:', session.user.role, 'ProposalId:', proposalId)

    // Obtener el chat
    const chat = await prisma.chat.findUnique({
      where: { proposalId },
      select: { id: true, clientId: true, partnerId: true }
    })

    console.log('[UNREAD COUNT] Chat encontrado:', chat)

    if (!chat) {
      console.log('[UNREAD COUNT] No se encontró chat para proposalId:', proposalId)
      return NextResponse.json({ count: 0 })
    }

    // Verificar que el usuario sea parte del chat
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { partnerProfile: true }
    })

    console.log('[UNREAD COUNT] Usuario completo:', {
      userId: user?.id,
      partnerProfileId: user?.partnerProfile?.id,
      chatClientId: chat.clientId,
      chatPartnerId: chat.partnerId
    })

    const isClient = chat.clientId === session.user.id
    const isPartner = user?.partnerProfile?.id === chat.partnerId

    console.log('[UNREAD COUNT] Permisos:', { isClient, isPartner })

    if (!isClient && !isPartner) {
      console.log('[UNREAD COUNT] Usuario no autorizado')
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Contar mensajes no leídos del otro usuario
    const unreadCount = await prisma.chatMessage.count({
      where: {
        chatId: chat.id,
        senderId: { not: session.user.id },
        read: false
      }
    })

    console.log('[UNREAD COUNT] Mensajes no leídos:', unreadCount)

    return NextResponse.json({ count: unreadCount })
  } catch (error) {
    console.error('[UNREAD COUNT] Error:', error)
    return NextResponse.json(
      { error: 'Error al obtener mensajes no leídos' },
      { status: 500 }
    )
  }
}