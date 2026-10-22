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

/** «5», « 4. », «3!» or the keycap emoji → the score; anything else (text, 0, 6, «45») → null. */
export function parseCsatScore(body: string | null | undefined): number | null {
  const text = (body ?? '').trim()
  if (text in KEYCAPS) return KEYCAPS[text]
  const m = /^([1-5])\s*[.!]?$/.exec(text)
  return m ? Number(m[1]) : null
}

/** The score when this message answers a pending survey (asked < 24 h ago and not answered yet). */
export function csatReplyScore(state: Pick<InboxState, 'csatAskedAt' | 'csat'>, body: string | null | undefined, now: number = Date.now()): number | null {
  if (!state.csatAskedAt) return null
  const asked = new Date(state.csatAskedAt).getTime()
  if (Number.isNaN(asked) || now - asked > CSAT_ANSWER_MS || now < asked) return null
  if (state.csat && state.csat.at >= state.csatAskedAt) return null
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
}

/** Why the survey is not sent, or null when it goes out. */
export function csatSkipReason(input: CsatAskInput, now: number = Date.now()): string | null {
  if (input.reason !== 'gestionada') return 'reason'
  if (!(CSAT_CHANNELS as readonly string[]).includes(input.channel)) return 'channel'
  if (input.status !== 'RESOLVED' && input.status !== 'CLOSED') return 'open'
  if (input.automatedOnly) return 'automated_only'
  if (input.aiSpam) return 'spam'
  if (input.isTest) return 'test'
  if (input.optedOut) return 'opted_out'
  if (input.csatAskedAt) {
    const asked = new Date(input.csatAskedAt).getTime()
    if (!Number.isNaN(asked) && now - asked < CSAT_COOLDOWN_MS) return 'recent'
  }
  if (!isWindowOpen(input.lastInboundAt, now)) return 'window_closed'
  return null
}

/** Echoes of the survey must not reopen a closed conversation (Meta echoes our own messages back). */
export function isCsatMessage(body: string | null | undefined) {
  const text = (body ?? '').trim()
  return text === CSAT_QUESTION || text === CSAT_THANKS
}
