/** Pure date helpers of a booking (no server imports), re-exported by lib/bookings/ops.ts. */

/**
 * The moment of the service in Bogotá (UTC-5, no DST): the calendar date of `scheduledDate` plus
 * `scheduledTime`. The date part is read in UTC because the app stores the day at midnight (UTC or
 * Bogotá, both fall on the same UTC day). Accepts 'HH:mm', 'H:mm' and 'h:mm AM/PM'.
 */
export function bookingWhen(b: { scheduledDate: Date; scheduledTime: string }): Date {
  // A date-only value is stored as midnight UTC (keep that calendar day); any other instant is read as
  // its Bogotá calendar day, so a booking at 19:00 Bogotá (00:00 UTC next day) keeps its real day.
  const when = new Date(b.scheduledDate)
  const dateOnly = when.getUTCHours() === 0 && when.getUTCMinutes() === 0 && when.getUTCSeconds() === 0 && when.getUTCMilliseconds() === 0
  const day = dateOnly ? when.toISOString().slice(0, 10) : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(when)
  const m = /(\d{1,2}):(\d{2})\s*([ap]\.?\s?m\.?)?/i.exec(b.scheduledTime || '')
  let hours = m ? Number(m[1]) : 0
  const minutes = m ? Number(m[2]) : 0
  const suffix = m?.[3]?.toLowerCase().replace(/[^ap]/g, '')
  if (suffix === 'p' && hours < 12) hours += 12
  if (suffix === 'a' && hours === 12) hours = 0
  return new Date(`${day}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00-05:00`)
}

const BOGOTA = 'America/Bogota'

export function formatBookingWhen(b: { scheduledDate: Date; scheduledTime: string }) {
  const d = bookingWhen(b)
  const parts = new Intl.DateTimeFormat('es-CO', { timeZone: BOGOTA, weekday: 'short', day: 'numeric', month: 'short' }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value.replace(/\./g, '') ?? ''
  const time = new Intl.DateTimeFormat('es-CO', { timeZone: BOGOTA, hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  return `${get('weekday')} ${get('day')} ${get('month')} ${time}`
}

/** Time used when a booking has a day but nobody chose the hour. */
export const DEFAULT_BOOKING_TIME = '09:00'

function isUtcMidnight(d: Date) {
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0
}

/** 'YYYY-MM-DD' of a stored date: a midnight-UTC value keeps its UTC day, any other instant its Bogotá day. */
export function calendarDayKey(value: Date | string): string {
  const d = new Date(value)
  if (isUtcMidnight(d)) return d.toISOString().slice(0, 10)
  return new Intl.DateTimeFormat('en-CA', { timeZone: BOGOTA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/** The date-only value the app stores (scheduledDate / preferredDate / proposedDate): the calendar day at 00:00 UTC. */
export function dateOnlyUtc(value: Date | string): Date {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00.000Z`)
  return new Date(`${calendarDayKey(value)}T00:00:00.000Z`)
}

/** The Bogotá wall-clock 'HH:mm' of an instant. */
export function bogotaClockTime(d: Date): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: BOGOTA, hour: '2-digit', minute: '2-digit', hour12: false }).format(d).replace(/^24/, '00')
}

/** Only the calendar day of a stored date (no time), in Spanish. */
export function formatCalendarDay(value: Date | string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Intl.DateTimeFormat('es-CO', { ...opts, timeZone: 'UTC' }).format(new Date(`${calendarDayKey(value)}T12:00:00.000Z`))
}
