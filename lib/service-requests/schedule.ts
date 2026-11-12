/**
 * «Cuándo» as chips instead of free text: a day chip (hoy / mañana / en 5 días) and a time range (mañana /
 * tarde / noche / hora exacta / cualquier hora). Everything maps to what the API already takes: a
 * YYYY-MM-DD `preferredDate` and an optional HH:mm `preferredTime` (the range's start). All days are Bogotá days.
 */
import { bogotaDatePlus } from '@/lib/service-requests/draft'

export type DayChip = 'today' | 'tomorrow' | 'plus5'
export const DAY_CHIPS: ReadonlyArray<{ id: DayChip; label: string; days: number }> = [
  { id: 'today', label: 'Hoy', days: 0 },
  { id: 'tomorrow', label: 'Mañana', days: 1 },
  { id: 'plus5', label: 'En 5 días', days: 5 },
]

export function dayChipDate(chip: DayChip, now = new Date()): string {
  const days = DAY_CHIPS.find((c) => c.id === chip)?.days ?? 0
  return bogotaDatePlus(days, now)
}

/** The chip a date corresponds to, or null when it is another day (the date input shows it). */
export function chipFromDate(date: string, now = new Date()): DayChip | null {
  if (!date) return null
  return DAY_CHIPS.find((c) => bogotaDatePlus(c.days, now) === date)?.id ?? null
}

export type TimeRange = 'any' | 'morning' | 'afternoon' | 'evening' | 'exact'
export const TIME_RANGES: ReadonlyArray<{ id: TimeRange; label: string; hint: string; time: string }> = [
  { id: 'any', label: 'Cualquier hora', hint: 'El socio propone', time: '' },
  { id: 'morning', label: 'Mañana', hint: '8 a. m. – 12 m.', time: '08:00' },
  { id: 'afternoon', label: 'Tarde', hint: '2 – 6 p. m.', time: '14:00' },
  { id: 'evening', label: 'Noche', hint: '6 – 9 p. m.', time: '18:00' },
  { id: 'exact', label: 'Hora exacta', hint: 'Tú eliges', time: '' },
]

/** HH:mm sent to the API for a range; for «exact» the typed hour, for «any» nothing. */
export function rangeTime(range: TimeRange, exactTime = ''): string {
  if (range === 'exact') return /^([01]\d|2[0-3]):[0-5]\d$/.test(exactTime) ? exactTime : ''
  return TIME_RANGES.find((r) => r.id === range)?.time ?? ''
}

/** Which range a saved HH:mm belongs to (a saved draft); a time that is not a range start is «exact». */
export function rangeFromTime(time: string): TimeRange {
  if (!time) return 'any'
  return TIME_RANGES.find((r) => r.time && r.time === time)?.id ?? 'exact'
}

/** Line added to the request notes so partners see the window the client meant (the API only stores the start). */
export function rangeNote(range: TimeRange): string | null {
  const r = TIME_RANGES.find((x) => x.id === range)
  if (!r || range === 'any' || range === 'exact') return null
  return `Franja preferida: ${r.label.toLowerCase()} (${r.hint}).`
}

/** Minutes since midnight in Bogotá. */
function bogotaMinutes(now: Date): number {
  const b = new Date(now.getTime() - 5 * 3600_000)
  return b.getUTCHours() * 60 + b.getUTCMinutes()
}

/**
 * A range is offered for a day unless its start is less than an hour away (only matters for today).
 * «any» and «exact» are always offered; an exact hour is checked when typed.
 */
export function rangeAvailable(range: TimeRange, date: string, now = new Date()): boolean {
  if (range === 'any' || range === 'exact') return true
  if (date !== bogotaDatePlus(0, now)) return true
  const time = TIME_RANGES.find((r) => r.id === range)?.time
  if (!time) return true
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m >= bogotaMinutes(now) + 60
}

/** The requested moment is at least one hour ahead (Bogotá); without an hour only the day must not be past. */
export function scheduledMomentOk(date: string, time: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const today = bogotaDatePlus(0, now)
  if (date < today) return false
  if (date > today || !time) return true
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m >= bogotaMinutes(now) + 60
}
