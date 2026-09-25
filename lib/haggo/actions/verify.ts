import type Anthropic from '@anthropic-ai/sdk'

/**
 * Phase 4: after an action runs, Haggo checks whether its hypothesis came true. Pure helpers here; the
 * runner asks the model to measure with its read tools and the engine stores the verdict.
 */

export const VERDICTS = ['mejoro', 'sin_cambio', 'empeoro', 'no_medible'] as const
export type Verdict = (typeof VERDICTS)[number]
export const VERDICT_LABEL: Record<Verdict | 'sin_verificar', string> = { mejoro: 'Mejoró', sin_cambio: 'Sin cambio', empeoro: 'Empeoró', no_medible: 'No se pudo medir', sin_verificar: 'Sin verificar' }

/** Who ran an action when nobody clicked: the actor name in decidedByEmail and in the audit log. */
export const AUTONOMOUS_ACTOR = 'Haggo (autónomo)'
export const AUTONOMOUS_ID = 'haggo'
export const isAutonomous = (decidedByEmail: string | null | undefined) => decidedByEmail === AUTONOMOUS_ACTOR

const H = 3600_000
/** After the deadline plus this grace, an action nobody could measure is closed as «sin verificar». */
export const VERIFY_GRACE_HOURS = 72
export const MAX_VERIFICATIONS_PER_CYCLE = 5

type Verifiable = { executedAt: Date | null; verifiedAt: Date | null; hypothesis: unknown; status: string }

export function hypothesisHours(h: unknown) {
  const n = (h as { byHours?: unknown } | null)?.byHours
  return typeof n === 'number' && n > 0 ? n : 24
}

/** Due for a check: executed, not verified, and its hypothesis deadline has passed. */
export function dueForVerification(a: Verifiable, now = new Date()) {
  return a.status === 'executed' && !a.verifiedAt && Boolean(a.executedAt) && now.getTime() >= a.executedAt!.getTime() + hypothesisHours(a.hypothesis) * H
}

/** Too late to measure: closed without a verdict so it does not stay pending forever. */
export function verificationExpired(a: Verifiable, now = new Date()) {
  return dueForVerification(a, now) && now.getTime() >= a.executedAt!.getTime() + (hypothesisHours(a.hypothesis) + VERIFY_GRACE_HOURS) * H
}

/**
 * Undo on its own only what Haggo did on its own, is reversible, and got worse. What a person approved
 * is not reverted behind their back: it becomes a recommendation.
 */
export function shouldAutoUndo(a: { decidedByEmail: string | null; reversible: boolean }, verdict: Verdict) {
  return verdict === 'empeoro' && a.reversible && isAutonomous(a.decidedByEmail)
}

export type Evaluation = { actionId: string; verdict: Verdict; evidence: string; learning: string | null }

export function parseEvaluation(raw: unknown, dueIds: string[]): { ok: true; evaluation: Evaluation } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Evaluación vacía' }
  const r = raw as Record<string, unknown>
  const actionId = typeof r.action_id === 'string' ? r.action_id : ''
  if (!dueIds.includes(actionId)) return { ok: false, error: 'Esa acción no está pendiente de verificar' }
  if (!VERDICTS.includes(r.resultado as Verdict)) return { ok: false, error: `resultado: ${VERDICTS.join(', ')}` }
  const evidence = typeof r.evidencia === 'string' ? r.evidencia.trim().slice(0, 800) : ''
  if (!evidence && r.resultado !== 'no_medible') return { ok: false, error: 'Falta la evidencia (cifras de antes y después)' }
  const learning = typeof r.aprendizaje === 'string' && r.aprendizaje.trim() ? r.aprendizaje.trim().slice(0, 400) : null
  return { ok: true, evaluation: { actionId, verdict: r.resultado as Verdict, evidence, learning } }
}

export const EVALUATE_TOOL: Anthropic.Tool = {
  name: 'evaluar_resultado',
  description: 'Registra si una acción ejecutada cumplió su hipótesis. Una llamada por acción pendiente de verificar.',
  input_schema: {
    type: 'object',
    properties: {
      action_id: { type: 'string' },
      resultado: { type: 'string', enum: [...VERDICTS] },
      evidencia: { type: 'string', description: 'La métrica antes y ahora, con la herramienta de la que sale.' },
      aprendizaje: { type: 'string', description: 'Qué aprendes para la próxima vez (una frase), si aplica.' },
    },
    required: ['action_id', 'resultado', 'evidencia'],
  },
}
