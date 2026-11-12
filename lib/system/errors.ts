import { prisma } from '@/lib/prisma'
import { errorFingerprint } from '@/lib/system/core'

/** Emails, phone-like and long numbers never reach the stored sample or message. */
const mask = (v: string) => v.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '<email>').replace(/\+?\d[\d\s-]{6,}\d/g, '<num>')

/** New groups per instance and hour: a flood of made-up browser errors cannot fill the table. */
let groupWindow = { start: 0, created: 0 }

/** Writes of the same group at most every 10 s per instance, so an error storm does not flood the DB. */
const lastWrite = new Map<string, number>()

/** What the health endpoint and the admin system page show: the tracker must not be silently broken. */
const state = { lastWriteAt: 0, lastFailureAt: 0, failures: 0, lastFailure: '' }

export function errorTrackingState() {
  return {
    lastWriteAt: state.lastWriteAt ? new Date(state.lastWriteAt).toISOString() : null,
    lastFailureAt: state.lastFailureAt ? new Date(state.lastFailureAt).toISOString() : null,
    failures: state.failures,
    lastFailure: state.lastFailure || null,
  }
}

/** In-memory state of this instance plus the last time any error group was written (any instance). */
export async function errorTrackingStatus() {
  const last = await prisma.appErrorGroup.findFirst({ orderBy: { lastSeenAt: 'desc' }, select: { lastSeenAt: true } }).catch(() => null)
  return { ...errorTrackingState(), lastGroupWriteAt: last?.lastSeenAt.toISOString() ?? null }
}

/** Test hook. */
export function resetErrorTrackingForTests() {
  groupWindow = { start: 0, created: 0 }
  lastWrite.clear()
  Object.assign(state, { lastWriteAt: 0, lastFailureAt: 0, failures: 0, lastFailure: '' })
}

/**
 * Records an application error in its group (count, last seen, one sample). Never throws and never
 * logs through the logger (that would loop).
 */
export async function recordError(e: { source: 'server' | 'client'; context?: string | null; message: string; route?: string | null; sample?: unknown }) {
  try {
    const message = mask((e.message || 'Error sin mensaje').slice(0, 500))
    const fingerprint = errorFingerprint(e.source, e.context ?? null, message)
    const now = Date.now()
    if ((lastWrite.get(fingerprint) ?? 0) > now - 10_000) return
    lastWrite.set(fingerprint, now)
    if (lastWrite.size > 2000) lastWrite.clear()
    const sample = e.sample === undefined ? undefined : JSON.parse(JSON.stringify(e.sample, (_k, v) => (typeof v === 'string' ? mask(v.length > 1000 ? `${v.slice(0, 1000)}…` : v) : v)) ?? 'null')
    if (now - groupWindow.start > 3600_000) groupWindow = { start: now, created: 0 }
    if (e.source === 'client' && groupWindow.created > 300 && !(await prisma.appErrorGroup.findUnique({ where: { fingerprint }, select: { id: true } }))) return
    const group = await prisma.appErrorGroup.upsert({
      where: { fingerprint },
      create: { fingerprint, source: e.source, context: e.context?.slice(0, 80) ?? null, message, route: e.route?.slice(0, 200) ?? null, sample },
      update: { count: { increment: 1 }, lastSeenAt: new Date(), resolvedAt: null, ...(sample !== undefined ? { sample } : {}), ...(e.route ? { route: e.route.slice(0, 200) } : {}) },
      select: { count: true },
    })
    state.lastWriteAt = Date.now()
    // Only a group that did not exist counts against the hourly cap on new groups
    if (group.count === 1) groupWindow.created++
  } catch (err) {
    // Recording must never break the request that failed, but a broken tracker must not be invisible either.
    // (console, not the logger: the logger feeds this function.)
    state.lastFailureAt = Date.now()
    state.failures++
    state.lastFailure = err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200)
    console.error('[error-tracking] could not record an error:', state.lastFailure, '| original:', String(e?.message ?? '').slice(0, 200))
  }
}
