import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { getMessagingProviderRuntimeConfig, upsertProviderConfig } from '@/lib/messaging/provider-config'
import { isPushConfigured } from '@/lib/notifications/push-sender'
import { env } from '@/lib/env'

function maskSecret(value: string | undefined) {
  if (!value) return ''
  if (value.length <= 8) return '********'
  return `${value.slice(0, 4)}********${value.slice(-4)}`
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const config = await getMessagingProviderRuntimeConfig()
  return NextResponse.json({
    providers: {
      twilio: {
        active: config.twilio.active,
        accountSid: maskSecret(config.twilio.config?.accountSid),
        smsFrom: config.twilio.config?.smsFrom || '',
        whatsappFrom: config.twilio.config?.whatsappFrom || '',
        hasAuthToken: Boolean(config.twilio.config?.authToken),
      },
      sendgrid: {
        active: config.sendgrid.active,
        fromEmail: config.sendgrid.config?.fromEmail || '',
        apiKey: maskSecret(config.sendgrid.config?.apiKey),
        hasApiKey: Boolean(config.sendgrid.config?.apiKey),
      },
      push: {
        configured: isPushConfigured(),
        hasVapidPublicKey: Boolean(env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
        hasVapidPrivateKey: Boolean(env.VAPID_PRIVATE_KEY),
      },
    },
  })
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const current = await getMessagingProviderRuntimeConfig()

  if (body.provider === 'TWILIO') {
    const merged = {
      accountSid: body.accountSid ? String(body.accountSid) : current.twilio.config?.accountSid,
      authToken: body.authToken ? String(body.authToken) : current.twilio.config?.authToken,
      smsFrom: body.smsFrom !== undefined ? (body.smsFrom ? String(body.smsFrom) : undefined) : current.twilio.config?.smsFrom,
      whatsappFrom:
        body.whatsappFrom !== undefined
          ? body.whatsappFrom
            ? String(body.whatsappFrom)
            : undefined
          : current.twilio.config?.whatsappFrom,
    }
    if (!merged.accountSid || !merged.authToken) {
      return NextResponse.json({ error: 'accountSid y authToken son requeridos para Twilio' }, { status: 400 })
    }
    await upsertProviderConfig({
      provider: 'TWILIO',
      isActive: body.isActive ?? true,
      config: merged,
      updatedByEmail: admin.email,
    })
  } else if (body.provider === 'SENDGRID') {
    const merged = {
      apiKey: body.apiKey ? String(body.apiKey) : current.sendgrid.config?.apiKey,
      fromEmail: body.fromEmail ? String(body.fromEmail) : current.sendgrid.config?.fromEmail,
    }
    if (!merged.apiKey || !merged.fromEmail) {
      return NextResponse.json({ error: 'apiKey y fromEmail son requeridos para SendGrid' }, { status: 400 })
    }
    await upsertProviderConfig({
      provider: 'SENDGRID',
      isActive: body.isActive ?? true,
      config: merged,
      updatedByEmail: admin.email,
    })
  } else {
    return NextResponse.json({ error: 'provider inválido' }, { status: 400 })
  }

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'messaging_provider.update',
    entityType: 'MessagingProviderConfig',
    route: '/api/admin/messaging/providers',
    details: body.provider,
    request,
  })

  return NextResponse.json({ ok: true })
}
