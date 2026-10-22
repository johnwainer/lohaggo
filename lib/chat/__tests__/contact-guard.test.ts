import { describe, expect, it } from 'vitest'
import { detectContactInfo } from '@/lib/chat/contact-guard'

const blocked = (t: string) => detectContactInfo(t).isValid === false

describe('detectContactInfo: frases reales de agenda, precio y servicio que NO se bloquean', () => {
  const ok = [
    'Hola Pablo, el cliente confirma la instalación de la lámpara el sábado 25 a las 11:00.',
    'Igual te confirmo mañana a las 9:30 si puedes ir.',
    'El cliente se llama Andrés y vive en Laureles, Cra 76 #33-12, apto 301.',
    'Cra 43A # 12 - 34, barrio El Poblado, torre 2 apto 1504',
    'El precio es $150.000 - $200.000 según el trabajo.',
    'Te cobro 180.000 pesos con materiales incluidos.',
    'Entre 150.000 - 200.000 está bien para él.',
    'La reserva #a1b2c3 quedó para el 2026-10-25 a las 10:00.',
    'Reserva ref HOPMJV del 25/10/2026, de 8:00 a 12:00.',
    'Son 2 baños y 3 habitaciones, unos 120 m2.',
    'Pablo dice que llega entre las 10 y las 11 y que trae escalera.',
    'Le escribí al cliente y quedó de responder hoy.',
    'Necesito instalar 4 lámparas e impermeabilizar la terraza de afuera.',
    'Pintar la fachada por fuera y por dentro.',
    'Te llega un correo de confirmación de LoHaggo.',
    'Revisa tu correo, ahí está el enlace.',
    'Mi número de reserva es 1234567.',
    '¿Puede ir el lunes a las 9?',
    'El servicio cuesta 1.250.000 en total.',
    'Hotel Dann, habitación 1203, llega a las 15:30',
    'Pago por transferencia de $350.000 al terminar',
  ]
  for (const t of ok) it(`pasa: ${t}`, () => expect(detectContactInfo(t)).toEqual({ isValid: true }))
})

describe('detectContactInfo: datos de contacto reales que SÍ se bloquean', () => {
  const cases: Array<[string, string]> = [
    ['escríbeme al 3001234567', 'números de teléfono'],
    ['mi cel es 300 123 4567', 'números de teléfono'],
    ['llámeme al +57 310 555 1234', 'números de teléfono'],
    ['3 0 0 1 2 3 4 5 6 7', 'números de teléfono'],
    ['WhatsApp: 4441234', 'números de teléfono'],
    ['teléfono fijo 6044441234', 'números de teléfono'],
    ['Nequi 3001234567 a nombre de Pablo', 'números de teléfono'],
    ['mi correo es ana@x.com', 'correos electrónicos'],
    ['ana punto perez arroba gmail punto com', 'correos electrónicos'],
    ['juan.perez arroba gmail punto com', 'correos electrónicos'],
    ['mi insta es @pablo.pinturas', 'redes sociales'],
    ['ig: pablopinturas', 'redes sociales'],
    ['búscame en Facebook', 'redes sociales'],
    ['entra a wa.me/573001234567', 'enlaces de contacto'],
    ['pásame tu número y cuadramos', 'solicitudes de contacto externo'],
    ['hablemos por WhatsApp mejor', 'solicitudes de contacto externo'],
    ['lo arreglamos por fuera de la app y te sale más barato', 'solicitudes de contacto externo'],
    ['llámame cuando puedas', 'solicitudes de contacto externo'],
    ['te escribo al interno', 'solicitudes de contacto externo'],
  ]
  for (const [t, reason] of cases) {
    it(`bloquea: ${t}`, () => {
      const r = detectContactInfo(t)
      expect(r.isValid).toBe(false)
      if (!r.isValid) {
        expect(r.reason).toBe(reason)
        expect(r.fragment.length).toBeGreaterThan(0)
        expect(t).toContain(r.fragment)
      }
    })
  }

  it('devuelve el fragmento exacto que se bloqueó', () => {
    const r = detectContactInfo('Perfecto, mi número es 3104567890, me avisas')
    expect(r).toEqual({ isValid: false, reason: 'números de teléfono', fragment: '3104567890' })
  })

  it('un mensaje vacío no se bloquea', () => {
    expect(blocked('')).toBe(false)
  })
})

describe('celular escrito con puntos', () => {
  it('un móvil con puntos de miles sigue siendo un teléfono, un precio no', async () => {
    const { detectContactInfo } = await import('@/lib/chat/contact-guard')
    expect(detectContactInfo('mi número es 3.001.234.567').isValid).toBe(false)
    expect(detectContactInfo('el trabajo cuesta 150.000 pesos').isValid).toBe(true)
    expect(detectContactInfo('te cobro 3.000.000 por todo').isValid).toBe(true)
  })
})
