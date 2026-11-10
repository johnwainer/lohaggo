/**
 * Half-way requests, the pure part: a contact who started asking the AI for a service (it saved the service
 * and the address or the date, or proposed crear_solicitud) and went quiet before the request existed gets
 * ONE friendly reminder that says what is missing. This is the funnel-aware form of the agent's re-engagement
 * (lib/ai/autopilot.ts runReengagement): same «one follow-up per silence» stamp (reengagedAt), same aux budget.
 */
import { normalizeText } from '@/lib/ai/runtime-core'

export const FUNNEL_NUDGE_EVENT = 'funnel_nudge'
const DAY_MS = 24 * 3600_000
/** Margin before the 24 h window closes: a nudge never goes out in its last half hour */
const WINDOW_MARGIN_MS = 30 * 60_000
const WINDOW_CHANNELS = new Set(['WHATSAPP', 'MESSENGER', 'INSTAGRAM'])
export const FUNNEL_CHANNELS = ['WHATSAPP', 'SMS', 'MESSENGER', 'INSTAGRAM']

export type FunnelProgress = {
  service: string | null
  address: string | null
  when: string | null
  details: string | null
  /** The agent proposed crear_solicitud with everything: only the person's yes is missing */
  proposal: boolean
}

const KEY_PATTERNS: Array<[keyof Omit<FunnelProgress, 'proposal'>, RegExp]> = [
  ['service', /^(servicio|tipo de servicio|trabajo|necesita|necesidad|servicio solicitado)/],
  ['address', /^(direccion|barrio|ubicacion|zona|sector|domicilio)/],
  ['when', /^(fecha|cuando|dia|hora|horario|fecha deseada|fecha preferida)/],
  ['details', /^(detalle|descripcion|que necesita)/],
]

const clean = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v).replace(/\s+/g, ' ').trim().slice(0, 120) : '')

/**
 * What the agent collected: the crear_solicitud it proposed (complete by construction) or, without one, the
 * values it saved with guardar_dato («servicio», «dirección», «fecha»…; the keys are free text).
 */
export function funnelProgress(fields: Record<string, unknown> | null | undefined, proposalInput: Record<string, unknown> | null | undefined): FunnelProgress {
  const p: FunnelProgress = { service: null, address: null, when: null, details: null, proposal: false }
  if (proposalInput && clean(proposalInput.servicio) && clean(proposalInput.direccion)) {
    const fecha = clean(proposalInput.fecha)
    const hora = clean(proposalInput.hora)
    return {
      service: clean(proposalInput.servicio),
      address: clean(proposalInput.direccion),
      when: proposalInput.urgente ? 'lo antes posible' : fecha ? `${fecha}${hora ? ` ${hora}` : ''}` : 'sin fecha fija',
      details: clean(proposalInput.detalles) || null,
      proposal: true,
    }
  }
  for (const [rawKey, value] of Object.entries(fields ?? {})) {
    const v = clean(value)
    if (!v) continue
    const key = normalizeText(rawKey).replace(/[_-]+/g, ' ')
    for (const [slot, re] of KEY_PATTERNS) {
      if (!p[slot] && re.test(key)) {
        p[slot] = v
        break
      }
    }
  }
  return p
}

/** Far enough to be worth a reminder: the service plus where or when, or a full proposal. */
export function isHalfWay(p: FunnelProgress) {
  return p.proposal || Boolean(p.service && (p.address || p.when))
}

export function missingParts(p: FunnelProgress): string[] {
  if (p.proposal) return []
  const out: string[] = []
  if (!p.service) out.push('el servicio')
  if (!p.address) out.push('la dirección')
  if (!p.when) out.push('la fecha')
  return out
}

/** «te falta solo la fecha» · «te faltan la dirección y la fecha» · «solo falta que me confirmes» */
export function missingText(p: FunnelProgress) {
  const parts = missingParts(p)
  if (!parts.length) return 'solo falta que me confirmes para enviarla a los socios'
  if (parts.length === 1) return `te falta solo ${parts[0]}`
  return `te faltan ${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`
}

export function collectedText(p: FunnelProgress) {
  return [p.service && `servicio: ${p.service}`, p.address && `dirección: ${p.address}`, p.when && `cuándo: ${p.when}`, p.details && `detalles: ${p.details}`].filter(Boolean).join('; ')
}

const STOP_RE = /^(stop|baja|darme de baja|unsubscribe|no me escriban( mas)?|no quiero (mas )?mensajes)$/

