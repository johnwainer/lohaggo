/**
 * Waitlist phone rules (pure).
 *
 * The number typed in the public form is NOT verified: anyone can type someone else's. So
 *  - an existing number is never overwritten by a different one (the first one stays), and
 *  - the B25 WhatsApp message is only sent when the number proved it is reachable by its owner, i.e. an
 *    INBOUND WhatsApp message from that same number exists. Entries without that proof are stored and the
 *    team (or the WhatsApp CTA, where the person writes first) contacts them; the email path still applies.
 */
export function waitlistPhoneUpdate(existing: { phone: string | null; phoneConsentAt: Date | null } | null, phone: string | null, now: Date): { phone?: string; phoneConsentAt?: Date } {
  if (!phone) return {}
  if (existing?.phone) return {}
  return { phone, phoneConsentAt: now }
}

export function canWhatsappWaitlistEntry(entry: { phone: string | null; phoneConsentAt: Date | null }, verifiedPhones: ReadonlySet<string>): boolean {
  return Boolean(entry.phone && entry.phoneConsentAt && verifiedPhones.has(phoneKey(entry.phone)))
}

export const phoneKey = (p: string) => p.replace(/\D/g, '')
