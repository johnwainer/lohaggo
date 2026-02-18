import webpush from 'web-push'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { env } from '@/lib/env'
import { validateVapidKeys, parsePushSubscription } from './pushValidation'

const logger = createLogger('push-sender')

const vapidKeys = {
  publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  privateKey: env.VAPID_PRIVATE_KEY || '',
}

const vapidValidation = validateVapidKeys(vapidKeys.publicKey, vapidKeys.privateKey)

if (vapidValidation.valid) {
  webpush.setVapidDetails('mailto:admin@lohaggo.com', vapidKeys.publicKey, vapidKeys.privateKey)
}

export interface PushPayload {
  title: string
  body: string
  data?: Record<string, unknown>
}

export type PushSendResult = {
  ok: boolean
  provider: 'webpush'
  providerMessageId?: string
  errorCode?: string
  errorMessage?: string
}

export function isPushConfigured() {
  return vapidValidation.valid
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<PushSendResult> {
  if (!isPushConfigured()) {
    return { ok: false, provider: 'webpush', errorCode: 'VAPID_NOT_CONFIGURED', errorMessage: 'Push VAPID keys missing' }
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { pushSubscription: true } })

    if (!user?.pushSubscription) {
      return { ok: false, provider: 'webpush', errorCode: 'NO_SUBSCRIPTION', errorMessage: 'User without push subscription' }
    }

    const subscription = parsePushSubscription(user.pushSubscription)
    if (!subscription) {
      await prisma.user.update({ where: { id: userId }, data: { pushSubscription: null } })
      return { ok: false, provider: 'webpush', errorCode: 'INVALID_SUBSCRIPTION', errorMessage: 'Invalid push subscription payload' }
    }

    const response = await webpush.sendNotification(subscription, JSON.stringify(payload))
    return {
      ok: true,
      provider: 'webpush',
      providerMessageId: response?.headers?.['x-request-id'] || response?.headers?.['x-message-id'],
    }
  } catch (error) {
    const statusCode = error && typeof error === 'object' && 'statusCode' in error ? Number((error as any).statusCode) : null

    if (statusCode === 410 || statusCode === 404) {
      await prisma.user.update({ where: { id: userId }, data: { pushSubscription: null } })
      return { ok: false, provider: 'webpush', errorCode: String(statusCode), errorMessage: 'Push subscription expired/invalid' }
    }

    logger.error('Error sending push notification', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    })

    return {
      ok: false,
      provider: 'webpush',
      errorCode: 'SEND_ERROR',
      errorMessage: error instanceof Error ? error.message : 'Push send failed',
    }
  }
}
