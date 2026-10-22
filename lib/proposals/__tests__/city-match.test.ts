import { describe, expect, it } from 'vitest'
import { cityMismatches, cityName, clientCityMismatchMessage, partnerCityMismatchMessage, serviceCityMismatch } from '@/lib/proposals/city-match'

describe('ciudad del servicio frente a la de la solicitud', () => {
  it('misma ciudad no es error; otra ciudad o sin servicio sí', () => {
    expect(serviceCityMismatch('MEDELLIN', 'MEDELLIN')).toBe(false)
    expect(serviceCityMismatch('BOGOTA', 'MEDELLIN')).toBe(true)
    expect(serviceCityMismatch(null, 'MEDELLIN')).toBe(true)
    expect(serviceCityMismatch('BOGOTA', null)).toBe(false)
  })

  it('nombres con tilde', () => {
    expect(cityName('MEDELLIN')).toBe('Medellín')
    expect(cityName('BOGOTA')).toBe('Bogotá')
    expect(cityName(null)).toBe('sin ciudad')
  })

  it('mensajes claros para el socio y el cliente', () => {
    expect(partnerCityMismatchMessage('Plomería', 'BOGOTA', 'MEDELLIN')).toContain('Tu servicio Plomería está registrado en Bogotá y esta solicitud es en Medellín')
    expect(partnerCityMismatchMessage('Plomería', null, 'MEDELLIN')).toContain('No ofreces Plomería en Medellín')
    expect(clientCityMismatchMessage('MEDELLIN')).toContain('Medellín')
  })

  it('encuentra las reservas en otra ciudad; ignora las de servicios que ya no tiene', () => {
    const bookings = [
      { id: 'b1', serviceId: 's1', city: 'MEDELLIN' },
      { id: 'b2', serviceId: 's1', city: 'BOGOTA' },
      { id: 'b3', serviceId: 's9', city: 'CALI' },
      { id: 'b4', city: 'CALI' },
    ]
    const out = cityMismatches(bookings, [{ serviceId: 's1', city: 'BOGOTA' }])
    expect(out.map((m) => [m.item.id, m.serviceCity, m.itemCity])).toEqual([['b1', 'BOGOTA', 'MEDELLIN']])
  })
})
