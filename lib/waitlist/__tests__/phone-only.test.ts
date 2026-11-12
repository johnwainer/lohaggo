import { describe, expect, it } from 'vitest'
import { cityAcceptsWaitlist, parseWaitlist } from '../schema'

describe('sign-up with only a WhatsApp (service page)', () => {
  const phoneOnly = { citySlug: 'cali', role: 'client', consent: true, phone: '300 123 4567', phoneConsent: true, serviceSlug: 'plomeria' }

  it('accepts WhatsApp without email when the number has its own consent', () => {
    const r = parseWaitlist(phoneOnly)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data).toMatchObject({ email: null, serviceSlug: 'plomeria' })
  })

  it('needs an email or a WhatsApp', () => {
    expect(parseWaitlist({ citySlug: 'cali', role: 'client', consent: true })).toMatchObject({ ok: false, reason: 'invalid' })
  })

  it('a number without its own consent is rejected', () => {
    expect(parseWaitlist({ ...phoneOnly, phoneConsent: false })).toMatchObject({ ok: false, reason: 'invalid' })
  })
})

describe('cityAcceptsWaitlist with partner registry', () => {
  it('an active city in partner-registry mode keeps a list; a normal active one does not', () => {
    expect(cityAcceptsWaitlist('ACTIVE', true)).toBe(true)
    expect(cityAcceptsWaitlist('ACTIVE', false)).toBe(false)
    expect(cityAcceptsWaitlist('ACTIVE', false, true)).toBe(true)
  })
})
