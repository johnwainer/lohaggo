import { describe, expect, it } from 'vitest'
import { cityIsIndexable, partnerIsIndexable, partnerIsLinkable } from '@/lib/seo/indexing'
import { computePriceRange, priceLabel, resolvePriceInfo, roundPrice, MIN_PRICE_SAMPLE } from '@/lib/seo/prices'
import { buildLlmsTxt } from '@/lib/seo/llms'

describe('partnerIsIndexable', () => {
  it('indexa con al menos una reseña', () => {
    expect(partnerIsIndexable({ totalReviews: 1 })).toBe(true)
  })
  it('indexa con biografía y foto', () => {
    expect(partnerIsIndexable({ totalReviews: 0, bio: 'Plomero con 10 años de experiencia en Envigado', image: 'https://x/y.jpg' })).toBe(true)
  })
  it('no indexa sin reseñas y solo biografía o solo foto', () => {
    expect(partnerIsIndexable({ totalReviews: 0, bio: 'Plomero con 10 años de experiencia en Envigado' })).toBe(false)
    expect(partnerIsIndexable({ totalReviews: 0, image: 'https://x/y.jpg' })).toBe(false)
    expect(partnerIsIndexable({ totalReviews: 0, bio: '   ', image: 'https://x/y.jpg' })).toBe(false)
    expect(partnerIsIndexable({ totalReviews: null, bio: 'hola', image: 'https://x/y.jpg' })).toBe(false)
  })
  it('solo enlaza perfiles con reseñas', () => {
    expect(partnerIsLinkable({ totalReviews: 0 })).toBe(false)
    expect(partnerIsLinkable({ totalReviews: 2 })).toBe(true)
  })
})

describe('cityIsIndexable', () => {
  it('solo las ciudades abiertas', () => {
    expect(cityIsIndexable('ACTIVE')).toBe(true)
    expect(cityIsIndexable('COMING_SOON')).toBe(false)
    expect(cityIsIndexable(undefined)).toBe(false)
  })
})

describe('computePriceRange', () => {
  it('sin muestra mínima no afirma un rango', () => {
    expect(computePriceRange([50000, 60000, 70000, 80000])).toBeNull()
    expect(MIN_PRICE_SAMPLE).toBe(5)
  })
  it('ignora valores inválidos al contar la muestra', () => {
    expect(computePriceRange([50000, 0, -5, NaN, null, undefined, 60000, 70000, 80000])).toBeNull()
  })
  it('calcula percentil 20 a 80 y mediana redondeados', () => {
    const r = computePriceRange([40000, 50000, 60000, 70000, 80000, 90000, 100000, 500000])
    expect(r).not.toBeNull()
    expect(r!.sample).toBe(8)
    expect(r!.low).toBeGreaterThanOrEqual(40000)
    expect(r!.high).toBeLessThan(500000)
    expect(r!.low).toBeLessThanOrEqual(r!.median)
    expect(r!.median).toBeLessThanOrEqual(r!.high)
  })
  it('redondea a cifras limpias', () => {
    expect(roundPrice(63400)).toBe(63000)
    expect(roundPrice(152300)).toBe(150000)
  })
})

describe('resolvePriceInfo / priceLabel', () => {
  it('cae al «desde» del catálogo sin muestra', () => {
    const info = resolvePriceInfo([50000], 45000)
    expect(info).toEqual({ source: 'catalog', from: 45000 })
    expect(priceLabel(info)).toContain('desde $45.000')
  })
  it('usa las propuestas con muestra suficiente', () => {
    const info = resolvePriceInfo([50000, 55000, 60000, 65000, 70000], 45000)
    expect(info.source).toBe('proposals')
    expect(priceLabel(info)).toMatch(/\$\d.* a \$\d.* COP/)
  })
})

describe('buildLlmsTxt', () => {
  const base = {
    services: [
      { name: 'Plomería', slug: 'plomeria', from: 50000 },
      { name: 'Pintura', slug: 'pintura', from: 80000, range: { low: 90000, high: 200000 } },
    ],
    cities: ['Medellín'],
    verifiedPartners: null,
    whatsappPhone: null,
    guarantee: null,
    clientPayment: 'Pagas al terminar el servicio.',
    verification: 'Identidad verificada por nuestro equipo.',
    updatedAt: new Date('2026-11-12T12:00:00Z'),
  }
  it('describe qué es, cobertura, servicios con precios y contacto', () => {
    const t = buildLlmsTxt(base)
    expect(t.startsWith('# LoHaggo')).toBe(true)
    expect(t).toContain('Medellín')
    expect(t).toContain('/servicios/plomeria): desde $50.000')
    expect(t).toContain('/servicios/pintura): típico $90.000 a $200.000')
    expect(t).toContain('hola@lohaggo.com')
    expect(t).toContain('https://www.lohaggo.com/precios')
  })
  it('no inventa cifras, garantía ni WhatsApp', () => {
    const t = buildLlmsTxt(base)
    expect(t).not.toMatch(/socios verificados\./)
    expect(t).not.toContain('## Garantía')
    expect(t).not.toContain('WhatsApp: +')
  })
  it('incluye lo respaldado cuando existe', () => {
    const t = buildLlmsTxt({ ...base, verifiedPartners: 40, whatsappPhone: '573001112233', guarantee: 'Te conseguimos otro socio.' })
    expect(t).toContain('Hoy hay 40 socios verificados.')
    expect(t).toContain('+573001112233')
    expect(t).toContain('## Garantía')
  })
})
