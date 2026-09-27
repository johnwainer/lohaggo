import { afterEach, describe, expect, it, vi } from 'vitest'
import { track } from '@/lib/analytics/track'

const g = globalThis as unknown as { window?: unknown }

afterEach(() => { delete g.window })

describe('track', () => {
  it('sin window ni scripts no hace nada ni lanza', () => {
    expect(() => track('lead', { content_name: 'Plomería' })).not.toThrow()
    g.window = {}
    expect(() => track('lead', { content_name: 'Plomería' })).not.toThrow()
  })

  it('envía el evento estándar de Meta y el de GA4', () => {
    const fbq = vi.fn()
    const gtag = vi.fn()
    g.window = { fbq, gtag }
    track('view_content', { content_name: 'Aseo', content_ids: ['s1'], value: 50000 })
    expect(fbq).toHaveBeenCalledWith('track', 'ViewContent', { content_name: 'Aseo', content_ids: ['s1'], value: 50000, currency: 'COP' })
    expect(gtag).toHaveBeenCalledWith('event', 'view_item', expect.objectContaining({ content_name: 'Aseo', value: 50000, currency: 'COP', items: [expect.objectContaining({ item_id: 's1', item_name: 'Aseo' })] }))
  })

  it('mapea los eventos', () => {
    const fbq = vi.fn()
    const gtag = vi.fn()
    g.window = { fbq, gtag }
    track('begin_checkout'); track('lead'); track('whatsapp_click'); track('search', { q: 'plomero' })
    expect(fbq.mock.calls.map((c) => c[1])).toEqual(['InitiateCheckout', 'Lead', 'Contact', 'Search'])
    expect(gtag.mock.calls.map((c) => c[1])).toEqual(['begin_checkout', 'generate_lead', 'whatsapp_click', 'search'])
  })

  it('un píxel que lanza no rompe GA4', () => {
    const gtag = vi.fn()
    g.window = { fbq: () => { throw new Error('boom') }, gtag }
    expect(() => track('lead')).not.toThrow()
    expect(gtag).toHaveBeenCalled()
  })
})
