export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { createHmac } from 'crypto'
import { NextRequest, NextResponse, after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { createLogger } from '@/lib/logger'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { scheduleAutomationsForUser } from '@/lib/messaging/automation-service'
import { getDefaultWorkspaceId } from '@/lib/workspaces'
import { normalizeContactAddress } from '@/lib/messaging/contact-address'
import { attachmentLabel, kindFromMime } from '@/lib/messaging/attachments'
import { resolveInboundContact } from '@/lib/inbox/contacts'
import { autopilotCovers, drainAgentTasks, scheduleInboundAgent } from '@/lib/ai/autopilot'
import { extractWebRef, parseTwilioReferral, recordConversationAttribution } from '@/lib/messaging/attribution'
import { parseButtonReply, withButtonMark } from '@/lib/messaging/wa-format'
import { NO_MARKETING_TAG } from '@/lib/messaging/wa-send'
import type { Prisma } from '@prisma/client'

const logger = createLogger('twilio-inbound')

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

// Only unambiguous words: «cancelar» or «para» are normal things a client writes about a booking
const STOP_KEYWORDS = new Set(['stop', 'baja', 'unsubscribe', 'darme de baja'])
const START_KEYWORDS = new Set(['start', 'alta', 'darme de alta', 'suscribir'])

export async function POST(request: NextRequest) {
  // Token fallback for non-HMAC callers (internal testing)
  const token = request.nextUrl.searchParams.get('token')
  // The internal-token bypass is for local testing only: never in production
  const skipHmac = process.env.NODE_ENV !== 'production' && env.SECURITY_INTERNAL_TOKEN && token === env.SECURITY_INTERNAL_TOKEN

  if (!skipHmac) {
    // Validate Twilio HMAC signature. Fail closed: without the auth token nothing can be verified.
    const runtimeConfig = await getMessagingProviderRuntimeConfig()
    const authToken = runtimeConfig.twilio?.config?.authToken
    if (!authToken) {
      logger.error('Twilio inbound webhook rejected: auth token not configured')
      return new NextResponse('Service Unavailable', { status: 503 })
    }
    const valid = await validateTwilioSignature(request, authToken)
    if (!valid) {
      logger.warn('Invalid Twilio signature on inbound webhook')
      return new NextResponse('Forbidden', { status: 403 })
    }
  }

  const formData = await request.formData()
  const from = String(formData.get('From') || '')
  const body = String(formData.get('Body') || '')
  const messageSid = String(formData.get('MessageSid') || '')
  const numMedia = Math.min(parseInt(String(formData.get('NumMedia') || '0'), 10) || 0, 10)
  // Every photo of the message (WhatsApp sends up to 10 at once); only the first used to be kept
  const media = Array.from({ length: numMedia }, (_, i) => ({
    url: String(formData.get(`MediaUrl${i}`) || ''),
    type: String(formData.get(`MediaContentType${i}`) || '') || null,
  })).filter((m) => m.url)
  const mediaUrl = media[0]?.url
  const mediaType = media[0]?.type ?? null
  const profileName = String(formData.get('ProfileName') || '').trim().slice(0, 120) || null

  // Raw params (minus media URLs) so odd sender formats (e.g. WhatsApp ids instead of phones) can be inspected
  const rawParams: Record<string, string> = {}
  formData.forEach((value, key) => { if (!/^MediaUrl/i.test(key)) rawParams[key] = String(value).slice(0, 200) })

  if (!from) return twiml()

  const isWhatsApp = from.toLowerCase().startsWith('whatsapp:')
  const channel: 'WHATSAPP' | 'SMS' = isWhatsApp ? 'WHATSAPP' : 'SMS'
  const contactPhone = normalizeContactAddress(from)

  // A quick-reply button of one of our templates (its title can be «Cancelar»: never an opt-out)
  const button = isWhatsApp ? parseButtonReply((k) => formData.get(k)) : null

  // Twilio retries: a message already saved is not processed twice
  if (messageSid && (await prisma.conversationMessage.findFirst({ where: { providerMessageId: messageSid }, select: { id: true } }))) return twiml()

  // STOP / START: the message is still saved (the team sees it) but the AI does not answer a STOP
  const trimmedBody = body.trim().toLowerCase().replace(/[.!¡]+/g, '').trim()
  const optingOut = !button && STOP_KEYWORDS.has(trimmedBody)
  if (optingOut) {
    await prisma.messagingOptOut.upsert({
      where: { channel_destination: { channel, destination: contactPhone } },
      create: { channel, destination: contactPhone, isActive: true },
      update: { isActive: true },
    })
    logger.info('Opt-out registered', { channel, contactPhone })
  } else if (!button && START_KEYWORDS.has(trimmedBody)) {
    await prisma.messagingOptOut.updateMany({ where: { channel, destination: contactPhone, isActive: true }, data: { isActive: false } })
    logger.info('Opt-in registered', { channel, contactPhone })
  }

  const workspaceId = await getDefaultWorkspaceId()
  // One contact per person across channels; matched to a platform user by phone when possible
  const contact = await resolveInboundContact({ workspaceId, channel, externalId: contactPhone, nameHint: profileName })
  const user = contact.userId ? await prisma.user.findUnique({ where: { id: contact.userId }, select: { id: true, name: true } }) : null

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

  // A conversation an AI autopilot will take must not get a human owner
  if (await autopilotCovers(workspaceId, channel, null)) autoAssignId = null

  // Upsert conversation
  let conversation = await prisma.conversation.findUnique({
    where: { channel_contactPhone: { channel, contactPhone } },
  })

  if (!conversation) {
    // Two messages of a new contact at once: the second one finds the conversation the first created
    conversation = await prisma.conversation.create({
      data: {
        channel,
        workspaceId,
        contactPhone,
        contactName: contact.name || user?.name || null,
        userId: user?.id || null,
        contactId: contact.id,
        assignedToId: autoAssignId,
        status: 'OPEN',
        lastMessageAt: new Date(),
        lastMessageBody: (body || (mediaUrl ? attachmentLabel(kindFromMime(mediaType)) : '')).slice(0, 200),
        unreadCount: 1,
      },
    }).catch(async (err) => {
      const existing = await prisma.conversation.findUnique({ where: { channel_contactPhone: { channel, contactPhone } } })
      if (!existing) throw err
      return existing
    })
    logger.info('New conversation', { id: conversation.id, channel, contactPhone })
  } else {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        status: conversation.status === 'CLOSED' || conversation.status === 'RESOLVED' ? 'OPEN' : conversation.status,
        lastMessageAt: new Date(),
        lastMessageBody: (body || (mediaUrl ? attachmentLabel(kindFromMime(mediaType)) : '')).slice(0, 200),
        unreadCount: { increment: 1 },
        userId: user?.id ?? conversation.userId,
        contactName: conversation.contactName || contact.name || user?.name || null,
        ...(conversation.contactId ? {} : { contactId: contact.id }),
        // Only auto-assign if currently unassigned
        ...(conversation.assignedToId == null && autoAssignId
          ? { assignedToId: autoAssignId }
          : {}),
      },
    })
  }

  const inbound = await prisma.conversationMessage.create({
    data: {
      conversationId: conversation.id,
      direction: 'INBOUND',
      senderType: 'CONTACT',
      // A photo without a caption still reads as one: the AI agent only sees message text
      body: body || (mediaUrl ? attachmentLabel(kindFromMime(mediaType)) : ''),
      mediaUrl: mediaUrl || null,
      mediaType,
      providerMessageId: messageSid || null,
      status: 'DELIVERED',
      deliveredAt: new Date(),
    },
  })
  // The agent answers the whole burst once, from its last part (a photo album arrives as several parts)
  let lastMessageId = inbound.id
  for (let i = 0; i < media.length - 1; i++) {
    const m = media[i + 1]
    const extra = await prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        senderType: 'CONTACT',
        body: attachmentLabel(kindFromMime(m.type)),
        mediaUrl: m.url,
        mediaType: m.type,
        providerMessageId: messageSid ? `${messageSid}:${i + 1}` : null,
        status: 'DELIVERED',
        deliveredAt: new Date(),
      },
    }).catch((err) => { logger.warn('Extra media not saved', { messageSid, err: err instanceof Error ? err.message : err }); return null })
    if (extra) lastMessageId = extra.id
  }

  logger.info('Inbound saved', { conversationId: conversation.id, messageSid })
  if (button) await recordButtonPress(conversation.id, button, String(formData.get('OriginalRepliedMessageSid') || '') || null, user?.id ?? null)
  // Ad / website attribution (Click-to-WhatsApp params, or the web's «(ref: web-…)» tag)
  const adReferral = isWhatsApp ? parseTwilioReferral((k) => formData.get(k)) : null
  await recordConversationAttribution(conversation.id, { adReferral, webRef: extractWebRef(body) })
  prisma.webhookEvent.create({
    data: { channel, externalId: contactPhone, status: 'OK', detail: `inbound · ${profileName || 'sin nombre'}`, payload: rawParams },
  }).catch(() => null)
  emitInboxEvent({ type: 'new-message', conversationId: conversation.id, workspaceId: conversation.workspaceId })

  // Fire INBOUND_MESSAGE automation only for known users, once per conversation
  if (user?.id) {
    scheduleAutomationsForUser(user.id, 'INBOUND_MESSAGE', { contextId: conversation.id }).catch(() => null)
  }

  // AI autopilot works after the TwiML response
  const conversationId = conversation.id
  if (optingOut) return twiml()
  after(async () => {
    scheduleInboundAgent(conversationId, lastMessageId)
    await drainAgentTasks()
  })

  return twiml()
}

