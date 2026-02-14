import { NextRequest, NextResponse } from 'next/server'
import type { MessagingDeliveryStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'

function mapTwilioStatus(raw: string): MessagingDeliveryStatus {
  const status = raw.toLowerCase()
  if (status === 'delivered') return 'DELIVERED'
  if (status === 'sent') return 'SENT'
  if (status === 'queued') return 'PENDING'
  if (status === 'undelivered' || status === 'failed') return 'FAILED'
  return 'SENT'
}

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (env.SECURITY_INTERNAL_TOKEN && token !== env.SECURITY_INTERNAL_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const messageSid = String(formData.get('MessageSid') || '')
  const messageStatus = String(formData.get('MessageStatus') || '')

  if (!messageSid) return NextResponse.json({ ok: true })

  const status = mapTwilioStatus(messageStatus)
  await prisma.messagingDelivery.updateMany({
    where: { providerMessageId: messageSid },
    data: {
      status,
      deliveredAt: status === 'DELIVERED' ? new Date() : undefined,
      errorCode: status === 'FAILED' ? String(formData.get('ErrorCode') || '') || null : undefined,
      errorMessage: status === 'FAILED' ? String(formData.get('ErrorMessage') || '') || null : undefined,
    },
  })

  return NextResponse.json({ ok: true })
}
