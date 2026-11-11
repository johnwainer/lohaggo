import { describe, expect, it } from 'vitest'
import { etaMinutesIn, partnerOnWaySignal } from '@/lib/bookings/partner-unavailable-core'

describe('el socio escribe que va en camino (texto libre)', () => {
  it.each([
    ['Voy en camino', null],
    ['ya voy en camino, llego en 20', 20],
    ['Llego en 15 minutos', 15],
    ['en 10 llego', 10],
    ['voy tarde, llego en media hora', 30],
    ['Me retrasé con el trancón, llego en una hora', 60],
    ['Ya salí, estoy allá en hora y media', 90],
    ['ya casi llego', null],
    ['Voy a llegar un poco tarde', null],
  ])('«%s» → en camino (%s min)', (text, eta) => {
    expect(partnerOnWaySignal(text)).toEqual({ etaMinutes: eta })
  })

  it.each([
    'No puedo ir hoy, tuve una emergencia',
    'Estoy de viaje, no podré ir',
    'no voy a llegar tarde, tranquilo',
    'Buenos días, ¿a qué hora es el servicio?',
    'No voy en camino todavía',
    '',
  ])('«%s» → no es un «voy en camino»', (text) => {
    expect(partnerOnWaySignal(text)).toBeNull()
  })

  it('los minutos quedan entre 5 y 120', () => {
    expect(etaMinutesIn('llego en 2 minutos')).toBe(5)
    expect(etaMinutesIn('llego en 300 minutos')).toBe(120)
    expect(etaMinutesIn('llego en 3 horas')).toBe(120)
    expect(etaMinutesIn('llego pronto')).toBeNull()
  })
})

describe('no es «voy en camino» (sin avisos falsos al cliente)', () => {
  it.each(['¿A qué hora llego?', 'llego mañana a cotizar', 'ya salí del otro servicio', 'Buenas, en camino de aprender', 'gracias, ya llegó el material'])('«%s»', (t) => {
    expect(partnerOnWaySignal(t)).toBeNull()
  })
})