/** The contact asked us to stop writing (the channel's opt-out list is checked apart). */
export function isStopText(body: string | null | undefined) {
  return STOP_RE.test(normalizeText(body ?? '').replace(/[.!¡]+/g, '').trim())
}

export type NudgeInput = {
  now: Date
  channel: string
  nudgeAfterHours: number
  teamOpen: boolean
  lastInbound: { sentAt: Date; body: string } | null
  /** Last message the contact saw (not internal) */
  lastMessage: { direction: string; senderType: string | null } | null
  alreadyNudged: boolean
  /** Someone (re-engagement) already followed up after the contact's last message */
  reengaged: boolean
  optedOut: boolean
  undeliverable: boolean
  requestCreated: boolean
  progress: FunnelProgress
}

export type NudgeDecision =
  | { send: true; missing: string }
  | { send: false; reason: 'night' | 'already_nudged' | 'reengaged' | 'opted_out' | 'undeliverable' | 'no_inbound' | 'not_waiting' | 'too_soon' | 'window_closing' | 'request_created' | 'not_half_way' }

/** Every exit is negative except the last: when in doubt, no reminder. */
export function funnelNudgeDecision(i: NudgeInput): NudgeDecision {
  if (i.alreadyNudged) return { send: false, reason: 'already_nudged' }
  if (i.reengaged) return { send: false, reason: 'reengaged' }
  if (i.optedOut || isStopText(i.lastInbound?.body)) return { send: false, reason: 'opted_out' }
  if (i.undeliverable) return { send: false, reason: 'undeliverable' }
  if (!i.lastInbound) return { send: false, reason: 'no_inbound' }
  // We are waiting for the contact: the last word was the agent's
  if (!i.lastMessage || i.lastMessage.direction !== 'OUTBOUND' || i.lastMessage.senderType !== 'AI') return { send: false, reason: 'not_waiting' }
  const silent = i.now.getTime() - i.lastInbound.sentAt.getTime()
  if (silent < i.nudgeAfterHours * 3600_000) return { send: false, reason: 'too_soon' }
  const windowLimit = WINDOW_CHANNELS.has(i.channel) ? DAY_MS - WINDOW_MARGIN_MS : DAY_MS
  if (silent >= windowLimit) return { send: false, reason: 'window_closing' }
  if (!i.teamOpen) return { send: false, reason: 'night' }
  if (i.requestCreated) return { send: false, reason: 'request_created' }
  if (!isHalfWay(i.progress)) return { send: false, reason: 'not_half_way' }
  return { send: true, missing: missingText(i.progress) }
}

/** The internal notice the agent writes the reminder from (it also reads the conversation). */
export function nudgeInstruction(p: FunnelProgress, hours: number) {
  return [
    `[Aviso interno de la plataforma, no lo escribió el cliente] El cliente empezó a pedir un servicio contigo y no responde desde hace ${hours} horas; la solicitud todavía no se creó.`,
    `Lo que ya te dio: ${collectedText(p) || 'nada concreto'}. Lo que falta: ${missingText(p)}.`,
    'Escribe un único mensaje breve y amable para retomarlo donde quedó: recuérdale en una frase lo que ya tienes y dile exactamente qué falta (por ejemplo, «te falta solo la fecha»), con una pregunta fácil de responder. Sin presionar, sin inventar precios ni disponibilidad, sin repetir lo que ya le preguntaste palabra por palabra.',
    p.proposal ? 'Si responde que sí, crea la solicitud con los mismos datos.' : '',
  ].filter(Boolean).join(' ')
}

/** The reminder when the model is not available: plain, specific, one question. */
export function nudgeFallbackText(p: FunnelProgress, firstName?: string | null) {
  const name = firstName?.trim().split(/\s+/)[0]
  const hello = name ? `¡Hola, ${name}!` : '¡Hola!'
  const what = p.service ? `tu solicitud de ${p.service}${p.address ? ` en ${p.address}` : ''}` : 'tu solicitud'
  const missing = missingParts(p)
  if (!missing.length) return `${hello} Quedó lista ${what}${p.when ? ` (${p.when})` : ''}; solo falta que me confirmes para enviarla a los socios. ¿La envío?`
  const ask: Record<string, string> = { 'el servicio': '¿Qué servicio necesitas?', 'la dirección': '¿En qué dirección y barrio sería?', 'la fecha': '¿Para qué día lo necesitas?' }
  return `${hello} Quedamos a mitad de ${what}: ${missingText(p)} para enviarla a los socios. ${ask[missing[0]]}`
}
