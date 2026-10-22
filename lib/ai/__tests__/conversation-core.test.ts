import { describe, expect, it } from 'vitest'
import {
  INACTIVITY_CLOSE_MS,
  dedupeReply,
  inactivityCloseDecision,
  isGibberish,
  isRepeatedGibberish,
  isUndeliverableError,
  parseRelayNotice,
  relayContextText,
  similarity,
  type InactivityInput,
} from '@/lib/ai/conversation-core'

const now = new Date('2026-10-21T15:00:00Z')
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000)

function conv(over: Partial<InactivityInput> = {}): InactivityInput {
  return {
    status: 'OPEN', aiHandled: true, assignedToId: null, aiHandoffAt: null, isTest: false,
    lastMessage: { direction: 'OUTBOUND', senderType: 'AI', sentAt: hoursAgo(25) },
    pendingActions: 0, waitingAfterHours: false,
    ...over,
  }
}

describe('inactivityCloseDecision (cierre por inactividad)', () => {
  it('cierra cuando el agente habló último hace más de 24 h y no queda nada pendiente', () => {
    expect(inactivityCloseDecision(conv(), now)).toEqual({ close: true })
  })
  it('justo antes de 24 h no cierra', () => {
    expect(inactivityCloseDecision(conv({ lastMessage: { direction: 'OUTBOUND', senderType: 'AI', sentAt: new Date(now.getTime() - INACTIVITY_CLOSE_MS + 60_000) } }), now)).toEqual({ close: false, why: 'too_recent' })
  })
  it('si el contacto escribió último, no cierra (le debemos respuesta)', () => {
    expect(inactivityCloseDecision(conv({ lastMessage: { direction: 'INBOUND', senderType: null, sentAt: hoursAgo(30) } }), now)).toMatchObject({ close: false, why: 'contact_spoke_last' })
  })
  it('si una persona del equipo escribió último, no cierra', () => {
    expect(inactivityCloseDecision(conv({ lastMessage: { direction: 'OUTBOUND', senderType: 'HUMAN', sentAt: hoursAgo(30) } }), now).close).toBe(false)
  })
  it('con acciones esperando el sí o la aprobación, no cierra', () => {
    expect(inactivityCloseDecision(conv({ pendingActions: 1 }), now)).toMatchObject({ why: 'pending_actions' })
  })
  it('con una persona a cargo, traspasada, de prueba, ya cerrada o sin IA, no cierra', () => {
    expect(inactivityCloseDecision(conv({ assignedToId: 'u1' }), now).close).toBe(false)
    expect(inactivityCloseDecision(conv({ aiHandoffAt: hoursAgo(26) }), now).close).toBe(false)
    expect(inactivityCloseDecision(conv({ isTest: true }), now).close).toBe(false)
    expect(inactivityCloseDecision(conv({ status: 'RESOLVED' }), now).close).toBe(false)
    expect(inactivityCloseDecision(conv({ aiHandled: false }), now).close).toBe(false)
    expect(inactivityCloseDecision(conv({ waitingAfterHours: true }), now).close).toBe(false)
  })
})

describe('dedupeReply (mensajes repetidos)', () => {
  it('no envía un mensaje casi idéntico al último del agente', () => {
    const prev = ['Listo, tu solicitud quedó creada. Cualquier cosa que necesites, aquí estoy.']
    expect(dedupeReply('Listo, tu solicitud quedó creada. ¡Cualquier cosa que necesites, aquí estoy!', prev)).toEqual({ text: '', dropped: 'duplicate' })
  })
  it('recorta la despedida repetida y deja lo nuevo', () => {
    const prev = ['Te confirmo la cita. Cualquier cosa que necesites, aquí estoy.']
    const r = dedupeReply('Pablo llega a las 11:00. Cualquier cosa que necesites, aquí estoy.', prev)
    expect(r).toEqual({ text: 'Pablo llega a las 11:00.', dropped: 'boilerplate' })
  })
  it('recorta solo la cláusula de cierre dentro de una frase', () => {
    const prev = ['Hola. Quedo atento a lo que necesites.']
    expect(dedupeReply('Listo, quedó enviada tu propuesta, cualquier duda me dices.', prev)).toEqual({ text: 'Listo, quedó enviada tu propuesta.', dropped: 'boilerplate' })
  })
  it('si solo era la despedida repetida, no envía nada', () => {
    expect(dedupeReply('Cualquier cosa que necesites, aquí estoy.', ['Hecho. Cualquier cosa que necesites, aquí estoy.']).text).toBe('')
  })
  it('la primera despedida sí se envía y un mensaje distinto pasa intacto', () => {
    expect(dedupeReply('Listo. Cualquier cosa, aquí estoy.', ['¿Para qué día lo necesitas?'])).toEqual({ text: 'Listo. Cualquier cosa, aquí estoy.', dropped: 'none' })
    expect(dedupeReply('¿A qué hora te queda bien?', ['¿Para qué día lo necesitas?']).dropped).toBe('none')
    expect(dedupeReply('Hola', [])).toEqual({ text: 'Hola', dropped: 'none' })
  })
  it('similarity: 1 para el mismo texto, bajo para textos distintos', () => {
    expect(similarity('Hola, ¿cómo estás?', 'hola como estas')).toBe(1)
    expect(similarity('Tu reserva es el lunes', 'El socio no llegó a la cita')).toBeLessThan(0.3)
  })
})

