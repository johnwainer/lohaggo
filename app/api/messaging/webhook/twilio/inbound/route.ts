export const dynamic = 'force-dynamic'

import { createHmac } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { createLogger } from '@/lib/logger'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { scheduleAutomationsForUser } from '@/lib/messaging/automation-service'

const logger = createLogger('twilio-inbound')

function normalizePhone(raw: string): string {
  const stripped = raw.replace(/^whatsapp:/i, '').trim()
  const clean = stripped.replace(/[^\d+]/g, '')
  if (clean.startsWith('+')) return clean
  if (clean.startsWith('57')) return `+${clean}`
  return `+57${clean}`
}

async function validateTwilioSignature(request: NextRequest, authToken: string): Promise<boolean> {
  const signature = request.headers.get('x-twilio-signature')
  if (!signature) return false

  const url = request.url
  const body = await request.clone().formData()
  const params: Record<string, string> = {}
  body.forEach((value, key) => { params[key] = String(value) })

  const sortedKeys = Object.keys(params).sort()
  const paramString = sortedKeys.map((k) => `${k}${params[k]}`).join('')
  const expected = createHmac('sha1', authToken).update(url + paramString).digest('base64')

  return expected === signature
}

const STOP_KEYWORDS = new Set(['stop', 'baja', 'cancelar', 'unsubscribe', 'salir', 'para'])

export async function POST(request: NextRequest) {
  // Token fallback for non-HMAC callers (internal testing)
  const token = request.nextUrl.searchParams.get('token')
  const skipHmac = env.SECURITY_INTERNAL_TOKEN && token === env.SECURITY_INTERNAL_TOKEN

  if (!skipHmac) {
    // Validate Twilio HMAC signature
    const runtimeConfig = await getMessagingProviderRuntimeConfig()
    const authToken = runtimeConfig.twilio?.config?.authToken
    if (authToken) {
      const valid = await validateTwilioSignature(request, authToken)
      if (!valid) {
        logger.warn('Invalid Twilio signature on inbound webhook')
        return new NextResponse('Forbidden', { status: 403 })
      }
    }
  }

  const formData = await request.formData()
  const from = String(formData.get('From') || '')
  const body = String(formData.get('Body') || '')
  const messageSid = String(formData.get('MessageSid') || '')
  const numMedia = parseInt(String(formData.get('NumMedia') || '0'), 10)
  const mediaUrl = numMedia > 0 ? String(formData.get('MediaUrl0') || '') : undefined

  if (!from) return twiml()

  const isWhatsApp = from.toLowerCase().startsWith('whatsapp:')
  const channel: 'WHATSAPP' | 'SMS' = isWhatsApp ? 'WHATSAPP' : 'SMS'
  const contactPhone = normalizePhone(from)

  // STOP / opt-out detection
  const trimmedBody = body.trim().toLowerCase()
  if (STOP_KEYWORDS.has(trimmedBody)) {
    await prisma.messagingOptOut.upsert({
      where: { channel_destination: { channel, destination: contactPhone } },
      create: { channel, destination: contactPhone, isActive: true },
      update: { isActive: true },
    })
    logger.info('Opt-out registered', { channel, contactPhone })
    return twiml()
  }

  // Identify user
  const user = await prisma.user.findFirst({
    where: { phone: contactPhone },
    select: { id: true, name: true },
  })

  // Auto-assign: find admin with fewest active IN_PROGRESS conversations
  const agentCounts = await prisma.conversation.groupBy({
    by: ['assignedToId'],
    where: { status: 'IN_PROGRESS', assignedToId: { not: null } },
    _count: { _all: true },
  })

  const adminUsers = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
  })

  let autoAssignId: string | null = null
  if (adminUsers.length > 0) {
    const countMap = new Map(agentCounts.map((r) => [r.assignedToId!, r._count._all]))
    const sorted = adminUsers.sort((a, b) => (countMap.get(a.id) ?? 0) - (countMap.get(b.id) ?? 0))
    autoAssignId = sorted[0]?.id ?? null
  }

  // Upsert conversation
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
        assignedToId: autoAssignId,
        status: 'OPEN',
        lastMessageAt: new Date(),
        lastMessageBody: body.slice(0, 200),
        unreadCount: 1,
      },
    })
    logger.info('New conversation', { id: conversation.id, channel, contactPhone })
  } else {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: conversation.status === 'CLOSED' ? 'OPEN' : conversation.status,
        lastMessageAt: new Date(),
        lastMessageBody: body.slice(0, 200),
        unreadCount: { increment: 1 },
        userId: user?.id ?? conversation.userId,
        contactName: user?.name ?? conversation.contactName,
        // Only auto-assign if currently unassigned
        ...(conversation.assignedToId == null && autoAssignId
          ? { assignedToId: autoAssignId }
          : {}),
      },
    })
  }

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

  logger.info('Inbound saved', { conversationId: conversation.id, messageSid })
  emitInboxEvent({ type: 'new-message', conversationId: conversation.id })

  // Fire INBOUND_MESSAGE automation only for known users, once per conversation
  if (user?.id) {
    scheduleAutomationsForUser(user.id, 'INBOUND_MESSAGE', { contextId: conversation.id }).catch(() => null)
  }

  return twiml()
}

function twiml() {
  return new NextResponse('<?xml version="1.0"?><Response/>', {
    headers: { 'Content-Type': 'text/xml' },
  })
}
