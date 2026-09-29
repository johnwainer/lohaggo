/**
 * WhatsApp templates, pure helpers: how values are written in the variables (first names, prices in es-CO,
 * dates and hours in Bogotá), when MARKETING may go out, the quick-reply buttons a person pressed and the
 * context line the inbox AI agent reads about the last template. No server imports.
 */

const BOGOTA = 'America/Bogota'

export type WaRole = 'CLIENT' | 'PARTNER' | 'ADMIN'

/** «Ana María Pérez» → «Ana». Falls back to a neutral word so «Hola {{1}},» still reads well. */
export function firstName(name: string | null | undefined, role: WaRole = 'CLIENT'): string {
  const first = String(name ?? '').trim().split(/\s+/)[0]?.replace(/[0-9_.,;:!?¡¿()"@#$%&*+=<>[\]{}|\\/]/g, '') ?? ''
  if (first) return first.charAt(0).toUpperCase() + first.slice(1)
  return role === 'PARTNER' ? 'socio' : role === 'ADMIN' ? 'equipo' : 'cliente'
}

const MONEY = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })
/** 120000 → «$120.000» */
export const waMoney = (n: number | null | undefined) => `$${MONEY.format(Math.round(Number(n) || 0))}`

function bogotaParts(d: Date) {
  const parts = new Intl.DateTimeFormat('es-CO', { timeZone: BOGOTA, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value.replace(/\./g, '').trim() ?? ''
  return { weekday: get('weekday').toLowerCase(), day: get('day'), month: get('month').toLowerCase(), hour: Number(get('hour')), minute: get('minute') }
}

/** «vie 3 oct» (Bogotá) */
export function waDay(d: Date): string {
  const p = bogotaParts(d)
  return `${p.weekday} ${p.day} ${p.month}`
}

/** «10:00 a. m.» / «3:30 p. m.» (Bogotá) */
export function waTime(d: Date): string {
  const p = bogotaParts(d)
  const h = p.hour % 12 || 12
  return `${h}:${p.minute.padStart(2, '0')} ${p.hour < 12 ? 'a. m.' : 'p. m.'}`
}

/** «vie 3 oct, 10:00 a. m.» (Bogotá) */
export const waWhen = (d: Date) => `${waDay(d)}, ${waTime(d)}`

/** «2 horas», «45 minutos», «1 hora» */
export function waDuration(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000))
  if (min < 60) return `${min} ${min === 1 ? 'minuto' : 'minutos'}`
  const h = Math.round(min / 60)
  if (h < 48) return `${h} ${h === 1 ? 'hora' : 'horas'}`
  const days = Math.round(h / 24)
  return `${days} días`
}

export const CITY_LABEL: Record<string, string> = { MEDELLIN: 'Medellín', BOGOTA: 'Bogotá', CALI: 'Cali', BARRANQUILLA: 'Barranquilla' }
export const cityLabel = (city: string | null | undefined) => CITY_LABEL[String(city ?? '')] ?? (String(city ?? '').charAt(0) + String(city ?? '').slice(1).toLowerCase() || 'tu ciudad')

/**
 * The zone a partner is told about: the neighbourhood when the address ends in one («Cra 70 # 44-10,
 * Laureles» → «Laureles»), else the city. Never the street address (the message goes to many partners).
 */
export function waZone(address: string | null | undefined, city: string | null | undefined): string {
  const parts = String(address ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const last = parts.length > 1 ? parts[parts.length - 1] : ''
  const isNeighbourhood = last && !/\d/.test(last) && last.length >= 3 && last.length <= 30 && !/^(apto|apartamento|casa|torre|piso|int|interior|bloque)\b/i.test(last)
  const cityName = cityLabel(city)
  if (isNeighbourhood && last.toLowerCase() !== cityName.toLowerCase()) return last
  return cityName
}

/** Last 6 characters of an id, upper-case, as the app and the agent show references. */
export const waRef = (id: string) => id.slice(-6).toUpperCase()

/** A URL suffix for «https://www.lohaggo.com/{{n}}»: path + query of an app URL or path, without the leading slash. */
export function urlSuffix(pathOrUrl: string): string {
  const s = String(pathOrUrl || '').trim()
  const noHost = s.replace(/^https?:\/\/[^/]+/i, '')
  return noHost.replace(/^\/+/, '') || 'dashboard'
}

// ─── Marketing hours ────────────────────────────────────────────────────────

/** MARKETING templates do not go out between 9 p. m. and 8 a. m. in Bogotá. */
export function isMarketingQuietHour(now: Date = new Date()): boolean {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: BOGOTA, hour: 'numeric', hourCycle: 'h23' }).format(now))
  return hour >= 21 || hour < 8
}

