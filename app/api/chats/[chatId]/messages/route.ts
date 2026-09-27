import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { chatMessageSchema, validateRequest } from '@/lib/validation'
import { emitProposalReadBroadcast } from '@/lib/supabase-admin'
import { sendChatMessage } from '@/lib/chat/ops'
import { currentActor, opsErrorResponse } from '@/lib/ops/actor'
import { APP_ORIGIN, OpsError } from '@/lib/ops/origin'


const logger = createLogger('chats-chatId-messages')

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
    // Your GET logic here
    // For example, fetching messages for the given chatId
    return NextResponse.json({ message: `GET request for chat ${chatId}` })
  } catch (error) {
    logger.error('Error in GET request:', error || undefined)
    return NextResponse.json({ error: 'Error processing GET request' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params
  try {
    const actor = await currentActor()
    if (!actor) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validation = await validateRequest(chatMessageSchema, { chatId, content: body.content })
    if (!validation.success) return validation.error

    // Photos reach the chat only from WhatsApp (stored by us); the app sends text
    const result = await sendChatMessage(actor, chatId, { content: validation.data.content }, APP_ORIGIN)
    if (result.blocked) {
      return NextResponse.json({
        error: 'mensaje_bloqueado',
        message: `⚠️ Por tu seguridad, no puedes compartir ${result.reason} a través del chat.\n\nMantén toda la comunicación dentro de la plataforma para proteger tus datos.`,
        blocked: true,
        systemMessage: result.systemMessage,
      }, { status: 400 })
    }
    return NextResponse.json({ ...result.message, helpReply: result.helpReply })
  } catch (error) {
    if (error instanceof OpsError) return opsErrorResponse(error)
    logger.error('Error sending message:', error || undefined)
    return NextResponse.json({ error: 'Error al enviar mensaje' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const chat = await prisma.chat.findUnique({
      where: { id: chatId }
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

    const updated = await prisma.chatMessage.updateMany({
      where: {
        chatId: chatId,
        senderId: { not: session.user.id },
        read: false
      },
      data: { read: true }
    })

    if (updated.count > 0) {
      void emitProposalReadBroadcast(chat.proposalId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error marking messages as read:', error || undefined)
    return NextResponse.json({ error: 'Error al marcar mensajes como leídos' }, { status: 500 })
  }
}
