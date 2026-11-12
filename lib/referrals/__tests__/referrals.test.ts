import { describe, expect, it } from 'vitest'
import { generateReferralCode, normalizeReferralCode, qualifiesReferral, referralLink, referralShareText, rewardFor } from '@/lib/referrals/core'

describe('referral codes', () => {
  it('generates readable 7-char codes without ambiguous characters', () => {
    for (let i = 0; i < 50; i++) expect(generateReferralCode()).toMatch(/^[A-HJKMNP-Z2-9]{7}$/)
  })
  it('normalizes ?ref= values and rejects junk', () => {
    expect(normalizeReferralCode(' abc23de ')).toBe('ABC23DE')
    expect(normalizeReferralCode('a b')).toBeNull()
    expect(normalizeReferralCode('<script>')).toBeNull()
    expect(normalizeReferralCode(undefined)).toBeNull()
  })
})

describe('qualifiesReferral', () => {
  it('needs a completed booking with an approved or confirmed payment', () => {
    expect(qualifiesReferral({ bookingStatus: 'COMPLETED', payment: { status: 'APPROVED', confirmationStatus: 'NONE' } })).toBe(true)
    expect(qualifiesReferral({ bookingStatus: 'COMPLETED', payment: { status: 'PENDING', confirmationStatus: 'CONFIRMED' } })).toBe(true)
  })
  it('does not qualify unpaid, reported-only or unfinished bookings', () => {
    expect(qualifiesReferral({ bookingStatus: 'COMPLETED', payment: { status: 'PENDING', confirmationStatus: 'CLIENT_REPORTED' } })).toBe(false)
    expect(qualifiesReferral({ bookingStatus: 'COMPLETED', payment: null })).toBe(false)
    expect(qualifiesReferral({ bookingStatus: 'IN_PROGRESS', payment: { status: 'APPROVED', confirmationStatus: 'NONE' } })).toBe(false)
  })
})

describe('rewards and links', () => {
  it('credits the counter and flags partner referrers for priority', () => {
    expect(rewardFor('PARTNER', 2)).toEqual({ qualifiedCount: 3, priorityNotifications: true })
    expect(rewardFor('CLIENT', 0)).toEqual({ qualifiedCount: 1, priorityNotifications: false })
  })
  it('builds the right landing per audience', () => {
    expect(referralLink('ABC23DE', 'CLIENT')).toContain('/register?ref=ABC23DE')
    expect(referralLink('ABC23DE', 'PARTNER')).toContain('/unete?ref=ABC23DE')
    expect(referralShareText('Ana López', 'https://x', 'CLIENT')).toMatch(/^Ana te invita/)
  })
})

import { isSelfDealingReferral } from '@/lib/referrals/core'

describe('self-dealing referrals', () => {
  const base = { referrerPhoneKey: '3001112222', referredPhoneKey: '3003334444', qualifyingBookingPartnerId: 'p1', referrerPartnerProfileId: null, referrerIsClientOfReferredPartner: false }
  it('a clean referral is fine', () => expect(isSelfDealingReferral(base)).toBeNull())
  it('shared phone blocks', () => expect(isSelfDealingReferral({ ...base, referredPhoneKey: '3001112222' })).toBe('shared_phone'))
  it('referrer being the partner of the booking blocks', () => expect(isSelfDealingReferral({ ...base, referrerPartnerProfileId: 'p1' })).toBe('referrer_is_partner'))
  it('referred being the partner of a booking of the referrer blocks', () => expect(isSelfDealingReferral({ ...base, referrerIsClientOfReferredPartner: true })).toBe('referred_is_partner_of_referrer'))
})
