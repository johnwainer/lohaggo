import { describe, expect, it } from 'vitest'
import { cityEnumFromName, isValidLatLon, parseNominatimReverse, splitAddressText } from '@/lib/geo/address'

describe('parseNominatimReverse', () => {
  it('toma calle, número y barrio', () => {
    const r = parseNominatimReverse({ address: { road: 'Carrera 70', house_number: '44-20', neighbourhood: 'Laureles', suburb: 'Comuna 11', city: 'Medellín' } })
    expect(r).toEqual({ street: 'Carrera 70 # 44-20', neighborhood: 'Laureles', city: 'Medellín' })
  })
  it('sin barrio usa suburb y sin número deja solo la vía', () => {
    expect(parseNominatimReverse({ address: { road: 'Calle 10', suburb: 'El Poblado' } })).toEqual({ street: 'Calle 10', neighborhood: 'El Poblado', city: '' })
  })
  it('respuestas raras no rompen', () => {
    expect(parseNominatimReverse(null)).toEqual({ street: '', neighborhood: '', city: '' })
    expect(parseNominatimReverse({ error: 'Unable to geocode' })).toEqual({ street: '', neighborhood: '', city: '' })
  })
})

describe('splitAddressText', () => {
  it('separa calle, número y complemento', () => {
    expect(splitAddressText('Calle 10 # 43-21 apto 301')).toEqual({ street: 'Calle 10', number: '43-21', complement: 'apto 301' })
    expect(splitAddressText('Carrera 70 No. 44 - 20')).toEqual({ street: 'Carrera 70', number: '44-20' })
  })
  it('sin número reconocible todo va a la calle', () => {
    expect(splitAddressText('Unidad Los Pinos torre 3')).toEqual({ street: 'Unidad Los Pinos torre 3', number: 'S/N' })
  })
})

describe('otros', () => {
  it('ciudad a enum', () => {
    expect(cityEnumFromName('Medellín')).toBe('MEDELLIN')
    expect(cityEnumFromName('Bogotá')).toBe('BOGOTA')
  })
  it('lat/lon válidos', () => {
    expect(isValidLatLon(6.2, -75.5)).toBe(true)
    expect(isValidLatLon(NaN, 1)).toBe(false)
    expect(isValidLatLon(91, 1)).toBe(false)
  })
})
