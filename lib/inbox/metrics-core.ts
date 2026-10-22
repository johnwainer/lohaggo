/** Inbox metrics math. Pure: the queries live in lib/inbox/metrics.ts. */

export const METRIC_PERIODS = [7, 30] as const
export type MetricPeriod = (typeof METRIC_PERIODS)[number]

export function parsePeriod(raw: string | null | undefined): MetricPeriod {
  return raw === '30' ? 30 : 7
}

export function median(values: number[]): number | null {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (!sorted.length) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export type ConversationRow = {
  status: string
  firstIn: Date | string | null
  firstOut: Date | string | null
  human: boolean
  ai: boolean
}

/** Median time from the contact's first message to the first answer of a person or the AI agent. */
export function firstResponseStats(rows: ConversationRow[]) {
  const seconds: number[] = []
  let unanswered = 0
  for (const r of rows) {
    if (!r.firstIn) continue
    if (!r.firstOut) { unanswered++; continue }
    seconds.push(Math.max(0, (new Date(r.firstOut).getTime() - new Date(r.firstIn).getTime()) / 1000))
  }
  return { medianSeconds: median(seconds), answered: seconds.length, unanswered }
}

/** Closed conversations that got an answer: how many only the AI answered (no person wrote to the contact). */
export function aiResolution(rows: ConversationRow[]) {
  const closed = rows.filter((r) => (r.status === 'RESOLVED' || r.status === 'CLOSED') && (r.ai || r.human))
  const byAi = closed.filter((r) => r.ai && !r.human).length
  return { closed: closed.length, byAi, rate: closed.length ? byAi / closed.length : null }
}

/** ai_handoff details are «Motivo: detalle» (or just «Motivo»): the most frequent reasons first. */
export function topHandoffReasons(details: Array<string | null>, limit = 5) {
  const counts = new Map<string, number>()
  for (const d of details) {
    const reason = (d ?? '').split(':')[0].trim() || 'Sin motivo'
    counts.set(reason, (counts.get(reason) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
    .slice(0, limit)
}

/** «45 s», «4 min», «1 h 20 min», «2 d 3 h» */
export function formatSeconds(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—'
  const s = Math.round(seconds)
  if (s < 60) return `${s} s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`
  const d = Math.floor(h / 24)
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`
}

export function percent(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)} %`
}
