/**
 * The next booking, kept on the device so the offline page can show it («Tu próxima reserva»). Nothing
 * from the API is cached by the service worker (it is per-user data): the panels write this small
 * snapshot to localStorage themselves. It holds only what is on the screen anyway: service, day and hour,
 * and the city; never the address, a name or a phone.
 */
import { bookingWhen, formatBookingWhen } from '@/lib/bookings/when'

export const NEXT_BOOKING_KEY = 'lohaggo:next-booking'

export type NextBookingSnapshot = { v: 1; service: string; when: string; at: number; role: 'CLIENT' | 'PARTNER'; savedAt: number }

type BookingLike = { status: string; scheduledDate: string | Date; scheduledTime: string; service?: { name?: string | null } | null }

/** The soonest live booking from now on (a 3 h grace keeps the one in progress), or null. */
export function pickNextBooking<T extends BookingLike>(bookings: T[], now = Date.now()): T | null {
  const live = bookings
    .filter((b) => b.status === 'PENDING' || b.status === 'CONFIRMED' || b.status === 'IN_PROGRESS')
    .map((b) => ({ b, at: bookingWhen({ scheduledDate: new Date(b.scheduledDate), scheduledTime: b.scheduledTime }).getTime() }))
    .filter((x) => Number.isFinite(x.at) && x.at >= now - 3 * 3600_000)
    .sort((a, b) => a.at - b.at)
  return live[0]?.b ?? null
}

type StorageLike = Pick<Storage, 'setItem' | 'removeItem'>

/** Writes the snapshot for the soonest booking, or clears it when there is none. */
export function saveNextBooking(storage: StorageLike | null | undefined, bookings: BookingLike[], role: 'CLIENT' | 'PARTNER', now = Date.now()) {
  if (!storage) return
  try {
    const next = pickNextBooking(bookings, now)
    if (!next) { storage.removeItem(NEXT_BOOKING_KEY); return }
    const when = formatBookingWhen({ scheduledDate: new Date(next.scheduledDate), scheduledTime: next.scheduledTime })
    const at = bookingWhen({ scheduledDate: new Date(next.scheduledDate), scheduledTime: next.scheduledTime }).getTime()
    const snapshot: NextBookingSnapshot = { v: 1, service: next.service?.name ?? 'Servicio', when, at, role, savedAt: now }
    storage.setItem(NEXT_BOOKING_KEY, JSON.stringify(snapshot))
  } catch { /* quota / private mode */ }
}
