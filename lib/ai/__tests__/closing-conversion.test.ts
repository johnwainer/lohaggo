/**
 * Conversations that end in a booking: prompt rules that help closing, goal-oriented follow-ups, the
 * memory that covers older turns, the consolidated proposals message and the partner who cannot come.
 */
import { describe, expect, it } from 'vitest'
import { buildSystem } from '@/lib/ai/prompt'
import { historyTake } from '@/lib/ai/runtime-core'
import { cop } from '@/lib/ai/actions-core'
import { funnelProgress, pendingProposalsText, reengageInstruction, secondFollowupDecision, type SecondFollowupInput } from '@/lib/ai/funnel-core'
import { buildDigest, chatWindowOpen, digestDecision, readDigestState, DIGEST_GAP_MS, type DigestProposal } from '@/lib/proposals/chat-digest-core'
import { partnerUnavailableSignal, unavailableClientText } from '@/lib/bookings/partner-unavailable-core'

const agent = { name: 'Sofía', goal: 'Agendar servicios', instructions: '', tone: 'Cercano', language: 'auto', handoffOnUnknown: false, ignoreSpam: false, signatureMode: 'off', signatureText: null }
const ctx = {
  knowledge: { mode: 'none' as const, chunks: [] }, nowText: 'martes 11 de noviembre de 2026, 10:00', timezone: 'America/Bogota', channel: 'WHATSAPP',
  contact: { name: 'Ana', tags: [], fields: {}, linkedUser: false }, summary: null,
  toolGuidance: '- crear_solicitud: crea la solicitud.',
}
const rules = () => buildSystem(agent, ctx).map((b) => b.text).join('\n')

describe('prompt: reglas que ayudan a cerrar', () => {
  it('pide juntos los datos que faltan de una solicitud, sin «una cosa a la vez»', () => {
    const t = rules()
    expect(t).not.toContain('Una sola pregunta por mensaje')
    expect(t).not.toContain('una cosa a la vez')
    expect(t).toContain('pídelos juntos en un solo mensaje corto')
  })
  it('las dudas de precio o de elección las resuelve el agente; traspaso solo por disputa, queja seria o pedido', () => {
    const t = rules()
    expect(t).not.toContain('si la persona duda, ofrece que una persona')
    expect(t).toContain('Si la persona duda por el precio o no sabe qué propuesta elegir, ayúdala tú')
    expect(t).toContain('Solo traspasa a una persona')
  })
  it('sin cuenta: primero los datos del servicio, y en WhatsApp nunca espera un código', () => {
    const t = rules()
    expect(t).not.toContain('primero vincúlala')
    expect(t).toContain('En WhatsApp una solicitud nunca espera un código')
    expect(t).toContain('reúne primero los datos')
  })
  it('lo que dice que hizo coincide con el resultado de las herramientas del turno', () => {
    expect(rules()).toContain('nunca «no he enviado nada»')
  })
  it('mantiene las reglas duras: no inventar y confirmar antes de actuar', () => {
    const t = rules()
    expect(t).toContain('No inventes pedidos, precios, plazos')
    expect(t).toContain('Solo con un sí claro llamas la herramienta con confirmado: true')
  })
})

describe('memoria: la ventana más lo que el resumen aún no cubre', () => {
  it('lee los mensajes que salieron de la ventana y no están resumidos', () => {
    expect(historyTake(10, 40, 0)).toBe(40)
    expect(historyTake(50, 40, 5)).toBe(45) // 45 sin resumir
    expect(historyTake(200, 40, 150)).toBe(50)
    expect(historyTake(500, 40, 0)).toBe(60) // tope: ventana y media (se resume el resto)
    expect(historyTake(60, 40, 20)).toBe(40) // el resumen cubre lo de fuera
  })
})

