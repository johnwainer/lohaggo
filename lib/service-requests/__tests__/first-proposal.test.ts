import { describe, expect, it } from 'vitest'
import { DEFAULT_FIRST_PROPOSAL_MIN, firstProposalDeltas, firstProposalLabel, medianFirstProposalMinutes } from '@/lib/service-requests/first-proposal'

describe('medianFirstProposalMinutes', () => {
  it('con pocas muestras devuelve el valor por defecto (7 min)', () => {
    expect(medianFirstProposalMinutes([3, 4, 5])).toBe(DEFAULT_FIRST_PROPOSAL_MIN)
    expect(DEFAULT_FIRST_PROPOSAL_MIN).toBe(7)
  })

  it('con suficientes muestras usa la mediana y no se deja arrastrar por un caso extremo', () => {
    const samples = [2, 3, 4, 5, 6, 8, 9, 10, 12, 4000]
    expect(medianFirstProposalMinutes(samples)).toBe(7)
    expect(medianFirstProposalMinutes([10, 10, 10, 10, 10, 10, 10, 10, 10, 20, 20])).toBe(10)
  })

  it('ignora valores inválidos', () => {
    expect(medianFirstProposalMinutes([NaN, -3, ...Array(10).fill(15)])).toBe(15)
  })
})

describe('firstProposalLabel', () => {
  it('redondea según el tamaño', () => {
    expect(firstProposalLabel(7)).toBe('~7 min')
    expect(firstProposalLabel(23)).toBe('~25 min')
    expect(firstProposalLabel(150)).toBe('~3 h')
    expect(firstProposalLabel(NaN)).toBe('~7 min')
  })
})

describe('firstProposalDeltas', () => {
  it('toma solo la primera propuesta de cada solicitud', () => {
    const t = (min: number) => new Date(Date.UTC(2026, 10, 12, 12, min))
    const rows = [
      { serviceRequestId: 'a', createdAt: t(5), serviceRequest: { createdAt: t(0) } },
      { serviceRequestId: 'a', createdAt: t(40), serviceRequest: { createdAt: t(0) } },
      { serviceRequestId: 'b', createdAt: t(20), serviceRequest: { createdAt: t(10) } },
    ]
    expect(firstProposalDeltas(rows)).toEqual([5, 10])
  })
})
