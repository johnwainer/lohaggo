import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse, after } from 'next/server'
import { createLogger } from '@/lib/logger'
import { getMetaAppConfig } from '@/lib/messaging/provider-config'
import type { MetaChannel } from '@/lib/messaging/meta-graph'
import { logWebhookEvent, processMetaWebhookPayload, verifyMetaSignature, type MetaWebhookPayload } from '@/lib/messaging/meta-inbound'

const logger = createLogger('meta-webhook')

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

/** GET: Meta's subscription handshake (hub.mode / hub.verify_token / hub.challenge). */
export async function handleMetaWebhookVerify(request: NextRequest, channel: MetaChannel) {
  const params = request.nextUrl.searchParams
  const mode = params.get('hub.mode')
  const token = params.get('hub.verify_token')
  const challenge = params.get('hub.challenge')

  const app = await getMetaAppConfig()
  if (mode === 'subscribe' && challenge && app?.verifyToken && token && safeEqual(token, app.verifyToken)) {
    logger.info('Webhook verified', { channel })
    return new NextResponse(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }
  logger.warn('Webhook verification rejected', { channel, mode, hasToken: Boolean(token) })
  return new NextResponse('Verification failed', { status: 400 })
}

/** POST: HMAC-SHA256 over the raw body, then async processing. Always answers fast. */
export async function handleMetaWebhookEvent(request: NextRequest, channel: MetaChannel) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-hub-signature-256')
  const app = await getMetaAppConfig()

  if (!app?.appSecret) {
    await logWebhookEvent({ channel, status: 'BAD_SIGNATURE', detail: 'appSecret no configurado' })
    return new NextResponse('App secret not configured', { status: 400 })
  }
  if (!signature || !verifyMetaSignature(rawBody, signature, app.appSecret)) {
    await logWebhookEvent({ channel, status: 'BAD_SIGNATURE', detail: signature ? 'Firma inválida' : 'Firma ausente' })
    return new NextResponse('Invalid signature', { status: 400 })
  }

  let payload: MetaWebhookPayload
  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload
  } catch {
    await logWebhookEvent({ channel, status: 'ERROR', detail: 'JSON inválido' })
    return new NextResponse('Invalid JSON', { status: 400 })
  }

  after(async () => {
    try {
      await processMetaWebhookPayload(channel, payload)
    } catch (err) {
      logger.error('Unhandled error processing webhook', { channel, err: err instanceof Error ? err.message : err })
      await logWebhookEvent({ channel, status: 'ERROR', detail: err instanceof Error ? err.message : 'error', payload })
    }
  })

  return new NextResponse('EVENT_RECEIVED', { status: 200 })
}
