export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'

const STATUS_MAP: Record<string, string> = {
  sent: 'SENT',
  delivered: 'DELIVERED',
  read: 'DELIVERED',
  failed: 'FAILED',
  undelivered: 'FAILED',
}

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (env.SECURITY_INTERNAL_TOKEN && token !== env.SECURITY_INTERNAL_TOKEN) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const formData = await request.formData()
  const messageSid = String(formData.get('MessageSid') || '')
  const messageStatus = String(formData.get('MessageStatus') || '').toLowerCase()

  if (!messageSid || !STATUS_MAP[messageStatus]) return new NextResponse('OK')

  const updated = await prisma.conversationMessage.updateMany({
    where: { providerMessageId: messageSid },
    data: {
      status: STATUS_MAP[messageStatus] as 'SENT' | 'DELIVERED' | 'FAILED',
      deliveredAt:
        messageStatus === 'delivered' || messageStatus === 'read' ? new Date() : undefined,
    },
  })

  if (updated.count > 0) {
    // Find conversation to emit SSE event
    const msg = await prisma.conversationMessage.findFirst({
      where: { providerMessageId: messageSid },
      select: { conversationId: true },
    })
    if (msg) emitInboxEvent({ type: 'status-update', conversationId: msg.conversationId })
  }

  return new NextResponse('OK')
}