/** Local hour and date key in Bogotá (for the daily sends). */
export function bogotaClock(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: BOGOTA, year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', hourCycle: 'h23' }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return { hour: Number(get('hour')), dateKey: `${get('year')}-${get('month')}-${get('day')}` }
}

/** ISO week key («2026-W40») for «at most once a week» sends. */
export function weekKey(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Dedupe key of a template send: one template, one entity, one recipient. */
export function waDedupeKey(event: string, entity: { type: string; id: string } | null | undefined, recipient: string): string {
  return `${event}:${entity ? `${entity.type}:${entity.id}` : '-'}:${recipient}`.slice(0, 190)
}

// ─── Quick-reply buttons ────────────────────────────────────────────────────

export type ButtonReply = { id: string; text: string }

/** Twilio sends a pressed quick reply as `ButtonPayload` (the id) and `ButtonText` (its title). */
export function parseButtonReply(get: (key: string) => unknown): ButtonReply | null {
  const id = String(get('ButtonPayload') ?? '').trim()
  // Our ids are short snake_case words (payment_confirm…); anything else is not one of our buttons
  if (!/^[a-z0-9_]{1,40}$/.test(id)) return null
  // The button's own title (never the free Body): it goes into the agent's context
  const text = String(get('ButtonText') ?? '').replace(/[\s«»“”"]+/g, ' ').trim().slice(0, 40)
  return { id, text: text || id }
}

export type TemplateMark = { name: string; event?: string; entityType?: string | null; entityId?: string | null; at: string; body?: string; sid?: string | null }
export type ButtonMark = { id: string; text: string; at: string; template?: TemplateMark | null }

const TEMPLATE_CONTEXT_MS = 72 * 3600_000

const ENTITY_LABEL: Record<string, string> = {
  Booking: 'la reserva', ServiceRequest: 'la solicitud', Proposal: 'la propuesta', Payment: 'el pago de la reserva',
  GuaranteeClaim: 'el reclamo de garantía', VerificationDocument: 'el documento', PartnerProfile: 'el perfil de socio', User: 'la cuenta',
}

const ago = (ms: number) => (ms < 3600_000 ? `hace ${Math.max(1, Math.round(ms / 60_000))} min` : `hace ${Math.round(ms / 3600_000)} h`)

function isMark(v: unknown): v is TemplateMark {
  return Boolean(v && typeof v === 'object' && typeof (v as TemplateMark).name === 'string' && typeof (v as TemplateMark).at === 'string')
}

/**
 * The lines the agent reads about templates in this conversation (both less than 72 h old): the last
 * automatic notice sent, and the button the person pressed, with the entity it refers to.
 */
export function templateContextLines(fields: Record<string, unknown> | null | undefined, now: Date = new Date()): string[] {
  const f = fields ?? {}
  const out: string[] = []
  const tpl = isMark(f.lastTemplate) ? f.lastTemplate : null
  const btn = f.lastButton && typeof f.lastButton === 'object' ? (f.lastButton as ButtonMark) : null
  const fresh = (at: string) => {
    const t = new Date(at).getTime()
    return Number.isFinite(t) && now.getTime() - t < TEMPLATE_CONTEXT_MS && t <= now.getTime() + 60_000
  }
  const about = (m: TemplateMark) => (m.entityType && m.entityId ? ` sobre ${ENTITY_LABEL[m.entityType] ?? m.entityType} #${m.entityId.slice(-6)}` : '')

  // A pressed button steers the next turns only for a short while: days later it would push the agent back
  // onto an old booking or payment
  const buttonFresh = (at: string) => fresh(at) && now.getTime() - new Date(at).getTime() < BUTTON_CONTEXT_MS
  if (btn && typeof btn.id === 'string' && typeof btn.at === 'string' && buttonFresh(btn.at)) {
    const ref = isMark(btn.template) ? btn.template : tpl
    const on = ref ? ` a la plantilla ${ref.name}${about(ref)}` : ''
    out.push(`La persona respondió con el botón “${btn.text}” (id ${btn.id})${on} ${ago(now.getTime() - new Date(btn.at).getTime())}; actúa sobre esa entidad${ref?.entityId ? ` (usa la referencia ${ref.entityId.slice(-6)} en las herramientas)` : ''}.`)
  }
  if (tpl && fresh(tpl.at)) {
    out.push(`Último aviso automático que le enviamos por WhatsApp (${tpl.name}${about(tpl)}, ${ago(now.getTime() - new Date(tpl.at).getTime())}): «${String(tpl.body ?? '').slice(0, 400)}».`)
  }
  return out
}

export const BUTTON_CONTEXT_MS = 2 * 3600_000

/** Keys the template machinery keeps in Conversation.customFields: not shown as «Datos guardados». */
export const TEMPLATE_FIELD_KEYS = new Set(['lastTemplate', 'lastButton', 'recentTemplates'])

/**
 * What to do with each quick-reply id of the catalog. Goes in the agent's rules (cached block) when it has
 * the platform tools.
 */
export const BUTTON_GUIDANCE = `Respuestas rápidas de nuestras plantillas de WhatsApp (el contexto dice qué botón pulsó y sobre qué reserva, solicitud o pago):
- La confirmación explícita sigue aplicando: un botón cuenta como el «sí» SOLO si la plantilla ya describía exactamente la acción (por ejemplo «¿Lo recibiste?» + «Sí, lo recibí»). Si no, resume lo que vas a hacer y pregunta.
- payment_confirm: confirmar_pago de esa reserva (pregunta el medio si no lo sabes). payment_reject: pide el motivo y usa rechazar_pago.
- booking_confirm: cambiar_estado_reserva con estado confirmar. booking_decline: pregunta si quiere cancelar y, con un sí, cancelar_reserva con el motivo. booking_start: cambiar_estado_reserva en_curso. booking_complete: cambiar_estado_reserva completar. booking_not_done / booking_late: pregunta cuándo termina o llega y avísale al cliente si corresponde; no cambies nada.
- booking_ok: agradece y confirma que lo esperamos. booking_reschedule: pregunta la nueva fecha y hora y usa reprogramar_reserva. booking_cancel: explica la política de cancelación, pide el motivo y usa cancelar_reserva.
- pay_cash / pay_transfer: reportar_pago de esa reserva con medio efectivo o transferencia. pay_not_yet: dale las opciones de pago (reportar_pago con mercadopago da el enlace) sin presionar.
- rate_5 / rate_4: calificar esa reserva con 5 o 4 estrellas; pregunta si quiere dejar un comentario.
- guarantee_claim: pregunta qué pasó y a qué hora y usa reportar_problema_servicio.
- request_reactivate: reactivar_solicitud de esa solicitud. request_adjust: pregunta qué quiere cambiar (fecha, presupuesto) y ofrece crear una solicitud nueva o cancelar la actual. request_wait: tranquilízalo; le avisaremos cuando llegue una propuesta. request_skip: agradece; no hace falta hacer nada.
- proposal_accept: aceptar_propuesta de la última propuesta notificada (usa ver_propuestas para la referencia). proposal_help: resuelve sus dudas sobre la propuesta con ver_propuestas.
- proposal_chat: ver_oportunidades y enviar_propuesta sobre la solicitud notificada (pide precio y nota).
- doc_upload_chat: pide la foto del documento y usa subir_documento. services_setup: pregunta qué servicios ofrece y usa gestionar_servicio. bank_setup: pide los datos y usa registrar_cuenta_bancaria.
- reorder / new_request: ayúdale a crear la solicitud (crear_solicitud). resume_request: retoma la solicitud que dejó a medias.
- optout_soft: la persona no quiere más avisos de este tipo; ya quedó registrada. Agradece en una frase y no insistas.`

/**
 * customFields with the pressed button recorded, linked to the template it answers: the one whose message
 * sid Twilio sends as OriginalRepliedMessageSid, else the last template. Pure.
 */
export function withButtonMark(current: unknown, button: ButtonReply, repliedSid: string | null, now: Date = new Date()): Record<string, unknown> {
  const base = current && typeof current === 'object' && !Array.isArray(current) ? { ...(current as Record<string, unknown>) } : {}
  const recent = Array.isArray(base.recentTemplates) ? (base.recentTemplates as unknown[]).filter(isMark) : []
  // The template the button answers: the one with that sid; the last template only when Twilio sent no sid
  // (a partner gets many notices: guessing would point at the wrong booking)
  const template = repliedSid ? recent.find((m) => m.sid === repliedSid) ?? null : isMark(base.lastTemplate) ? base.lastTemplate : null
  const mark: ButtonMark = { id: button.id, text: button.text, at: now.toISOString(), template: template ?? null }
  return { ...base, lastButton: mark }
}
