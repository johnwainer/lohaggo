/** How long a contact has waited and whether the 24 h window of a channel is still open. Pure (shared by the page and the server). */
import { waitingFor } from '@/lib/inbox/tabs'

const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000
export const BUSINESS_START_HOUR = 7
export const BUSINESS_END_HOUR = 21
/** Waiting longer than this during business hours turns the row red */
export const OVERDUE_MINUTES = 15
export const WINDOW_MS = 24 * 60 * 60 * 1000

/** Hour of the day in Bogotá (UTC-5, no DST). */
export function bogotaHour(at: Date | number): number {
  return new Date(new Date(at).getTime() + BOGOTA_OFFSET_MS).getUTCHours()
}

/** 7:00–20:59 in Bogotá: the team is expected to answer. */
export function isBusinessHour(at: Date | number): boolean {
  const h = bogotaHour(at)
  return h >= BUSINESS_START_HOUR && h < BUSINESS_END_HOUR
}

/** «espera hace 20 min» and whether it is late (more than 15 min, now inside business hours). null without a time. */
export function waitingState(sinceIso: string | null | undefined, now: number = Date.now()): { label: string; minutes: number; overdue: boolean } | null {
  if (!sinceIso) return null
  const since = new Date(sinceIso).getTime()
  if (Number.isNaN(since)) return null
  const minutes = Math.max(0, Math.floor((now - since) / 60000))
  return { label: waitingFor(sinceIso, now) ?? '', minutes, overdue: minutes > OVERDUE_MINUTES && isBusinessHour(now) }
}

/** WhatsApp / Messenger / Instagram accept free text only within 24 h of the contact's last message. */
export function isWindowOpen(lastInboundIso: string | Date | null | undefined, now: number = Date.now()): boolean {
  if (!lastInboundIso) return false
  const t = new Date(lastInboundIso).getTime()
  return !Number.isNaN(t) && now - t <= WINDOW_MS
}
