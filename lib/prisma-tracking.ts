/**
 * Keeps attribution data (ServiceRequest / Booking `acquisition` + `lastTouch`) out of query results unless the
 * query names those fields. Rows of both models have the two keys; User has only `acquisition` and is left alone.
 */

const TRACKING = ['acquisition', 'lastTouch'] as const

/** True when the query selects the tracking fields by name (writing them does not count: the result is still stripped). */
export function wantsTracking(args: unknown): boolean {
  if (!args || typeof args !== 'object') return false
  const select = (args as { select?: unknown }).select
  if (!select) return false
  try {
    return JSON.stringify(select).includes('"lastTouch"')
  } catch {
    return false
  }
}

function isPlain(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== 'object') return false
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

/** Removes the tracking pair from every row that carries it, however deep it was included. Mutates in place. */
export function stripTracking<T>(value: T, depth = 0): T {
  if (depth > 8 || value === null || value === undefined) return value
  if (Array.isArray(value)) {
    for (const item of value) stripTracking(item, depth + 1)
    return value
  }
  if (!isPlain(value)) return value
  if ('lastTouch' in value && 'acquisition' in value) {
    for (const k of TRACKING) delete value[k]
  }
  for (const k of Object.keys(value)) {
    const v = value[k]
    if (v && typeof v === 'object') stripTracking(v, depth + 1)
  }
  return value
}
