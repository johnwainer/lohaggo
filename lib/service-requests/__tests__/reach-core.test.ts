import { describe, expect, it } from 'vitest'
import { ZONE_KEYS, nearbyZones } from '@/lib/geo/zones'
import { pickReachBatch, reachRing, widenedRequestId, type ReachCandidate } from '@/lib/service-requests/reach-core'

const c = (name: string, coverageZones: string[], over: Partial<ReachCandidate> = {}): ReachCandidate => ({
  partnerId: `p-${name}`, userId: `u-${name}`, name, coverageZones, rating: 4, completed: 0, quotedService: 0, quotedCategory: 0, ...over,
})

describe('zonas vecinas', () => {
  it('son simétricas, válidas y nunca la misma zona', () => {
    for (const z of ZONE_KEYS) {
      for (const n of nearbyZones(z)) {
        expect(ZONE_KEYS).toContain(n)
        expect(n).not.toBe(z)
        expect(nearbyZones(n)).toContain(z)
      }
    }
    expect(nearbyZones('san-javier')).toEqual(expect.arrayContaining(['la-america', 'robledo', 'belen']))
    expect(nearbyZones(null)).toEqual([])
  })
})

describe('a quién más se le avisa', () => {
  it('anillos: la zona, las vecinas y, en la segunda ola, toda la ciudad', () => {
    expect(reachRing(['san-javier'], 'san-javier', 'nearby')).toBe(0)
    expect(reachRing([], 'san-javier', 'nearby')).toBe(0)
    expect(reachRing(['robledo'], 'san-javier', 'nearby')).toBe(1)
    expect(reachRing(['el-poblado'], 'san-javier', 'nearby')).toBeNull()
    expect(reachRing(['el-poblado'], 'san-javier', 'city')).toBe(2)
  })

  it('primero los de la zona, luego quien cotizó ese servicio (o su categoría) hace poco, luego calificación; con tope', () => {
    const list = [
      c('lejos', ['el-poblado'], { rating: 5, quotedService: 9 }),
      c('vecino', ['belen'], { rating: 3 }),
      c('vecino-cotiza', ['robledo'], { quotedService: 2 }),
      c('vecino-categoria', ['la-america'], { quotedCategory: 3, rating: 5 }),
      c('zona', ['san-javier'], { rating: 2 }),
    ]
    expect(pickReachBatch(list, { zone: 'san-javier', scope: 'nearby', limit: 10 }).map((x) => x.name)).toEqual(['zona', 'vecino-cotiza', 'vecino-categoria', 'vecino'])
    expect(pickReachBatch(list, { zone: 'san-javier', scope: 'city', limit: 10 }).map((x) => x.name)).toEqual(['zona', 'vecino-cotiza', 'vecino-categoria', 'vecino', 'lejos'])
    expect(pickReachBatch(list, { zone: 'san-javier', scope: 'city', limit: 2 })).toHaveLength(2)
  })

  it('reconoce el aviso ampliado en la notificación', () => {
    expect(widenedRequestId(JSON.stringify({ serviceRequestId: 'sr1', reach: 'nearby' }))).toBe('sr1')
    expect(widenedRequestId(JSON.stringify({ serviceRequestId: 'sr1' }))).toBeNull()
    expect(widenedRequestId('no json')).toBeNull()
    expect(widenedRequestId(null)).toBeNull()
  })
})
