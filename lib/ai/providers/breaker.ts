import { FAILURES_TO_TRIP, type Classification } from '@/lib/ai/providers/classify'

export type ProviderStatus = 'ok' | 'degraded' | 'down'

export type BreakerState = {
  status: ProviderStatus
  reason: string | null
  detail: string | null
  downUntil: Date | null
  failures: number
  lastErrorAt: Date | null
  lastOkAt: Date | null
}

export const EMPTY_STATE: BreakerState = { status: 'ok', reason: null, detail: null, downUntil: null, failures: 0, lastErrorAt: null, lastOkAt: null }

/** Skipped only while down and before downUntil; after that a real call tries it again. */
export function isDown(s: Pick<BreakerState, 'status' | 'downUntil'> | null | undefined, now = new Date()) {
  return Boolean(s && s.status === 'down' && s.downUntil && s.downUntil.getTime() > now.getTime())
}

/**
 * After a failed plan (retries included). A missing key or an unknown model says nothing about the
 * provider's health, so it is not counted. `down` opens a new episode only coming from another status.
 */
export function afterError(prev: BreakerState, c: Classification, detail: string, now = new Date()): { next: BreakerState; transition: 'down' | null } {
  if (!c.failover || !c.reason || c.reason === 'sin_clave' || c.reason === 'modelo_no_disponible') return { next: prev, transition: null }
  const failures = prev.failures + 1
  const trip = c.tripNow || failures >= FAILURES_TO_TRIP
  const next: BreakerState = {
    ...prev,
    status: trip ? 'down' : 'degraded',
    reason: c.reason,
    detail: detail.slice(0, 500),
    failures,
    lastErrorAt: now,
    downUntil: trip ? new Date(now.getTime() + c.cooldownMs) : prev.downUntil,
  }
  return { next, transition: trip && prev.status !== 'down' ? 'down' : null }
}

const OK_WRITE_EVERY_MS = 5 * 60_000

/** After an answer: back to ok. Writes only on a change, or to refresh lastOkAt every few minutes. */
export function afterOk(prev: BreakerState, now = new Date()): { next: BreakerState; transition: 'recovered' | null; write: boolean } {
  const changed = prev.status !== 'ok' || prev.failures > 0
  const stale = !prev.lastOkAt || now.getTime() - prev.lastOkAt.getTime() > OK_WRITE_EVERY_MS
  return {
    next: { ...prev, status: 'ok', reason: null, detail: null, downUntil: null, failures: 0, lastOkAt: now },
    transition: prev.status === 'down' ? 'recovered' : null,
    write: changed || stale,
  }
}
