/**
 * Normalizes a phone number to E.164 format assuming Colombia (+57) as default country.
 * Returns null for empty/invalid input.
 *
 * Rules:
 *  - Already has + prefix → strip non-digits/+, return as-is
 *  - Starts with 57 (10+ digits) → add +
 *  - Starts with 3 and is 10 digits → Colombian mobile, add +57
 *  - Anything else → add +57 and hope for the best (Twilio will reject if wrong)
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const clean = raw.replace(/[^\d+]/g, '')
  if (!clean) return null
  if (clean.startsWith('+')) return clean
  if (clean.startsWith('57') && clean.length >= 11) return `+${clean}`
  return `+57${clean}`
}
