/**
 * System health rules with no I/O: how often each scheduled job should run (from its cron
 * expression), whether it is healthy given its recent runs, and how an error is fingerprinted. Pure.
 */
import { createHash } from 'crypto'

const MIN = 60_000

/**
 * Expected time between runs for the cron expressions Vercel uses here ("* * * * *", "*\/15 * * * *",
 * "20 * * * *", "0 *\/6 * * *", "0 11 * * *"). Null for anything more exotic.
 */
export function cronInterval(expr: string): number | null {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return null
  const [m, h, dom, mon, dow] = parts
  if (dom !== '*' || mon !== '*' || dow !== '*') return null
  const every = (field: string) => (field === '*' ? 1 : /^\*\/(\d+)$/.test(field) ? Number(field.slice(2)) : null)
  if (h === '*') {
    const e = every(m)
    if (e) return e * MIN
    return /^\d+$/.test(m) ? 60 * MIN : null
  }
  const eh = every(h)
  if (eh && /^\d+$/.test(m)) return eh * 60 * MIN
  if (/^\d+$/.test(h) && /^\d+$/.test(m)) return 24 * 60 * MIN
  return null
}

export type CronHealth = 'ok' | 'late' | 'failing' | 'stuck' | 'never'

/**
 * Health of a job from its latest runs (newest first). Late: no start in 2.5 intervals (plus a
 * margin for Vercel's own delay). Failing: the last finished run ended in error. Stuck: running
 * for more than 15 minutes.
 */
export function cronHealth(runs: Array<{ status: string; startedAt: Date }>, everyMs: number | null, now: Date): CronHealth {
  if (!runs.length) return 'never'
  const last = runs[0]
  if (last.status === 'running' && now.getTime() - last.startedAt.getTime() > 15 * MIN) return 'stuck'
  const finished = runs.find((r) => r.status !== 'running')
  if (finished?.status === 'error') return 'failing'
  if (everyMs && now.getTime() - last.startedAt.getTime() > everyMs * 2.5 + 5 * MIN) return 'late'
  return 'ok'
}

/** Two consecutive failures open an incident; one success closes it. */
export function shouldOpenIncident(recent: Array<{ status: string }>) {
  const finished = recent.filter((r) => r.status !== 'running')
  return finished.length >= 2 && finished[0].status === 'error' && finished[1].status === 'error'
}

/**
 * Same error, same group: ids, numbers, emails and quoted values are blanked so "Booking abc123 not
 * found" and "Booking xyz789 not found" count as one.
 */
export function errorFingerprint(source: string, context: string | null, message: string) {
  const shape = message
    .toLowerCase()
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '<email>')
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/["'`][^"'`]{0,80}["'`]/g, '<v>')
    .replace(/\b[a-z0-9]{20,}\b/g, '<id>')
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27}\b/g, '<id>')
    .replace(/\d+/g, '#')
    .slice(0, 300)
  return createHash('sha1').update(`${source}|${context ?? ''}|${shape}`).digest('hex')
}

/** Human label of a job path: /api/cron/marketing-agent → marketing-agent. */
export const jobKey = (path: string) => path.replace(/^\/api\//, '').replace(/^cron\//, '').replace(/\/cron\//, '-').replace(/\//g, '-')
