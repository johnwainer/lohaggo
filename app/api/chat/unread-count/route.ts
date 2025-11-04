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

    // Obtener el chat
    const chat = await prisma.chat.findUnique({
      where: { proposalId },
      select: { id: true, clientId: true, partnerId: true }
    })

    if (!chat) {
      return NextResponse.json({ count: 0 })
    }

    // Verificar que el usuario sea parte del chat
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { partnerProfile: true }
    })

    const isClient = chat.clientId === session.user.id
    const isPartner = user?.partnerProfile?.id === chat.partnerId

    if (!isClient && !isPartner) {
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

    return NextResponse.json({ count: unreadCount })
  } catch (error) {
    console.error('Error al obtener mensajes no leídos:', error)
    return NextResponse.json(
      { error: 'Error al obtener mensajes no leídos' },
      { status: 500 }
    )
  }
}
