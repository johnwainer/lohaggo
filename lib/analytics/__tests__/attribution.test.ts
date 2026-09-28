import { describe, expect, it } from 'vitest'
import { classifyTouch, fbcFrom, gaClientIdFrom, readTouch, compactTouch, touchFromCookie, touchesFromConversation } from '@/lib/analytics/attribution-core'
import { buildGa4Event, buildMetaEvent, conversionDestinations, conversionEventId, hashEmail, hashPhone, type ConversionInput } from '@/lib/analytics/conversions-core'
import { spendWithoutRequests, summarizeOrigins } from '@/lib/analytics/origins-core'
import { creditPosts } from '@/lib/marketing/post-results'
import { adRefCode, adUrlParams, adWelcomeMessage } from '@/lib/marketing/ads-core'
import { extractWebRef } from '@/lib/messaging/attribution'
import { parseAdSpendInput } from '@/lib/marketing/ad-spend'

const cookie = (o: Record<string, unknown>) => encodeURIComponent(JSON.stringify(o))

describe('touches', () => {
  it('reads the cookie with click ids and builds _fbc from a fbclid', () => {
    const t = touchFromCookie(cookie({ source: 'ig', medium: 'paid_social', campaign: 'ad-abcd1234', content: '123', fbclid: 'XYZ', at: '2026-10-01T15:00:00.000Z' }))
    expect(t?.fbclid).toBe('XYZ')
    expect(fbcFrom(null, t)).toBe(`fb.1.${Date.parse('2026-10-01T15:00:00.000Z')}.XYZ`)
    expect(fbcFrom('fb.1.1.ABC', t)).toBe('fb.1.1.ABC')
    expect(classifyTouch(t)).toEqual({ channel: 'meta_ads', campaign: 'ad-abcd1234', content: '123' })
  })

  it('GA client id from _ga', () => {
    expect(gaClientIdFrom('GA1.1.123456.789')).toBe('123456.789')
    expect(gaClientIdFrom('basura')).toBeNull()
  })

  it('a Click-to-WhatsApp chat with the package ref lands on that package', () => {
    const t = touchesFromConversation({ adReferral: { source: 'ctwa', adId: '999', ctwaClid: 'clid', at: 'x' }, webRef: 'ad-abcd1234' }, 'WHATSAPP')
    expect(t.first?.ctwaClid).toBe('clid')
    expect(classifyTouch(t.first)).toEqual({ channel: 'meta_ads', campaign: 'ad-abcd1234', content: '999' })
  })

  it('post, blog, web and direct chats', () => {
    expect(classifyTouch(touchesFromConversation({ webRef: 'post-cmabc123' }, 'WHATSAPP').last).channel).toBe('publicaciones')
    expect(classifyTouch(touchesFromConversation({ webRef: 'blog-como-destapar' }, 'WHATSAPP').last).channel).toBe('blog')
    expect(classifyTouch(touchesFromConversation({ webRef: 'web-plomeria' }, 'WHATSAPP').last)).toMatchObject({ channel: 'sitio_web', content: 'plomeria' })
    expect(classifyTouch(touchesFromConversation({}, 'WHATSAPP').last).channel).toBe('chat_directo')
  })

  it('organic web sources', () => {
    const t = (o: Record<string, unknown>) => touchFromCookie(cookie(o))
    expect(classifyTouch(t({ source: 'instagram', medium: 'social', campaign: 'educacion', content: 'cmpost1' })).channel).toBe('publicaciones')
    expect(classifyTouch(t({ source: 'gbp', medium: 'organic' })).channel).toBe('gbp')
    expect(classifyTouch(t({ referrer: 'https://www.google.com/' })).channel).toBe('google')
    expect(classifyTouch(t({ landing: '/' })).channel).toBe('directo')
    expect(classifyTouch(null).channel).toBe('sin_dato')
  })

  it('compact / read round trip drops empty fields', () => {
    const c = compactTouch({ via: 'web', source: 'fb', medium: null, campaign: null, content: null, at: null })
    expect(c).toEqual({ via: 'web', source: 'fb' })
    expect(readTouch(c)?.source).toBe('fb')
  })

  it('extractWebRef accepts post- and ad- tags', () => {
    expect(extractWebRef('Hola (ref: post-cmabc123)')).toBe('post-cmabc123')
    expect(extractWebRef('Hola, vi su anuncio (ref: ad-ABCD1234)')).toBe('ad-abcd1234')
    expect(extractWebRef('(ref: otro-x)')).toBeNull()
  })

  it('ad package: same code in the UTM and the welcome message', () => {
    const id = 'cmukad0wf00241g10fomkmudr'
    expect(adRefCode(id)).toBe('fomkmudr')
    expect(adUrlParams('X', id)).toContain('utm_campaign=ad-fomkmudr')
    expect(adWelcomeMessage(id, 'Plomería')).toBe('Hola, vi su anuncio y quiero pedir plomería (ref: ad-fomkmudr)')
    expect(extractWebRef(adWelcomeMessage(id, null))).toBe('ad-fomkmudr')
  })

  it('messaging campaigns: cmp- ref in chat and campaign UTM on the web', () => {
    expect(extractWebRef('Hola, recibí su mensaje y necesito un servicio (ref: cmp-AB12cd34)')).toBe('cmp-ab12cd34')
    const chat = touchesFromConversation({ webRef: 'cmp-ab12cd34' }, 'WHATSAPP').last
    expect(chat).toMatchObject({ source: 'campaign', medium: 'campaign', campaign: 'cmp-ab12cd34' })
    expect(classifyTouch(chat)).toMatchObject({ channel: 'campanas', campaign: 'cmp-ab12cd34' })
    const web = touchFromCookie(cookie({ source: 'whatsapp', medium: 'campaign', campaign: 'cmp-ab12cd34' }))
    expect(classifyTouch(web)).toMatchObject({ channel: 'campanas', campaign: 'cmp-ab12cd34' })
    expect(classifyTouch(touchFromCookie(cookie({ source: 'email', medium: 'campaign', campaign: 'cmp-x' }))).channel).toBe('campanas')
    expect(classifyTouch(touchFromCookie(cookie({ source: 'facebook', medium: 'social' }))).channel).toBe('facebook')
  })
})

