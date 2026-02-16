import { z } from 'zod'

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url('Invalid endpoint URL'),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(1, 'p256dh key is required'),
    auth: z.string().min(1, 'auth key is required')
  })
})

export type PushSubscription = z.infer<typeof pushSubscriptionSchema>

export function validatePushSubscription(subscription: unknown): { 
  success: true; 
  data: PushSubscription 
} | { 
  success: false; 
  error: string 
} {
  try {
    const validated = pushSubscriptionSchema.parse(subscription)
    return { success: true, data: validated }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: error.errors.map(e => e.message).join(', ') 
      }
    }
    return { success: false, error: 'Invalid push subscription format' }
  }
}

export function validateVapidKeys(publicKey: string, privateKey: string): {
  valid: boolean
  error?: string
} {
  if (!publicKey || !privateKey) {
    return { valid: false, error: 'VAPID keys are not configured' }
  }

  // web-push generateVAPIDKeys() returns:
  // - publicKey: base64url (commonly length 87)
  // - privateKey: base64url (commonly length 43)
  const base64UrlRegex = /^[A-Za-z0-9_-]+$/

  if (!base64UrlRegex.test(publicKey) || publicKey.length < 80) {
    return { valid: false, error: 'Invalid VAPID public key format' }
  }

  if (!base64UrlRegex.test(privateKey) || privateKey.length < 40) {
    return { valid: false, error: 'Invalid VAPID private key format' }
  }

  return { valid: true }
}

export function sanitizePushSubscription(subscription: PushSubscription): string {
  return JSON.stringify({
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth
    }
  })
}

export function parsePushSubscription(subscriptionString: string): PushSubscription | null {
  try {
    const parsed = JSON.parse(subscriptionString)
    const validation = validatePushSubscription(parsed)
    return validation.success ? validation.data : null
  } catch {
    return null
  }
}
