import { describe, expect, it } from 'vitest'
import { rankProposals, trustedRating, valueScore } from '@/lib/proposals/ranking'
import { choosePrompt, compareLine, optionFromText, readProposalOptions, PROPOSAL_OPTIONS_KEY } from '@/lib/proposals/chat-compare'
import { feedbackDetails, feedbackLine, isProposalReason, parseFeedback } from '@/lib/proposals/feedback'

const p = (id: string, price: number, rating = 0, totalReviews = 0, completedServicesCount = 0, status = 'PENDING') => ({ id, price, status, partner: { rating, totalReviews, completedServicesCount } })

describe('ranking de propuestas', () => {
  it('una reseña de 5★ no le gana a muchas de 4.8★', () => {
    expect(trustedRating({ rating: 5, totalReviews: 1 })).toBeLessThan(trustedRating({ rating: 4.8, totalReviews: 40 }))
    expect(trustedRating({ rating: 0, totalReviews: 0 })).toBe(4)
  })

  it('mejor relación calidad-precio primero; las que ya no se pueden elegir al final', () => {
    const list = [p('caro-bueno', 300_000, 4.9, 30, 40), p('barato-nuevo', 100_000), p('medio-bueno', 130_000, 4.8, 12, 15), p('rechazada', 50_000, 5, 50, 50, 'REJECTED')]
    const order = rankProposals(list).map((r) => r.proposal.id)
    expect(order[0]).toBe('medio-bueno')
    expect(order.at(-1)).toBe('rechazada')
    expect(valueScore(list[2], 100_000)).toBeGreaterThan(valueScore(list[0], 100_000))
  })

  it('insignias solo con algo que comparar y con un ganador claro', () => {
    const ranked = rankProposals([p('a', 120_000, 4.9, 10), p('b', 90_000, 4.5, 3), p('c', 150_000)])
    const badges = Object.fromEntries(ranked.map((r) => [r.proposal.id, r.badges]))
    expect(badges.a).toEqual(['best_rated'])
    expect(badges.b).toEqual(['cheapest'])
    expect(badges.c).toEqual([])
    expect(rankProposals([p('solo', 100_000, 5, 9)])[0].badges).toEqual([])
    // Same price and same trusted rating: no winner, no badge
    const tie = rankProposals([p('x', 100_000, 4.8, 5), p('y', 100_000, 4.8, 5)])
    expect(tie.every((r) => r.badges.length === 0)).toBe(true)
    // Same stars: the one with more reviews is the best rated (as in the order)
    const more = Object.fromEntries(rankProposals([p('x', 100_000, 4.8, 5), p('y', 100_000, 4.8, 7)]).map((r) => [r.proposal.id, r.badges]))
    expect(more.y).toEqual(['best_rated'])
    // One 5★ review never wins over many 4.8★
    const few = Object.fromEntries(rankProposals([p('nuevo', 100_000, 5, 1), p('viejo', 110_000, 4.8, 40)]).map((r) => [r.proposal.id, r.badges]))
    expect(few.viejo).toEqual(['best_rated'])
  })

  it('las dos insignias pueden ir en la misma', () => {
    const ranked = rankProposals([p('top', 80_000, 4.9, 20), p('otra', 120_000, 4.2, 4)])
    expect(ranked[0].proposal.id).toBe('top')
    expect(ranked[0].badges).toEqual(['best_rated', 'cheapest'])
  })
})

describe('comparación en el chat', () => {
  it('línea compacta con lo que importa', () => {
    const line = compareLine({ n: 1, ref: 'abc123', partnerName: 'Darwin', price: '$130.000', rating: 4.8, reviews: 12, jobs: 15, zone: 'El Poblado', when: 'sáb 15 nov 09:00', badges: ['best_rated'] })
    expect(line).toBe('1) Darwin · $130.000 · 4.8★ (12 reseñas) · 15 servicios hechos · cubre El Poblado · propone sáb 15 nov 09:00 · Mejor calificado [ref abc123]')
    expect(compareLine({ n: 2, ref: 'x', partnerName: 'Ana', price: '$90.000', rating: 0, reviews: 0, jobs: 1, zone: null, when: null, badges: [] })).toMatch(/nuevo, sin reseñas · 1 servicio hecho · fecha: la de la solicitud/)
  })

  it('frase para elegir', () => {
    expect(choosePrompt(3)).toBe('Responde 1, 2 o 3 para elegir')
    expect(choosePrompt(2)).toBe('Responde 1 o 2 para elegir')
    expect(choosePrompt(1)).toBe('Responde 1 para elegirla')
  })

  it('lee la elección de la persona', () => {
    expect(optionFromText('2', 3)).toBe(2)
    expect(optionFromText('La 2 por favor', 3)).toBe(2)
    expect(optionFromText('opción dos', 3)).toBe(2)
    expect(optionFromText('me quedo con la segunda', 3)).toBe(2)
    expect(optionFromText('quiero la primera', 3)).toBe(1)
    expect(optionFromText('4', 3)).toBeNull()
    expect(optionFromText('la 2 no', 3)).toBeNull()
    expect(optionFromText('¿la 2 incluye materiales?', 3)).toBeNull()
    expect(optionFromText('la 1 o la 2', 3)).toBeNull()
    expect(optionFromText('sí', 3)).toBeNull()
    expect(optionFromText('a las 2 pm', 3)).toBeNull()
  })

  it('la numeración guardada vence a las 48 h', () => {
    const at = '2026-11-09T12:00:00.000Z'
    const fields = { otra: 1, [PROPOSAL_OPTIONS_KEY]: { at, items: [{ n: 1, id: 'p1', requestId: 'r1', label: 'Darwin · $1' }, { bad: true }] } }
    expect(readProposalOptions(fields, new Date('2026-11-10T12:00:00Z'))?.items).toEqual([{ n: 1, id: 'p1', requestId: 'r1', label: 'Darwin · $1' }])
    expect(readProposalOptions(fields, new Date('2026-11-11T12:00:01Z'))).toBeNull()
    expect(readProposalOptions(null)).toBeNull()
  })
})

describe('motivo de rechazo', () => {
  it('se guarda y se lee', () => {
    const d = feedbackDetails({ reason: 'precio_alto', detail: '  me cobraban el doble ', kind: 'rejected', proposalIds: ['p1'], source: 'app' })
    const f = parseFeedback(d)
    expect(f).toEqual({ reason: 'precio_alto', detail: 'me cobraban el doble', kind: 'rejected', proposalIds: ['p1'], source: 'app' })
    expect(feedbackLine(f!)).toBe('Precio alto: me cobraban el doble')
    expect(parseFeedback('{"reason":"inventado"}')).toBeNull()
    expect(parseFeedback('no json')).toBeNull()
    expect(isProposalReason('sin_motivo')).toBe(true)
    expect(isProposalReason('x')).toBe(false)
  })
})
