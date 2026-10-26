/**
 * One-tap link to confirm a booking without logging in (email and SMS): /cita/{token}. The token is the
 * booking, its client and an expiry signed with HMAC; the page asks for a tap before confirming, so a mail
 * scanner opening the link never confirms by itself.
 */
import { createHmac, timingSafeEqual } from 'crypto'
import { env } from '@/lib/env'

const TTL_MS = 48 * 3600_000
const APP_URL = 'https://www.lohaggo.com'

const b64 = (s: string) => Buffer.from(s).toString('base64url')
const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(`appointment:${payload}`).digest('base64url').slice(0, 32)

export function appointmentToken(bookingId: string, userId: string, now = Date.now(), secret = env.NEXTAUTH_SECRET) {
  const payload = b64(JSON.stringify({ b: bookingId, u: userId, e: now + TTL_MS }))
  return `${payload}.${sign(payload, secret)}`
}

export function appointmentLink(bookingId: string, userId: string) {
  return `${APP_URL}/cita/${appointmentToken(bookingId, userId)}`
}

/** The booking and client of a valid, unexpired token; null otherwise. */
export function readAppointmentToken(token: string, now = Date.now(), secret = env.NEXTAUTH_SECRET): { bookingId: string; userId: string } | null {
  const [payload, sig] = String(token ?? '').split('.')
  if (!payload || !sig || payload.length > 400) return null
  const expected = sign(payload, secret)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { b?: unknown; u?: unknown; e?: unknown }
    if (typeof d.b !== 'string' || typeof d.u !== 'string' || typeof d.e !== 'number' || d.e < now) return null
    return { bookingId: d.b, userId: d.u }
  } catch {
    return null
  }
}
