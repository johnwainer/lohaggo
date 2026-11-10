/** How long a contact has waited and whether the 24 h window of a channel is still open. Pure (shared by the page and the server). */
import { waitingFor } from '@/lib/inbox/tabs'

const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000
export const BUSINESS_START_HOUR = 7
export const BUSINESS_END_HOUR = 21
/** Waiting longer than this during business hours turns the row red */
export const OVERDUE_MINUTES = 15
/** Waiting this long is critical (the ladder's critical step) */
export const CRITICAL_MINUTES = 120
export const WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * The one rule the list uses for «espera hace…», built from the inbox settings (lib/inbox/settings-core.ts →
 * waitingRuleOf). The defaults match DEFAULT_INBOX_CONFIG.
 */
export type WaitingRule = {
  overdueMinutes: number
  criticalMinutes: number
  openHour: number
  closeHour: number
  timezone: string
}

export const DEFAULT_WAITING_RULE: Readonly<WaitingRule> = {
  overdueMinutes: OVERDUE_MINUTES,
  criticalMinutes: CRITICAL_MINUTES,
  openHour: BUSINESS_START_HOUR,
  closeHour: BUSINESS_END_HOUR,
  timezone: 'America/Bogota',
}

/** Hour of the day in Bogotá (UTC-5, no DST). */
export function bogotaHour(at: Date | number): number {
  return new Date(new Date(at).getTime() + BOGOTA_OFFSET_MS).getUTCHours()
}

function localHour(at: Date | number, timeZone: string): number {
  if (timeZone === 'America/Bogota') return bogotaHour(at)
  try {
    const h = Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(new Date(at)))
    return Number.isFinite(h) ? h % 24 : bogotaHour(at)
  } catch {
    return bogotaHour(at)
  }
}

/** Team hours (7:00–20:59 in Bogotá by default): the team is expected to answer. */
export function isBusinessHour(at: Date | number, rule: Pick<WaitingRule, 'openHour' | 'closeHour' | 'timezone'> = DEFAULT_WAITING_RULE): boolean {
  const h = localHour(at, rule.timezone)
  return h >= rule.openHour && h < rule.closeHour
}

export type WaitingLevel = 'waiting' | 'overdue' | 'critical'

/**
 * «espera hace 20 min» and how late it is: overdue past `overdueMinutes`, critical past `criticalMinutes`, both
 * only while the team is working now. null without a time.
 */
export function waitingState(
  sinceIso: string | null | undefined,
  now: number = Date.now(),
  rule: WaitingRule = DEFAULT_WAITING_RULE,
): { label: string; minutes: number; overdue: boolean; level: WaitingLevel } | null {
  if (!sinceIso) return null
  const since = new Date(sinceIso).getTime()
  if (Number.isNaN(since)) return null
  const minutes = Math.max(0, Math.floor((now - since) / 60000))
  const working = isBusinessHour(now, rule)
  const overdue = working && minutes > rule.overdueMinutes
  const level: WaitingLevel = working && minutes >= rule.criticalMinutes ? 'critical' : overdue ? 'overdue' : 'waiting'
  return { label: waitingFor(sinceIso, now) ?? '', minutes, overdue, level }
}

/** WhatsApp / Messenger / Instagram accept free text only within 24 h of the contact's last message. */
export function isWindowOpen(lastInboundIso: string | Date | null | undefined, now: number = Date.now()): boolean {
  if (!lastInboundIso) return false
  const t = new Date(lastInboundIso).getTime()
  return !Number.isNaN(t) && now - t <= WINDOW_MS
}

export const WA_WINDOW_CLOSED_ERROR = 'La ventana de 24 h de WhatsApp está cerrada: solo se puede enviar una plantilla aprobada («Elegir plantilla»).'

/**
 * WhatsApp free text (or an attachment) outside the 24 h window: Twilio accepts it and Meta drops it later, so
 * the server refuses it with a clear error. Templates always pass. Pure.
 */
export function whatsappWindowError(input: { channel: string; template: boolean; lastInboundAt: string | Date | null | undefined }, now: number = Date.now()): string | null {
  if (input.channel !== 'WHATSAPP' || input.template) return null
  return isWindowOpen(input.lastInboundAt, now) ? null : WA_WINDOW_CLOSED_ERROR
}
