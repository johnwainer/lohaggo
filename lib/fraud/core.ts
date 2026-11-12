import { nationalPhoneDigits } from '@/lib/phone'
import { isPlaceholderEmail } from '@/lib/accounts/phone-login-core'

/** Pure rules behind FraudSignal rows (the database parts are in lib/fraud/signals.ts). */

export const FRAUD_TYPE = {
  contactBlocked: 'CONTACT_GUARD_BLOCK',
  offPlatformPair: 'OFF_PLATFORM_PAIR',
  sharedPhone: 'SHARED_PHONE',
} as const
export type FraudType = (typeof FRAUD_TYPE)[keyof typeof FRAUD_TYPE]

export const FRAUD_LABEL: Record<string, string> = {
  CONTACT_GUARD_BLOCK: 'Intento de compartir contacto',
  OFF_PLATFORM_PAIR: 'Posible trato fuera de la plataforma',
  SHARED_PHONE: 'Varias cuentas con el mismo celular',
}

export const dayKey = (d: Date) => d.toISOString().slice(0, 10)

/** Key inside `details` that makes a signal idempotent: same pair/phone/chat on the same day (or while it stays open). */
export const signalKey = (type: FraudType, parts: string[], day?: string) => [type, ...parts, ...(day ? [day] : [])].join(':')

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

/** Repeated attempts in the chat are worse than a one-off: 3+ in the last week is HIGH. */
export function contactBlockSeverity(attemptsThisWeek: number): { severity: Severity; score: number } {
  if (attemptsThisWeek >= 5) return { severity: 'HIGH', score: 80 }
  if (attemptsThisWeek >= 3) return { severity: 'HIGH', score: 60 }
  return { severity: 'MEDIUM', score: 20 + attemptsThisWeek * 5 }
}

export type PairActivity = {
  clientId: string
  partnerId: string
  /** Bookings of the pair that are not cancelled */
  activeBookings: number
  completedBookings: number
  firstCompletedAt: Date | null
  /** Human messages (not SYSTEM) in their chats after the first completed booking */
  messagesAfter: number
  lastMessageAt: Date | null
}

export const OFF_PLATFORM = { minMessagesAfter: 6, minDaysSinceCompleted: 2, maxDaysSinceLastMessage: 14 } as const

/**
 * A pair that finished ONE booking and never booked again while the chat keeps going: the usual way of taking a
 * client off the platform. Needs real conversation after the service (not a thank-you) and a recent last message.
 */
export function isOffPlatformPair(p: PairActivity, now = new Date()): boolean {
  if (p.completedBookings !== 1 || p.activeBookings !== 1 || !p.firstCompletedAt || !p.lastMessageAt) return false
  const days = (a: Date, b: Date) => (a.getTime() - b.getTime()) / 86_400_000
  return p.messagesAfter >= OFF_PLATFORM.minMessagesAfter && days(now, p.firstCompletedAt) >= OFF_PLATFORM.minDaysSinceCompleted && days(now, p.lastMessageAt) <= OFF_PLATFORM.maxDaysSinceLastMessage
}

export type AccountLite = { id: string; name: string; email: string; phone: string | null; role: string; isActive: boolean; createdAt: Date; acquisitionSource?: string | null }

/** Same phone written differently («+57 300…», «3001234567») is the same phone. Null when it is not a usable number. */
export function phoneKey(raw: string | null | undefined): string | null {
  const d = nationalPhoneDigits(raw)
  return /^3\d{9}$/.test(d) ? d : null
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim()

export type DuplicateGroup = { reason: 'phone' | 'name'; key: string; accounts: AccountLite[] }

const bornInChat = (a: AccountLite) => isPlaceholderEmail(a.email) || a.acquisitionSource === 'inbox'

/**
 * Probable duplicate accounts for manual merge review: same normalized phone (active client/partner accounts), or the
 * same full name created within 1 h of each other when at least one was created through a chat. Read-only.
 */
export function findDuplicateGroups(accounts: AccountLite[], opts: { windowMs?: number } = {}): DuplicateGroup[] {
  const windowMs = opts.windowMs ?? 3600_000
  const groups: DuplicateGroup[] = []

  const byPhone = new Map<string, AccountLite[]>()
  for (const a of accounts) {
    if (!a.isActive || a.role === 'ADMIN') continue
    const k = phoneKey(a.phone)
    if (k) byPhone.set(k, [...(byPhone.get(k) ?? []), a])
  }
  for (const [key, list] of Array.from(byPhone.entries())) if (list.length > 1) groups.push({ reason: 'phone', key, accounts: list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()) })

  const byName = new Map<string, AccountLite[]>()
  for (const a of accounts) {
    if (a.role === 'ADMIN') continue
    const n = fold(a.name)
    if (n.split(' ').length < 2) continue
    byName.set(n, [...(byName.get(n) ?? []), a])
  }
  for (const [key, list] of Array.from(byName.entries())) {
    if (list.length < 2) continue
    const sorted = [...list].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    // Chain accounts created within the window of the previous one
    let run: AccountLite[] = [sorted[0]]
    const flush = () => {
      if (run.length > 1 && run.some(bornInChat)) groups.push({ reason: 'name', key, accounts: run })
    }
    for (const a of sorted.slice(1)) {
      if (a.createdAt.getTime() - run[run.length - 1].createdAt.getTime() <= windowMs) run.push(a)
      else { flush(); run = [a] }
    }
    flush()
  }
  return groups
}
