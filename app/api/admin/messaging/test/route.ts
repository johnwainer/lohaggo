import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'

function normalizePhone(phone: string) {
  const clean = phone.replace(/[^\d+]/g, '')
  if (clean.startsWith('+')) return clean
  if (clean.startsWith('57')) return `+${clean}`
  return `+57${clean}`
}

const WA_ERROR_LABELS: Record<string, string> = {
  '63016': 'El destinatario no ha unido el sandbox. Para producción: el número sender está Offline o pendiente de activación por Meta.',
  '63007': 'No hay senders de WhatsApp activos configurados en la cuenta.',
  '21211': 'Número de teléfono inválido.',
  '21408': 'Permiso para enviar al número internacional no habilitado.',
  '63001': 'El número WhatsApp no está registrado.',
  '63003': 'Cuenta de WhatsApp Business no verificada.',
  '63015': 'El número de sender no está conectado a WhatsApp.',
  '63018': 'Límite de mensajes excedido para este número.',
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { channel, to, message, fromOverride } = body

  if (!channel || !to) {
    return NextResponse.json({ error: 'channel y to son requeridos' }, { status: 400 })
  }
  if (!['SMS', 'WHATSAPP'].includes(channel)) {
    return NextResponse.json({ error: 'channel debe ser SMS o WHATSAPP' }, { status: 400 })
  }

  const runtimeConfig = await getMessagingProviderRuntimeConfig()
  const conf = runtimeConfig.twilio.config

  if (!conf?.accountSid || !conf?.authToken) {
    return NextResponse.json({
      ok: false, provider: 'twilio', errorCode: 'CONFIG',
      errorMessage: 'Credenciales de Twilio no configuradas',
    })
  }

  const normalizedTo = normalizePhone(to)
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${conf.accountSid}/Messages.json`
  const authHeader = `Basic ${Buffer.from(`${conf.accountSid}:${conf.authToken}`).toString('base64')}`
  const testBody = message || `✅ Prueba LoHaggo Admin — ${new Date().toLocaleTimeString('es-CO', { timeZone: 'America/Bogota' })}`

  let from: string
  if (channel === 'WHATSAPP') {
    const sender = fromOverride || conf.whatsappFrom || ''
    from = sender.startsWith('whatsapp:') ? sender : `whatsapp:${sender}`
    const toWA = `whatsapp:${normalizedTo}`
    const payload = new URLSearchParams({ To: toWA, From: from, Body: testBody })
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload.toString(),
    })
    const data = await res.json().catch(() => ({}))
    const errorCode = String(data?.code || data?.error_code || '')
    return NextResponse.json({
      ok: res.ok && !data?.error_code,
      provider: 'twilio-whatsapp',
      providerMessageId: data?.sid,
      twilioStatus: data?.status,
      from: from,
      to: toWA,
      errorCode: errorCode || undefined,
      errorMessage: data?.message || data?.error_message || undefined,
      errorExplanation: errorCode ? (WA_ERROR_LABELS[errorCode] || null) : null,
    })
  } else {
    const sender = fromOverride || conf.smsFrom || ''
    from = sender
    const payload = new URLSearchParams({ To: normalizedTo, From: from, Body: testBody })
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload.toString(),
    })
    const data = await res.json().catch(() => ({}))
    const errorCode = String(data?.code || data?.error_code || '')
    return NextResponse.json({
      ok: res.ok && !data?.error_code,
      provider: 'twilio-sms',
      providerMessageId: data?.sid,
      twilioStatus: data?.status,
      from: from,
      to: normalizedTo,
      errorCode: errorCode || undefined,
      errorMessage: data?.message || data?.error_message || undefined,
      errorExplanation: errorCode ? (WA_ERROR_LABELS[errorCode] || null) : null,
    })
  }
}
