import { describe, expect, it } from 'vitest'
import { attentionFlags, worstSeverity, type CaseInput } from '@/lib/admin/attention-core'

const now = new Date('2026-10-05T15:00:00Z')
const h = (n: number) => new Date(now.getTime() - n * 3600_000)
const base = (o: Partial<CaseInput> = {}): CaseInput => ({
  now, basePrice: 100_000,
  request: { status: 'ACTIVE', createdAt: h(1), expiresAt: new Date(now.getTime() + 20 * 3600_000), isUrgent: false, direct: false, proposals: [] },
  booking: null, chats: [], guaranteeOpen: 0, ...o,
})
const booking = (o: Partial<NonNullable<CaseInput['booking']>> = {}): NonNullable<CaseInput['booking']> => ({
  status: 'CONFIRMED', createdAt: h(30), at: new Date(now.getTime() + 24 * 3600_000), totalPrice: 120_000, proposalPrice: 120_000, statusSince: h(20),
  payment: null, reschedules: 0, afterPhotos: 1, cancelledBy: null, ...o,
})
const codes = (c: CaseInput) => attentionFlags(c).map((f) => f.code)

describe('attention flags', () => {
  it('request without proposals after 3 h (1 h urgent)', () => {
    expect(codes(base())).toEqual([])
    expect(codes(base({ request: { ...base().request, createdAt: h(4) } }))).toContain('request:no-proposals')
    expect(attentionFlags(base({ request: { ...base().request, createdAt: h(2), isUrgent: true } }))[0]).toMatchObject({ code: 'request:no-proposals', severity: 'warning' })
  })
  it('booking not confirmed with the service close is critical', () => {
    const f = attentionFlags(base({ request: { ...base().request, status: 'ACCEPTED' }, booking: booking({ status: 'PENDING', at: new Date(now.getTime() + 5 * 3600_000) }) }))
    expect(f[0]).toMatchObject({ code: 'booking:unconfirmed-soon', severity: 'critical' })
  })
  it('confirmed booking past its time: no-show risk', () => {
    expect(codes(base({ request: { ...base().request, status: 'ACCEPTED' }, booking: booking({ at: h(3) }) }))).toContain('booking:no-show-risk')
  })
  it('payments: dispute, unconfirmed report, price mismatch', () => {
    const done = (payment: NonNullable<CaseInput['booking']>['payment'], extra = {}) => codes(base({ request: { ...base().request, status: 'ACCEPTED' }, booking: booking({ status: 'COMPLETED', statusSince: h(72), payment, ...extra }) }))
    expect(done({ status: 'PENDING', confirmationStatus: 'DISPUTED', clientReportedAt: h(10) })).toContain('payment:disputed')
    expect(done({ status: 'PENDING', confirmationStatus: 'CLIENT_REPORTED', clientReportedAt: h(50) })).toContain('payment:unconfirmed')
    expect(done(null)).toContain('payment:not-reported')
    expect(done({ status: 'APPROVED', confirmationStatus: 'CONFIRMED', clientReportedAt: null }, { totalPrice: 150_000 })).toContain('booking:price-mismatch')
  })
  it('chat: contact attempts, complaints and unanswered messages', () => {
    const chat = (messages: CaseInput['chats'][number]['messages'], blockedAttempts = 0) => [{ proposalId: 'p1', messages, blockedAttempts }]
    const f = attentionFlags(base({ chats: chat([], 3) }))
    expect(f[0]).toMatchObject({ code: 'chat:contact-attempts', severity: 'critical' })
    expect(codes(base({ chats: chat([{ side: 'CLIENT', at: h(1), content: 'El socio no llegó y no contesta' }]) }))).toContain('chat:complaint')
    expect(codes(base({ chats: chat([{ side: 'PARTNER', at: h(14), content: '¿A qué hora le queda bien?' }]) }))).toContain('chat:unanswered')
    expect(codes(base({ chats: chat([{ side: 'SYSTEM', at: h(14), content: 'no llegó' }]) }))).toEqual([])
  })
  it('worst severity first', () => {
    const f = attentionFlags(base({ guaranteeOpen: 1, chats: [{ proposalId: 'p', messages: [], blockedAttempts: 4 }] }))
    expect(worstSeverity(f)).toBe('critical')
    expect(f.map((x) => x.severity)).toEqual(['critical', 'warning'])
  })
})
