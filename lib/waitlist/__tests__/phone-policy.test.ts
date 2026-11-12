import { describe, expect, it } from 'vitest'
import { canWhatsappWaitlistEntry, waitlistPhoneUpdate } from '../phone-policy'

const now = new Date('2026-11-12T00:00:00Z')

describe('waitlistPhoneUpdate', () => {
  it('sets the number on a new entry or one without number', () => {
    expect(waitlistPhoneUpdate(null, '+573001234567', now)).toEqual({ phone: '+573001234567', phoneConsentAt: now })
    expect(waitlistPhoneUpdate({ phone: null, phoneConsentAt: null }, '+573001234567', now)).toMatchObject({ phone: '+573001234567' })
  })
  it('never overwrites an existing number with a different one', () => {
    expect(waitlistPhoneUpdate({ phone: '+573000000000', phoneConsentAt: now }, '+573001234567', now)).toEqual({})
  })
  it('does nothing without a number', () => {
    expect(waitlistPhoneUpdate(null, null, now)).toEqual({})
  })
})

describe('canWhatsappWaitlistEntry', () => {
  it('requires consent and a verified (inbound) number', () => {
    const verified = new Set(['573001234567'])
    expect(canWhatsappWaitlistEntry({ phone: '+573001234567', phoneConsentAt: now }, verified)).toBe(true)
    expect(canWhatsappWaitlistEntry({ phone: '+573001234567', phoneConsentAt: null }, verified)).toBe(false)
    expect(canWhatsappWaitlistEntry({ phone: '+573009999999', phoneConsentAt: now }, verified)).toBe(false)
    expect(canWhatsappWaitlistEntry({ phone: null, phoneConsentAt: null }, verified)).toBe(false)
  })
})
