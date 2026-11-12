import { describe, expect, it } from 'vitest'
import { CONSENT_REQUIRED_FROM, TERMS_VERSION, hasMarketingConsent, marketingConsentBasis, marketingConsentWhere, signupConsent } from '@/lib/privacy/consent'

const before = new Date(CONSENT_REQUIRED_FROM.getTime() - 86_400_000)
const after = new Date(CONSENT_REQUIRED_FROM.getTime() + 86_400_000)

describe('marketing consent rule', () => {
  it('grandfathers accounts created before the cutoff (existing partners from /unete)', () => {
    expect(marketingConsentBasis({ createdAt: before })).toBe('grandfathered')
    expect(hasMarketingConsent({ createdAt: before, marketingConsentAt: null })).toBe(true)
  })
  it('requires explicit consent for new signups', () => {
    expect(marketingConsentBasis({ createdAt: after })).toBe('none')
    expect(hasMarketingConsent({ createdAt: after })).toBe(false)
    expect(marketingConsentBasis({ createdAt: after, marketingConsentAt: new Date() })).toBe('explicit')
  })
  it('explicit wins over grandfathered', () => {
    expect(marketingConsentBasis({ createdAt: before, marketingConsentAt: before })).toBe('explicit')
  })
  it('unknown data is not consent', () => {
    expect(hasMarketingConsent({})).toBe(false)
  })
  it('exposes the same rule as a where fragment', () => {
    expect(marketingConsentWhere().OR).toHaveLength(2)
  })
})

describe('signupConsent', () => {
  const now = new Date('2026-11-14T10:00:00Z')
  it('records terms and optional marketing', () => {
    expect(signupConsent({}, now)).toEqual({ termsAcceptedAt: now, termsVersion: TERMS_VERSION })
    expect(signupConsent({ marketing: true }, now)).toMatchObject({ marketingConsentAt: now })
  })
  it('records nothing for terms when the person was not shown them', () => {
    expect(signupConsent({ termsShown: false }, now)).toEqual({})
  })
})
