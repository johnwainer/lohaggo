import { describe, expect, it } from 'vitest'
import { detectIntentTargets, queryTokens, rankByIntent } from '@/lib/services/searchIntent'
import { enhancedSearch } from '@/lib/searchSynonyms'

const svc = (name: string, category: string, available = 1, description = '') => ({
  id: name,
  name,
  slug: name.toLowerCase().replace(/\s+/g, '-'),
  description,
  category: { name: category, slug: category.toLowerCase() },
  partnerStats: { availableCount: available, avgRating: 0 },
  _count: { partners: available },
})

const catalog = [
  svc('Depilación', 'Belleza', 3, 'Depilación con cera caliente, sin dolor y con agua tibia'),
  svc('Electricidad', 'Hogar', 15, 'Instalaciones, tomas y cortos'),
  svc('Plomería', 'Hogar', 13, 'Fugas, tuberías, grifos y sanitarios'),
  svc('Pintura', 'Hogar', 15),
  svc('Limpieza de hogar', 'Limpieza', 12),
  svc('Cerrajería', 'Hogar', 2),
  svc('Carpintería', 'Hogar', 4),
  svc('Manicure y pedicure', 'Belleza', 12),
  svc('Instalación de cámaras', 'Tecnología', 1),
  svc('Masajes', 'Salud', 14),
]

const names = (q: string) => enhancedSearch(catalog, q).results.map((s) => s.name)

describe('queryTokens', () => {
  it('drops filler words and accents', () => {
    expect(queryTokens('Necesito un plomero para la cocina')).toEqual(['plomero', 'cocina'])
    expect(queryTokens('de la el en')).toEqual([])
  })
})

describe('search intent', () => {
  it('"fuga de agua" gives Plomería first and never Depilación', () => {
    const r = names('fuga de agua')
    expect(r[0]).toBe('Plomería')
    expect(r).not.toContain('Depilación')
  })

  it('maps everyday words to the right service', () => {
    expect(names('se me dañó el enchufe')[0]).toBe('Electricidad')
    expect(names('gotera en el baño')[0]).toBe('Plomería')
    expect(names('pintar la pared')[0]).toBe('Pintura')
    expect(names('aseo de la casa')[0]).toBe('Limpieza de hogar')
    expect(names('arreglar un closet')[0]).toBe('Carpintería')
    expect(names('uñas')[0]).toBe('Manicure y pedicure')
    expect(names('cámaras de seguridad')[0]).toBe('Instalación de cámaras')
  })

  it('"llave perdida" is a locksmith, a plain "llave" is plumbing', () => {
    expect(names('perdí la llave')[0]).toBe('Cerrajería')
    expect(names('llave perdida')[0]).toBe('Cerrajería')
    expect(names('llave que gotea')[0]).toBe('Plomería')
  })

  it('only points at services in the catalogue', () => {
    expect(detectIntentTargets('pasto del jardín').length).toBeGreaterThan(0)
    expect(rankByIntent(catalog, 'pasto del jardín')).toBeNull()
  })

  it('falls back to text search without an intent, ignoring filler words', () => {
    expect(names('necesito masajes')).toEqual(['Masajes'])
    expect(names('de')).not.toContain('Depilación')
  })
})