/**
 * Keeps the pressed button in the conversation (customFields.lastButton, linked to the template it answers)
 * so the AI agent acts on the right booking or payment. «No más avisos» (optout_soft) is applied here:
 * the conversation is tagged and a linked user is excluded from marketing.
 */
async function recordButtonPress(conversationId: string, button: { id: string; text: string }, repliedSid: string | null, userId: string | null) {
  try {
    const conv = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { customFields: true, tags: true } })
    if (!conv) return
    const optOut = button.id === 'optout_soft'
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        customFields: withButtonMark(conv.customFields, button, repliedSid) as Prisma.InputJsonValue,
        ...(optOut && !conv.tags.includes(NO_MARKETING_TAG) ? { tags: [...conv.tags, NO_MARKETING_TAG] } : {}),
      },
    })
    if (optOut && userId) {
      await prisma.user.update({ where: { id: userId }, data: { excludedFromMarketing: true, excludedFromMarketingAt: new Date(), excludedFromMarketingBy: 'whatsapp:optout_soft' } })
    }
  } catch (err) {
    logger.warn('Button press not recorded', { conversationId, err: err instanceof Error ? err.message : err })
  }
}

function twiml() {
  return new NextResponse('<?xml version="1.0"?><Response/>', {
    headers: { 'Content-Type': 'text/xml' },
  })
}
