import { describe, expect, it } from 'vitest'
import { buildIcs, googleMapsUrl, telHref, wazeUrl } from '@/lib/bookings/directions'

describe('enlaces de ruta', () => {
  it('Google Maps y Waze llevan la dirección completa codificada', () => {
    expect(googleMapsUrl('Calle 10 # 43-21, apto 301', 'Medellín')).toBe('https://www.google.com/maps/search/?api=1&query=Calle%2010%20%23%2043-21%2C%20apto%20301%2C%20Medell%C3%ADn')
    expect(wazeUrl('Carrera 7 # 5-1', null)).toBe('https://waze.com/ul?q=Carrera%207%20%23%205-1&navigate=yes')
  })
})

describe('telHref', () => {
  it('deja solo los dígitos marcables y exige un largo razonable', () => {
    expect(telHref('+57 300 123 4567')).toBe('tel:+573001234567')
    expect(telHref('300-123-4567')).toBe('tel:3001234567')
    expect(telHref('12')).toBeNull()
    expect(telHref(null)).toBeNull()
  })
})

describe('buildIcs', () => {
  const booking = { id: 'b123', title: 'Plomería · Ana', scheduledDate: '2026-11-20T00:00:00.000Z', scheduledTime: '15:30', address: 'Calle 10 # 43-21, Medellín', notes: 'Llave, que gotea; portería 2' }
  const ics = buildIcs(booking, new Date('2026-11-12T12:00:00.000Z'))

  it('la hora de Bogotá (UTC-5) se escribe en UTC y dura una hora por defecto', () => {
    expect(ics).toContain('DTSTART:20261120T203000Z')
    expect(ics).toContain('DTEND:20261120T213000Z')
    expect(ics).toContain('DTSTAMP:20261112T120000Z')
  })

  it('escapa comas, punto y coma y saltos de línea', () => {
    expect(ics).toContain('LOCATION:Calle 10 # 43-21\\, Medellín')
    expect(ics).toContain('DESCRIPTION:Llave\\, que gotea\\; portería 2')
  })

  it('es un VCALENDAR válido con UID estable y finales de línea CRLF', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('UID:booking-b123@lohaggo.com')
  })

  it('pliega las líneas largas a 75 caracteres', () => {
    const long = buildIcs({ ...booking, notes: 'x'.repeat(300) })
    for (const line of long.split('\r\n')) expect(line.length).toBeLessThanOrEqual(75)
  })
})
