import { describe, expect, it } from 'vitest'
import { approximateAddress, firstName, opportunitiesFromResponse, toPartnerOpportunity } from '@/lib/partners/opportunities'

describe('approximateAddress', () => {
  it.each([
    ['Calle 10 # 43-25, El Poblado', 'Calle 10, El Poblado'],
    ['Cra 43A #1-50 apto 502, Medellín', 'Cra 43A, Medellín'],
    ['Carrera 70 No. 45-12, Laureles', 'Carrera 70, Laureles'],
    ['Carrera 70 no 45 - 12 Laureles', 'Carrera 70'],
    ['Calle 10 43-25, Belén', 'Calle 10, Belén'],
    ['Cl 33 #65B-20 Torre 2 Apto 1101, Conquistadores', 'Cl 33, Conquistadores'],
    ['Transversal 39B N° 72-10 sur, Envigado', 'Transversal 39B, Envigado'],
    ['Circular 1 # 70-01, Laureles, 050031', 'Circular 1, Laureles'],
    ['Barrio Camino Real, Medellín', 'Barrio Camino Real, Medellín'],
    ['Conjunto Los Pinos casa 12, Sabaneta', 'Conjunto Los Pinos, Sabaneta'],
  ])('%s → %s', (input, expected) => {
    expect(approximateAddress(input)).toBe(expected)
  })

  it('handles empty input', () => {
    expect(approximateAddress('')).toBe('')
    expect(approximateAddress(null)).toBe('')
  })

  it('never keeps the plate number', () => {
    const out = approximateAddress('Calle 50 # 45-67 interior 301, Centro')
    expect(out).not.toMatch(/45|67|301/)
  })
})

describe('firstName', () => {
  it('keeps only the first name', () => {
    expect(firstName('María José Pérez')).toBe('María')
    expect(firstName('  Ana  ')).toBe('Ana')
    expect(firstName(null)).toBe('Cliente')
    expect(firstName('')).toBe('Cliente')
  })
})

const source = {
  id: 'r1',
  userId: 'u-client',
  address: 'Calle 10 # 43-25 apto 301, El Poblado',
  city: 'MEDELLIN',
  notes: 'Gotea la llave',
  budget: 80_000,
  preferredDate: new Date('2026-10-01T00:00:00Z'),
  preferredTime: '10:00',
  isUrgent: true,
  status: 'ACTIVE',
  expiresAt: new Date('2026-09-28T00:00:00Z'),
  createdAt: new Date('2026-09-27T00:00:00Z'),
  partnerId: null,
  origin: 'app',
  originChannel: null,
  service: { id: 's1', name: 'Plomería', slug: 'plomeria', icon: '🔧', basePrice: 50_000, description: 'x', category: { id: 'c1', name: 'Hogar', slug: 'hogar' } },
  user: { name: 'Laura Gómez', email: 'laura@example.com', phone: '+573001112233' },
  photos: [{ id: 'ph1', url: 'https://res.cloudinary.com/x/a.jpg', order: 0, serviceRequestId: 'r1' }],
  proposals: [{ id: 'pr1', price: 90_000, notes: 'Voy hoy', status: 'PENDING', partnerId: 'p1', serviceRequestId: 'r1' }],
  _count: { proposals: 4 },
}

describe('toPartnerOpportunity', () => {
  it('never exposes the client email, phone, full name, id or exact address', () => {
    const out = toPartnerOpportunity(source, 'p1')
    const json = JSON.stringify(out)
    expect(json).not.toContain('laura@example.com')
    expect(json).not.toContain('3001112233')
    expect(json).not.toContain('Gómez')
    expect(json).not.toContain('u-client')
    expect(json).not.toMatch(/43-25|301/)
    expect(out.user).toEqual({ name: 'Laura' })
    expect(Object.keys(out)).not.toContain('userId')
  })

  it('keeps what the partner needs to bid', () => {
    const out = toPartnerOpportunity(source, 'p1')
    expect(out).toMatchObject({
      id: 'r1',
      address: 'Calle 10, El Poblado',
      city: 'MEDELLIN',
      budget: 80_000,
      isUrgent: true,
      preferredTime: '10:00',
      service: { name: 'Plomería', basePrice: 50_000, category: { name: 'Hogar' } },
      _count: { proposals: 4 },
      proposals: [{ id: 'pr1', price: 90_000, notes: 'Voy hoy', status: 'PENDING' }],
    })
    expect(out.photos).toEqual([{ id: 'ph1', url: 'https://res.cloudinary.com/x/a.jpg', order: 0 }])
    expect(Object.keys(out.service)).toEqual(['name', 'slug', 'icon', 'basePrice', 'category'])
  })

  it('does not return other partners proposals and only marks direct requests to this partner', () => {
    const out = toPartnerOpportunity(
      { ...source, partnerId: 'p1', proposals: [{ id: 'other', price: 1, notes: null, status: 'PENDING', partnerId: 'p2' }] },
      'p1',
    )
    expect(out.proposals).toEqual([])
    expect(out.partnerId).toBe('p1')
    expect(toPartnerOpportunity({ ...source, partnerId: 'p9' }, 'p1').partnerId).toBeNull()
  })
})

describe('opportunitiesFromResponse', () => {
  it('reads the object shape and the legacy array', () => {
    expect(opportunitiesFromResponse({ requests: [{ id: 'a' }], requiresVerification: false }).requests).toHaveLength(1)
    expect(opportunitiesFromResponse({ requests: [], requiresVerification: true }).requiresVerification).toBe(true)
    expect(opportunitiesFromResponse([{ id: 'a' }]).requests).toHaveLength(1)
    expect(opportunitiesFromResponse({ error: 'x' })).toEqual({ requests: [], requiresVerification: false })
  })
})
