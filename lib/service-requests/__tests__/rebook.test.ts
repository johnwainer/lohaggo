import { describe, expect, it } from 'vitest'
import { cleanNotes, draftFromBooking, rebookHref, splitStoredAddress } from '@/lib/service-requests/rebook'
import { loadDraft } from '@/lib/service-requests/draft'

describe('splitStoredAddress', () => {
  it('«calle, barrio, ciudad» → calle y barrio', () => {
    expect(splitStoredAddress('Calle 10 # 43-21, apto 301, Laureles, Medellín')).toEqual({ street: 'Calle 10 # 43-21, apto 301', neighborhood: 'Laureles' })
    expect(splitStoredAddress('Calle 10 #43 - 301, Laureles, Medellín')).toEqual({ street: 'Calle 10 #43 - 301', neighborhood: 'Laureles' })
  })

  it('direcciones cortas no se rompen', () => {
    expect(splitStoredAddress('Calle 5, Poblado')).toEqual({ street: 'Calle 5', neighborhood: 'Poblado' })
    expect(splitStoredAddress('Calle 5')).toEqual({ street: 'Calle 5', neighborhood: '' })
    expect(splitStoredAddress('')).toEqual({ street: '', neighborhood: '' })
  })
})

describe('cleanNotes', () => {
  it('quita las líneas que añadió la plataforma y separa las indicaciones', () => {
    expect(cleanNotes('La llave gotea\nFranja preferida: tarde (2 – 6 p. m.).\nIndicaciones para llegar: portería 2')).toEqual({ notes: 'La llave gotea', instructions: 'portería 2' })
    expect(cleanNotes(null)).toEqual({ notes: '', instructions: '' })
  })
})

describe('draftFromBooking / rebookHref', () => {
  const booking = { serviceSlug: 'plomeria', partnerId: 'p1', address: 'Calle 10 # 43-21, Laureles, Medellín', notes: 'La llave gotea' }

  it('arma el borrador en el paso «Cuándo» con socio, dirección y notas', () => {
    const d = draftFromBooking(booking, 1000)
    expect(d).toMatchObject({ slug: 'plomeria', step: 2, partnerId: 'p1', addressMode: 'new', when: 'flexible', notes: 'La llave gotea' })
    expect(d.newAddress).toEqual({ street: 'Calle 10 # 43-21', neighborhood: 'Laureles', instructions: '' })
  })

  it('lo guarda donde el asistente lo lee y devuelve el enlace con ?resume=1', () => {
    const data = new Map<string, string>()
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v) }, removeItem: (k: string) => { data.delete(k) } }
    expect(rebookHref(storage, booking)).toBe('/servicios/plomeria?resume=1')
    expect(loadDraft(storage, 'plomeria')).toMatchObject({ partnerId: 'p1', step: 2, newAddress: { street: 'Calle 10 # 43-21' } })
  })
})
