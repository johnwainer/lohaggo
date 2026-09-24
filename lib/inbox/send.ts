import type { Conversation } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { sendWhatsAppTemplate } from '@/lib/messaging/providers'
import { sendMetaMessage } from '@/lib/messaging/meta-graph'
import { describeGraphError, getConnectionCredentials, isMetaChannel, requireMetaApp } from '@/lib/messaging/meta-channels'
import { attachmentLabel, channelDeliveryUrl, channelSupportsAttachment, warmDeliveryUrl, isTrustedAttachmentUrl, kindFromMime, type AttachmentKind } from '@/lib/messaging/attachments'

const DAY_MS = 24 * 60 * 60 * 1000
const HUMAN_AGENT_WINDOW_MS = 7 * DAY_MS

export type OutboundAttachment = { url: string; mediaType: string; mediaName: string | null; kind: AttachmentKind }

/** Who sends: a person from the inbox, or an AI agent (its name is stored with each message). */
export type OutboundSender = { type: 'HUMAN'; userId: string } | { type: 'AI'; agentId: string; agentName: string }

export type SendInput = {
  conversation: Conversation
  message: string
  attachment?: OutboundAttachment | null
  sender: OutboundSender
  waTemplate?: { contentSid: string; variables: Record<string, string> } | null
}

const include = { sentBy: { select: { id: true, name: true } } }

function senderFields(sender: OutboundSender) {
  return sender.type === 'HUMAN'
    ? { sentById: sender.userId, senderType: 'HUMAN', aiAgentId: null, aiAgentName: null }
    : { sentById: null, senderType: 'AI', aiAgentId: sender.agentId, aiAgentName: sender.agentName }
}

export function parseAttachment(raw: unknown): OutboundAttachment | null {
  if (!raw || typeof raw !== 'object') return null
  const a = raw as Record<string, unknown>
  const url = typeof a.url === 'string' ? a.url : ''
  const mediaType = typeof a.mediaType === 'string' ? a.mediaType.toLowerCase() : ''
  if (!url || !mediaType || !isTrustedAttachmentUrl(url)) return null
  const mediaName = typeof a.mediaName === 'string' && a.mediaName.trim() ? a.mediaName.trim().slice(0, 120) : null
  return { url, mediaType, mediaName, kind: kindFromMime(mediaType) }
}

function normalizePhone(phone: string) {
  const clean = phone.replace(/[^\d+]/g, '')
  if (clean.startsWith('+')) return clean
  if (clean.startsWith('57')) return `+${clean}`
  return `+57${clean}`
}

/**
 * Creates the OUTBOUND row, or completes it if the provider's echo/status webhook already stored
 * a row with the same providerMessageId (race: Meta echoes arrive before the send call returns).
 */
async function saveOutbound(params: {
  conversationId: string
  providerMessageId: string | null
  body: string
  media: { mediaUrl?: string; mediaType?: string; mediaName?: string | null }
  sender: OutboundSender
}) {
  const data = { body: params.body, ...params.media, ...senderFields(params.sender) }
  if (params.providerMessageId) {
    const existing = await prisma.conversationMessage.findUnique({ where: { providerMessageId: params.providerMessageId } })
    if (existing) return prisma.conversationMessage.update({ where: { id: existing.id }, data, include })
  }
  try {
    return await prisma.conversationMessage.create({
      data: { conversationId: params.conversationId, direction: 'OUTBOUND', status: 'SENT', providerMessageId: params.providerMessageId, ...data },
      include,
    })
  } catch (err) {
    if ((err as { code?: string })?.code === 'P2002' && params.providerMessageId) {
      return prisma.conversationMessage.update({ where: { providerMessageId: params.providerMessageId }, data, include })
    }
    throw err
  }
}

type Saved = Awaited<ReturnType<typeof saveOutbound>>
export type SendResult = { ok: true; saved: Saved; savedList: Saved[] } | { ok: false; status: number; error: string }

