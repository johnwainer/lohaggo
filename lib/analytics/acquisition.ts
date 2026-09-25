import type { NextRequest } from 'next/server'
import { parseAcquisition, type Acquisition } from '@/lib/analytics/core'

export const ACQ_COOKIE = 'lh_acq'
export const VISITOR_COOKIE = 'lh_vid'

/**
 * Where a new account came from: the first-visit cookie, overridden by UTM fields the signup form
 * sends itself (the partner landing keeps them from its own URL).
 */
export function acquisitionFrom(request: NextRequest, body?: Record<string, unknown> | null): Acquisition | null {
  const fromCookie = parseAcquisition(request.cookies.get(ACQ_COOKIE)?.value)
  const s = (k: string) => (typeof body?.[k] === 'string' && (body[k] as string).trim() ? (body[k] as string).trim().slice(0, 120) : null)
  const utmSource = s('utm_source')
  if (!utmSource) return fromCookie
  return {
    ...(fromCookie ?? { referrer: null, landing: null, at: null, content: null, term: null }),
    source: utmSource,
    medium: s('utm_medium') ?? fromCookie?.medium ?? null,
    campaign: s('utm_campaign') ?? fromCookie?.campaign ?? null,
    content: s('utm_content') ?? fromCookie?.content ?? null,
    term: s('utm_term') ?? fromCookie?.term ?? null,
  } as Acquisition
}
