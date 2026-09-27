import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ configFindFirst: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { platformConfig: { findFirst: m.configFindFirst } } }))

import { bookingRates, clientBreakdown, effectiveRates, loadEffectiveRates, rateOrEffective } from '@/lib/payments/commission'

beforeEach(() => vi.clearAllMocks())

describe('effectiveRates', () => {
  it('apagada → 0/0 aunque haya tasas guardadas', () => {
    expect(effectiveRates({ commissionEnabled: false, clientCommissionRate: 5, partnerCommissionRate: 10 })).toEqual({ enabled: false, client: 0, partner: 0 })
  })
  it('encendida → las tasas guardadas', () => {
    expect(effectiveRates({ commissionEnabled: true, clientCommissionRate: 7, partnerCommissionRate: 12 })).toEqual({ enabled: true, client: 7, partner: 12 })
  })
  it('sin fila → 0/0 y enabled false', () => {
    expect(effectiveRates(null)).toEqual({ enabled: false, client: 0, partner: 0 })
  })
  it('encendida con tasas inválidas → defaults 5/10; nunca por encima de 100', () => {
    expect(effectiveRates({ commissionEnabled: true, clientCommissionRate: null, partnerCommissionRate: -3 })).toEqual({ enabled: true, client: 5, partner: 10 })
    expect(effectiveRates({ commissionEnabled: true, clientCommissionRate: 500, partnerCommissionRate: 10 }).client).toBe(100)
  })
})

describe('rateOrEffective / clientBreakdown', () => {
  it('la tasa de la reserva manda, incluso si es 0', () => {
    expect(rateOrEffective(0, 5)).toBe(0)
    expect(rateOrEffective(8, 5)).toBe(8)
    expect(rateOrEffective(null, 5)).toBe(5)
  })
  it('0 % → total = precio del socio', () => {
    expect(clientBreakdown(130000, 0)).toEqual({ serviceAmount: 130000, clientCommission: 0, clientCommissionRate: 0, totalAmount: 130000 })
  })
  it('5 % → suma la comisión en pesos enteros', () => {
    expect(clientBreakdown(130001, 5)).toEqual({ serviceAmount: 130001, clientCommission: 6500, clientCommissionRate: 5, totalAmount: 136501 })
  })
})

describe('loadEffectiveRates / bookingRates', () => {
  it('lee la fila default; sin filas → 0/0', async () => {
    m.configFindFirst.mockResolvedValue(null)
    await expect(loadEffectiveRates()).resolves.toEqual({ enabled: false, client: 0, partner: 0 })
    expect(m.configFindFirst.mock.calls[0][0]).toEqual({ where: { key: 'default' } })
  })
  it('usa la primera fila si no hay default', async () => {
    m.configFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ commissionEnabled: true, clientCommissionRate: 5, partnerCommissionRate: 10 })
    await expect(loadEffectiveRates()).resolves.toEqual({ enabled: true, client: 5, partner: 10 })
  })
  it('reserva con tasas guardadas no consulta la plataforma', async () => {
    await expect(bookingRates({ clientCommissionRate: 0, partnerCommissionRate: 0 })).resolves.toEqual({ client: 0, partner: 0, source: 'booking' })
    expect(m.configFindFirst).not.toHaveBeenCalled()
  })
  it('reserva sin tasas → efectivas actuales (apagada = 0/0)', async () => {
    m.configFindFirst.mockResolvedValue({ commissionEnabled: false, clientCommissionRate: 5, partnerCommissionRate: 10 })
    await expect(bookingRates({ clientCommissionRate: null, partnerCommissionRate: null })).resolves.toEqual({ client: 0, partner: 0, source: 'platform' })
  })
})