/** Sends through the conversation's channel and stores the message. Shared by the inbox and the AI agents. */
export async function sendToConversation(input: SendInput): Promise<SendResult> {
  const { conversation, message, attachment, sender } = input
  const id = conversation.id
  const storedBody = message || (attachment ? attachmentLabel(attachment.kind, attachment.mediaName) : '')
  const mediaData = attachment ? { mediaUrl: attachment.url, mediaType: attachment.mediaType, mediaName: attachment.mediaName } : {}

  if (attachment) {
    const support = channelSupportsAttachment(conversation.channel, attachment.mediaType, attachment.kind)
    if (!support.ok) return { ok: false, status: 400, error: support.error || 'Adjunto no soportado' }
  }

  // Format each channel accepts (e.g. Instagram needs M4A instead of MP3); transcoded by Cloudinary
  const delivery = attachment ? channelDeliveryUrl(conversation.channel, attachment.url, attachment.kind) : null
  if (delivery?.converted) await warmDeliveryUrl(delivery.url)
  const deliveryUrl = delivery?.url ?? attachment?.url ?? ''

  const finish = async (savedList: Saved[]): Promise<SendResult> => {
    await prisma.conversation.update({
      where: { id },
      data: { lastMessageAt: new Date(), lastMessageBody: storedBody.slice(0, 200), status: 'IN_PROGRESS' },
    })
    emitInboxEvent({ type: 'new-message', conversationId: id, workspaceId: conversation.workspaceId })
    return { ok: true, saved: savedList[savedList.length - 1], savedList }
  }

  // Messenger / Instagram: send through the connected Page's token (Graph API)
  if (isMetaChannel(conversation.channel)) {
    const connection = conversation.connectionId
      ? await prisma.channelConnection.findUnique({ where: { id: conversation.connectionId } })
      : null
    if (!connection) return { ok: false, status: 500, error: 'Esta conversación no tiene una cuenta conectada' }
    if (!connection.enabled) return { ok: false, status: 409, error: `La conexión "${connection.name}" está pausada` }
    if (conversation.threadOwner) {
      return { ok: false, status: 409, error: 'El hilo está en la bandeja nativa de Meta. Recupera el control antes de responder.' }
    }
    const creds = getConnectionCredentials(connection)
    if (!creds?.pageAccessToken) return { ok: false, status: 500, error: 'Token de la página no disponible, vuelve a conectar la cuenta' }

    const lastInbound = await prisma.conversationMessage.findFirst({
      where: { conversationId: id, direction: 'INBOUND' },
      orderBy: { sentAt: 'desc' },
      select: { sentAt: true },
    })
    const sinceInbound = lastInbound ? Date.now() - lastInbound.sentAt.getTime() : Number.POSITIVE_INFINITY
    const insideWindow = sinceInbound <= DAY_MS
    // The HUMAN_AGENT tag is only for people: an AI agent can never send outside the 24h window
    if (!insideWindow && (sender.type === 'AI' || sinceInbound > HUMAN_AGENT_WINDOW_MS)) {
      return { ok: false, status: 409, error: sender.type === 'AI' ? 'Ventana de 24h cerrada: la IA no puede escribir' : 'Ventana de 24h cerrada y han pasado más de 7 días: Meta no permite enviar' }
    }

    let attachmentMid: string | null = null
    let textMid: string | null = null
    try {
      const app = await requireMetaApp()
      const common = {
        app,
        pageAccessToken: creds.pageAccessToken,
        recipientId: conversation.contactPhone,
        messagingType: insideWindow ? ('RESPONSE' as const) : ('MESSAGE_TAG' as const),
        tag: insideWindow ? undefined : 'HUMAN_AGENT',
      }
      // Meta accepts either text or attachment per message: send the attachment first, then the caption
      if (attachment) {
        const result = await sendMetaMessage({
          ...common,
          message: { attachment: { type: attachment.kind, payload: { url: deliveryUrl, is_reusable: true } } },
        })
        attachmentMid = result.message_id || null
      }
      if (message) {
        const result = await sendMetaMessage({ ...common, message: { text: message } })
        textMid = result.message_id || null
      }
    } catch (err) {
      const detail = describeGraphError(err)
      await prisma.channelConnection.update({ where: { id: connection.id }, data: { lastError: detail } }).catch(() => null)
      // If the attachment already went out, keep it in the inbox instead of losing it
      if (!attachmentMid) return { ok: false, status: 502, error: detail }
    }

    // Meta sends one message per part (attachment, text): store each one so its echo webhook matches
    const savedList: Saved[] = []
    if (attachment) {
      savedList.push(await saveOutbound({ conversationId: id, providerMessageId: attachmentMid, body: attachmentLabel(attachment.kind, attachment.mediaName), media: mediaData, sender }))
    }
    if (message && (textMid || !attachment)) {
      savedList.push(await saveOutbound({ conversationId: id, providerMessageId: textMid, body: message, media: {}, sender }))
    }
    return finish(savedList)
  }

  const runtimeConfig = await getMessagingProviderRuntimeConfig()
  const conf = runtimeConfig.twilio?.config
  if (!runtimeConfig.twilio?.active || !conf?.accountSid || !conf?.authToken) {
    return { ok: false, status: 500, error: 'Twilio no configurado' }
  }

  const isWhatsApp = conversation.channel === 'WHATSAPP'
  let providerMessageId: string | null = null

  // WA Content Template send from inbox
  if (isWhatsApp && input.waTemplate?.contentSid) {
    const result = await sendWhatsAppTemplate(normalizePhone(conversation.contactPhone), input.waTemplate.contentSid, input.waTemplate.variables || {}, runtimeConfig.twilio)
    if (!result.ok) return { ok: false, status: 502, error: result.errorMessage || 'Error enviando plantilla' }
    providerMessageId = result.providerMessageId || null
  } else {
    const from = isWhatsApp ? conf.whatsappFrom : conf.smsFrom
    if (!from) return { ok: false, status: 500, error: `Número ${conversation.channel} no configurado en Twilio` }

    const toRaw = normalizePhone(conversation.contactPhone)
    const toFormatted = isWhatsApp ? `whatsapp:${toRaw}` : toRaw
    const fromFormatted = isWhatsApp ? `whatsapp:${from}` : from

    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${conf.accountSid}/Messages.json`
    const payload = new URLSearchParams({ To: toFormatted, From: fromFormatted })
    if (message) payload.set('Body', message)
    if (attachment) payload.set('MediaUrl', deliveryUrl)
    // Delivery status (incl. media download failures) comes back to the inbox
    const base = (env.NEXT_PUBLIC_APP_URL || env.NEXTAUTH_URL || '').replace(/\/+$/, '')
    if (base.startsWith('https://')) {
      const cb = new URL(`${base}/api/messaging/webhook/twilio/status`)
      if (env.SECURITY_INTERNAL_TOKEN) cb.searchParams.set('token', env.SECURITY_INTERNAL_TOKEN)
      payload.set('StatusCallback', cb.toString())
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${conf.accountSid}:${conf.authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: payload.toString(),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return { ok: false, status: 502, error: String(data?.message || 'Error enviando mensaje') }
    }

    const data = await response.json().catch(() => ({}))
    providerMessageId = data?.sid || null
  }

  const saved = await prisma.conversationMessage.create({
    data: {
      conversationId: id,
      direction: 'OUTBOUND',
      body: storedBody,
      ...mediaData,
      providerMessageId,
      ...senderFields(sender),
      status: 'SENT',
    },
    include,
  })
  return finish([saved])
}
