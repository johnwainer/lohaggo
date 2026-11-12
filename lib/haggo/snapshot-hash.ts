import { createHash } from 'crypto'

/** Fields that change every cycle without meaning anything (timestamps, spend counters that grow by themselves) */
const VOLATILE = new Set(['at', 'checkedAt', 'generatedAt', 'aiCost'])

function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable)
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([k]) => !VOLATILE.has(k))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, val]) => [k, stable(val)]),
    )
  }
  return v
}

/** Hash of what a snapshot says, ignoring volatile fields and key order: equal hash = nothing changed since the last cycle. */
export function snapshotHash(snapshot: unknown): string {
  return createHash('sha1').update(JSON.stringify(stable(snapshot))).digest('hex')
}

/** Order-independent signature of the situations the rules see (key + severity). */
export function detectionSignature(detections: Array<{ key: string; severity: string }>): string {
  return createHash('sha1').update(detections.map((d) => `${d.key}:${d.severity}`).sort().join('|')).digest('hex')
}

export type LastCycle = { status: string; startedAt: Date; signature: string | null }

/** An analysed (ok) cycle this recent counts as «already looked at» for an identical set of situations */
export const SAME_SITUATION_HOURS = 6

/**
 * The cycle needs no model call when nothing changed: the snapshot is identical to the previous cycle's (that
 * cycle did not fail), or the rules see exactly the situations the last analysed cycle already examined, a few
 * hours ago at most. A manual run and actions waiting to be measured always go through. Reports are separate.
 */
export function canSkipUnchanged(p: {
  hash: string
  previousHash: string | null
  signature: string
  lastCycle: LastCycle | null
  lastOk: LastCycle | null
  force: boolean
  hasVerifications: boolean
  now: Date
}) {
  if (p.force || p.hasVerifications) return false
  if (p.previousHash !== null && p.hash === p.previousHash && p.lastCycle && p.lastCycle.status !== 'error') return true
  const ok = p.lastOk
  return Boolean(ok && ok.signature === p.signature && p.now.getTime() - ok.startedAt.getTime() < SAME_SITUATION_HOURS * 3600_000)
}
