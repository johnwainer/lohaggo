import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { requireAdmin } from '@/lib/admin-utils'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { sendWhatsAppTemplate } from '@/lib/messaging/providers'
import { sendMetaMessage } from '@/lib/messaging/meta-graph'
import { describeGraphError, getConnectionCredentials, isMetaChannel, requireMetaApp } from '@/lib/messaging/meta-channels'
import { canView, getWorkspaceAccess } from '@/lib/workspaces'
import { attachmentLabel, channelSupportsAttachment, isTrustedAttachmentUrl, kindFromMime, type AttachmentKind } from '@/lib/messaging/attachments'

type RouteContext = { params: Promise<{ id: string }> }

const DAY_MS = 24 * 60 * 60 * 1000
const HUMAN_AGENT_WINDOW_MS = 7 * DAY_MS

type OutboundAttachment = { url: string; mediaType: string; mediaName: string | null; kind: AttachmentKind }

/**
 * Creates the OUTBOUND row, or completes it if the provider's echo/status webhook already stored
 * a row with the same providerMessageId (race: Meta echoes arrive before the send call returns).
 */
async function saveOutbound(params: {
  conversationId: string
  providerMessageId: string | null
  body: string
  media: { mediaUrl?: string; mediaType?: string; mediaName?: string | null }
  sentById: string
}) {
  const data = { body: params.body, ...params.media, sentById: params.sentById }
  const include = { sentBy: { select: { id: true, name: true } } }
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

function parseAttachment(raw: unknown): OutboundAttachment | null {
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

export async function POST(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params
  const body = await request.json()

  const { isInternal, waContentSid, waVariables } = body
  const message: string = typeof body.message === 'string' ? body.message.trim() : ''

  // Optional attachment previously uploaded via /attachments (Cloudinary URL only)
  const attachment = parseAttachment(body.attachment)
  if (body.attachment && !attachment) return NextResponse.json({ error: 'Adjunto inválido' }, { status: 400 })
  if (!message && !attachment) return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 })

  const conversation = await prisma.conversation.findUnique({ where: { id } })
  if (!conversation) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
  const access = await getWorkspaceAccess(admin)
  if (!canView(access, conversation.workspaceId)) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })

  const storedBody = message || (attachment ? attachmentLabel(attachment.kind, attachment.mediaName) : '')
  const mediaData = attachment ? { mediaUrl: attachment.url, mediaType: attachment.mediaType, mediaName: attachment.mediaName } : {}

  // Internal notes: save to DB only, no Twilio
  if (isInternal) {
    const saved = await prisma.conversationMessage.create({
      data: {
        conversationId: id,
        direction: 'OUTBOUND',
        body: storedBody,
        ...mediaData,
        isInternal: true,
        sentById: admin.id,
        status: 'SENT',
      },
      include: { sentBy: { select: { id: true, name: true } } },
    })
    emitInboxEvent({ type: 'new-message', conversationId: id, workspaceId: conversation.workspaceId })
    return NextResponse.json({ message: saved })
  }

  if (attachment) {
    const support = channelSupportsAttachment(conversation.channel, attachment.mediaType, attachment.kind)
    if (!support.ok) return NextResponse.json({ error: support.error }, { status: 400 })
  }

  let providerMessageId: string | null = null

  // Messenger / Instagram: send through the connected Page's token (Graph API)
  if (isMetaChannel(conversation.channel)) {
    const connection = conversation.connectionId
      ? await prisma.channelConnection.findUnique({ where: { id: conversation.connectionId } })
      : null
    if (!connection) return NextResponse.json({ error: 'Esta conversación no tiene una cuenta conectada' }, { status: 500 })
    if (!connection.enabled) return NextResponse.json({ error: `La conexión "${connection.name}" está pausada` }, { status: 409 })
    if (conversation.threadOwner) {
      return NextResponse.json({ error: 'El hilo está en la bandeja nativa de Meta. Recupera el control antes de responder.' }, { status: 409 })
    }
    const creds = getConnectionCredentials(connection)
    if (!creds?.pageAccessToken) return NextResponse.json({ error: 'Token de la página no disponible, vuelve a conectar la cuenta' }, { status: 500 })

    const lastInbound = await prisma.conversationMessage.findFirst({
      where: { conversationId: id, direction: 'INBOUND' },
      orderBy: { sentAt: 'desc' },
      select: { sentAt: true },
    })
    const sinceInbound = lastInbound ? Date.now() - lastInbound.sentAt.getTime() : Number.POSITIVE_INFINITY
    const insideWindow = sinceInbound <= DAY_MS
    if (!insideWindow && sinceInbound > HUMAN_AGENT_WINDOW_MS) {
      return NextResponse.json({ error: 'Ventana de 24h cerrada y han pasado más de 7 días: Meta no permite enviar' }, { status: 409 })
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
          message: { attachment: { type: attachment.kind, payload: { url: attachment.url, is_reusable: true } } },
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
      if (!attachmentMid) return NextResponse.json({ error: detail }, { status: 502 })
    }

    // Meta sends one message per part (attachment, text): store each one so its echo webhook matches
    const savedList = []
    if (attachment) {
      savedList.push(await saveOutbound({
        conversationId: id,
        providerMessageId: attachmentMid,
        body: attachmentLabel(attachment.kind, attachment.mediaName),
        media: mediaData,
        sentById: admin.id,
      }))
    }
    if (message && (textMid || !attachment)) {
      savedList.push(await saveOutbound({ conversationId: id, providerMessageId: textMid, body: message, media: {}, sentById: admin.id }))
    }
    const saved = savedList[savedList.length - 1]
    await prisma.conversation.update({
      where: { id },
      data: { lastMessageAt: new Date(), lastMessageBody: storedBody.slice(0, 200), status: 'IN_PROGRESS' },
    })
    emitInboxEvent({ type: 'new-message', conversationId: id, workspaceId: conversation.workspaceId })
    return NextResponse.json({ message: saved, messages: savedList })
  }

  const runtimeConfig = await getMessagingProviderRuntimeConfig()
  const conf = runtimeConfig.twilio?.config
  if (!runtimeConfig.twilio?.active || !conf?.accountSid || !conf?.authToken) {
    return NextResponse.json({ error: 'Twilio no configurado' }, { status: 500 })
  }

  const isWhatsApp = conversation.channel === 'WHATSAPP'

  // WA Content Template send from inbox
  if (isWhatsApp && waContentSid) {
    const result = await sendWhatsAppTemplate(
      normalizePhone(conversation.contactPhone),
      waContentSid,
      waVariables || {},
      runtimeConfig.twilio
    )
    if (!result.ok) {
      return NextResponse.json({ error: result.errorMessage || 'Error enviando plantilla' }, { status: 502 })
    }
    providerMessageId = result.providerMessageId || null
  } else {
    const from = isWhatsApp ? conf.whatsappFrom : conf.smsFrom
    if (!from) {
      return NextResponse.json({ error: `Número ${conversation.channel} no configurado en Twilio` }, { status: 500 })
    }

    const toRaw = normalizePhone(conversation.contactPhone)
    const toFormatted = isWhatsApp ? `whatsapp:${toRaw}` : toRaw
    const fromFormatted = isWhatsApp ? `whatsapp:${from}` : from

    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${conf.accountSid}/Messages.json`
    const payload = new URLSearchParams({ To: toFormatted, From: fromFormatted })
    if (message) payload.set('Body', message)
    if (attachment) payload.set('MediaUrl', attachment.url)
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
      return NextResponse.json({ error: String(data?.message || 'Error enviando mensaje') }, { status: 502 })
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
      sentById: admin.id,
      status: 'SENT',
    },
    include: { sentBy: { select: { id: true, name: true } } },
  })

  await prisma.conversation.update({
    where: { id },
    data: {
      lastMessageAt: new Date(),
      lastMessageBody: storedBody.slice(0, 200),
      status: 'IN_PROGRESS',
    },
  })

  emitInboxEvent({ type: 'new-message', conversationId: id, workspaceId: conversation.workspaceId })
  return NextResponse.json({ message: saved })
}
