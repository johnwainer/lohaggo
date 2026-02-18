import { NextRequest, NextResponse } from 'next/server'
import type { MessagingDeliveryStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'

function mapSendgridEvent(event: string): MessagingDeliveryStatus | null {
  const value = event.toLowerCase()
  if (value === 'processed' || value === 'delivered') return 'DELIVERED'
  if (value === 'open') return 'OPENED'
  if (value === 'click') return 'CLICKED'
  if (value === 'bounce' || value === 'dropped' || value === 'deferred') return 'FAILED'
  return null
}

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (env.SECURITY_INTERNAL_TOKEN && token !== env.SECURITY_INTERNAL_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const events = (await request.json().catch(() => [])) as Array<Record<string, unknown>>
  if (!Array.isArray(events)) return NextResponse.json({ ok: true })

  for (const event of events) {
    const providerMessageId = String(event.sg_message_id || '').split('.')[0]
    const mapped = mapSendgridEvent(String(event.event || ''))
    if (!providerMessageId || !mapped) continue

    await prisma.messagingDelivery.updateMany({
      where: { providerMessageId },
      data: {
        status: mapped,
        deliveredAt: mapped === 'DELIVERED' ? new Date() : undefined,
        openedAt: mapped === 'OPENED' ? new Date() : undefined,
        clickedAt: mapped === 'CLICKED' ? new Date() : undefined,
      },
    })
    await (prisma as any).notificationDispatchLog.updateMany({
      where: { providerMessageId },
      data: {
        status: mapped,
        deliveredAt: mapped === 'DELIVERED' ? new Date() : undefined,
        openedAt: mapped === 'OPENED' ? new Date() : undefined,
        clickedAt: mapped === 'CLICKED' ? new Date() : undefined,
      },
    })
  }

  return NextResponse.json({ ok: true })
}