const base: ConversionInput = {
  kind: 'Lead', entityId: 'req1', at: new Date('2026-10-01T15:00:00Z'), value: 80000, serviceId: 's1', serviceName: 'Plomería',
  user: { id: 'u1', email: ' Ana@Mail.com ', phone: '3001234567' }, touch: null, browser: null, siteUrl: 'https://www.lohaggo.com',
}

describe('conversions', () => {
  it('hashes normalized email and Colombian phone; skips placeholder emails', () => {
    expect(hashEmail(' Ana@Mail.com ')).toBe(hashEmail('ana@mail.com'))
    expect(hashPhone('300 123 4567')).toBe(hashPhone('573001234567'))
    expect(hashEmail('wa-573001234567@clientes.lohaggo.com')).toBeNull()
  })

  it('web Lead: website source, same event id as the pixel, fbc/fbp and browser data', () => {
    const e = buildMetaEvent({ ...base, touch: { via: 'web', source: 'fb', medium: 'paid_social', campaign: null, content: null, at: null, fbc: 'fb.1.1.X', fbp: 'fb.1.2.Y' }, browser: { ip: '1.2.3.4', userAgent: 'UA', url: 'https://www.lohaggo.com/servicios/plomeria' } })
    expect(e).toMatchObject({ event_name: 'Lead', event_id: 'lead-req1', action_source: 'website', event_source_url: 'https://www.lohaggo.com/servicios/plomeria' })
    expect(e.user_data).toMatchObject({ fbc: 'fb.1.1.X', fbp: 'fb.1.2.Y', client_ip_address: '1.2.3.4' })
    expect(e.custom_data).toMatchObject({ currency: 'COP', value: 80000 })
  })

  it('Click-to-WhatsApp chat goes as business_messaging only with the WABA id', () => {
    const touch = { via: 'chat' as const, channel: 'WHATSAPP', source: 'meta', medium: 'paid_social', campaign: null, content: null, ctwaClid: 'CLID', at: null }
    expect(buildMetaEvent({ ...base, touch }, { wabaId: '123456789' })).toMatchObject({ event_name: 'LeadSubmitted', action_source: 'business_messaging', messaging_channel: 'whatsapp', user_data: { whatsapp_business_account_id: '123456789', ctwa_clid: 'CLID' } })
    expect(buildMetaEvent({ ...base, touch }, {})).toMatchObject({ event_name: 'Lead', action_source: 'chat' })
  })

  it('GA4 purchase uses the booking as transaction id; Lead skipped when the page sent it', () => {
    const g = buildGa4Event({ ...base, kind: 'Purchase', entityId: 'b1' })
    expect(g.events[0]).toMatchObject({ name: 'purchase', params: { transaction_id: 'purchase-b1', value: 80000 } })
    expect(conversionEventId('Purchase', 'b1')).toBe('purchase-b1')
    expect(conversionDestinations({ kind: 'Lead', browserSent: true, meta: true, ga4: true })).toEqual(['meta_capi'])
    expect(conversionDestinations({ kind: 'Lead', browserSent: false, meta: false, ga4: true })).toEqual(['ga4_mp'])
    expect(conversionDestinations({ kind: 'Purchase', browserSent: true, meta: true, ga4: true })).toEqual(['meta_capi', 'ga4_mp'])
  })
})