describe('spam evidente', () => {
  it('texto sin sentido repetido es spam', () => {
    expect(isGibberish('asdfghjk qwrtzx')).toBe(true)
    expect(isRepeatedGibberish(['hola', 'kdjfhskdjfh', 'kdjfhskdjfh', 'kdjfhskdjfh'])).toBe(true)
    expect(isRepeatedGibberish(['.....???', '.....???', '.....???'])).toBe(true)
  })
  it('una persona que repite «hola» o escribe corto no es spam', () => {
    expect(isRepeatedGibberish(['hola', 'hola', 'hola'])).toBe(false)
    expect(isRepeatedGibberish(['?', '?', '?'])).toBe(false)
    expect(isRepeatedGibberish(['👍', '👍', '👍'])).toBe(false)
    expect(isRepeatedGibberish(['necesito un plomero', 'urgente', 'por favor'])).toBe(false)
    expect(isGibberish('Necesito pintar mi apartamento en Envigado')).toBe(false)
  })
})

describe('isUndeliverableError', () => {
  it('reconoce números inválidos y destinatarios inalcanzables', () => {
    expect(isUndeliverableError("Twilio 21211: Invalid 'To' Phone Number")).toBe(true)
    expect(isUndeliverableError('63003: Channel could not find To address')).toBe(true)
    expect(isUndeliverableError('(#551) This person isn\'t available right now.')).toBe(true)
  })
  it('un fallo pasajero no lo es', () => {
    expect(isUndeliverableError('fetch failed: ETIMEDOUT')).toBe(false)
    expect(isUndeliverableError('Fuera de la ventana de 24 h')).toBe(false)
    expect(isUndeliverableError(null)).toBe(false)
  })
})

describe('relevo pendiente', () => {
  const body = '💬 Pablo (tu socio) te escribió sobre Pintura · ref abc123:\n\n«Llego a las 11, ¿me abre el portero?»\n\nEs un mensaje de tu socio, no de LoHaggo: nunca te pediremos pagos ni datos por un enlace suyo. Si quieres responderle, escríbelo aquí y se lo hago llegar.'
  it('lee el aviso de relevo que le llegó a la persona', () => {
    expect(parseRelayNotice(body)).toEqual({ from: 'Pablo', who: 'socio', service: 'Pintura', ref: 'abc123', text: 'Llego a las 11, ¿me abre el portero?' })
    expect(parseRelayNotice('Hola, ¿en qué te ayudo?')).toBeNull()
  })
  it('el contexto dice a quién va la respuesta y qué mensaje está pendiente, sin volver a preguntar', () => {
    const t = relayContextText({
      lastNotice: { ...parseRelayNotice(body)!, minutesAgo: 3 },
      pendingMessage: { recipient: 'el socio Pablo', ref: 'abc123', text: 'Sí, el portero le abre', minutesAgo: 1 },
    })
    expect(t).toContain('ref abc123')
    expect(t).toContain('«Sí, el portero le abre»')
    expect(t).toContain('nunca le preguntes qué mensaje quiere enviar')
    expect(relayContextText({ lastNotice: null, pendingMessage: null })).toBe('')
  })
})
