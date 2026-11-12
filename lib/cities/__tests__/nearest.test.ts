import { describe, expect, it } from 'vitest'
import { distanceKm, isLiveCity, nearestLiveCity } from '@/lib/cities/nearest'

const medellin = { slug: 'medellin', name: 'Medellín', status: 'ACTIVE', order: 1, latitude: 6.2442, longitude: -75.5812 }
const bogota = { slug: 'bogota', name: 'Bogotá', status: 'ACTIVE', order: 2, latitude: 4.711, longitude: -74.0721 }
const cali = { slug: 'cali', name: 'Cali', status: 'ACTIVE', order: 3, latitude: 3.4516, longitude: -76.532, partnerRegistry: true }
const envigado = { slug: 'envigado', name: 'Envigado', status: 'COMING_SOON', order: 4, latitude: 6.17, longitude: -75.59 }

describe('nearestLiveCity', () => {
  it('una ciudad en registro de socios o próxima no es viva', () => {
    expect(isLiveCity(medellin)).toBe(true)
    expect(isLiveCity(cali)).toBe(false)
    expect(isLiveCity(envigado)).toBe(false)
  })

  it('elige la ciudad viva más cercana por distancia', () => {
    // Cali is closer to Bogotá (≈ 300 km) than to Medellín (≈ 340 km)
    expect(nearestLiveCity(cali, [medellin, bogota, cali, envigado])?.slug).toBe('bogota')
    expect(nearestLiveCity(envigado, [medellin, bogota])?.slug).toBe('medellin')
  })

  it('sin coordenadas cae a la primera viva por orden', () => {
    expect(nearestLiveCity({ slug: 'x', name: 'X', status: 'COMING_SOON' }, [bogota, medellin])?.slug).toBe('medellin')
  })

  it('sin ciudades vivas devuelve null y nunca la misma ciudad', () => {
    expect(nearestLiveCity(cali, [cali, envigado])).toBeNull()
    expect(nearestLiveCity(medellin, [medellin])).toBeNull()
  })

  it('la distancia Medellín–Bogotá es de unos 240 km', () => {
    const d = distanceKm(medellin, bogota)
    expect(d).toBeGreaterThan(230)
    expect(d).toBeLessThan(250)
  })
})
