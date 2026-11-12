import { describe, expect, it } from 'vitest'
import { anonymizeBlockers, anonymizeRefusal } from '../anonymize'

describe('anonymize refusal', () => {
  it('allows an account with nothing active or unsettled', () => {
    expect(anonymizeRefusal(anonymizeBlockers({ activeBookings: 0, unsettledPayments: 0, unsettledPayouts: 0 }))).toBeNull()
  })
  it('explains every blocker to the admin', () => {
    const msg = anonymizeRefusal(anonymizeBlockers({ activeBookings: 2, unsettledPayments: 1, unsettledPayouts: 3 }))!
    expect(msg).toContain('2 reserva(s) activa(s)')
    expect(msg).toContain('1 pago(s) sin liquidar')
    expect(msg).toContain('3 pago(s) al socio')
  })
})
