import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'

type RouteContext = { params: Promise<{ id: string }> }

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

  const { message } = body
  if (!message?.trim()) return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 })

  const conversation = await prisma.conversation.findUnique({ where: { id } })
  if (!conversation) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })

  const runtimeConfig = await getMessagingProviderRuntimeConfig()
  const conf = runtimeConfig.twilio?.config
  if (!runtimeConfig.twilio?.active || !conf?.accountSid || !conf?.authToken) {
    return NextResponse.json({ error: 'Twilio no configurado' }, { status: 500 })
  }

  const isWhatsApp = conversation.channel === 'WHATSAPP'
  const from = isWhatsApp ? conf.whatsappFrom : conf.smsFrom
  if (!from) {
    return NextResponse.json({ error: `Número ${conversation.channel} no configurado en Twilio` }, { status: 500 })
  }

  const toRaw = normalizePhone(conversation.contactPhone)
  const toFormatted = isWhatsApp ? `whatsapp:${toRaw}` : toRaw
  const fromFormatted = isWhatsApp ? `whatsapp:${from}` : from

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${conf.accountSid}/Messages.json`
  const payload = new URLSearchParams({ To: toFormatted, From: fromFormatted, Body: message.trim() })

  let providerMessageId: string | null = null
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
    const msg = String(data?.message || 'Error enviando mensaje')
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  const data = await response.json().catch(() => ({}))
  providerMessageId = data?.sid || null

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

  return NextResponse.json({ message: saved })
}
