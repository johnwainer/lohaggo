/**
 * Numbers for the partner home (pure): net earnings of the week and the month, how many proposals win,
 * and how fast the partner answers. Days are Bogotá days; a service day is stored as that day at 00:00 UTC.
 */

const DAY = 24 * 3600_000

/** The Bogotá calendar day (YYYY-MM-DD) of an instant. */
export function bogotaDay(d: Date): string {
  return new Date(d.getTime() - 5 * 3600_000).toISOString().slice(0, 10)
}

/** First day of the current week (Monday) and of the month, as YYYY-MM-DD in Bogotá. */
export function periodStarts(now = new Date()): { week: string; month: string } {
  const today = bogotaDay(now)
  const d = new Date(`${today}T00:00:00.000Z`)
  const weekday = (d.getUTCDay() + 6) % 7 // Monday = 0
  const week = new Date(d.getTime() - weekday * DAY).toISOString().slice(0, 10)
  return { week, month: `${today.slice(0, 7)}-01` }
}

export type EarningBooking = { status: string; scheduledDate: string | Date; totalPrice: number; partnerCommissionRate?: number | null }

/** What the partner receives after the commission, whole pesos. */
export const netOf = (amount: number, ratePct: number) => Math.round(amount * (1 - ratePct / 100))

/**
 * Net of the completed bookings whose service day falls in the week / month. `fallbackRate` covers old rows
 * without a saved rate; when neither exists the net is unknown (null) instead of a guess.
 */
export function netEarnings(bookings: EarningBooking[], fallbackRate: number | null, now = new Date()): { week: number | null; month: number | null } {
  const starts = periodStarts(now)
  const today = bogotaDay(now)
  let week: number | null = 0
  let month: number | null = 0
  for (const b of bookings) {
    if (b.status !== 'COMPLETED') continue
    // Service days are date-only values at 00:00 UTC: their ISO day is the calendar day
    const day = new Date(b.scheduledDate).toISOString().slice(0, 10)
    if (day > today) continue
    const rate = typeof b.partnerCommissionRate === 'number' ? b.partnerCommissionRate : fallbackRate
    if (rate === null) {
      if (day >= starts.week) week = null
      if (day >= starts.month) month = null
      continue
    }
    const net = netOf(b.totalPrice, rate)
    if (day >= starts.week && week !== null) week += net
    if (day >= starts.month && month !== null) month += net
  }
  return { week, month }
}

/** Share of decided proposals (accepted vs accepted + not chosen) that were chosen; null with fewer than `min` decided. */
export function proposalWinRate(statuses: string[], min = 3): { rate: number; won: number; decided: number } | null {
  const won = statuses.filter((s) => s === 'ACCEPTED').length
  const decided = won + statuses.filter((s) => s === 'REJECTED').length
  if (decided < min) return null
  return { rate: Math.round((won / decided) * 100), won, decided }
}

/** Median minutes from the request to the partner's proposal; null with no samples. */
export function medianResponseMinutes(pairs: Array<{ requestAt: Date; proposalAt: Date }>): number | null {
  const mins = pairs.map((p) => (p.proposalAt.getTime() - p.requestAt.getTime()) / 60_000).filter((m) => Number.isFinite(m) && m >= 0).sort((a, b) => a - b)
  if (mins.length === 0) return null
  const mid = Math.floor(mins.length / 2)
  return Math.max(1, Math.round(mins.length % 2 ? mins[mid] : (mins[mid - 1] + mins[mid]) / 2))
}

/** «12 min», «2 h», «1 d». */
export function responseLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  if (minutes < 60 * 36) return `${Math.round(minutes / 60)} h`
  return `${Math.round(minutes / 1440)} d`
}
