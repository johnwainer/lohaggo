/**
 * Pure rules around a conversation the AI agent handles (no DB, no API): when to close it, repeated
 * replies, evident spam, undeliverable recipients and the client↔partner relay the agent carries.
 */

// ─── Closing ────────────────────────────────────────────────────────────────

export const CLOSE_REASONS = ['gestionada', 'sin_respuesta', 'spam', 'otra_marca'] as const
export type CloseReason = (typeof CLOSE_REASONS)[number]

export const CLOSE_REASON_LABEL: Record<CloseReason, string> = {
  gestionada: 'Gestión terminada',
  sin_respuesta: 'Sin respuesta del cliente',
  spam: 'Spam',
  otra_marca: 'Mensaje para otra marca',
}

export const isCloseReason = (v: unknown): v is CloseReason => typeof v === 'string' && (CLOSE_REASONS as readonly string[]).includes(v)

/** Hours without an answer from the contact after the agent's last message before the conversation closes itself. */
export const INACTIVITY_CLOSE_MS = 24 * 3600_000

export type InactivityInput = {
  status: string
  aiHandled: boolean
  assignedToId: string | null
  aiHandoffAt: Date | null
  isTest: boolean
  /** Last message the contact can see (internal notes excluded) */
  lastMessage: { direction: string; senderType: string | null; sentAt: Date } | null
  /** Actions waiting for the person's yes or the team's approval */
  pendingActions: number
  /** A message that arrived outside hours still waits for its answer */
  waitingAfterHours: boolean
}

/**
 * A conversation the AI handles closes itself (RESOLVED, «sin respuesta del cliente») when the agent spoke
 * last, the contact has been silent for 24 h and nothing waits: no person in charge, no handoff, no
 * action waiting for a yes, no answer owed from outside hours.
 */
export function inactivityCloseDecision(c: InactivityInput, now = new Date()): { close: true } | { close: false; why: string } {
  if (c.isTest) return { close: false, why: 'test' }
  if (c.status !== 'OPEN' && c.status !== 'IN_PROGRESS') return { close: false, why: 'not_open' }
  if (!c.aiHandled) return { close: false, why: 'not_ai' }
  if (c.assignedToId) return { close: false, why: 'person_in_charge' }
  if (c.aiHandoffAt) return { close: false, why: 'handed_off' }
  if (c.waitingAfterHours) return { close: false, why: 'after_hours_pending' }
  if (c.pendingActions > 0) return { close: false, why: 'pending_actions' }
  const m = c.lastMessage
  if (!m) return { close: false, why: 'no_messages' }
  if (m.direction !== 'OUTBOUND' || m.senderType !== 'AI') return { close: false, why: 'contact_spoke_last' }
  if (now.getTime() - m.sentAt.getTime() < INACTIVITY_CLOSE_MS) return { close: false, why: 'too_recent' }
  return { close: true }
}

// ─── Repeated replies ───────────────────────────────────────────────────────

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const tokens = (s: string) => fold(s).replace(/[^a-z0-9ñ]+/g, ' ').trim().split(' ').filter(Boolean)

/** Dice coefficient over word bigrams (words alone for very short texts): 1 = same text. */
export function similarity(a: string, b: string) {
  const ta = tokens(a)
  const tb = tokens(b)
  if (!ta.length && !tb.length) return 1
  if (!ta.length || !tb.length) return 0
  const grams = (t: string[]) => (t.length < 3 ? t : t.slice(1).map((w, i) => `${t[i]} ${w}`))
  const ga = grams(ta)
  const gb = new Map<string, number>()
  for (const g of grams(tb)) gb.set(g, (gb.get(g) ?? 0) + 1)
  let hits = 0
  for (const g of ga) {
    const n = gb.get(g) ?? 0
    if (n > 0) { hits++; gb.set(g, n - 1) }
  }
  return (2 * hits) / (ga.length + grams(tb).length)
}

/** Sentences that are boilerplate: sign-offs, offers of further help, introductions. */
const BOILERPLATE = /\b(cualquier (cosa|otra cosa|duda|inquietud)|aqui estoy|aqui sigo|estoy (atento|atenta|pendiente|para ayudarte|para servirte|a tu disposicion)|quedo (atento|atenta|pendiente)|con gusto te ayudo|no dudes en|que tengas|feliz (dia|tarde|noche)|hasta (pronto|luego)|un saludo|saludos|soy (el|la|tu) (asistente|agente)|te saluda|bienvenid[oa] a lohaggo|gracias por (escribir|contactar|comunicarte))\b/

export function splitSentences(text: string) {
  return text.split(/(?<=[.!?¡¿…])\s+|\n+/).map((s) => s.trim()).filter(Boolean)
}

export type DedupeResult = { text: string; dropped: 'none' | 'boilerplate' | 'duplicate' }

const isBoilerplate = (s: string) => BOILERPLATE.test(fold(s))

/** Removes the boilerplate clauses of a sentence («Listo, quedó creada, cualquier cosa aquí estoy.» → «Listo, quedó creada.»). */
function stripBoilerplate(sentence: string) {
  const end = /[.!?…]$/.test(sentence) ? sentence.slice(-1) : ''
  const body = end ? sentence.slice(0, -1) : sentence
  const clauses = body.split(/,\s+|\s+y\s+(?=(?:cualquier|si necesitas|quedo|estoy|aqui))/i)
  const kept = clauses.filter((c) => !isBoilerplate(c))
  if (kept.length === clauses.length) return sentence
  if (!kept.length) return ''
  return `${kept.join(', ')}${end || '.'}`
}

/**
 * Keeps the agent from sending what it just sent. Same message as one of the last ones → nothing is sent.
 * A sign-off, «anything else, I'm here» or a self-introduction when one of the last replies already had one
 * is cut (only that clause); if nothing else is left, nothing is sent.
 */
