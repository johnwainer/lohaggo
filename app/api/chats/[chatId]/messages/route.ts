import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { chatMessageSchema, validateRequest } from '@/lib/validation'
import { createNotification } from '@/lib/notifications/notificationService'
import { emitProposalBroadcast, emitProposalReadBroadcast } from '@/lib/supabase-admin'

function detectContactInfo(message: string): { isValid: boolean; reason?: string } {
  const lowerMessage = message.toLowerCase()
  const normalizedMessage = message.replace(/\s+/g, '')

  const phonePatterns = [
    /\b\d{10}\b/g,
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    /\b\d{3}[-.\s]?\d{7}\b/g,
    /\(\d{3}\)\s*\d{3}[-.\s]?\d{4}/g,
    /\+?\d{1,3}[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g,
    /\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    /\b3\d{9}\b/g,
    /\b[3][0-9]{2}[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
    /\bcel[:\s]*\d+/gi,
    /\bcelular[:\s]*\d+/gi,
    /\bwhatsapp[:\s]*\d+/gi,
    /\bwpp[:\s]*\d+/gi,
    /\btel[:\s]*\d+/gi,
    /\bteléfono[:\s]*\d+/gi,
    /\btelefono[:\s]*\d+/gi,
    /\bmóvil[:\s]*\d+/gi,
    /\bmovil[:\s]*\d+/gi,
  ]

  for (const pattern of phonePatterns) {
    if (pattern.test(message) || pattern.test(normalizedMessage)) {
      return {
        isValid: false,
        reason: 'números de teléfono'
      }
    }
  }

  const emailPatterns = [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    /\b[A-Za-z0-9._%+-]+\s*@\s*[A-Za-z0-9.-]+\s*\.\s*[A-Z|a-z]{2,}\b/g,
    /\b[A-Za-z0-9._%+-]+\s*\[\s*@\s*\]\s*[A-Za-z0-9.-]+\s*\[\s*\.\s*\]\s*[A-Z|a-z]{2,}\b/g,
    /\b[A-Za-z0-9._%+-]+\s*\(\s*@\s*\)\s*[A-Za-z0-9.-]+\s*\(\s*\.\s*\)\s*[A-Z|a-z]{2,}\b/g,
    /\b[A-Za-z0-9._%+-]+\s+arroba\s+[A-Za-z0-9.-]+\s+punto\s+[A-Z|a-z]{2,}\b/gi,
    /\bcorreo[:\s]*[A-Za-z0-9._%+-]+/gi,
    /\bemail[:\s]*[A-Za-z0-9._%+-]+/gi,
    /\be-mail[:\s]*[A-Za-z0-9._%+-]+/gi,
  ]

  for (const pattern of emailPatterns) {
    if (pattern.test(message)) {
      return {
        isValid: false,
        reason: 'correos electrónicos'
      }
    }
  }

  const socialMediaPatterns = [
    /\b(?:instagram|insta|ig)[:\s]*[@]?[A-Za-z0-9._]+/gi,
    /\b(?:facebook|fb)[:\s]*[A-Za-z0-9._]+/gi,
    /\b(?:twitter|x\.com)[:\s]*[@]?[A-Za-z0-9._]+/gi,
    /\b(?:telegram|tg)[:\s]*[@]?[A-Za-z0-9._]+/gi,
    /\b(?:tiktok|tt)[:\s]*[@]?[A-Za-z0-9._]+/gi,
    /\b(?:linkedin)[:\s]*[A-Za-z0-9._]+/gi,
    /\b(?:snapchat|snap)[:\s]*[A-Za-z0-9._]+/gi,
    /\b@[A-Za-z0-9._]{3,}/g,
  ]

  for (const pattern of socialMediaPatterns) {
    if (pattern.test(message)) {
      return {
        isValid: false,
        reason: 'redes sociales'
      }
    }
  }

  const contactKeywords = [
    'llámame', 'llamame', 'llama me', 'llamá', 'llama',
    'escríbeme', 'escribeme', 'escribe me', 'escribí',
    'contáctame', 'contactame', 'contacta me',
    'mi número', 'mi numero', 'mi cel', 'mi celular', 'mi móvil', 'mi movil',
    'mi correo', 'mi email', 'mi e-mail', 'mi mail',
    'mi whatsapp', 'mi wpp', 'mi whats',
    'mi instagram', 'mi insta', 'mi ig',
    'mi facebook', 'mi fb',
    'mi telegram', 'mi tg',
    'agrégame', 'agregame', 'agrega me',
    'búscame', 'buscame', 'busca me',
    'añádeme', 'añademe', 'añade me',
    'fuera de la plataforma', 'fuera de aquí', 'fuera de aqui',
    'por fuera', 'afuera',
  ]

  for (const keyword of contactKeywords) {
    if (lowerMessage.includes(keyword)) {
      return {
        isValid: false,
        reason: 'solicitudes de contacto externo'
      }
    }
  }

  const obfuscatedPatterns = [
    /\b\d+\s*\d+\s*\d+\s*\d+\s*\d+\s*\d+\s*\d+\s*\d+\s*\d+\s*\d+\b/g,
    /\b\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d[\s.-]*\d\b/g,
    /\b[a-z0-9]+\s*\*+\s*[a-z0-9]+\s*@/gi,
    /\b[a-z0-9]+\s*\[at\]\s*[a-z0-9]+/gi,
    /\b[a-z0-9]+\s*\(at\)\s*[a-z0-9]+/gi,
  ]

  for (const pattern of obfuscatedPatterns) {
    if (pattern.test(message) || pattern.test(normalizedMessage)) {
      return {
        isValid: false,
        reason: 'información de contacto ofuscada'
      }
    }
  }

  return { isValid: true }
}


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
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()

    const validation = await validateRequest(chatMessageSchema, {
      chatId: chatId,
      content: body.content
    })

    if (!validation.success) {
      return validation.error
    }

    const { content } = validation.data

    const contactValidation = detectContactInfo(content)
    if (!contactValidation.isValid) {
      const chat = await prisma.chat.findUnique({
        where: { id: chatId }
      })

      if (!chat) {
        return NextResponse.json({ error: 'Chat no encontrado' }, { status: 404 })
      }

      let isAuthorized = false
      let partnerProfile = null

      if (chat.clientId === session.user.id) {
        isAuthorized = true
      } else if (session.user.role === 'PARTNER') {
        partnerProfile = await prisma.partnerProfile.findUnique({
          where: { userId: session.user.id }
        })
        if (partnerProfile && chat.partnerId === partnerProfile.id) {
          isAuthorized = true
        }
      }

      if (!isAuthorized) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      }

      const warningMessage = `⚠️ MENSAJE BLOQUEADO\n\nSe intentó compartir ${contactValidation.reason}. Por seguridad, no se permite compartir información de contacto.\n\nMantén la comunicación dentro de la plataforma.`

      const systemMessage = await prisma.chatMessage.create({
        data: {
          chatId: chatId,
          senderId: 'SYSTEM',
          content: warningMessage
        }
      })

      await prisma.chat.update({
        where: { id: chatId },
        data: { updatedAt: new Date() }
      })

      void emitProposalBroadcast(chat.proposalId)

      let recipientUserId: string | null = null

      if (chat.clientId === session.user.id) {
        const partner = await prisma.partnerProfile.findUnique({
          where: { id: chat.partnerId },
          include: { user: true }
        })
        recipientUserId = partner?.userId || null
      } else {
        recipientUserId = chat.clientId
      }

      if (recipientUserId) {
        await createNotification({
          userId: recipientUserId,
          type: 'NEW_MESSAGE',
          title: 'Alerta de seguridad',
          message: 'Se bloqueó un intento de compartir información de contacto en el chat',
          data: {
            chatId,
            targetUrl: session.user.role === 'PARTNER' ? '/dashboard' : '/partner',
          },
        })
      }

      return NextResponse.json({
        error: 'mensaje_bloqueado',
        message: `⚠️ Por tu seguridad, no puedes compartir ${contactValidation.reason} a través del chat.\n\nMantén toda la comunicación dentro de la plataforma para proteger tus datos.`,
        blocked: true,
        systemMessage
      }, { status: 400 })
    }

    const chat = await prisma.chat.findUnique({
      where: { id: chatId }
    })

    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    }

    let isAuthorized = false
    let partnerProfile = null

    if (chat.clientId === session.user.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isActive: true }
      })
      if (!user?.isActive) {
        return NextResponse.json({ error: 'Your account is inactive. Please contact the administrator.' }, { status: 403 })
      }
      isAuthorized = true
    } else if (session.user.role === 'PARTNER') {
      partnerProfile = await prisma.partnerProfile.findUnique({
        where: { userId: session.user.id }
      })
      if (partnerProfile && chat.partnerId === partnerProfile.id) {
        if (!partnerProfile.isActive) {
          return NextResponse.json({ error: 'Your account is inactive. Please contact the administrator.' }, { status: 403 })
        }
        isAuthorized = true
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const message = await prisma.chatMessage.create({
      data: {
        chatId: chatId,
        senderId: session.user.id,
        content: content.trim()
      }
    })

    await prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() }
    })

    void emitProposalBroadcast(chat.proposalId)

    let recipientUserId: string | null = null

    if (chat.clientId === session.user.id) {
      const partner = await prisma.partnerProfile.findUnique({
        where: { id: chat.partnerId },
        include: { user: true }
      })
      recipientUserId = partner?.userId || null
    } else {
      recipientUserId = chat.clientId
    }

    if (recipientUserId) {
      await createNotification({
        userId: recipientUserId,
        type: 'NEW_MESSAGE',
        title: 'Nuevo mensaje',
        message: `${session.user.name} te ha enviado un mensaje`,
        data: {
          chatId,
          targetUrl: session.user.role === 'PARTNER' ? '/dashboard' : '/partner',
        },
      })
    }

    return NextResponse.json(message)
  } catch (error) {
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
