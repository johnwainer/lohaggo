import { NextResponse } from 'next/server'
import { overLimit } from '@/lib/rate-limit-store'

/**
 * DB-backed limit for a route (shared by every server instance). Returns the 429 response to send when over the
 * limit, otherwise null. The first limit that is exceeded wins.
 */
export async function rateLimitResponse(limits: Array<{ key: string; windowMs: number; max: number }>, message = 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.') {
  for (const l of limits) {
    const r = await overLimit(l.key, l.windowMs, l.max)
    if (r.blocked) return NextResponse.json({ error: message }, { status: 429, headers: { 'Retry-After': String(r.retryAfterSec) } })
  }
  return null
}
