import { describe, expect, it } from 'vitest'
import { funnelNudgeDecision, funnelProgress, isHalfWay, isStopText, missingText, nudgeFallbackText, nudgeInstruction, type NudgeInput } from '@/lib/ai/funnel-core'
import { fitChannelLength, formatForChannel } from '@/lib/ai/format'

const now = new Date('2026-11-10T15:00:00Z')
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000)

const base = (over: Partial<NudgeInput> = {}): NudgeInput => ({
  now, channel: 'WHATSAPP', nudgeAfterHours: 3, teamOpen: true,
  lastInbound: { sentAt: hoursAgo(4), body: 'Es en Laureles' },
  lastMessage: { direction: 'OUTBOUND', senderType: 'AI' },
  alreadyNudged: false, reengaged: false, optedOut: false, undeliverable: false, requestCreated: false,
  progress: funnelProgress({ servicio: 'Plomería', direccion: 'Cra 70 #45-10, Laureles' }, null),
  ...over,
})

describe('funnelProgress · lo que la IA ya reunió', () => {
  it('lee los datos guardados con guardar_dato aunque las claves varíen', () => {
    const p = funnelProgress({ Servicio: 'Pintura', 'Dirección': 'Calle 10 # 43-20', inbox: { awaitingReply: true }, lastTemplate: 'x' }, null)
    expect(p).toMatchObject({ service: 'Pintura', address: 'Calle 10 # 43-20', when: null, proposal: false })
    expect(missingText(p)).toBe('te falta solo la fecha')
    expect(funnelProgress({ fecha_deseada: 'el sábado', tipo_de_servicio: 'Aseo' }, null)).toMatchObject({ service: 'Aseo', when: 'el sábado' })
  })

  it('una propuesta de crear_solicitud trae todo: solo falta el sí', () => {
    const p = funnelProgress({}, { servicio: 'Plomería', direccion: 'Cra 70 #45', fecha: '2026-11-12', hora: '09:00', urgente: false, detalles: 'fuga' })
    expect(p).toMatchObject({ proposal: true, when: '2026-11-12 09:00' })
    expect(missingText(p)).toBe('solo falta que me confirmes para enviarla a los socios')
    expect(funnelProgress({}, { servicio: 'Aseo', direccion: 'Cll 1', fecha: '', urgente: false }).when).toBe('sin fecha fija')
  })

  it('a mitad: servicio + dirección o fecha; solo el servicio no basta', () => {
    expect(isHalfWay(funnelProgress({ servicio: 'Aseo' }, null))).toBe(false)
    expect(isHalfWay(funnelProgress({ servicio: 'Aseo', fecha: 'mañana' }, null))).toBe(true)
    expect(missingText(funnelProgress({ servicio: 'Aseo', fecha: 'mañana' }, null))).toBe('te falta solo la dirección')
    expect(missingText(funnelProgress({ direccion: 'Cll 1 #2', fecha: 'mañana' }, null))).toBe('te falta solo el servicio')
    expect(missingText(funnelProgress({ servicio: 'x' }, null))).toBe('te faltan la dirección y la fecha')
  })
})

