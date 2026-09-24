/**
 * Canonical contact address for Twilio SMS/WhatsApp conversations.
 * Real phone numbers arrive as E.164 ("+57…"). Local Colombian numbers get +57. Anything else
 * (e.g. a WhatsApp user ID without "+") is kept verbatim: prefixing +57 turns it into an invalid
 * number and Twilio then rejects every reply to that contact.
 */
export function normalizeContactAddress(raw: string): string {
  const value = raw.replace(/^whatsapp:/i, '').trim()
  const compact = value.replace(/[\s().-]/g, '')
  if (/^\+\d{6,15}$/.test(compact)) return compact
  if (/^3\d{9}$/.test(compact)) return `+57${compact}`
  if (/^573\d{9}$/.test(compact)) return `+${compact}`
  return value
}

/** Address to send to through Twilio, the exact form the contact wrote from. */
export function twilioAddress(contact: string, whatsapp: boolean) {
  const address = normalizeContactAddress(contact)
  return whatsapp ? `whatsapp:${address}` : address
}
