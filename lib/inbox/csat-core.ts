/**
 * Satisfaction survey sent when a conversation is closed as handled (by a person or the AI agent): one short
 * question, answered with a digit 1–5. Pure rules here; sending and recording live in lib/inbox/csat.ts.
 */
import type { InboxState } from '@/lib/inbox/state'
import { isWindowOpen, WINDOW_MS } from '@/lib/inbox/waiting'

export const CSAT_QUESTION = '¿Cómo te atendimos? Responde con un número del 1 al 5 (5 = excelente).'
export const CSAT_THANKS = '¡Gracias por tu calificación!'
export const CSAT_SENDER = { type: 'AI' as const, agentId: 'csat', agentName: 'Encuesta' }
export const CSAT_CHANNELS = ['WHATSAPP', 'MESSENGER', 'INSTAGRAM'] as const
export const CSAT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000
/** The answer counts only within this time after the question */
export const CSAT_ANSWER_MS = WINDOW_MS

const KEYCAPS: Record<string, number> = { '1️⃣': 1, '2️⃣': 2, '3️⃣': 3, '4️⃣': 4, '5️⃣': 5 }

const SCORE_WORDS: Record<string, number> = { uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5 }
/** Words that may go with the score («5 estrellas», «excelente 5», «le doy un 5», «5/5 gracias») */
const SCORE_FILLER = new Set([
  'estrella', 'estrellas', 'punto', 'puntos', 'de', 'sobre', 'un', 'una', 'le', 'les', 'te', 'doy', 'damos', 'pongo', 'mi', 'nota', 'calificacion', 'es', 'el', 'la',
  'excelente', 'excelentes', 'muy', 'bien', 'buena', 'bueno', 'buenisimo', 'super', 'perfecto', 'genial', 'regular', 'mal', 'malo', 'mala', 'pesimo', 'todo', 'gracias', 'ok', 'si',
  'servicio', 'atencion', 'y', 'por', 'favor', 'muchas',
])

/**
 * «5», « 4. », «3!», the keycap emoji, «5 estrellas», «⭐⭐⭐⭐⭐», «excelente 5», «le doy un 5», «5/5» → the
 * score; anything else (other words, 0, 6, «45», two different numbers, «5 minutos») → null.
 */
export function parseCsatScore(body: string | null | undefined): number | null {
  const text = (body ?? '').trim()
  if (!text) return null
  if (text in KEYCAPS) return KEYCAPS[text]
  const compact = text.replace(/[\s️]+/g, '')
  const stars = compact.match(/⭐|🌟/g)
  if (stars && stars.length <= 5 && !compact.replace(/⭐|🌟/g, '')) return stars.length
  const folded = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/⭐|🌟/g, ' ')
    .replace(/\b([1-5])\s*(?:\/|de|sobre)\s*5\b/g, '$1')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
  const words = folded.split(/\s+/).filter(Boolean)
  if (!words.length || words.length > 8) return null
  let score: number | null = null
  for (const w of words) {
    const n = /^\d+$/.test(w) ? Number(w) : SCORE_WORDS[w] ?? null
    if (n !== null) {
      if (n < 1 || n > 5 || (score !== null && score !== n)) return null
      score = n
    } else if (!SCORE_FILLER.has(w)) return null
  }
  return score
}

/**
 * The score when this message answers a pending survey (asked < 24 h ago, not answered yet). Right after
 * the question (the contact wrote nothing since) it counts even if the conversation was reopened meanwhile
 * (a last agent message after the close, a status change); once the contact wrote something else after the
 * question and the conversation reopened, a lone digit is an ordinary answer for the team or the agent.
 */
export function csatReplyScore(state: Pick<InboxState, 'csatAskedAt' | 'csat'> & { lastInboundAt?: string | null }, body: string | null | undefined, now: number = Date.now(), status?: string | null): number | null {
  if (!state.csatAskedAt) return null
  const asked = new Date(state.csatAskedAt).getTime()
  if (Number.isNaN(asked) || now - asked > CSAT_ANSWER_MS || now < asked) return null
  if (state.csat && state.csat.at >= state.csatAskedAt) return null
  if (status && status !== 'RESOLVED' && status !== 'CLOSED') {
    const lastIn = state.lastInboundAt ? new Date(state.lastInboundAt).getTime() : NaN
    if (Number.isNaN(lastIn) || lastIn >= asked) return null
  }
  return parseCsatScore(body)
}

export type CsatAskInput = {
  channel: string
  status: string
  reason: string
  automatedOnly: boolean
  aiSpam: boolean
  isTest: boolean
  optedOut: boolean
  csatAskedAt: string | null | undefined
  lastInboundAt: string | Date | null | undefined
  /** Someone (a person or the agent) answered in this conversation: nobody asks how a chat nobody attended went */
  replied?: boolean
}

/** Why the survey is not sent, or null when it goes out. */
export function csatSkipReason(input: CsatAskInput, now: number = Date.now(), opts: { enabled?: boolean; cooldownMs?: number } = {}): string | null {
  if (opts.enabled === false) return 'disabled'
  if (input.reason !== 'gestionada') return 'reason'
  if (!(CSAT_CHANNELS as readonly string[]).includes(input.channel)) return 'channel'
  if (input.status !== 'RESOLVED' && input.status !== 'CLOSED') return 'open'
  if (input.automatedOnly) return 'automated_only'
  if (input.replied === false) return 'no_reply'
  if (input.aiSpam) return 'spam'
  if (input.isTest) return 'test'
  if (input.optedOut) return 'opted_out'
  if (input.csatAskedAt) {
    const asked = new Date(input.csatAskedAt).getTime()
    if (!Number.isNaN(asked) && now - asked < (opts.cooldownMs ?? CSAT_COOLDOWN_MS)) return 'recent'
  }
  if (!isWindowOpen(input.lastInboundAt, now)) return 'window_closed'
  return null
}

/** Echoes of the survey must not reopen a closed conversation (Meta echoes our own messages back). */
export function isCsatMessage(body: string | null | undefined) {
  const text = (body ?? '').trim()
  return text === CSAT_QUESTION || text === CSAT_THANKS
}
