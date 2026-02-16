import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { getMessagingProviderRuntimeConfig, upsertProviderConfig } from '@/lib/messaging/provider-config'

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
    },
  })
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()

  if (body.provider === 'TWILIO') {
    if (!body.accountSid || !body.authToken) {
      return NextResponse.json({ error: 'accountSid y authToken son requeridos para Twilio' }, { status: 400 })
    }
    await upsertProviderConfig({
      provider: 'TWILIO',
      isActive: body.isActive ?? true,
      config: {
        accountSid: String(body.accountSid),
        authToken: String(body.authToken),
        smsFrom: body.smsFrom ? String(body.smsFrom) : undefined,
        whatsappFrom: body.whatsappFrom ? String(body.whatsappFrom) : undefined,
      },
      updatedByEmail: admin.email,
    })
  } else if (body.provider === 'SENDGRID') {
    if (!body.apiKey || !body.fromEmail) {
      return NextResponse.json({ error: 'apiKey y fromEmail son requeridos para SendGrid' }, { status: 400 })
    }
    await upsertProviderConfig({
      provider: 'SENDGRID',
      isActive: body.isActive ?? true,
      config: {
        apiKey: String(body.apiKey),
        fromEmail: String(body.fromEmail),
      },
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
