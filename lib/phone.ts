/**
 * Colombian phone numbers as people type them: «300 123 4567», «300-123-4567», «+57 300 123 4567»,
 * «57 3001234567», «0057 300…», «(+57) 300…», «whatsapp:+573001234567». Pure: used by the forms in the
 * browser and by the server alike.
 */

export const MOBILE_HINT = 'Escribe un celular colombiano de 10 dígitos que empiece por 3 (ej. 300 123 4567).'
export const LANDLINE_ERROR = 'Ese número parece un fijo. Escribe un celular con WhatsApp: 10 dígitos que empiezan por 3 (ej. 300 123 4567).'

export type ColombianMobile =
  | { ok: true; e164: string; national: string }
  | { ok: false; reason: 'empty' | 'landline' | 'foreign' | 'invalid'; error: string }

/** Digits of the national number: the +57 / 57 / 0057 prefix is dropped. */
export function nationalPhoneDigits(raw: string | null | undefined): string {
  const value = String(raw ?? '').replace(/^whatsapp:/i, '').trim()
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('0057')) digits = digits.slice(4)
  // No national number starts with 57 (mobiles start with 3, landlines with 60): beyond 10 digits it is the country code
  else if (digits.startsWith('57') && digits.length > 10) digits = digits.slice(2)
  return digits
}

/** «3001234567» → «300 123 4567» (as the person types; never more than 10 digits). */
export function formatNationalPhone(raw: string | null | undefined): string {
  const d = nationalPhoneDigits(raw).slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
}

/**
 * A Colombian mobile (10 digits starting with 3) in any of the usual formats. Landlines (60X + 7 digits,
 * the old 7-digit numbers, or area code + 7) get their own message; other countries are «foreign».
 */
export function parseColombianMobile(raw: string | null | undefined): ColombianMobile {
  const value = String(raw ?? '').replace(/^whatsapp:/i, '').trim()
  if (!value.replace(/\D/g, '')) return { ok: false, reason: 'empty', error: 'El celular es obligatorio.' }
  const compact = value.replace(/[\s().\-–]/g, '')
  if (/^\+(?!57)\d/.test(compact) || (/^00(?!57)\d/.test(compact))) return { ok: false, reason: 'foreign', error: MOBILE_HINT }
  const national = nationalPhoneDigits(value)
  if (/^3\d{9}$/.test(national)) return { ok: true, e164: `+57${national}`, national }
  if (/^60[1-8]\d{7}$/.test(national) || /^[1-8]\d{7}$/.test(national) || /^[2-8]\d{6}$/.test(national)) {
    return { ok: false, reason: 'landline', error: LANDLINE_ERROR }
  }
  return { ok: false, reason: 'invalid', error: MOBILE_HINT }
}

/**
 * Normalizes a phone number to E.164 format assuming Colombia (+57) as default country.
 * Returns null for empty/invalid input.
 *
 * Rules:
 *  - A Colombian mobile in any usual format → +573XXXXXXXXX
 *  - Already has + prefix → strip non-digits/+, return as-is
 *  - 00 international prefix → +
 *  - Starts with 57 (10+ digits) → add +
 *  - Anything else → add +57 and hope for the best (Twilio will reject if wrong)
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const mobile = parseColombianMobile(raw)
  if (mobile.ok) return mobile.e164
  const clean = raw.replace(/^whatsapp:/i, '').replace(/[^\d+]/g, '')
  if (!clean.replace(/\+/g, '')) return null
  if (clean.startsWith('+')) return `+${clean.replace(/\+/g, '')}`
  if (clean.startsWith('00') && clean.length > 8) return `+${clean.slice(2)}`
  if (clean.startsWith('57') && clean.length >= 11) return `+${clean}`
  return `+57${clean}`
}

/**
 * The forms a phone may have been stored with before normalization was strict (E.164, without «+», the
 * 10 national digits): to find the account behind a WhatsApp number.
 */
export function storedPhoneVariants(e164: string): string[] {
  const digits = e164.replace(/\D/g, '')
  const out = new Set<string>([e164, digits])
  if (digits.startsWith('57') && digits.length === 12) out.add(digits.slice(2))
  return Array.from(out)
}
