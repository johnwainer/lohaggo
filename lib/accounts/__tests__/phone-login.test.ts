import { describe, expect, it } from 'vitest'
import { hashPhoneCode, isPlaceholderEmail, phoneLoginDecision, placeholderEmail, sameHash } from '@/lib/accounts/phone-login-core'
import { ZONES, coversZone, zoneFromText } from '@/lib/geo/zones'

const acc = (o: Partial<{ id: string; role: string; isActive: boolean; email: string; phoneVerifiedAt: Date | null }> = {}) => ({ id: 'u1', role: 'CLIENT', isActive: true, email: 'ana@mail.com', phoneVerifiedAt: null, ...o })

describe('phone login', () => {
  it('placeholder emails', () => {
    expect(placeholderEmail('+573001234567')).toBe('wa-573001234567@clientes.lohaggo.com')
    expect(isPlaceholderEmail('WA-573@CLIENTES.LOHAGGO.COM')).toBe(true)
    expect(isPlaceholderEmail('ana@mail.com')).toBe(false)
  })

  it('code hash is bound to the code id', () => {
    const h = hashPhoneCode('123456', 'id1', 's')
    expect(sameHash(h, hashPhoneCode('123456', 'id1', 's'))).toBe(true)
    expect(sameHash(h, hashPhoneCode('123456', 'id2', 's'))).toBe(false)
    expect(sameHash(h, 'short')).toBe(false)
  })

  it('decides what a confirmed code opens', () => {
    expect(phoneLoginDecision([])).toEqual({ action: 'create' })
    expect(phoneLoginDecision([acc(), acc({ id: 'u2' })])).toEqual({ action: 'refuse', reason: 'ambiguous' })
    expect(phoneLoginDecision([acc({ role: 'ADMIN', phoneVerifiedAt: new Date() })])).toEqual({ action: 'refuse', reason: 'admin' })
    expect(phoneLoginDecision([acc({ isActive: false })])).toEqual({ action: 'refuse', reason: 'inactive' })
    expect(phoneLoginDecision([acc({ phoneVerifiedAt: new Date() })])).toEqual({ action: 'login', userId: 'u1' })
    expect(phoneLoginDecision([acc({ email: 'wa-57300@clientes.lohaggo.com' })])).toEqual({ action: 'login', userId: 'u1' })
    // A phone nobody confirmed could be a typo that belongs to whoever holds the code: the link goes to the email
    expect(phoneLoginDecision([acc()])).toEqual({ action: 'email_link', userId: 'u1' })
  })
})

describe('zones', () => {
  it('has the 16 comunas and 6 municipalities', () => {
    expect(ZONES.filter((z) => z.kind === 'comuna')).toHaveLength(16)
    expect(ZONES.filter((z) => z.kind === 'municipio')).toHaveLength(6)
  })
  it('finds the zone of an address', () => {
    expect(zoneFromText('Cra 43A # 10-20, Provenza, Medellín')).toBe('el-poblado')
    expect(zoneFromText('Calle 33 #70-10', 'Laureles')).toBe('laureles')
    expect(zoneFromText('Cl 50 Sur, El Dorado, Envigado')).toBe('envigado')
    expect(zoneFromText('Las lomitas, Sabaneta')).toBe('sabaneta')
    expect(zoneFromText('Carrera 76, Suramericana')).toBe('laureles')
    expect(zoneFromText('Calle 1')).toBeNull()
  })
  it('empty coverage = whole city', () => {
    expect(coversZone([], 'belen')).toBe(true)
    expect(coversZone(['belen'], 'belen')).toBe(true)
    expect(coversZone(['belen'], 'bello')).toBe(false)
    expect(coversZone(['belen'], null)).toBe(true)
  })
})
