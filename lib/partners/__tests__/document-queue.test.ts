import { describe, expect, it } from 'vitest'
import { pendingCountByPartner, sortReviewQueue } from '@/lib/partners/document-queue'

const doc = (id: string, status: string, day: number, partner = 'p1') => ({ id, status, createdAt: new Date(2026, 8, day).toISOString(), partner: { id: partner } })

describe('sortReviewQueue', () => {
  it('pending first, oldest first; then reviewed newest first', () => {
    const out = sortReviewQueue([
      doc('approvedOld', 'APPROVED', 1),
      doc('pendingNew', 'PENDING', 20),
      doc('rejectedNew', 'REJECTED', 25),
      doc('pendingOld', 'PENDING', 3),
    ])
    expect(out.map((d) => d.id)).toEqual(['pendingOld', 'pendingNew', 'rejectedNew', 'approvedOld'])
  })

  it('does not mutate the input', () => {
    const input = [doc('b', 'PENDING', 5), doc('a', 'PENDING', 1)]
    sortReviewQueue(input)
    expect(input.map((d) => d.id)).toEqual(['b', 'a'])
  })
})

describe('pendingCountByPartner', () => {
  it('counts only pending documents per partner', () => {
    expect(pendingCountByPartner([
      doc('1', 'PENDING', 1, 'p1'),
      doc('2', 'PENDING', 2, 'p1'),
      doc('3', 'APPROVED', 3, 'p1'),
      doc('4', 'PENDING', 4, 'p2'),
    ])).toEqual({ p1: 2, p2: 1 })
  })
})
