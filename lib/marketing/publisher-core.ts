/**
 * Rules of the publishing worker: which failures are retried, when, what a post's overall status is,
 * and how a retry recognises a post that did go out before the worker died. Pure.
 */

export const MAX_ATTEMPTS = 3
/** Minutes to wait before attempt 2, 3… */
export const BACKOFF_MINUTES = [2, 10, 30]
/** A claim older than this belongs to a worker that died: the job can be taken again. */
export const STALE_CLAIM_MS = 5 * 60 * 1000
/** Instagram video containers: give up if Meta has not processed the video after this long. */
export const CONTAINER_TIMEOUT_MS = 30 * 60 * 1000

export type PublicationStatus = 'scheduled' | 'publishing' | 'processing' | 'published' | 'failed' | 'cancelled'

export type GraphFailure = { code?: number | null; subcode?: number | null; status?: number | null; message: string }

export type FailureKind = {
  retryable: boolean
  /** The connection's token no longer works: pause the account's queue and ask to reconnect */
  tokenProblem: boolean
  reason: string
}

const TOKEN_SUBCODES: Record<number, string> = {
  458: 'La app fue desinstalada de la cuenta',
  459: 'Facebook pide verificar la cuenta (checkpoint)',
  460: 'Cambió la contraseña de la cuenta que conectó la página',
  463: 'El token expiró',
  464: 'La cuenta que conectó la página no está confirmada',
  467: 'El token no es válido',
  492: 'La persona que conectó la página ya no tiene rol en ella',
}

/** Meta error → retry or not, and a reason a person understands. */
export function classifyGraphError(e: GraphFailure): FailureKind {
  const code = e.code ?? null
  const sub = e.subcode ?? null
  if (code === 190 || (sub && TOKEN_SUBCODES[sub])) {
    return { retryable: false, tokenProblem: true, reason: `${(sub && TOKEN_SUBCODES[sub]) || 'El token de la cuenta no es válido'}: reconéctala en Admin → Canales` }
  }
  if (code === 10 || code === 200 || (code !== null && code >= 200 && code < 300)) {
    return { retryable: false, tokenProblem: true, reason: `Falta un permiso para publicar (${e.message}): reconecta la cuenta` }
  }
  // Rate limits, transient and "media not ready yet"
  if ([1, 2, 4, 17, 32, 341, 368, 613, 9007].includes(code ?? -1) || sub === 2207027 || (e.status ?? 0) >= 500 || e.status === 0) {
    return { retryable: true, tokenProblem: false, reason: `Meta no respondió bien (${e.message}); se reintenta` }
  }
  return { retryable: false, tokenProblem: false, reason: e.message }
}

export function nextAttemptAt(attempts: number, now: Date): Date | null {
  if (attempts >= MAX_ATTEMPTS) return null
  const minutes = BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)] ?? BACKOFF_MINUTES[0]
  return new Date(now.getTime() + minutes * 60_000)
}

export type PostStatus = 'draft' | 'review' | 'approved' | 'scheduled' | 'publishing' | 'published' | 'partial' | 'failed' | 'archived'

/** Overall status of a post from its channel publications (cancelled ones don't count). */
export function aggregatePostStatus(current: PostStatus, statuses: PublicationStatus[]): PostStatus {
  const live = statuses.filter((s) => s !== 'cancelled')
  if (!live.length) return ['scheduled', 'publishing', 'published', 'partial', 'failed'].includes(current) ? 'approved' : current
  const all = (s: PublicationStatus) => live.every((x) => x === s)
  if (all('published')) return 'published'
  if (live.some((s) => s === 'publishing' || s === 'processing')) return 'publishing'
  if (live.every((s) => s === 'scheduled')) return 'scheduled'
  if (live.some((s) => s === 'scheduled')) return 'publishing'
  if (all('failed')) return 'failed'
  return 'partial'
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * A retry must not publish twice. If the previous attempt died after Meta accepted the post, the post
 * is in the account's feed: same text, created after the first attempt started.
 */
export function findAlreadyPublished<T extends { id: string; message?: string | null; createdAt: Date }>(
  recent: T[],
  body: string,
  since: Date,
): T | null {
  const target = norm(body)
  if (!target) return null
  return recent.find((p) => p.createdAt.getTime() >= since.getTime() - 60_000 && norm(p.message || '') === target) ?? null
}

/** Valid moves; anything else is refused by the API (e.g. editing a post while it publishes). */
export function canEditPost(status: PostStatus) {
  return ['draft', 'review', 'approved', 'scheduled', 'failed', 'partial'].includes(status)
}

export function canSchedule(when: Date, now: Date) {
  // Meta-scheduled content needs ≥10 min; ours only needs to be in the future (the worker runs every minute)
  return when.getTime() > now.getTime() + 30_000
}

/**
 * How often a published post's metrics are refreshed: hourly the first 2 days (when most reach
 * happens), every 6 h until day 7, daily until day 30, then never again.
 */
export function metricsDue(publishedAt: Date, lastCapture: Date | null, now: Date) {
  const age = now.getTime() - publishedAt.getTime()
  const H = 60 * 60 * 1000
  if (age > 30 * 24 * H) return false
  const every = age <= 48 * H ? H : age <= 7 * 24 * H ? 6 * H : 24 * H
  return !lastCapture || now.getTime() - lastCapture.getTime() >= every - 5 * 60 * 1000
}