export function dedupeReply(text: string, previousAgentTexts: string[]): DedupeResult {
  const recent = previousAgentTexts.filter((t) => t?.trim()).slice(-3)
  if (!text.trim() || !recent.length) return { text, dropped: 'none' }
  if (recent.some((p) => similarity(p, text) >= 0.9)) return { text: '', dropped: 'duplicate' }
  const saidBoilerplate = recent.flatMap(splitSentences).some((p) => isBoilerplate(p) || p.split(/,\s+/).some(isBoilerplate))
  if (!saidBoilerplate) return { text, dropped: 'none' }
  let out = text
  for (const sentence of splitSentences(text)) {
    const stripped = stripBoilerplate(sentence)
    if (stripped !== sentence) out = out.replace(sentence, stripped)
  }
  if (out === text) return { text, dropped: 'none' }
  out = out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim()
  if (!out) return { text: '', dropped: 'duplicate' }
  return { text: out, dropped: 'boilerplate' }
}

// ─── Evident spam ───────────────────────────────────────────────────────────

const VOWELS = /[aeiouáéíóúü]/i

/** A word that no language here writes: no vowel at all, or five consonants in a row («asdfg», «qwrtzk»). */
function nonsenseWord(w: string) {
  if (w.length < 4) return false
  if (!VOWELS.test(w)) return true
  return /[bcdfghjklmnpqrstvwxyz]{5,}/i.test(w)
}

export function isGibberish(text: string) {
  const t = text.trim()
  if (!t) return false
  const letters = t.replace(/[^a-záéíóúüñ]/gi, '')
  // Only symbols / digits repeated (no words, no emoji conversation) of some length
  if (!letters.length) return t.replace(/\s/g, '').length >= 6 && !/[\uD800-\uDBFF\u2600-\u27BF]/.test(t)
  const words = t.split(/\s+/).map((w) => w.replace(/[^a-záéíóúüñ]/gi, '')).filter(Boolean)
  if (!words.length) return false
  const bad = words.filter(nonsenseWord).length
  return bad / words.length >= 0.6
}

/**
 * Evident spam: the same nonsense sent over and over. Needs at least three of the last inbound messages
 * identical and meaningless, or four meaningless in a row. A person repeating «hola» is not spam.
 */
export function isRepeatedGibberish(inbound: string[]) {
  const last = inbound.map((t) => t?.trim() ?? '').filter(Boolean).slice(-5)
  if (last.length < 3) return false
  const tail3 = last.slice(-3)
  const same = tail3.every((t) => fold(t) === fold(tail3[0]))
  if (same && isGibberish(tail3[0])) return true
  const tail4 = last.slice(-4)
  return tail4.length === 4 && tail4.every(isGibberish)
}

// ─── Undeliverable recipients ───────────────────────────────────────────────

/**
 * The provider says the recipient cannot get messages at all (not a passing failure): an invalid number,
 * a number without WhatsApp, a Meta user that is not reachable. Retrying or handing off does not help.
 */
export function isUndeliverableError(error: string | null | undefined) {
  if (!error) return false
  return /\b(21211|21614|63003|63024|63033|131026|551)\b|invalid ['"]?to['"]? phone|not a valid (?:mobile|phone)|invalid (?:phone )?number|n[uú]mero (?:no v[aá]lido|inv[aá]lido)|invalid message recipient|could not find a channel with the (?:specified )?to|no matching user|isn.t available right now|recipient (?:is )?not (?:a valid )?whatsapp user|message undeliverable/i.test(error)
}

// ─── Relay between client and partner ───────────────────────────────────────

export type RelayNotice = { from: string; who: 'socio' | 'cliente'; service: string; ref: string; text: string }

/** «💬 Pablo (tu socio) te escribió sobre Pintura · ref abc123:\n\n«…»» → its parts. */
export function parseRelayNotice(body: string): RelayNotice | null {
  const m = body.match(/^💬\s*(.+?)\s*\(tu (socio|cliente)\) te escribió sobre (.+?) · ref ([a-z0-9]{4,30}):\s*\n+\s*([\s\S]*?)\n\nEs un mensaje de/i)
  if (!m) return null
  return { from: m[1], who: m[2].toLowerCase() as 'socio' | 'cliente', service: m[3], ref: m[4].toLowerCase(), text: m[5].replace(/^«|»$/g, '').trim() }
}

/** What the model must keep in mind about the relay: tool calls and our forwarded notices are easy to lose. */
export function relayContextText(p: {
  lastNotice: (RelayNotice & { minutesAgo: number }) | null
  pendingMessage: { recipient: string; ref: string; text: string; minutesAgo: number } | null
}) {
  const lines: string[] = []
  if (p.lastNotice) {
    const n = p.lastNotice
    lines.push(`Relevo: hace ${n.minutesAgo} min le reenviamos a esta persona un mensaje de ${n.from} (su ${n.who}) sobre ${n.service}, ref ${n.ref}: «${n.text.slice(0, 300)}». Si lo que escribe ahora es una respuesta para ${n.from}, es para la ref ${n.ref}: usa enviar_mensaje_reserva con esa ref y sus palabras, sin preguntarle a quién va.`)
  }
  if (p.pendingMessage) {
    const m = p.pendingMessage
    lines.push(`Mensaje de relevo pendiente (propuesto hace ${m.minutesAgo} min): para ${m.recipient}, ref ${m.ref}, texto exacto «${m.text.slice(0, 500)}». Ya sabes qué enviar y a quién: con su sí, envíalo tal cual; nunca le preguntes qué mensaje quiere enviar.`)
  }
  return lines.join('\n')
}
