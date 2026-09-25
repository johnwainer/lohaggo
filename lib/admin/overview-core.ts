/**
 * Date windows and small calculations of the admin command center, in Bogotá time (UTC-5, no DST).
 * Pure: no DB.
 */

const H = 3600_000
const DAY = 24 * H
const OFFSET = 5 * H

/** Midnight of the Bogotá day that contains `d`, as an instant. */
export function bogotaDayStart(d: Date) {
  const local = d.getTime() - OFFSET
  return new Date(local - (((local % DAY) + DAY) % DAY) + OFFSET)
}

/** YYYY-MM-DD of `d` in Bogotá. */
export const bogotaKey = (d: Date) => new Date(d.getTime() - OFFSET).toISOString().slice(0, 10)

/** First instant of the Bogotá calendar month of `d`. */
export function bogotaMonthStart(d: Date) {
  const local = new Date(d.getTime() - OFFSET)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) + OFFSET)
}

/**
 * The windows the dashboard compares: today vs yesterday up to the same hour, month to date vs the
 * previous month up to the same day and hour (a fair comparison at any moment of the month).
 */
export function windows(now: Date) {
  const today = bogotaDayStart(now)
  const yesterday = new Date(today.getTime() - DAY)
  const sinceToday = now.getTime() - today.getTime()
  const month = bogotaMonthStart(now)
  const prevMonth = bogotaMonthStart(new Date(month.getTime() - DAY))
  const sinceMonth = now.getTime() - month.getTime()
  const prevMonthEnd = new Date(Math.min(prevMonth.getTime() + sinceMonth, month.getTime()))
  return {
    now,
    today,
    yesterday,
    yesterdaySameTime: new Date(yesterday.getTime() + sinceToday),
    week: new Date(now.getTime() - 7 * DAY),
    month,
    prevMonth,
    prevMonthEnd,
    days14: new Date(today.getTime() - 13 * DAY),
    days30: new Date(now.getTime() - 30 * DAY),
  }
}

/** The last `n` Bogotá day keys, oldest first, ending today. */
export function lastDays(now: Date, n: number) {
  const today = bogotaDayStart(now).getTime()
  return Array.from({ length: n }, (_, i) => bogotaKey(new Date(today - (n - 1 - i) * DAY + H)))
}

/** Rows grouped by day (from SQL) → one value per day, zeros where nothing happened. */
export function fillSeries<T extends string>(keys: string[], rows: Array<{ d: string } & Partial<Record<T, number | bigint | null>>>, fields: T[]) {
  const byDay = new Map(rows.map((r) => [r.d, r]))
  return keys.map((d) => {
    const row = byDay.get(d)
    const out: Record<string, number | string> = { d }
    for (const f of fields) out[f] = Number(row?.[f] ?? 0)
    return out as { d: string } & Record<T, number>
  })
}

/** % change; null when there is nothing to compare with. */
export function delta(current: number, previous: number) {
  if (!previous) return current ? null : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

export type Alert = { level: 'critical' | 'warning'; text: string; href: string }

/** What needs someone now, most urgent first. */
export function alertsFrom(s: {
  waitingCustomers: number
  slaBreached: number
  channelProblems: number
  payoutsFailed: number
  postsFailed: number
  agentsDegraded: number
  requestsWithoutProposals: number
  paymentsToConfirm: number
  cronsFailing?: number
  cronsLate?: number
  errorsLastHour?: number
}): Alert[] {
  const out: Alert[] = []
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  if (s.waitingCustomers) out.push({ level: 'critical', text: `${plural(s.waitingCustomers, 'cliente espera', 'clientes esperan')} respuesta hace más de 15 min`, href: '/admin/inbox' })
  if (s.cronsFailing) out.push({ level: 'critical', text: `${plural(s.cronsFailing, 'tarea automática falla', 'tareas automáticas fallan')}`, href: '/admin/system' })
  if (s.slaBreached) out.push({ level: 'critical', text: `${plural(s.slaBreached, 'caso de soporte', 'casos de soporte')} con el plazo vencido`, href: '/admin/operations' })
  if (s.channelProblems) out.push({ level: 'critical', text: `${plural(s.channelProblems, 'canal', 'canales')} con problemas de conexión`, href: '/admin/channels' })
  if (s.payoutsFailed) out.push({ level: 'critical', text: `${plural(s.payoutsFailed, 'pago a socio falló', 'pagos a socios fallaron')}`, href: '/admin?section=payouts' })
  if (s.postsFailed) out.push({ level: 'warning', text: `${plural(s.postsFailed, 'publicación falló', 'publicaciones fallaron')} en redes (7 días)`, href: '/admin/marketing' })
  if (s.agentsDegraded) out.push({ level: 'warning', text: `${plural(s.agentsDegraded, 'agente de marketing está', 'agentes de marketing están')} en copiloto forzado`, href: '/admin/marketing' })
  if (s.requestsWithoutProposals) out.push({ level: 'warning', text: `${plural(s.requestsWithoutProposals, 'solicitud activa', 'solicitudes activas')} sin propuestas hace más de 2 h`, href: '/admin/service-requests' })
  if (s.cronsLate) out.push({ level: 'warning', text: `${plural(s.cronsLate, 'tarea automática atrasada', 'tareas automáticas atrasadas')}`, href: '/admin/system' })
  if (s.errorsLastHour) out.push({ level: 'warning', text: `${plural(s.errorsLastHour, 'error nuevo', 'errores nuevos')} de la aplicación en la última hora`, href: '/admin/system' })
  if (s.paymentsToConfirm) out.push({ level: 'warning', text: `${plural(s.paymentsToConfirm, 'pago en efectivo', 'pagos en efectivo')} por confirmar`, href: '/admin?section=payments' })
  return out
}
