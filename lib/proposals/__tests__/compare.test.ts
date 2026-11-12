import { describe, expect, it } from 'vitest'
import { buildComparison, partnerLabel, reviewPreview, verificationLabels } from '@/lib/proposals/compare'

const p = (id: string, price: number, over: Record<string, unknown> = {}, partnerOver: Record<string, unknown> = {}) => ({
  id, price, status: 'PENDING' as const,
  partner: { rating: 4.5, totalReviews: 10, completedServicesCount: 8, user: { name: `Socio ${id}` }, documents: [], ...partnerOver },
  ...over,
})

describe('buildComparison', () => {
  it('solo propuestas abiertas, mejor valor primero, con total y diferencia frente a la más barata', () => {
    const rows = buildComparison([
      p('a', 100000),
      p('b', 80000, {}, { rating: 3.0, totalReviews: 2 }),
      p('c', 90000, { status: 'REJECTED' }),
    ], 5)
    expect(rows.map((r) => r.proposal.id)).toHaveLength(2)
    expect(rows.every((r) => r.proposal.id !== 'c')).toBe(true)
    const a = rows.find((r) => r.proposal.id === 'a')!
    const b = rows.find((r) => r.proposal.id === 'b')!
    expect(a.fee).toBe(5000)
    expect(a.total).toBe(105000)
    expect(a.vsCheapest).toBe(20000)
    expect(b.vsCheapest).toBe(0)
    expect(rows.map((r) => r.position)).toEqual([1, 2])
  })

  it('con la comisión apagada no hay tarifa', () => {
    const [row] = buildComparison([p('a', 100000)], 0)
    expect(row.fee).toBe(0)
    expect(row.total).toBe(100000)
  })

  it('el mejor calificado y el más económico reciben su insignia; el buen valor va primero', () => {
    const rows = buildComparison([p('cheap', 60000, {}, { rating: 3.5, totalReviews: 4 }), p('top', 65000, {}, { rating: 4.9, totalReviews: 40, completedServicesCount: 30 })], 0)
    expect(rows[0].proposal.id).toBe('top')
    expect(rows[0].badges).toContain('best_rated')
    expect(rows.find((r) => r.proposal.id === 'cheap')!.badges).toContain('cheapest')
  })

  it('lista vacía → sin filas', () => {
    expect(buildComparison([], 5)).toEqual([])
  })
})

describe('partnerLabel y verificaciones', () => {
  it('una empresa muestra su razón social; una persona, su nombre', () => {
    expect(partnerLabel({ isCompany: true, companyName: ' Plomería SAS ', user: { name: 'Ana' } })).toBe('Plomería SAS')
    expect(partnerLabel({ isCompany: true, companyName: '', user: { name: 'Ana' } })).toBe('Ana')
    expect(partnerLabel({ isCompany: false, companyName: 'X', user: { name: 'Ana' } })).toBe('Ana')
  })

  it('solo cuentan los documentos aprobados', () => {
    expect(verificationLabels([
      { type: 'CEDULA_CIUDADANIA', status: 'APPROVED' },
      { type: 'ANTECEDENTES', status: 'PENDING' },
      { type: 'DIPLOMA_TECNICO', status: 'APPROVED' },
    ])).toEqual(['Identidad', 'Estudios'])
    expect(verificationLabels(undefined)).toEqual([])
  })
})

describe('reviewPreview', () => {
  const d = (s: string) => new Date(s)
  it('las 2 más recientes, solo el primer nombre y sin comentarios vacíos', () => {
    const out = reviewPreview([
      { clientToPartnerRating: 5, clientToPartnerComment: ' Excelente ', clientReviewedAt: d('2026-11-01'), reviewerName: 'Laura Gómez Pérez', serviceName: 'Plomería' },
      { clientToPartnerRating: 4, clientToPartnerComment: '   ', clientReviewedAt: d('2026-11-05'), reviewerName: null, serviceName: null },
      { clientToPartnerRating: 3, clientToPartnerComment: 'Regular', clientReviewedAt: d('2026-10-01'), reviewerName: 'Juan', serviceName: 'Pintura' },
      { clientToPartnerRating: null, clientToPartnerComment: 'sin calificación', clientReviewedAt: d('2026-11-09'), reviewerName: 'X', serviceName: null },
    ])
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ rating: 4, comment: null, reviewer: 'Cliente' })
    expect(out[1]).toMatchObject({ rating: 5, comment: 'Excelente', reviewer: 'Laura' })
  })
})
