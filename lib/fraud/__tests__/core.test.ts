import { describe, expect, it } from 'vitest'
import { contactBlockSeverity, findDuplicateGroups, isOffPlatformPair, phoneKey, signalKey, type AccountLite } from '@/lib/fraud/core'

const now = new Date('2026-11-12T12:00:00Z')
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000)

describe('contactBlockSeverity', () => {
  it('escalates with repeated attempts', () => {
    expect(contactBlockSeverity(1).severity).toBe('MEDIUM')
    expect(contactBlockSeverity(3).severity).toBe('HIGH')
    expect(contactBlockSeverity(6).score).toBeGreaterThan(contactBlockSeverity(3).score)
  })
})

describe('isOffPlatformPair', () => {
  const base = { clientId: 'c', partnerId: 'p', activeBookings: 1, completedBookings: 1, firstCompletedAt: daysAgo(5), messagesAfter: 9, lastMessageAt: daysAgo(1) }
  it('flags one completed booking with a chat that keeps going', () => {
    expect(isOffPlatformPair(base, now)).toBe(true)
  })
  it('does not flag a second booking, a quiet chat or a fresh service', () => {
    expect(isOffPlatformPair({ ...base, activeBookings: 2 }, now)).toBe(false)
    expect(isOffPlatformPair({ ...base, completedBookings: 2 }, now)).toBe(false)
    expect(isOffPlatformPair({ ...base, messagesAfter: 3 }, now)).toBe(false)
    expect(isOffPlatformPair({ ...base, firstCompletedAt: daysAgo(1) }, now)).toBe(false)
    expect(isOffPlatformPair({ ...base, lastMessageAt: daysAgo(30) }, now)).toBe(false)
  })
})

describe('signalKey and phoneKey', () => {
  it('builds stable keys', () => {
    expect(signalKey('OFF_PLATFORM_PAIR', ['a', 'b'])).toBe('OFF_PLATFORM_PAIR:a:b')
    expect(signalKey('CONTACT_GUARD_BLOCK', ['c', 'u'], '2026-11-12')).toBe('CONTACT_GUARD_BLOCK:c:u:2026-11-12')
  })
  it('normalizes the same mobile written differently', () => {
    expect(phoneKey('+57 300 123 4567')).toBe('3001234567')
    expect(phoneKey('3001234567')).toBe('3001234567')
    expect(phoneKey('12345')).toBeNull()
  })
})

const acc = (id: string, over: Partial<AccountLite>): AccountLite => ({ id, name: 'Ana Gómez', email: `${id}@x.com`, phone: null, role: 'CLIENT', isActive: true, createdAt: now, ...over })

describe('findDuplicateGroups', () => {
  it('groups active accounts that share a normalized phone', () => {
    const g = findDuplicateGroups([acc('a', { phone: '+573001234567', name: 'A B' }), acc('b', { phone: '300 123 4567', name: 'C D' }), acc('c', { phone: '3105550000', name: 'E F' })])
    expect(g).toHaveLength(1)
    expect(g[0].reason).toBe('phone')
    expect(g[0].accounts.map((x) => x.id)).toEqual(['a', 'b'])
  })
  it('ignores inactive accounts and admins for phone duplicates', () => {
    expect(findDuplicateGroups([acc('a', { phone: '3001234567', name: 'A B' }), acc('b', { phone: '3001234567', name: 'C D', isActive: false }), acc('c', { phone: '3001234567', name: 'E F', role: 'ADMIN' })])).toHaveLength(0)
  })
  it('groups same full name created within 1 h when one was born in a chat', () => {
    const g = findDuplicateGroups([
      acc('a', { createdAt: new Date(now.getTime() - 30 * 60_000), email: 'wa-573001112222@clientes.lohaggo.com' }),
      acc('b', { createdAt: now }),
    ])
    expect(g.map((x) => x.reason)).toEqual(['name'])
  })
  it('does not group the same name far apart in time or without a chat origin', () => {
    expect(findDuplicateGroups([acc('a', { createdAt: daysAgo(3), email: 'wa-573001112222@clientes.lohaggo.com' }), acc('b', { createdAt: now })])).toHaveLength(0)
    expect(findDuplicateGroups([acc('a', { createdAt: new Date(now.getTime() - 60_000) }), acc('b', { createdAt: now })])).toHaveLength(0)
  })
})
