import { describe, expect, it } from 'vitest'
import {
  clientSegmentError,
  clientSegmentWhere,
  mergeClientSegmentMetadata,
  normalizeClientSegment,
  parseClientSegment,
  zoneUserIds,
} from '@/lib/messaging/campaign-segments'
import { campaignRefCode, campaignResults, campaignWaLink, touchMatchesCampaign, withCampaignUtm } from '@/lib/messaging/campaign-tracking'

const now = new Date('2026-10-01T15:00:00.000Z')

describe('client segments', () => {
  it('normalizes untrusted input and round-trips through metadata', () => {
    expect(normalizeClientSegment(null)).toEqual({ type: 'all', inactiveDays: 30, serviceIds: [], zoneKeys: [] })
    expect(normalizeClientSegment({ type: 'INACTIVE', inactiveDays: '60' })).toMatchObject({ type: 'inactive', inactiveDays: 60 })
    expect(normalizeClientSegment({ type: 'inactive', inactiveDays: 45 }).inactiveDays).toBe(30)
    expect(normalizeClientSegment({ type: 'bogus' }).type).toBe('all')
    expect(normalizeClientSegment({ type: 'zone', zoneKeys: ['belen', 'nowhere', 'belen'] }).zoneKeys).toEqual(['belen'])
    const meta = mergeClientSegmentMetadata(JSON.stringify({ contentMode: 'CUSTOM' }), normalizeClientSegment({ type: 'service', serviceIds: ['s1', ' s2 ', ''] }))
    expect(JSON.parse(meta).contentMode).toBe('CUSTOM')
    expect(parseClientSegment(meta)).toMatchObject({ type: 'service', serviceIds: ['s1', 's2'] })
    expect(parseClientSegment('not json').type).toBe('all')
  })

  it('requires services or zones when the segment needs them', () => {
    expect(clientSegmentError(normalizeClientSegment({ type: 'service' }))).toMatch(/servicio/)
    expect(clientSegmentError(normalizeClientSegment({ type: 'zone' }))).toMatch(/zona/)
    expect(clientSegmentError(normalizeClientSegment({ type: 'inactive' }))).toBeNull()
  })

  it('builds the user where of each segment', () => {
    expect(clientSegmentWhere(normalizeClientSegment({ type: 'all' }))).toBeNull()
    expect(clientSegmentWhere(normalizeClientSegment({ type: 'no_booking' }))).toEqual({ bookings: { none: {} } })
    const inactive = clientSegmentWhere(normalizeClientSegment({ type: 'inactive', inactiveDays: 60 }), { now }) as { AND: unknown[] }
    const cutoff = new Date(now.getTime() - 60 * 86_400_000)
    expect(inactive.AND).toEqual([
      { OR: [{ bookings: { some: {} } }, { serviceRequests: { some: {} } }] },
      { bookings: { none: { createdAt: { gte: cutoff } } } },
      { serviceRequests: { none: { createdAt: { gte: cutoff } } } },
    ])
    expect(clientSegmentWhere(normalizeClientSegment({ type: 'service', serviceIds: ['s1'] }))).toEqual({
      OR: [{ serviceRequests: { some: { serviceId: { in: ['s1'] } } } }, { bookings: { some: { serviceId: { in: ['s1'] } } } }],
    })
    expect(clientSegmentWhere(normalizeClientSegment({ type: 'zone', zoneKeys: ['belen'] }), { zoneUserIds: ['u1'] })).toEqual({ id: { in: ['u1'] } })
    expect(clientSegmentWhere(normalizeClientSegment({ type: 'zone', zoneKeys: ['belen'] }))).toEqual({ id: { in: [] } })
  })

  it('zone users come from request zones and the main address', () => {
    const d = (s: string) => new Date(s)
    const ids = zoneUserIds(
      ['belen', 'envigado'],
      [{ userId: 'r1', zone: 'belen' }, { userId: 'r2', zone: 'laureles' }],
      [
        { userId: 'a1', neighborhood: 'Rosales', isPrimary: true, createdAt: d('2026-01-01') },
        { userId: 'a2', neighborhood: 'Laureles', isPrimary: true, createdAt: d('2026-01-01') },
        { userId: 'a2', neighborhood: 'Zúñiga', isPrimary: false, createdAt: d('2026-05-01') },
        { userId: 'a3', neighborhood: 'Zuñiga', isPrimary: false, createdAt: d('2026-05-01') },
        { userId: 'a4', neighborhood: '', isPrimary: true, createdAt: d('2026-05-01') },
      ],
    )
    expect(ids.sort()).toEqual(['a1', 'a3', 'r1'])
    expect(zoneUserIds([], [{ userId: 'r1', zone: 'belen' }], [])).toEqual([])
  })
})

describe('campaign tracking', () => {
  const id = 'cmukad0wf00241g10abcd1234'

  it('code, WhatsApp link and UTM on our links only', () => {
    expect(campaignRefCode(id)).toBe('cmp-abcd1234')
    expect(campaignWaLink('https://lohaggo.com/', id)).toBe('https://lohaggo.com/w/cmp-abcd1234')
    const out = withCampaignUtm('Mira https://www.lohaggo.com/servicios/plomeria. Y https://otro.com/x y https://lohaggo.com/auth/magic?token=1', {
      channel: 'WHATSAPP', campaignId: id, appUrl: 'https://lohaggo.com',
    })
    expect(out).toContain('https://www.lohaggo.com/servicios/plomeria?utm_source=whatsapp&utm_medium=campaign&utm_campaign=cmp-abcd1234.')
    expect(out).toContain('https://otro.com/x ')
    expect(out).toContain('https://lohaggo.com/auth/magic?token=1')
    expect(withCampaignUtm('<a href="https://lohaggo.com/?a=1">x</a>', { channel: 'EMAIL', campaignId: id })).toBe(
      '<a href="https://lohaggo.com/?a=1&utm_source=email&utm_medium=campaign&utm_campaign=cmp-abcd1234">x</a>',
    )
    expect(withCampaignUtm('https://lohaggo.com/?utm_campaign=otra', { channel: 'SMS', campaignId: id })).toBe('https://lohaggo.com/?utm_campaign=otra')
  })

  it('counts requests since start with the code and their bookings', () => {
    const since = new Date('2026-09-01T00:00:00Z')
    expect(touchMatchesCampaign({ campaign: 'CMP-ABCD1234' }, 'cmp-abcd1234')).toBe(true)
    expect(touchMatchesCampaign({ ref: 'cmp-abcd1234' }, 'cmp-abcd1234')).toBe(true)
    expect(touchMatchesCampaign(null, 'cmp-abcd1234')).toBe(false)
    const reqs = [
      { id: 'q1', createdAt: new Date('2026-09-02'), acquisition: { campaign: 'cmp-abcd1234' }, lastTouch: null },
      { id: 'q2', createdAt: new Date('2026-09-03'), acquisition: { campaign: 'ad-x' }, lastTouch: { ref: 'cmp-abcd1234' } },
      { id: 'q3', createdAt: new Date('2026-08-01'), acquisition: { campaign: 'cmp-abcd1234' }, lastTouch: null },
      { id: 'q4', createdAt: new Date('2026-09-04'), acquisition: { campaign: 'cmp-other123' }, lastTouch: null },
    ]
    expect(campaignResults('cmp-abcd1234', since, reqs, [{ serviceRequestId: 'q1' }, { serviceRequestId: 'q3' }, { serviceRequestId: null }])).toEqual({
      code: 'cmp-abcd1234', solicitudes: 2, reservas: 1,
    })
  })
})
