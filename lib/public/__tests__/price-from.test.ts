import { describe, expect, it } from 'vitest'
import { clientFee, feeNote, priceFrom, priceFromLabel } from '@/lib/public/price-from'

const money = (n: number) => `$${n}`

describe('priceFrom', () => {
  it('nunca baja del precio base (precios de socios anteriores a esa regla)', () => {
    expect(priceFrom({ basePrice: 100000 }, [70000, 120000])).toEqual({ amount: 100000, source: 'base' })
    expect(priceFrom({ basePrice: 100000 }, [70000])).toEqual({ amount: 100000, source: 'base' })
    expect(priceFrom({ basePrice: 100000 }, [130000, 110000])).toEqual({ amount: 110000, source: 'partners' })
  })
  it('con socios usa el precio más bajo; sin socios, el base', () => {
    expect(priceFrom({ basePrice: 50000 }, [90000, 70000, 80000])).toEqual({ amount: 70000, source: 'partners' })
    expect(priceFrom({ basePrice: 50000 }, [])).toEqual({ amount: 50000, source: 'base' })
  })

  it('ignora precios inválidos y la etiqueta dice de dónde sale', () => {
    expect(priceFrom({ basePrice: 50000 }, [0, NaN])).toEqual({ amount: 50000, source: 'base' })
    expect(priceFromLabel('partners')).toMatch(/socio/)
    expect(priceFromLabel('base')).toMatch(/base/)
  })
})

describe('tarifa de servicio al cliente', () => {
  it('comisión apagada → «Sin tarifa de servicio»', () => {
    expect(feeNote(100000, { enabled: false, rate: 5 }, money)).toBe('Sin tarifa de servicio')
    expect(clientFee(100000, { enabled: false, rate: 5 })).toBe(0)
  })

  it('comisión encendida → porcentaje y monto aproximado', () => {
    expect(feeNote(100000, { enabled: true, rate: 5 }, money)).toBe('+ tarifa de servicio 5 % (≈ $5000)')
    expect(clientFee(33333, { enabled: true, rate: 5 })).toBe(1667)
  })

  it('sin config todavía no afirma nada', () => {
    expect(feeNote(100000, null, money)).toBeNull()
  })

  it('tasa 0 equivale a sin tarifa', () => {
    expect(feeNote(100000, { enabled: true, rate: 0 }, money)).toBe('Sin tarifa de servicio')
  })
})
