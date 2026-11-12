/**
 * Ley 1581 de 2012 (habeas data): terms acceptance and marketing consent.
 *
 * Terms: every signup path records `termsAcceptedAt` + `termsVersion` (the form says «Al continuar aceptas…»).
 * Chat-born accounts (WhatsApp/Messenger/Instagram) leave them null on purpose, because the bot does not tell the
 * person about the terms: the app asks on their first login (TermsAcceptBanner).
 *
 * Marketing by WhatsApp or SMS needs ONE of these:
 *  1. `marketingConsentAt` set (explicit checkbox at signup, or opt-in in the app) → basis `explicit`.
 *  2. GRANDFATHERED: the account existed before CONSENT_REQUIRED_FROM. Those people signed up under the previous
 *     flow (partners through /unete included) and keep receiving service-related marketing (reactivation, rebooking
 *     invitations, coverage news) with the opt-out that always applies (STOP / «no más avisos» / excludedFromMarketing)
 *     → basis `grandfathered`.
 * Accounts created on or after CONSENT_REQUIRED_FROM without the checkbox get no marketing: only transactional
 * messages about their own bookings and requests. The opt-out always wins over both bases.
 */
export const TERMS_VERSION = '2026-11'
/** Signups from this instant on need explicit marketing consent (Bogotá midnight of 2026-11-13) */
export const CONSENT_REQUIRED_FROM = new Date('2026-11-13T05:00:00Z')

export type ConsentFields = { marketingConsentAt?: Date | string | null; createdAt?: Date | string | null }

export type ConsentBasis = 'explicit' | 'grandfathered' | 'none'

const asDate = (v: Date | string | null | undefined) => (v ? new Date(v) : null)

export function marketingConsentBasis(u: ConsentFields, requiredFrom: Date = CONSENT_REQUIRED_FROM): ConsentBasis {
  if (asDate(u.marketingConsentAt)) return 'explicit'
  const created = asDate(u.createdAt)
  if (created && created.getTime() < requiredFrom.getTime()) return 'grandfathered'
  return 'none'
}

/** Whether marketing by WhatsApp/SMS may go to this person (the opt-out is checked separately by every sender). */
export function hasMarketingConsent(u: ConsentFields, requiredFrom?: Date): boolean {
  return marketingConsentBasis(u, requiredFrom) !== 'none'
}

/** Prisma `where` fragment with the same rule (for audience queries). */
export function marketingConsentWhere(requiredFrom: Date = CONSENT_REQUIRED_FROM) {
  return { OR: [{ marketingConsentAt: { not: null } }, { createdAt: { lt: requiredFrom } }] }
}

/** What a signup records. `marketing` is the checkbox; terms are implied by the form's notice. */
export function signupConsent(opts: { marketing?: boolean; termsShown?: boolean }, now = new Date()) {
  return {
    ...(opts.termsShown === false ? {} : { termsAcceptedAt: now, termsVersion: TERMS_VERSION }),
    ...(opts.marketing ? { marketingConsentAt: now } : {}),
  }
}