describe('seguimiento con objetivo', () => {
  const pending = [{ requestRef: 'abc123', service: 'Plomería', count: 2, minPrice: 120000 }]
  it('con propuestas sin responder recuerda cuántas y el precio más bajo, con datos reales', () => {
    const t = reengageInstruction({ hours: 3, pending, progress: null, second: false, money: cop })
    expect(pendingProposalsText(pending, cop)).toMatch(/^2 propuestas para Plomería, desde \$\s?120\.000 \(solicitud ref abc123\)$/)
    expect(t).toContain('Tiene propuestas sin responder: 2 propuestas para Plomería')
    expect(t).toContain('estas cifras exactas')
    expect(t).not.toContain('segundo')
  })
  it('una solicitud a medias dice exactamente qué falta', () => {
    const t = reengageInstruction({ hours: 3, pending: [], progress: funnelProgress({ servicio: 'Pintura', barrio: 'Laureles' }, null), second: false, money: cop })
    expect(t).toContain('te falta solo la fecha')
  })
  it('el segundo seguimiento se anuncia como el último', () => {
    expect(reengageInstruction({ hours: 21, pending, progress: null, second: true, money: cop })).toContain('segundo y último')
  })

  const now = new Date('2026-11-11T16:00:00Z')
  const h = (n: number) => new Date(now.getTime() - n * 3600_000)
  const base = (o: Partial<SecondFollowupInput> = {}): SecondFollowupInput => ({
    now, channel: 'WHATSAPP', teamOpen: true, optedOut: false, lastInbound: { sentAt: h(21), body: 'ok déjame ver' },
    lastMessage: { direction: 'OUTBOUND', senderType: 'AI' }, reengagedAt: h(15), alreadySecond: false, pendingCount: 2, ...o,
  })
  it('segundo seguimiento: solo con propuestas pendientes, dentro de la ventana, de día y una vez', () => {
    expect(secondFollowupDecision(base())).toEqual({ send: true })
    expect(secondFollowupDecision(base({ pendingCount: 0 }))).toMatchObject({ send: false, reason: 'no_pending_proposals' })
    expect(secondFollowupDecision(base({ lastInbound: { sentAt: h(23.8), body: 'ok' } }))).toMatchObject({ send: false, reason: 'window_closing' })
    expect(secondFollowupDecision(base({ lastInbound: { sentAt: h(10), body: 'ok' } }))).toMatchObject({ send: false, reason: 'too_soon' })
    expect(secondFollowupDecision(base({ reengagedAt: h(2) }))).toMatchObject({ send: false, reason: 'too_close_to_first' })
    expect(secondFollowupDecision(base({ teamOpen: false }))).toMatchObject({ send: false, reason: 'night' })
    expect(secondFollowupDecision(base({ alreadySecond: true }))).toMatchObject({ send: false, reason: 'already_sent' })
    expect(secondFollowupDecision(base({ lastInbound: { sentAt: h(21), body: 'STOP' } }))).toMatchObject({ send: false, reason: 'opted_out' })
    expect(secondFollowupDecision(base({ lastMessage: { direction: 'INBOUND', senderType: 'CONTACT' } }))).toMatchObject({ send: false, reason: 'not_waiting' })
    expect(secondFollowupDecision(base({ reengagedAt: null }))).toMatchObject({ send: false, reason: 'no_first' })
  })
})

