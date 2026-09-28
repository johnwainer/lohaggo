/** Pure pieces of the WhatsApp code login: placeholder emails, code hashing, which accounts a code can open. */
import { createHash, timingSafeEqual } from 'crypto'

export const PHONE_CODE_TTL_MS = 10 * 60_000
export const PHONE_CODE_MAX_ATTEMPTS = 5
export const PLACEHOLDER_EMAIL_DOMAIN = 'clientes.lohaggo.com'

/** Accounts born from a phone get an internal address that never receives mail: wa-573001234567@clientes.lohaggo.com */
export const placeholderEmail = (e164: string) => `wa-${e164.replace(/\D/g, '')}@${PLACEHOLDER_EMAIL_DOMAIN}`
export const isPlaceholderEmail = (email: string | null | undefined) => Boolean(email && email.toLowerCase().endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`))

export function hashPhoneCode(code: string, codeId: string, secret: string) {
  return createHash('sha256').update(`${codeId}:${code}:${secret}`).digest('hex')
}

export function sameHash(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export type AccountForPhone = { id: string; role: string; isActive: boolean; email: string; phoneVerifiedAt: Date | null }

/**
 * What a confirmed code does for the accounts with that phone:
 * - none → create a client account (needs a name);
 * - one client/partner whose phone was confirmed before, or born from a phone → sign in;
 * - one whose phone was never confirmed → the link goes to its email (the phone on file could be a typo
 *   that belongs to whoever holds this code);
 * - admins, inactive accounts or several accounts on the number → no sign-in by phone.
 */
export function phoneLoginDecision(accounts: AccountForPhone[]):
  | { action: 'create' }
  | { action: 'login'; userId: string }
  | { action: 'email_link'; userId: string }
  | { action: 'refuse'; reason: 'ambiguous' | 'admin' | 'inactive' } {
  if (accounts.length === 0) return { action: 'create' }
  if (accounts.length > 1) return { action: 'refuse', reason: 'ambiguous' }
  const a = accounts[0]
  if (a.role !== 'CLIENT' && a.role !== 'PARTNER') return { action: 'refuse', reason: 'admin' }
  if (!a.isActive) return { action: 'refuse', reason: 'inactive' }
  if (a.phoneVerifiedAt || isPlaceholderEmail(a.email)) return { action: 'login', userId: a.id }
  return { action: 'email_link', userId: a.id }
}
