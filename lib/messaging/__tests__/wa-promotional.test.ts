import { describe, expect, it } from 'vitest'
import { WA } from '@/lib/messaging/wa-specs'

describe('promotional flag (consent gate)', () => {
  it('only the commercial promotions need marketing consent', () => {
    expect(WA.B25({ entryId: 'e', name: 'Ana', city: 'Cali' }).promotional).toBe(true)
    expect(WA.C33({ partnerId: 'p', name: 'Luis', slug: 'luis' }).promotional).toBe(true)
  })

  it('partner operational nudges are marketing (STOP, quiet hours) but not promotional', () => {
    const c30 = WA.C30({ partnerId: 'p', partnerName: 'Luis', service: 'Plomería' })
    expect(c30.marketing).toBe(true)
    expect(c30.promotional).toBeFalsy()
    const c29 = WA.C29({ partnerId: 'p', partnerName: 'Luis', service: 'Plomería', city: 'Cali', now: new Date() })
    expect(c29.promotional).toBeFalsy()
  })
})
