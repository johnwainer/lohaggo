import { bookingWhen } from '@/lib/bookings/when'
import { coversZone } from '@/lib/geo/zones'

/**
 * A partner's weekly schedule and coverage zones, and whether they fit a request. Pure (no server imports).
 * Times are Bogotá wall clock (UTC-5, no DST); dayOfWeek 0 = domingo … 6 = sábado.
 */

export type ScheduleRange = { dayOfWeek: number; startTime: string; endTime: string }

export const MAX_RANGES_PER_DAY = 3
export const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/

export const isHHmm = (s: unknown): s is string => typeof s === 'string' && HHMM.test(s)

/** 'HH:mm' → minutes since midnight. */
export const toMinutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))

/** Day of week and minute of the day of an instant, on the Bogotá wall clock. */
export function bogotaClock(date: Date) {
  const local = new Date(date.getTime() - BOGOTA_OFFSET_MS)
  return { dayOfWeek: local.getUTCDay(), minutes: local.getUTCHours() * 60 + local.getUTCMinutes() }
}

/** Available at that instant: some range of that day contains it. An empty schedule = always available. */
export function availableAt(schedule: ScheduleRange[], date: Date) {
  if (schedule.length === 0) return true
  const { dayOfWeek, minutes } = bogotaClock(date)
  return schedule.some((r) => r.dayOfWeek === dayOfWeek && toMinutes(r.startTime) <= minutes && minutes < toMinutes(r.endTime))
}

/** Works some time on that weekday. */
export const worksOnDay = (schedule: ScheduleRange[], dayOfWeek: number) =>
  schedule.length === 0 || schedule.some((r) => r.dayOfWeek === dayOfWeek)

/** Available now or later today (for urgent requests). */
export function availableRestOfToday(schedule: ScheduleRange[], now: Date) {
  if (schedule.length === 0) return true
  const { dayOfWeek, minutes } = bogotaClock(now)
  return schedule.some((r) => r.dayOfWeek === dayOfWeek && minutes < toMinutes(r.endTime))
}

/** Weekday of a stored preferredDate (a date-only value is midnight UTC; otherwise its Bogotá day). */
function preferredDayOfWeek(preferredDate: Date) {
  return bogotaClock(bookingWhen({ scheduledDate: preferredDate, scheduledTime: '12:00' })).dayOfWeek
}

export type PartnerCoverageInput = { coverageZones?: string[] | null; schedule?: ScheduleRange[] | null }
export type RequestMatchInput = { zone?: string | null; preferredDate?: Date | string | null; preferredTime?: string | null; isUrgent?: boolean | null }

/** Whether a partner's zones and schedule fit a request. No zones / no schedule = no restriction. */
export function matchesRequest(partner: PartnerCoverageInput, request: RequestMatchInput, now: Date = new Date()) {
  if (!coversZone(partner.coverageZones, request.zone)) return false
  const schedule = partner.schedule ?? []
  if (schedule.length === 0) return true
  if (request.isUrgent) return availableRestOfToday(schedule, now)
  if (request.preferredDate) {
    const date = new Date(request.preferredDate)
    if (Number.isNaN(date.getTime())) return true
    if (request.preferredTime && /\d{1,2}:\d{2}/.test(request.preferredTime)) {
      return availableAt(schedule, bookingWhen({ scheduledDate: date, scheduledTime: request.preferredTime }))
    }
    return worksOnDay(schedule, preferredDayOfWeek(date))
  }
  return true
}

/**
 * Validates and normalizes a schedule from user input. Returns the ranges sorted, or an error in Spanish.
 */
export function parseSchedule(input: unknown): { ok: true; schedule: ScheduleRange[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: 'El horario debe ser una lista de franjas' }
  const out: ScheduleRange[] = []
  for (const raw of input) {
    const r = raw as Partial<ScheduleRange> | null
    const day = r?.dayOfWeek
    if (typeof day !== 'number' || !Number.isInteger(day) || day < 0 || day > 6) return { ok: false, error: 'Día de la semana inválido' }
    if (!isHHmm(r?.startTime) || !isHHmm(r?.endTime)) return { ok: false, error: `Hora inválida el ${DAY_NAMES[day].toLowerCase()} (usa HH:mm)` }
    if (toMinutes(r.startTime) >= toMinutes(r.endTime)) return { ok: false, error: `El ${DAY_NAMES[day].toLowerCase()} la hora de inicio debe ser antes de la de fin` }
    out.push({ dayOfWeek: day, startTime: r.startTime, endTime: r.endTime })
  }
  out.sort((a, b) => a.dayOfWeek - b.dayOfWeek || toMinutes(a.startTime) - toMinutes(b.startTime))
  for (let d = 0; d <= 6; d++) {
    const day = out.filter((r) => r.dayOfWeek === d)
    if (day.length > MAX_RANGES_PER_DAY) return { ok: false, error: `Máximo ${MAX_RANGES_PER_DAY} franjas por día (${DAY_NAMES[d].toLowerCase()})` }
    for (let i = 1; i < day.length; i++) {
      if (toMinutes(day[i].startTime) < toMinutes(day[i - 1].endTime)) return { ok: false, error: `Las franjas del ${DAY_NAMES[d].toLowerCase()} se cruzan` }
    }
  }
  return { ok: true, schedule: out }
}
