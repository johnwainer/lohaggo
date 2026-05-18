import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const logger = createLogger('twilio-inbound')

function normalizePhone(raw: string): string {
  // Strip "whatsapp:" prefix Twilio adds for WA numbers
  return raw.replace(/^whatsapp:/i, '').trim()
}

export async function POST(request: NextRequest) {
  // Validate Twilio token if configured
  const token = request.nextUrl.searchParams.get('token')
  if (env.SECURITY_INTERNAL_TOKEN && token !== env.SECURITY_INTERNAL_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const from = String(formData.get('From') || '')
  const body = String(formData.get('Body') || '')
  const messageSid = String(formData.get('MessageSid') || '')
  const numMedia = parseInt(String(formData.get('NumMedia') || '0'), 10)
  const mediaUrl = numMedia > 0 ? String(formData.get('MediaUrl0') || '') : undefined

  if (!from) {
    return new NextResponse('<?xml version="1.0"?><Response/>', { headers: { 'Content-Type': 'text/xml' } })
  }

  const isWhatsApp = from.toLowerCase().startsWith('whatsapp:')
  const channel = isWhatsApp ? 'WHATSAPP' : 'SMS'
  const contactPhone = normalizePhone(from)

  // Try to identify the user by phone number
  const user = await prisma.user.findFirst({
    where: { phone: contactPhone },
    select: { id: true, name: true },
  })

  // Find or create conversation
  let conversation = await prisma.conversation.findUnique({
    where: { channel_contactPhone: { channel, contactPhone } },
  })

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        channel,
        contactPhone,
        contactName: user?.name || null,
        userId: user?.id || null,
        status: 'OPEN',
        lastMessageAt: new Date(),
        lastMessageBody: body.slice(0, 200),
        unreadCount: 1,
      },
    })
    logger.info('New conversation created', { conversationId: conversation.id, channel, contactPhone })
  } else {
    // Re-open closed conversations when they write again
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: conversation.status === 'CLOSED' ? 'OPEN' : conversation.status,
        lastMessageAt: new Date(),
        lastMessageBody: body.slice(0, 200),
        unreadCount: { increment: 1 },
        userId: user?.id || conversation.userId,
        contactName: user?.name || conversation.contactName,
      },
    })
  }

  // Save the inbound message
  await prisma.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      direction: 'INBOUND',
      body,
      mediaUrl: mediaUrl || null,
      providerMessageId: messageSid || null,
      status: 'DELIVERED',
      deliveredAt: new Date(),
    },
  })

  logger.info('Inbound message saved', { conversationId: conversation.id, messageSid })

  // Respond with empty TwiML so Twilio doesn't auto-reply
  return new NextResponse('<?xml version="1.0"?><Response/>', {
    headers: { 'Content-Type': 'text/xml' },
  })
}
