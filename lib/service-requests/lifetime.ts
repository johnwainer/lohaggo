import { bookingWhen, dateOnlyUtc } from '@/lib/bookings/when'

/**
 * How long a request stays open, pure. With a preferred date it lives until the day before at 20:00
 * (Bogotá), never less than 48 h nor more than 7 days from its start; without a date, or «lo antes
 * posible», 48 h.
 */

const H = 3600_000
export const REQUEST_MIN_LIFETIME_MS = 48 * H
export const REQUEST_MAX_LIFETIME_MS = 7 * 24 * H
/** An active request about to expire without proposals is extended at most this many times */
export const MAX_AUTO_EXTENSIONS = 2
/** An extension ends this long before the service at the latest (a partner still has time to go) */
const EXTENSION_MARGIN_MS = 2 * H
const MIN_EXTENSION_GAIN_MS = H

export type LifetimeInput = { preferredDate?: Date | string | null; isUrgent?: boolean | null }

/** 20:00 Bogotá of the day before the preferred day (= the preferred day at 01:00 UTC). */
export function eveOfPreferredDay(preferredDate: Date | string) {
  return new Date(dateOnlyUtc(preferredDate).getTime() + H)
}

export function requestExpiresAt(r: LifetimeInput, from: Date = new Date()) {
  const start = from.getTime()
  const min = start + REQUEST_MIN_LIFETIME_MS
  if (!r.preferredDate || r.isUrgent) return new Date(min)
  const eve = eveOfPreferredDay(r.preferredDate).getTime()
  if (Number.isNaN(eve)) return new Date(min)
  return new Date(Math.min(start + REQUEST_MAX_LIFETIME_MS, Math.max(min, eve)))
}

/** The moment of the service the client asked for (09:00 when there is no hour). */
export function preferredMoment(r: { preferredDate: Date | string; preferredTime?: string | null }) {
  return bookingWhen({ scheduledDate: new Date(r.preferredDate), scheduledTime: r.preferredTime && /\d{1,2}:\d{2}/.test(r.preferredTime) ? r.preferredTime : '09:00' })
}

export type ExtensionInput = { preferredDate: Date | string | null; preferredTime?: string | null; isUrgent?: boolean | null; expiresAt: Date | string; createdAt?: Date | string | null }

/** However many extensions, a request never stays open longer than this from its creation. */
export const REQUEST_TOTAL_CAP_MS = 14 * 24 * H

/**
 * The new deadline of a request about to expire with no proposals, or null when it must expire: no date or
 * urgent, the service already close, the extensions used up, or nothing to gain. Never earlier than now.
 */
export function nextAutoExtension(r: ExtensionInput, extensionsDone: number, now: Date = new Date()): Date | null {
  if (extensionsDone >= MAX_AUTO_EXTENSIONS || !r.preferredDate || r.isUrgent) return null
  const service = preferredMoment({ preferredDate: r.preferredDate, preferredTime: r.preferredTime })
  if (Number.isNaN(service.getTime())) return null
  const created = r.createdAt ? new Date(r.createdAt).getTime() : NaN
  const cap = Math.min(service.getTime() - EXTENSION_MARGIN_MS, Number.isNaN(created) ? Infinity : created + REQUEST_TOTAL_CAP_MS)
  const target = Math.min(requestExpiresAt({ preferredDate: r.preferredDate }, now).getTime(), cap)
  const current = new Date(r.expiresAt).getTime()
  if (target - Math.max(current, now.getTime()) < MIN_EXTENSION_GAIN_MS) return null
  return new Date(target)
}
