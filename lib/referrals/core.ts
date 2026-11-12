/** Referrals (pure): codes, capture and the qualification rule. */

/** No 0/O/1/I/L: codes get read aloud and typed from a WhatsApp message */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const REFERRAL_CODE_LENGTH = 7

export function generateReferralCode(random: () => number = Math.random): string {
  let out = ''
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) out += ALPHABET[Math.floor(random() * ALPHABET.length)]
  return out
}

/** The code inside a ?ref= value, or null when it cannot be one. */
export function normalizeReferralCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const code = raw.trim().toUpperCase()
  return /^[A-Z0-9]{5,12}$/.test(code) ? code : null
}

export const REFERRAL_STORAGE_KEY = 'lh_ref'

/** Link to share: the landing the referred person should open (clients /register, partners /unete). */
export function referralLink(code: string, audience: 'CLIENT' | 'PARTNER', base = 'https://www.lohaggo.com') {
  return `${base}${audience === 'PARTNER' ? '/unete' : '/register'}?ref=${code}&utm_source=referido&utm_medium=enlace&utm_campaign=referidos`
}

export function referralShareText(name: string | null | undefined, link: string, audience: 'CLIENT' | 'PARTNER') {
  const who = audience === 'PARTNER' ? 'Únete como socio en LoHaggo y recibe solicitudes de clientes en tu zona' : 'Pide servicios para tu hogar con profesionales verificados en LoHaggo'
  return `${name ? `${name.split(' ')[0]} te invita. ` : ''}${who}: ${link}`
}

export type QualifyInput = {
  bookingStatus: string
  payment: { status: string; confirmationStatus: string } | null
}

/**
 * A referral qualifies when the referred person's FIRST booking is completed AND paid: approved in the app, or
 * paid directly to the partner and confirmed (confirmationStatus CONFIRMED). Completed without confirmed payment waits.
 */
export function qualifiesReferral(b: QualifyInput): boolean {
  if (b.bookingStatus !== 'COMPLETED' || !b.payment) return false
  return b.payment.status === 'APPROVED' || b.payment.confirmationStatus === 'CONFIRMED'
}

/** The referrer's reward: one more on the counter; partner referrers also get priority notifications from the first one. */
export function rewardFor(role: string, currentCount: number) {
  return { qualifiedCount: currentCount + 1, priorityNotifications: role === 'PARTNER' }
}

/**
 * Self-dealing: a referral does not qualify when both accounts share a phone, or when the qualifying booking is
 * between the referrer's own accounts/counterparts (the referrer is the partner of the referred client's booking,
 * or the referred is the partner of a booking of the referrer's).
 */
export function isSelfDealingReferral(p: {
  referrerPhoneKey: string | null
  referredPhoneKey: string | null
  qualifyingBookingPartnerId: string | null
  referrerPartnerProfileId: string | null
  referrerIsClientOfReferredPartner: boolean
}): 'shared_phone' | 'referrer_is_partner' | 'referred_is_partner_of_referrer' | null {
  if (p.referrerPhoneKey && p.referrerPhoneKey === p.referredPhoneKey) return 'shared_phone'
  if (p.referrerPartnerProfileId && p.qualifyingBookingPartnerId === p.referrerPartnerProfileId) return 'referrer_is_partner'
  if (p.referrerIsClientOfReferredPartner) return 'referred_is_partner_of_referrer'
  return null
}
