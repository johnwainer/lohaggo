import { env } from '@/lib/env'
import { createLogger } from '@/lib/logger'

const logger = createLogger('bot-protection')

const MIN_FORM_COMPLETION_MS = 1200
const MAX_FORM_AGE_MS = 2 * 60 * 60 * 1000

type HeaderLike = Headers | Record<string, string | string[] | undefined> | undefined

type TurnstileResponse = {
  success: boolean
  'error-codes'?: string[]
  action?: string
}

export function isTurnstileEnabled(): boolean {
  return Boolean(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY)
}

export function getClientIpFromHeaders(headers: HeaderLike): string {
  if (!headers) return 'unknown'

  const getHeader = (name: string) => {
    if (headers instanceof Headers) return headers.get(name) || ''
    const value = headers[name]
    return Array.isArray(value) ? value[0] || '' : value || ''
  }

  const forwarded = getHeader('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()

  return getHeader('x-real-ip') || 'unknown'
}

export function isLikelyBotSubmission(input: {
  honeypot?: string
  formStartedAt?: string
}): boolean {
  if (input.honeypot && input.honeypot.trim().length > 0) {
    return true
  }

  if (!input.formStartedAt) {
    return false
  }

  const startedAt = Number(input.formStartedAt)
  if (!Number.isFinite(startedAt) || startedAt <= 0) {
    return true
  }

  const elapsed = Date.now() - startedAt
  if (elapsed < MIN_FORM_COMPLETION_MS) {
    return true
  }

  if (elapsed > MAX_FORM_AGE_MS) {
    return true
  }

  return false
}

export async function verifyTurnstileToken(params: {
  token?: string
  remoteIp?: string
  expectedAction?: string
}): Promise<boolean> {
  if (!isTurnstileEnabled()) {
    return true
  }

  if (!params.token) {
    return false
  }

  try {
    const body = new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY!,
      response: params.token,
      remoteip: params.remoteIp || '',
    })

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      cache: 'no-store',
    })

    if (!response.ok) {
      logger.warn('Turnstile verification endpoint failed', { status: response.status })
      return false
    }

    const result = (await response.json()) as TurnstileResponse
    if (!result.success) {
      logger.warn('Turnstile verification failed', {
        errors: result['error-codes'] || [],
      })
      return false
    }

    if (params.expectedAction && result.action && result.action !== params.expectedAction) {
      logger.warn('Turnstile action mismatch', {
        expectedAction: params.expectedAction,
        receivedAction: result.action,
      })
      return false
    }

    return true
  } catch (error) {
    logger.error('Turnstile verification exception', { error })
    return false
  }
}
