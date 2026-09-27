/**
 * First and last touch of a new request, read from where it was made: the browser cookies (web) or the
 * conversation's ad / web ref (chat). What the request stores and its booking copies.
 */
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ACQ_COOKIE } from '@/lib/analytics/acquisition'
import { fbcFrom, gaClientIdFrom, touchesFromConversation, touchFromCookie, type Touches } from '@/lib/analytics/attribution-core'

export const LAST_TOUCH_COOKIE = 'lh_lt'

/** Browser data for a server conversion sent right away (never stored: IP and user agent). */
export type BrowserContext = { ip: string | null; userAgent: string | null; url: string | null }

export type RequestAttribution = Touches & { browser?: BrowserContext | null }

export function webAttribution(req: NextRequest): RequestAttribution {
  const first = touchFromCookie(req.cookies.get(ACQ_COOKIE)?.value)
  const lastRaw = touchFromCookie(req.cookies.get(LAST_TOUCH_COOKIE)?.value)
  const last = lastRaw ?? first
  const fbp = req.cookies.get('_fbp')?.value?.slice(0, 200) ?? null
  const fbc = fbcFrom(req.cookies.get('_fbc')?.value, last ?? first)
  const gaClientId = gaClientIdFrom(req.cookies.get('_ga')?.value)
  const ids = { fbp, fbc, gaClientId }
  const ip = (req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0] || '').trim() || null
  return {
    first: first ? { ...first } : null,
    last: last ? { ...last, ...ids } : fbp || fbc || gaClientId ? { via: 'web', source: 'direct', medium: 'none', campaign: null, content: null, at: null, ...ids } : null,
    browser: { ip, userAgent: req.headers.get('user-agent')?.slice(0, 400) ?? null, url: req.headers.get('referer')?.slice(0, 500) ?? null },
  }
}

/** Touches of the conversation a chat request comes from (null outside a real conversation). */
export async function conversationAttribution(conversationId: string | null | undefined): Promise<RequestAttribution | null> {
  if (!conversationId || conversationId === 'playground') return null
  try {
    const conv = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { customFields: true, channel: true } })
    return conv ? touchesFromConversation(conv.customFields, conv.channel) : null
  } catch {
    // Attribution never blocks a request
    return null
  }
}
