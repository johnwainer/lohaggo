/**
 * Business analytics rules with no DB: periods in Bogotá time and their comparison period, funnel
 * rates, percentiles, search normalization and the first-touch acquisition record. Pure.
 */

const H = 3600_000
const DAY = 24 * H
const OFFSET = 5 * H

export const PRESETS = ['7d', '30d', '90d', '12m'] as const
export type Preset = (typeof PRESETS)[number]

export type Period = { from: Date; to: Date; prevFrom: Date; prevTo: Date; days: number; label: string }

const dayStart = (d: Date) => {
  const local = d.getTime() - OFFSET
  return new Date(local - (((local % DAY) + DAY) % DAY) + OFFSET)
}
export const bogotaDay = (d: Date) => new Date(d.getTime() - OFFSET).toISOString().slice(0, 10)
export const bogotaMonth = (d: Date) => bogotaDay(d).slice(0, 7)

/**
 * The selected period (whole Bogotá days, ending today) and the one right before with the same
 * length, for "vs periodo anterior". Custom from/to (YYYY-MM-DD) win over the preset.
 */
export function parsePeriod(p: { preset?: string | null; from?: string | null; to?: string | null }, now = new Date()): Period {
  const valid = (s?: string | null) => Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s))
  let from: Date
  let to: Date
  if (valid(p.from) && valid(p.to) && p.from! <= p.to!) {
    from = new Date(`${p.from}T00:00:00-05:00`)
    to = new Date(new Date(`${p.to}T00:00:00-05:00`).getTime() + DAY)
  } else {
    const preset = (PRESETS as readonly string[]).includes(p.preset || '') ? (p.preset as Preset) : '30d'
    to = new Date(dayStart(now).getTime() + DAY)
    const days = preset === '7d' ? 7 : preset === '30d' ? 30 : preset === '90d' ? 90 : 365
    from = new Date(to.getTime() - days * DAY)
  }
  // Never past the end of today
  const end = new Date(dayStart(now).getTime() + DAY)
  if (to > end) to = end
  if (from >= to) from = new Date(to.getTime() - DAY)
  const length = to.getTime() - from.getTime()
  const days = Math.round(length / DAY)
  return { from, to, prevFrom: new Date(from.getTime() - length), prevTo: from, days, label: `${bogotaDay(from)} – ${bogotaDay(new Date(to.getTime() - 1))}` }
}

/** Day keys of a period, oldest first. */
export function periodDays(p: Pick<Period, 'from' | 'to'>) {
  const out: string[] = []
  for (let t = p.from.getTime() + H; t < p.to.getTime(); t += DAY) out.push(bogotaDay(new Date(t)))
  return out
}

/** The last `n` calendar months (YYYY-MM) ending with the month of `end`, oldest first. */
export function lastMonths(end: Date, n: number) {
  const [y, m] = bogotaMonth(new Date(end.getTime() - 1)).split('-').map(Number)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1))
    return d.toISOString().slice(0, 7)
  })
}

/** % change vs the previous period; null when there is no base to compare with. */
export function change(current: number, previous: number) {
  if (!previous) return current ? null : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

export const ratio = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : null)

export function percentile(values: number[], p: number) {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const i = (s.length - 1) * p
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return s[lo] + (s[hi] - s[lo]) * (i - lo)
}

/** One row per stage with the share of the previous stage and of the first one. */
export function funnel(stages: Array<{ key: string; label: string; count: number }>) {
  return stages.map((s, i) => ({
    ...s,
    fromPrevious: i === 0 ? 100 : ratio(s.count, stages[i - 1].count),
    fromStart: i === 0 ? 100 : ratio(s.count, stages[0].count),
  }))
}

/** "  Plomero URGENTE " → "plomero urgente": groups the same search typed differently. */
export function normalizeQuery(q: string) {
  return q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
}

export type Acquisition = {
  source: string | null
  medium: string | null
  campaign: string | null
  content: string | null
  term: string | null
  referrer: string | null
  landing: string | null
  at: string | null
}

const clean = (v: unknown, max = 120) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

/**
 * First-touch record from the cookie the site sets on the first visit. Without UTM, a referrer from
 * another site becomes the source (google, facebook…) and no referrer means "direct".
 */
export function parseAcquisition(raw: string | null | undefined): Acquisition | null {
  if (!raw) return null
  let o: Record<string, unknown>
  try {
    o = JSON.parse(decodeURIComponent(raw))
  } catch {
    return null
  }
  if (!o || typeof o !== 'object') return null
  const referrer = clean(o.referrer, 300)
  let source = clean(o.source)
  if (!source && referrer) {
    try {
      source = new URL(referrer).hostname.replace(/^www\./, '').replace(/^(l|m|lm)\./, '')
    } catch {
      source = null
    }
  }
  return {
    source: source ?? 'direct',
    medium: clean(o.medium) ?? (referrer ? 'referral' : 'none'),
    campaign: clean(o.campaign),
    content: clean(o.content),
    term: clean(o.term),
    referrer,
    landing: clean(o.landing, 300),
    at: clean(o.at, 40),
  }
}

/** Groups sources the way people think of them: facebook.com, m.facebook.com and fb → Facebook. */
export function sourceLabel(source: string | null | undefined) {
  const s = (source || 'direct').toLowerCase()
  if (s === 'direct') return 'Directo'
  if (/facebook|^fb$|fb\.me/.test(s)) return 'Facebook'
  if (/instagram|^ig$/.test(s)) return 'Instagram'
  if (/google/.test(s)) return 'Google'
  if (/whatsapp|wa\.me/.test(s)) return 'WhatsApp'
  if (/tiktok/.test(s)) return 'TikTok'
  if (/bing|yahoo|duckduckgo/.test(s)) return 'Otros buscadores'
  if (/lohaggo/.test(s)) return 'Directo'
  return s
}
