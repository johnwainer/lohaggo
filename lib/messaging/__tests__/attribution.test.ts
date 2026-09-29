import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { extractWebRef, mergeAttribution, parseMetaReferral, parseTwilioReferral, summarizeConversationOrigins } from '@/lib/messaging/attribution'

const now = new Date('2026-10-01T15:00:00.000Z')

describe('Twilio clic a WhatsApp', () => {
  it('lee los parámetros Referral* de Twilio', () => {
    const params: Record<string, string> = {
      ReferralSourceId: '118588094077142', ReferralCtwaClid: 'ARAkLkA8rml', ReferralSourceUrl: 'https://fb.me/xyz123',
      ReferralHeadline: 'Plomero hoy', ReferralSourceType: 'ad', ReferralBody: 'x',
    }
    expect(parseTwilioReferral((k) => params[k] ?? null, now)).toEqual({
      source: 'ctwa', adId: '118588094077142', ctwaClid: 'ARAkLkA8rml', headline: 'Plomero hoy', url: 'https://fb.me/xyz123', type: 'ad', at: now.toISOString(),
    })
  })
  it('sin parámetros de anuncio → null', () => {
    expect(parseTwilioReferral(() => null)).toBeNull()
    expect(parseTwilioReferral((k) => (k === 'ReferralHeadline' ? 'solo titular' : '  '))).toBeNull()
  })
})

describe('Meta referral', () => {
  it('con ad_id es anuncio', () => {
    expect(parseMetaReferral({ ad_id: '123', source: 'ADS', type: 'OPEN_THREAD', ref: 'promo' }, now)).toEqual({
      adReferral: { source: 'meta', adId: '123', ref: 'promo', type: 'OPEN_THREAD', at: now.toISOString() }, ref: 'promo',
    })
  })
  it('un enlace m.me con ref no es anuncio', () => {
    expect(parseMetaReferral({ ref: 'web-home', source: 'SHORTLINK', type: 'OPEN_THREAD' })).toEqual({ adReferral: null, ref: 'web-home' })
    expect(parseMetaReferral(undefined)).toEqual({ adReferral: null, ref: null })
  })
})

describe('ref de la web', () => {
  it('saca web-… y blog-… del mensaje prellenado', () => {
    expect(extractWebRef('Hola, quiero pedir Plomería. ¿Me ayudas? (ref: web-plomeria)')).toBe('web-plomeria')
    expect(extractWebRef('Hola, leí su artículo (ref: blog-como-destapar-un-lavamanos)')).toBe('blog-como-destapar-un-lavamanos')
    expect(extractWebRef('Hola (REF: Web-Ciudad-medellin)')).toBe('web-ciudad-medellin')
    expect(extractWebRef('ref: web-home')).toBeNull()
    expect(extractWebRef('(ref: promo)')).toBeNull()
    expect(extractWebRef('Hola (ref: cmp-ab12cd34)')).toBe('cmp-ab12cd34')
    expect(extractWebRef(null)).toBeNull()
  })
})

describe('mezcla en customFields', () => {
  const ad1 = { source: 'ctwa' as const, adId: 'A1', at: 't1' }
  const ad2 = { source: 'ctwa' as const, adId: 'A2', at: 't2' }
  it('guarda el primer anuncio, actualiza el último y conserva otros campos', () => {
    const first = mergeAttribution({ city: 'MEDELLIN' }, { adReferral: ad1 })
    expect(first).toMatchObject({ city: 'MEDELLIN', adReferral: ad1, lastAdReferral: ad1 })
    expect(mergeAttribution(first, { adReferral: ad2 })).toMatchObject({ adReferral: ad1, lastAdReferral: ad2 })
  })
  it('webRef: el primero gana, lastWebRef guarda el último y sin cambios devuelve null', () => {
    const t1 = new Date('2026-10-01T10:00:00Z')
    const t2 = new Date('2026-10-03T10:00:00Z')
    const f = mergeAttribution(null, { webRef: 'web-home' }, t1)
    expect(f).toMatchObject({ webRef: 'web-home', webRefAt: t1.toISOString(), lastWebRef: 'web-home', lastWebRefAt: t1.toISOString() })
    expect(mergeAttribution(f, { webRef: 'blog-x' }, t2)).toMatchObject({ webRef: 'web-home', webRefAt: t1.toISOString(), lastWebRef: 'blog-x', lastWebRefAt: t2.toISOString() })
    expect(mergeAttribution(f, {})).toBeNull()
  })
})

describe('resumen de origen', () => {
  it('cuenta conversaciones por anuncio y por página, y cuántas terminaron en solicitud', () => {
    const convs = [
      { id: 'c1', channel: 'WHATSAPP', isAd: true, customFields: { adReferral: { adId: 'A1', headline: 'Plomero', source: 'ctwa' } } },
      { id: 'c2', channel: 'WHATSAPP', isAd: true, customFields: { adReferral: { adId: 'A1' } } },
      { id: 'c3', channel: 'WHATSAPP', isAd: false, customFields: { webRef: 'web-plomeria' } },
      { id: 'c4', channel: 'INSTAGRAM', isAd: false, customFields: null },
      { id: 'c5', channel: 'MESSENGER', isAd: true, customFields: null },
    ]
    const requests = [
      { originConversationId: 'c1', status: 'ACCEPTED' },
      { originConversationId: 'c3', status: 'ACTIVE' },
      { originConversationId: null, status: 'ACTIVE' },
    ]
    const s = summarizeConversationOrigins(convs, requests)
    expect(s.total).toEqual({ conversaciones: 5, con_solicitud: 2, solicitudes_aceptadas: 1 })
    expect(s.por_anuncio).toEqual([{ anuncio_id: 'A1', titulo: 'Plomero', fuente: 'ctwa', conversaciones: 2, con_solicitud: 1, solicitudes_aceptadas: 1 }])
    expect(s.por_pagina_web).toEqual([{ ref: 'web-plomeria', conversaciones: 1, con_solicitud: 1, solicitudes_aceptadas: 0 }])
    expect(s.anuncio_sin_id.conversaciones).toBe(1)
    expect(s.sin_origen.conversaciones).toBe(1)
  })
})
