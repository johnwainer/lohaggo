import { describe, expect, it } from 'vitest'
import { cityAcceptsWaitlist, parseWaitlist } from '../schema'

const base = { citySlug: 'bogota', email: 'Ana@Correo.COM ', role: 'client', consent: true }

describe('parseWaitlist', () => {
  it('accepts a valid sign-up and normalizes the email', () => {
    const r = parseWaitlist({ ...base, name: '  Ana ', website: '' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.email).toBe('ana@correo.com')
      expect(r.data.name).toBe('Ana')
    }
  })

  it('rejects an invalid email', () => {
    const r = parseWaitlist({ ...base, email: 'no-es-correo' })
    expect(r).toMatchObject({ ok: false, reason: 'invalid' })
  })

  it('rejects when consent is missing or false', () => {
    const { consent: _c, ...noConsent } = base
    expect(parseWaitlist(noConsent)).toMatchObject({ ok: false, reason: 'invalid' })
    expect(parseWaitlist({ ...base, consent: false })).toMatchObject({ ok: false, reason: 'invalid' })
  })

  it('rejects an unknown role', () => {
    expect(parseWaitlist({ ...base, role: 'admin' })).toMatchObject({ ok: false, reason: 'invalid' })
  })

  it('flags the honeypot when filled', () => {
    expect(parseWaitlist({ ...base, website: 'http://spam.example' })).toEqual({ ok: false, reason: 'honeypot' })
  })
})

describe('cityAcceptsWaitlist', () => {
  it('rejects active cities', () => {
    expect(cityAcceptsWaitlist('ACTIVE')).toBe(false)
    expect(cityAcceptsWaitlist(null)).toBe(false)
  })
  it('accepts coming soon and inactive cities', () => {
    expect(cityAcceptsWaitlist('COMING_SOON')).toBe(true)
    expect(cityAcceptsWaitlist('INACTIVE')).toBe(true)
  })
})