describe('funnelNudgeDecision · un único recordatorio, a tiempo y de día', () => {
  it('manda cuando se quedó a mitad, en silencio y dentro de la ventana', () => {
    expect(funnelNudgeDecision(base())).toEqual({ send: true, missing: 'te falta solo la fecha' })
  })

  it('nunca dos veces, ni después de un reenganche, ni de noche', () => {
    expect(funnelNudgeDecision(base({ alreadyNudged: true }))).toEqual({ send: false, reason: 'already_nudged' })
    expect(funnelNudgeDecision(base({ reengaged: true }))).toEqual({ send: false, reason: 'reengaged' })
    expect(funnelNudgeDecision(base({ teamOpen: false }))).toEqual({ send: false, reason: 'night' })
  })

  it('respeta STOP y los destinatarios que no reciben', () => {
    expect(funnelNudgeDecision(base({ optedOut: true }))).toMatchObject({ send: false, reason: 'opted_out' })
    expect(funnelNudgeDecision(base({ lastInbound: { sentAt: hoursAgo(4), body: 'STOP' } }))).toMatchObject({ reason: 'opted_out' })
    expect(isStopText('Baja.')).toBe(true)
    expect(isStopText('no, mejor el sábado')).toBe(false)
    expect(funnelNudgeDecision(base({ undeliverable: true }))).toMatchObject({ reason: 'undeliverable' })
  })

  it('espera las horas configuradas y no entra en la última media hora de la ventana de 24 h', () => {
    expect(funnelNudgeDecision(base({ lastInbound: { sentAt: hoursAgo(2), body: 'ok' } }))).toMatchObject({ reason: 'too_soon' })
    expect(funnelNudgeDecision(base({ lastInbound: { sentAt: hoursAgo(23.6), body: 'ok' } }))).toMatchObject({ reason: 'window_closing' })
    expect(funnelNudgeDecision(base({ channel: 'SMS', lastInbound: { sentAt: hoursAgo(23.6), body: 'ok' } }))).toMatchObject({ send: true })
    expect(funnelNudgeDecision(base({ channel: 'INSTAGRAM', lastInbound: { sentAt: hoursAgo(5), body: 'ok' } }))).toMatchObject({ send: true })
  })

  it('solo si la última palabra fue de la IA, y nunca si la solicitud ya existe o no hay avance', () => {
    expect(funnelNudgeDecision(base({ lastMessage: { direction: 'INBOUND', senderType: 'CONTACT' } }))).toMatchObject({ reason: 'not_waiting' })
    expect(funnelNudgeDecision(base({ lastMessage: { direction: 'OUTBOUND', senderType: 'HUMAN' } }))).toMatchObject({ reason: 'not_waiting' })
    expect(funnelNudgeDecision(base({ requestCreated: true }))).toMatchObject({ reason: 'request_created' })
    expect(funnelNudgeDecision(base({ progress: funnelProgress({ servicio: 'Aseo' }, null) }))).toMatchObject({ reason: 'not_half_way' })
    expect(funnelNudgeDecision(base({ lastInbound: null }))).toMatchObject({ reason: 'no_inbound' })
  })
})

describe('texto del recordatorio', () => {
  it('el aviso al modelo dice lo reunido y lo que falta', () => {
    const t = nudgeInstruction(funnelProgress({ servicio: 'Plomería', direccion: 'Laureles' }, null), 3)
    expect(t).toContain('3 horas')
    expect(t).toContain('servicio: Plomería; dirección: Laureles')
    expect(t).toContain('te falta solo la fecha')
  })
  it('sin modelo: un texto concreto con una sola pregunta', () => {
    expect(nudgeFallbackText(funnelProgress({ servicio: 'Plomería', direccion: 'Laureles' }, null), 'Ana María')).toBe(
      '¡Hola, Ana! Quedamos a mitad de tu solicitud de Plomería en Laureles: te falta solo la fecha para enviarla a los socios. ¿Para qué día lo necesitas?',
    )
    expect(nudgeFallbackText(funnelProgress({}, { servicio: 'Aseo', direccion: 'Cll 1', fecha: '', urgente: true }), null)).toBe(
      '¡Hola! Quedó lista tu solicitud de Aseo en Cll 1 (lo antes posible); solo falta que me confirmes para enviarla a los socios. ¿La envío?',
    )
  })
})

describe('fitChannelLength · Instagram corta a 1000 bytes', () => {
  it('no toca textos cortos ni otros canales', () => {
    expect(fitChannelLength('Hola', 'INSTAGRAM')).toBe('Hola')
    const long = 'Frase larga de prueba. '.repeat(100)
    expect(fitChannelLength(long, 'WHATSAPP')).toBe(long)
  })
  it('corta en el último párrafo o frase que cabe, contando bytes (tildes y emojis)', () => {
    const para = 'Opción con tildes: ñandú, acción, canción 😀. '.repeat(10)
    const text = `${para}\n\n${para}\n\n${para}`
    const out = formatForChannel(text, 'INSTAGRAM')
    expect(new TextEncoder().encode(out).length).toBeLessThanOrEqual(1000)
    expect(out.endsWith(' …')).toBe(true)
    expect(out.startsWith('Opción con tildes')).toBe(true)
    const messenger = fitChannelLength('a'.repeat(2500), 'MESSENGER')
    expect(Array.from(messenger).length).toBeLessThanOrEqual(2000)
  })
})
