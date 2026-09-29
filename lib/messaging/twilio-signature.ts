import { createHmac, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'
import { env } from '@/lib/env'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'

/** Twilio's X-Twilio-Signature over the full URL plus the sorted form params, compared in constant time. */
export async function validTwilioSignature(request: NextRequest, authToken: string) {
  const signature = request.headers.get('x-twilio-signature')
  if (!signature) return false
  const body = await request.clone().formData()
  const params: Record<string, string> = {}
  body.forEach((value, key) => { params[key] = String(value) })
  const data = request.url + Object.keys(params).sort().map((k) => `${k}${params[k]}`).join('')
  const expected = Buffer.from(createHmac('sha1', authToken).update(data).digest('base64'))
  const given = Buffer.from(signature)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

/**
 * Status callbacks: our internal token when it is configured (we put it in the callback URL), otherwise
 * Twilio's signature. Fails closed when neither can be checked.
 */
export async function twilioCallbackAllowed(request: NextRequest) {
  if (env.SECURITY_INTERNAL_TOKEN) {
    const given = Buffer.from(request.nextUrl.searchParams.get('token') ?? '')
    const expected = Buffer.from(env.SECURITY_INTERNAL_TOKEN)
    return given.length === expected.length && timingSafeEqual(given, expected)
  }
  const authToken = (await getMessagingProviderRuntimeConfig()).twilio?.config?.authToken
  return authToken ? validTwilioSignature(request, authToken) : false
}
