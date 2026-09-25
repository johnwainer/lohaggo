import type { HaggoConfig, QuietWindow } from '@/lib/haggo/config'

/** Local day, hour and minute in the configured time zone (Bogotá by default). */
export function localParts(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  return { day, hour: Number(get('hour')), minute: Number(get('minute')), dateKey: `${get('year')}-${get('month')}-${get('day')}` }
}

/** Vercel ticks are not exact: a cycle is due up to a minute early so a 15-min cycle does not slip to 20. */
const TICK_SLACK_MS = 60_000

export type LastRuns = { cycle?: Date | null; daily?: Date | null; weekly?: Date | null }
export type Due = { cycle: boolean; daily: boolean; weekly: boolean }

/**
 * What the tick has to run. The daily report runs once per local day from its hour on (a late tick still
 * gets it, a second tick the same day does not); the weekly review once on its day from its hour on.
 */
export function dueJobs(cfg: Pick<HaggoConfig, 'enabled' | 'cycleMinutes' | 'dailyReportHour' | 'weeklyReviewDay' | 'weeklyReviewHour' | 'timezone'>, last: LastRuns, now = new Date()): Due {
  if (!cfg.enabled) return { cycle: false, daily: false, weekly: false }
  const local = localParts(now, cfg.timezone)
  const cycle = !last.cycle || now.getTime() - last.cycle.getTime() >= cfg.cycleMinutes * 60_000 - TICK_SLACK_MS
  const daily = cfg.dailyReportHour != null && local.hour >= cfg.dailyReportHour && (!last.daily || localParts(last.daily, cfg.timezone).dateKey !== local.dateKey)
  const weekly = cfg.weeklyReviewDay != null && local.day === cfg.weeklyReviewDay && local.hour >= cfg.weeklyReviewHour && (!last.weekly || now.getTime() - last.weekly.getTime() > 6 * 24 * 3600_000)
  return { cycle, daily, weekly }
}

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

/** Inside a window where Haggo only observes and proposes. A window that crosses midnight belongs to the day it starts. */
export function inQuietHours(windows: QuietWindow[], timezone: string, now = new Date()) {
  if (!windows.length) return false
  const { day, hour, minute } = localParts(now, timezone)
  const t = hour * 60 + minute
  const yesterday = (day + 6) % 7
  return windows.some((w) => {
    const from = minutes(w.from)
    const to = minutes(w.to)
    if (from < to) return w.days.includes(day) && t >= from && t < to
    return (w.days.includes(day) && t >= from) || (w.days.includes(yesterday) && t < to)
  })
}

/** For the UI: when each job runs next (approximate for the cycle: last run + frequency). */
export function nextRuns(cfg: Pick<HaggoConfig, 'enabled' | 'cycleMinutes' | 'dailyReportHour' | 'weeklyReviewDay' | 'weeklyReviewHour' | 'timezone'>, last: LastRuns, now = new Date()) {
  if (!cfg.enabled) return { cycle: null, daily: null, weekly: null }
  const cycle = last.cycle ? new Date(Math.max(now.getTime(), last.cycle.getTime() + cfg.cycleMinutes * 60_000)) : now
  // Walk forward in 5-minute steps (the tick) until each job is due; at most 8 days
  const find = (key: 'daily' | 'weekly') => {
    if ((key === 'daily' ? cfg.dailyReportHour : cfg.weeklyReviewDay) == null) return null
    for (let t = now.getTime(); t < now.getTime() + 8 * 24 * 3600_000; t += 5 * 60_000) {
      if (dueJobs(cfg, { ...last, cycle: new Date(t) }, new Date(t))[key]) return new Date(t)
    }
    return null
  }
  return { cycle, daily: find('daily'), weekly: find('weekly') }
}
