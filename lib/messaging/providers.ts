import type { MessagingChannel } from '@prisma/client'
import type { MessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { sendDirectPushToUser } from '@/lib/notifications/notificationService'

type SendParams = {
  channel: MessagingChannel
  to: string
  userId?: string
  subject?: string | null
  body: string
  data?: Record<string, unknown>
}

type SendResult = {
  ok: boolean
  provider: string
  providerMessageId?: string
  errorCode?: string
  errorMessage?: string
}

function normalizePhone(phone: string) {
  const clean = phone.replace(/[^\d+]/g, '')
  if (clean.startsWith('+')) return clean
  if (clean.startsWith('57')) return `+${clean}`
  return `+57${clean}`
}

async function sendByTwilioSms(to: string, body: string, cfg: MessagingProviderRuntimeConfig['twilio']): Promise<SendResult> {
  const conf = cfg.config
  if (!cfg.active || !conf?.accountSid || !conf?.authToken || !conf?.smsFrom) {
    return { ok: false, provider: 'twilio-sms', errorCode: 'CONFIG', errorMessage: 'Twilio SMS not configured' }
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${conf.accountSid}/Messages.json`
  const payload = new URLSearchParams({
    To: normalizePhone(to),
    From: conf.smsFrom,
    Body: body,
  })

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${conf.accountSid}:${conf.authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: payload.toString(),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return {
      ok: false,
      provider: 'twilio-sms',
      errorCode: String(data?.code || response.status),
      errorMessage: String(data?.message || 'Twilio SMS error'),
    }
  }

  return { ok: true, provider: 'twilio-sms', providerMessageId: data?.sid }
}

async function sendByTwilioWhatsApp(to: string, body: string, cfg: MessagingProviderRuntimeConfig['twilio']): Promise<SendResult> {
  const conf = cfg.config
  if (!cfg.active || !conf?.accountSid || !conf?.authToken || !conf?.whatsappFrom) {
    return { ok: false, provider: 'twilio-whatsapp', errorCode: 'CONFIG', errorMessage: 'Twilio WhatsApp not configured' }
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${conf.accountSid}/Messages.json`
  const payload = new URLSearchParams({
    To: `whatsapp:${normalizePhone(to)}`,
    From: conf.whatsappFrom.startsWith('whatsapp:')
      ? conf.whatsappFrom
      : `whatsapp:${conf.whatsappFrom}`,
    Body: body,
  })

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${conf.accountSid}:${conf.authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: payload.toString(),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return {
      ok: false,
      provider: 'twilio-whatsapp',
      errorCode: String(data?.code || response.status),
      errorMessage: String(data?.message || 'Twilio WhatsApp error'),
    }
  }

  return { ok: true, provider: 'twilio-whatsapp', providerMessageId: data?.sid }
}

async function sendBySendgridEmail(
  to: string,
  subject: string | null | undefined,
  body: string,
  cfg: MessagingProviderRuntimeConfig['sendgrid']
): Promise<SendResult> {
  const conf = cfg.config
  if (!cfg.active || !conf?.apiKey || !conf?.fromEmail) {
    return { ok: false, provider: 'sendgrid-email', errorCode: 'CONFIG', errorMessage: 'SendGrid not configured' }
  }

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${conf.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: conf.fromEmail },
      subject: subject || 'LoHaggo',
      content: [{ type: 'text/html', value: body.replace(/\n/g, '<br/>') }],
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    return { ok: false, provider: 'sendgrid-email', errorCode: String(response.status), errorMessage: text || 'SendGrid error' }
  }

  return { ok: true, provider: 'sendgrid-email', providerMessageId: response.headers.get('x-message-id') || undefined }
}

export async function sendMessageViaProvider(
  params: SendParams,
  runtimeConfig: MessagingProviderRuntimeConfig
): Promise<SendResult> {
  if (params.channel === 'SMS') return sendByTwilioSms(params.to, params.body, runtimeConfig.twilio)
  if (params.channel === 'WHATSAPP') return sendByTwilioWhatsApp(params.to, params.body, runtimeConfig.twilio)
  if (params.channel === 'PUSH') {
    if (!params.userId) {
      return { ok: false, provider: 'webpush', errorCode: 'MISSING_USER', errorMessage: 'PUSH channel requires userId' }
    }
    const result = await sendDirectPushToUser(params.userId, {
      title: params.subject || 'LoHaggo',
      body: params.body,
      data: {
        type: 'CAMPAIGN_PUSH',
        campaignChannel: 'PUSH',
        ...(params.data || {}),
      },
    })
    return {
      ok: result.ok,
      provider: 'webpush',
      errorCode: result.ok ? undefined : result.errorCode,
      errorMessage: result.ok ? undefined : result.errorMessage,
    }
  }
  return sendBySendgridEmail(params.to, params.subject, params.body, runtimeConfig.sendgrid)
}