describe('origins board', () => {
  const draftId = 'cmukad0wf00241g10fomkmudr'
  const labels = { adDrafts: new Map([['ad-fomkmudr', { id: draftId, title: 'Plomería Medellín' }]]), posts: new Map([['cmpost000000000000000001', 'Goteras']]) }
  it('groups the funnel and divides spend per package', () => {
    const s = summarizeOrigins({
      conversations: [{ id: 'c1', channel: 'WHATSAPP', customFields: { adReferral: { adId: '9', ctwaClid: 'x' }, webRef: 'ad-fomkmudr' } }, { id: 'c2', channel: 'WHATSAPP', customFields: {} }],
      requests: [
        { id: 'r1', acquisition: null, lastTouch: { via: 'chat', source: 'meta', medium: 'paid_social', campaign: 'ad-fomkmudr', adId: '9' } },
        { id: 'r2', acquisition: null, lastTouch: { via: 'web', source: 'instagram', medium: 'social', campaign: 'educacion', content: 'cmpost000000000000000001' } },
      ],
      bookings: [{ id: 'b1', status: 'COMPLETED', totalPrice: 90000, requestId: 'r1', acquisition: null, lastTouch: null }],
      spendByDraft: new Map([[draftId, 20000]]),
      labels,
      model: 'last',
    })
    const meta = s.channels.find((c) => c.channel === 'meta_ads')!
    expect(meta).toMatchObject({ conversations: 1, requests: 1, bookings: 1, completed: 1, sales: 90000, spend: 20000, costPerRequest: 20000 })
    expect(s.campaigns.find((c) => c.campaign === 'ad-fomkmudr')?.label).toBe('Pauta «Plomería Medellín»')
    expect(s.pieces.find((c) => c.content === 'cmpost000000000000000001')?.label).toContain('«Goteras»')
    expect(s.totals).toMatchObject({ requests: 2, spend: 20000, costPerRequest: 20000 })
  })

  it('flags packages with 3+ days of spend and no request', () => {
    const d = (day: string) => new Date(`${day}T00:00:00Z`)
    const spend = ['2026-10-01', '2026-10-02', '2026-10-03'].map((day) => ({ key: draftId, day: d(day), amountCop: 10000 }))
    expect(spendWithoutRequests({ spendDays: spend, requestsByCampaign: new Map(), minDays: 3 })).toEqual([{ adDraftId: draftId, daysWithSpend: 3, spendCop: 30000 }])
    expect(spendWithoutRequests({ spendDays: spend, requestsByCampaign: new Map([['ad-fomkmudr', 1]]), minDays: 3 })).toEqual([])
    expect(spendWithoutRequests({ spendDays: spend.slice(0, 2), requestsByCampaign: new Map(), minDays: 3 })).toEqual([])
  })

  it('credits requests and bookings to the post by channel', () => {
    const r = creditPosts(new Set(['p1']), [
      { id: 'r1', acquisition: null, lastTouch: { source: 'instagram', content: 'p1' } },
      { id: 'r2', acquisition: { source: 'publicacion', content: 'p1' }, lastTouch: { source: 'google' } },
      { id: 'r3', acquisition: null, lastTouch: { source: 'facebook', content: 'otro' } },
    ], [{ requestId: 'r1', status: 'COMPLETED' }])
    expect(r.get('p1')).toMatchObject({ requests: 2, bookings: 1, completed: 1, byChannel: { INSTAGRAM: { requests: 1, bookings: 1 } } })
  })

  it('ad spend input validation', () => {
    expect(parseAdSpendInput({ day: '2026-01-02', amountCop: '15000' })).toMatchObject({ day: '2026-01-02', amountCop: 15000, adSet: '' })
    expect(() => parseAdSpendInput({ day: '2999-01-01', amountCop: 1 })).toThrow()
    expect(() => parseAdSpendInput({ day: 'ayer', amountCop: 1 })).toThrow()
    expect(() => parseAdSpendInput({ day: '2026-01-02', amountCop: -5 })).toThrow()
  })
})

