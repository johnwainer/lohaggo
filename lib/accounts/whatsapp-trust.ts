/**
 * A person writing from a WhatsApp number holds that number: WhatsApp itself proved it. Pure rules for
 * what that proof allows (no DB): link the chat to the account with that phone without asking for a code,
 * and when the phone may count as confirmed.
 */

export type PhoneAccount = { id: string; role: string; isActive: boolean }

/**
 * The accounts with the chat's number decide: exactly one active client or partner → link it. Never an
 * admin (it would reach every booking) nor a number several accounts share (one of them is a typo).
 */
export function whatsappLinkDecision(accounts: PhoneAccount[]): { link: true; userId: string } | { link: false; reason: 'none' | 'ambiguous' | 'admin' | 'inactive' } {
  if (!accounts.length) return { link: false, reason: 'none' }
  const unique = Array.from(new Map(accounts.map((a) => [a.id, a])).values())
  if (unique.length > 1) return { link: false, reason: 'ambiguous' }
  const a = unique[0]
  if (a.role !== 'CLIENT' && a.role !== 'PARTNER') return { link: false, reason: 'admin' }
  if (!a.isActive) return { link: false, reason: 'inactive' }
  return { link: true, userId: a.id }
}

/**
 * Writing from the number proves the chat holds it, not that the account owner typed their own number: a
 * web sign-up with a mistyped phone would hand the account to whoever has that number if the link marked
 * it confirmed (phoneVerifiedAt opens sign-in by WhatsApp code). Only accounts whose phone was taken from
 * a chat (created from the inbox, acquisition.source «inbox») or born from a phone count as confirmed.
 */
export function linkConfirmsPhone(account: { acquisition?: unknown; email?: string | null }, isPlaceholderEmail: (email: string | null | undefined) => boolean) {
  const source = account.acquisition && typeof account.acquisition === 'object' ? (account.acquisition as Record<string, unknown>).source : null
  return source === 'inbox' || isPlaceholderEmail(account.email)
}