describe('propuestas en el chat: un solo mensaje comparable', () => {
  const now = new Date('2026-11-11T16:00:00Z')
  const prop = (id: string, price: number, rating: number, reviews: number, name: string): DigestProposal => ({
    id, price, status: 'PENDING', partner: { rating, totalReviews: reviews, completedServicesCount: reviews }, partnerName: name, when: null,
  })
  it('decide: enviar, esperar la actualización o nada nuevo', () => {
    expect(digestDecision(null, [], now)).toBe('nothing')
    expect(digestDecision(null, ['a'], now)).toBe('send')
    expect(digestDecision({ at: new Date(now.getTime() - 5 * 60_000).toISOString(), ids: ['a'] }, ['a', 'b'], now)).toBe('wait')
    expect(digestDecision({ at: new Date(now.getTime() - DIGEST_GAP_MS - 1).toISOString(), ids: ['a'] }, ['a', 'b'], now)).toBe('send')
    expect(digestDecision({ at: now.toISOString(), ids: ['a', 'b'] }, ['b'], now)).toBe('nothing')
  })
  it('lista ordenada por relación calidad-precio, numerada para elegir, sin referencias', () => {
    const { text, options } = buildDigest({ kind: 'new', service: 'Plomería', requestId: 'req1', proposals: [prop('p1', 200000, 4.9, 30, 'Darwin'), prop('p2', 120000, 4.8, 12, 'Luis')] })
    expect(text).toContain('Ya tienes 2 propuestas para Plomería')
    expect(text).toContain('1) ')
    expect(text).toContain('2) ')
    expect(text).toContain('Responde 1 o 2 para elegir')
    expect(text).not.toContain('[ref')
    expect(options.map((o) => o.n)).toEqual([1, 2])
    expect(options.every((o) => o.requestId === 'req1')).toBe(true)
  })
  it('cuando el socio cancela, ofrece las otras propuestas de la solicitud', () => {
    const withOthers = buildDigest({ kind: 'partner_cancelled', service: 'Pintura', requestId: 'r', partnerName: 'Pedro Gómez', proposals: [prop('p3', 150000, 4.5, 5, 'Ana')] })
    expect(withOthers.text).toContain('Pedro canceló tu reserva de Pintura')
    expect(withOthers.text).toContain('1) Ana')
    expect(withOthers.text).toContain('Responde 1 para elegirla')
    const none = buildDigest({ kind: 'partner_cancelled', service: 'Pintura', requestId: 'r', partnerName: 'Pedro', proposals: [] })
    expect(none.text).toContain('volvió a abrirse')
    expect(none.options).toEqual([])
  })
  it('solo en la ventana de 24 h (con margen) y en canales con ventana', () => {
    expect(chatWindowOpen('WHATSAPP', new Date(now.getTime() - 3600_000), now)).toBe(true)
    expect(chatWindowOpen('WHATSAPP', new Date(now.getTime() - 23.9 * 3600_000), now)).toBe(false)
    expect(chatWindowOpen('SMS', new Date(now.getTime() - 3600_000), now)).toBe(false)
    expect(chatWindowOpen('WHATSAPP', null, now)).toBe(false)
  })
  it('lee el estado guardado e ignora basura', () => {
    expect(readDigestState({ proposalDigest: { r1: { at: 'x', ids: ['a', 3] }, r2: 'bad' } })).toEqual({ r1: { at: 'x', ids: ['a'] } })
    expect(readDigestState(null)).toEqual({})
  })
})

describe('socio que no puede ir, está en otra ciudad o llega tarde', () => {
  it('detecta los avisos reales', () => {
    expect(partnerUnavailableSignal('Hola, qué pena, no voy a poder ir mañana')).toBe('cannot')
    expect(partnerUnavailableSignal('Me salió una emergencia familiar')).toBe('cannot')
    expect(partnerUnavailableSignal('Tengo que cancelar la cita')).toBe('cannot')
    expect(partnerUnavailableSignal('Estoy de viaje, no podré ir')).toBe('other_city')
    expect(partnerUnavailableSignal('ando fuera de la ciudad hasta el lunes')).toBe('other_city')
    expect(partnerUnavailableSignal('Voy a llegar un poco tarde, hay trancón')).toBe('late')
    expect(partnerUnavailableSignal('me retrasé, llego en 30 min')).toBe('late')
  })
  it('no confunde mensajes normales', () => {
    expect(partnerUnavailableSignal('Listo, mañana a las 9 estoy allá')).toBeNull()
    expect(partnerUnavailableSignal('No voy a llegar tarde, tranquilo')).toBeNull()
    expect(partnerUnavailableSignal('¿Puedo ir a las 10 en vez de las 9?')).toBeNull()
    expect(partnerUnavailableSignal('No puedo bajar el precio, son 150.000')).toBeNull()
    expect(partnerUnavailableSignal('')).toBeNull()
  })
  it('al cliente: qué pasa y sus opciones, con las otras propuestas reales', () => {
    const t = unavailableClientText({ kind: 'cannot', partnerName: 'Darwin Pérez', service: 'Plomería', when: 'sáb 15 nov, 9:00 a. m.', others: { count: 2, minPrice: 120000 } })
    expect(t).toContain('Darwin nos avisó que no podrá atender tu servicio de Plomería')
    expect(t).toMatch(/2 propuestas más \(desde \$\s?120\.000\)/)
    expect(t).toContain('¿Prefieres esperar')
    const late = unavailableClientText({ kind: 'late', partnerName: null, service: 'Pintura', when: null, others: { count: 0, minPrice: null } })
    expect(late).toContain('Tu socio nos avisó que va a llegar tarde a tu servicio de Pintura')
    expect(late).not.toContain('propuesta')
  })
})