describe('attribution stays out of default query results', () => {
  it('strips the pair everywhere unless selected by name', async () => {
    const { stripTracking, wantsTracking } = await import('@/lib/prisma-tracking')
    const row = { id: 'b1', acquisition: { a: 1 }, lastTouch: { fbp: 'x' }, proposal: { serviceRequest: { id: 'r1', acquisition: null, lastTouch: { fbc: 'y' } } }, user: { id: 'u', acquisition: { source: 'ig' } }, at: new Date() }
    stripTracking([row])
    expect(row).not.toHaveProperty('lastTouch')
    expect(row.proposal.serviceRequest).not.toHaveProperty('lastTouch')
    expect(row.user.acquisition).toEqual({ source: 'ig' })
    expect(row.at).toBeInstanceOf(Date)
    expect(wantsTracking({ select: { id: true, lastTouch: true } })).toBe(true)
    expect(wantsTracking({ data: { lastTouch: {} }, include: { user: true } })).toBe(false)
    expect(wantsTracking({ include: { user: true } })).toBe(false)
  })
})

describe('weekly budget check', () => {
  it('suggests moving budget when one package costs twice as much', async () => {
    const { budgetShiftSuggestion } = await import('@/lib/analytics/origins-core')
    const pk = (id: string, spendCop: number, requests: number, bookings = 0) => ({ adDraftId: id, title: id, adSets: [id], spendCop, requests, bookings })
    expect(budgetShiftSuggestion([pk('a', 70_000, 7), pk('b', 50_000, 1)])).toMatchObject({ from: { adDraftId: 'b' }, to: { adDraftId: 'a' }, metric: 'solicitud', fromCost: 50000, toCost: 10000 })
    expect(budgetShiftSuggestion([pk('a', 70_000, 7), pk('b', 50_000, 0)])).toMatchObject({ from: { adDraftId: 'b' }, fromCost: null })
    expect(budgetShiftSuggestion([pk('a', 70_000, 7), pk('b', 50_000, 4)])).toBeNull()
    expect(budgetShiftSuggestion([pk('a', 70_000, 7), pk('b', 10_000, 0)])).toBeNull()
    expect(budgetShiftSuggestion([pk('a', 70_000, 7, 2), pk('b', 60_000, 6, 0)])).toMatchObject({ from: { adDraftId: 'b' }, metric: 'reserva' })
  })
})
