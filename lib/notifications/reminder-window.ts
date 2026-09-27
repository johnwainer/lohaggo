import { bookingWhen } from '@/lib/bookings/ops'

/**
 * Reminder timing in real time (Bogotá wall clock), for the notification-reminders cron. Pure.
 *
 * `scheduledDate` comes in two shapes: a UTC-midnight day (older rows, the time lives only in
 * `scheduledTime`) or a full instant (preferredDate / next full hour). For the second one the calendar day
 * is taken in Bogotá, so an evening booking (≥ 19:00, already the next day in UTC) is not moved a day later.
 */
export function bookingStart(b: { scheduledDate: Date | string; scheduledTime: string }): Date {
  const d = new Date(b.scheduledDate)
  const isUtcMidnight = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0
  const day = isUtcMidnight ? d : new Date(`${bogotaDay(d)}T00:00:00.000Z`)
  return bookingWhen({ scheduledDate: day, scheduledTime: b.scheduledTime })
}

function bogotaDay(d: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

export type ReminderWindow = { fromMin: number; toMin: number }

/** 24 h reminder: starts in 22–25 h. «Starts soon»: in 30–90 min. Dedupe is done by the caller. */
export const REMINDER_WINDOWS = {
  day: { fromMin: 22 * 60, toMin: 25 * 60 },
  soon: { fromMin: 30, toMin: 90 },
} satisfies Record<string, ReminderWindow>

export function minutesUntilStart(b: { scheduledDate: Date | string; scheduledTime: string }, now: Date) {
  return (bookingStart(b).getTime() - now.getTime()) / 60_000
}

export function inReminderWindow(b: { scheduledDate: Date | string; scheduledTime: string }, now: Date, w: ReminderWindow) {
  const min = minutesUntilStart(b, now)
  return min >= w.fromMin && min <= w.toMin
}

/** Broad `scheduledDate` range that surely contains every booking starting in the next ~26 h, whatever its shape. */
export function candidateScheduledRange(now: Date) {
  return { gte: new Date(now.getTime() - 36 * 3600_000), lte: new Date(now.getTime() + 48 * 3600_000) }
}

export function expiringSoonMessage(serviceName: string, proposals: number) {
  return proposals > 0
    ? `Tu solicitud de ${serviceName} expira en menos de 2 horas. Revisa las propuestas recibidas.`
    : `Tu solicitud de ${serviceName} expira en menos de 2 horas. Aún no recibes propuestas; te avisamos si llega alguna, o escríbenos por WhatsApp.`
}
