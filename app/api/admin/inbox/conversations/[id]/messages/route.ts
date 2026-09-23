import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { sendWhatsAppTemplate } from '@/lib/messaging/providers'
import { sendMetaMessage } from '@/lib/messaging/meta-graph'
import { describeGraphError, getConnectionCredentials, isMetaChannel, requireMetaApp } from '@/lib/messaging/meta-channels'
import { canView, getWorkspaceAccess } from '@/lib/workspaces'

type RouteContext = { params: Promise<{ id: string }> }

const DAY_MS = 24 * 60 * 60 * 1000
const HUMAN_AGENT_WINDOW_MS = 7 * DAY_MS

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

  const { message, isInternal, waContentSid, waVariables } = body
  if (!message?.trim()) return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 })

  const conversation = await prisma.conversation.findUnique({ where: { id } })
  if (!conversation) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
  const access = await getWorkspaceAccess(admin)
  if (!canView(access, conversation.workspaceId)) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })

  // Internal notes: save to DB only, no Twilio
  if (isInternal) {
    const saved = await prisma.conversationMessage.create({
      data: {
        conversationId: id,
        direction: 'OUTBOUND',
        body: message.trim(),
        isInternal: true,
        sentById: admin.id,
        status: 'SENT',
      },
      include: { sentBy: { select: { id: true, name: true } } },
    })
    emitInboxEvent({ type: 'new-message', conversationId: id, workspaceId: conversation.workspaceId })
    return NextResponse.json({ message: saved })
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

    try {
      const app = await requireMetaApp()
      const result = await sendMetaMessage({
        app,
        pageAccessToken: creds.pageAccessToken,
        recipientId: conversation.contactPhone,
        message: { text: message.trim() },
        messagingType: insideWindow ? 'RESPONSE' : 'MESSAGE_TAG',
        tag: insideWindow ? undefined : 'HUMAN_AGENT',
      })
      providerMessageId = result.message_id || null
    } catch (err) {
      const detail = describeGraphError(err)
      await prisma.channelConnection.update({ where: { id: connection.id }, data: { lastError: detail } }).catch(() => null)
      return NextResponse.json({ error: detail }, { status: 502 })
    }

    const saved = await prisma.conversationMessage.create({
      data: {
        conversationId: id,
        direction: 'OUTBOUND',
        body: message.trim(),
        providerMessageId,
        sentById: admin.id,
        status: 'SENT',
      },
      include: { sentBy: { select: { id: true, name: true } } },
    })
    await prisma.conversation.update({
      where: { id },
      data: { lastMessageAt: new Date(), lastMessageBody: message.trim().slice(0, 200), status: 'IN_PROGRESS' },
    })
    emitInboxEvent({ type: 'new-message', conversationId: id, workspaceId: conversation.workspaceId })
    return NextResponse.json({ message: saved })
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
    const payload = new URLSearchParams({ To: toFormatted, From: fromFormatted, Body: message.trim() })

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
      body: message.trim(),
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
      lastMessageBody: message.trim().slice(0, 200),
      status: 'IN_PROGRESS',
    },
  })

  emitInboxEvent({ type: 'new-message', conversationId: id, workspaceId: conversation.workspaceId })
  return NextResponse.json({ message: saved })
}
