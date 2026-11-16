import { describe, expect, it } from 'vitest'
import { hashtagOf, shareKit } from '@/lib/seo/agent/share-core'

const EMOJI = /[\u2190-\u2BFF\uFE0F\u200D]|[\uD83C-\uD83E][\uDC00-\uDFFF]/g
const long = 'Cómo elegir un plomero de confianza en Medellín y qué revisar antes de contratarlo para evitar sorpresas en tu hogar '.repeat(8)
const art = {
  title: 'Cómo elegir un plomero de confianza en Medellín',
  excerpt: 'Revisa estas señales antes de contratar y evita dolores de cabeza con las fugas de tu casa.',
  slug: 'como-elegir-plomero',
  tags: ['Plomería', 'fugas de agua', 'Hogar Seguro'],
  serviceName: 'Plomero',
  cityName: 'Medellín',
}

describe('shareKit', () => {
  it('respeta los límites de caracteres, incluso con textos larguísimos', () => {
    const k = shareKit({ ...art, title: long, excerpt: long })
    expect(k.whatsapp.length).toBeLessThanOrEqual(350)
    expect(k.facebook.length).toBeLessThanOrEqual(450)
    expect(k.instagram.length).toBeLessThanOrEqual(600)
    expect(k.whatsapp.endsWith(k.url)).toBe(true)
    expect(k.facebook.endsWith(shareKit(art).facebook.split('\n').pop()!)).toBe(true)
  })

  it('usa un utm_source distinto por canal y el resto fijo', () => {
    const k = shareKit(art)
    expect(k.whatsapp).toContain('https://www.lohaggo.com/blog/como-elegir-plomero?utm_source=whatsapp&utm_medium=social&utm_campaign=guia-compartida')
    expect(k.facebook).toContain('utm_source=facebook&utm_medium=social&utm_campaign=guia-compartida')
    expect(k.facebook.split('\n').pop()).toMatch(/^https:\/\/www\.lohaggo\.com\/blog\//)
  })

  it('Instagram no lleva enlace y manda a la bio', () => {
    const k = shareKit(art)
    expect(k.instagram).not.toMatch(/https?:\/\//)
    expect(k.instagram).not.toContain('utm_')
    expect(k.instagram).toContain('Enlace en la bio')
  })

  it('hashtags: de 5 a 8, sin acentos ni espacios, siempre #lohaggo', () => {
    const k = shareKit(art)
    expect(k.hashtags.length).toBeGreaterThanOrEqual(5)
    expect(k.hashtags.length).toBeLessThanOrEqual(8)
    expect(k.hashtags).toContain('#lohaggo')
    expect(k.hashtags).toContain('#plomeromedellin')
    for (const h of k.hashtags) expect(h).toMatch(/^#[a-z0-9]+$/)
    for (const h of k.hashtags) expect(k.instagram).toContain(h)
    expect(shareKit({ ...art, tags: Array.from({ length: 20 }, (_, i) => `etiqueta${i}`) }).hashtags.length).toBe(8)
    expect(shareKit({ ...art, tags: [], serviceName: null, cityName: null }).hashtags.length).toBeGreaterThanOrEqual(5)
  })

  it('máximo un emoji por mensaje, aunque el título traiga más', () => {
    const k = shareKit({ ...art, title: '🔧 Plomero 😀 de confianza', excerpt: '✨ Tips 🚿' })
    for (const t of [k.whatsapp, k.facebook, k.instagram]) expect((t.match(EMOJI) ?? []).length).toBeLessThanOrEqual(1)
  })

  it('sanea título y extracto: sin correos, teléfonos ni enlaces ajenos', () => {
    const k = shareKit({ ...art, title: 'Escríbeme a juan@correo.com <b>ya</b>', excerpt: 'Llama al 3001234567 o entra a https://malo.com/x' })
    for (const t of [k.whatsapp, k.facebook, k.instagram]) {
      expect(t).not.toContain('juan@correo.com')
      expect(t).not.toContain('3001234567')
      expect(t).not.toContain('malo.com')
      expect(t).not.toMatch(/[<>]/)
    }
  })

  it('sin extracto no inventa nada: solo título, gancho y enlace', () => {
    const k = shareKit({ ...art, excerpt: null })
    expect(k.whatsapp).toBe(`Te comparto esta guía de LoHaggo: «${art.title}». Te la dejo aquí 👇\n${k.url}`)
    expect(k.facebook.split('\n')[0]).toBe(art.title)
    expect(k.instagram).not.toContain('null')
    expect(k.whatsapp).not.toMatch(/\$|precio|gratis|garant/i)
  })
})

describe('hashtagOf', () => {
  it('quita acentos, espacios y símbolos', () => {
    expect(hashtagOf('PlomeroMedellín')).toBe('#plomeromedellin')
    expect(hashtagOf('Aire acondicionado!')).toBe('#aireacondicionado')
    expect(hashtagOf('ñ')).toBe('')
  })
})
