/**
 * «Cómo llegar» and «Agregar al calendario» for a booking the partner already has (so the exact address is
 * theirs to see). Deep links to Google Maps / Waze (no embedded map) and a standards-compliant .ics file.
 */
import { bookingWhen } from '@/lib/bookings/when'

const q = (address: string, city?: string | null) => [address.trim(), city?.trim()].filter(Boolean).join(', ')

/** Google Maps search for the address (opens the Maps app on a phone). */
export function googleMapsUrl(address: string, city?: string | null): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q(address, city))}`
}

/** Waze search for the address. */
export function wazeUrl(address: string, city?: string | null): string {
  return `https://waze.com/ul?q=${encodeURIComponent(q(address, city))}&navigate=yes`
}

/** `tel:` link with only the digits and a leading +; null when there is nothing dialable. */
export function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/[^\d+]/g, '')
  const clean = digits.startsWith('+') ? `+${digits.slice(1).replace(/\+/g, '')}` : digits.replace(/\+/g, '')
  return clean.replace(/\D/g, '').length >= 7 ? `tel:${clean}` : null
}

const pad = (n: number) => String(n).padStart(2, '0')
const icsStamp = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** RFC 5545 folding: lines over 75 octets continue on the next line after a space. */
function fold(line: string): string {
  if (line.length <= 73) return line
  const parts: string[] = []
  let rest = line
  parts.push(rest.slice(0, 73))
  rest = rest.slice(73)
  while (rest.length > 72) { parts.push(` ${rest.slice(0, 72)}`); rest = rest.slice(72) }
  if (rest) parts.push(` ${rest}`)
  return parts.join('\r\n')
}

export type IcsBooking = {
  id: string
  title: string
  scheduledDate: Date | string
  scheduledTime: string
  address: string
  notes?: string | null
  /** Minutes the visit is blocked for (default 60) */
  durationMin?: number
}

/** The .ics text for one booking. The start is the real Bogotá moment, written in UTC. */
export function buildIcs(b: IcsBooking, now = new Date()): string {
  const start = bookingWhen({ scheduledDate: new Date(b.scheduledDate), scheduledTime: b.scheduledTime })
  const end = new Date(start.getTime() + (b.durationMin ?? 60) * 60_000)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LoHaggo//Reservas//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:booking-${b.id}@lohaggo.com`,
    `DTSTAMP:${icsStamp(now)}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${esc(b.title)}`,
    `LOCATION:${esc(b.address)}`,
    ...(b.notes ? [`DESCRIPTION:${esc(b.notes.slice(0, 500))}`] : []),
    'BEGIN:VALARM',
    'TRIGGER:-PT60M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(b.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lines.map(fold).join('\r\n')}\r\n`
}
