import type { HaggoActionDef } from '@/lib/haggo/actions/types'

/** Read tools that return text written by customers, partners or the public. */
export const THIRD_PARTY_TOOLS = ['conversaciones_en_espera', 'resenas', 'agente_ia', 'incidentes_abiertos'] as const
/** Evidence the chat accepts beyond the read tools: the superadmin's own order. */
export const SUPERADMIN_ORDER = 'orden_del_superadmin'

export const MIN_CONFIDENCE = 0.3
export const REVIEW_CONFIDENCE = 0.5
const LOW_TRUST_CAP = 0.45

export type Hypothesis = { metric: string; current: string; expected: string; byHours: number }
export type ValidProposal = {
  actionId: string
  params: Record<string, unknown>
  what: string
  why: string
  evidence: Array<{ tool: string; fact: string }>
  hypothesis: Hypothesis
  alternatives: Array<{ option: string; whyNot: string }>
  risks: string
  confidence: number
  forReview: boolean
  lowTrust: boolean
  plan: { id: string; order: number } | null
  againBecause: string | null
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/**
 * The model's proposal, validated before anything else. Evidence must cite read tools actually used in
 * this run (or, in the chat, the superadmin's order). Evidence made only of third-party text is «low
 * trust»: its confidence is capped (so it shows as «para revisar») and, for high or max risk, refused.
 */
export function validateProposal(raw: unknown, ctx: { action: Pick<HaggoActionDef, 'risk'> | null; toolsUsed: string[]; origin: 'cycle' | 'chat' | 'report' }): { ok: true; proposal: ValidProposal } | { ok: false; errors: string[] } {
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['Propuesta vacía'] }
  const r = raw as Record<string, unknown>
  const errors: string[] = []
  if (!ctx.action) errors.push(`Acción desconocida: ${String(r.action_id)}`)
  const what = str(r.que, 300)
  const why = str(r.por_que, 1500)
  if (!what) errors.push('Falta «que»')
  if (!why) errors.push('Falta «por_que»')

  const allowed = new Set([...ctx.toolsUsed, ...(ctx.origin === 'chat' ? [SUPERADMIN_ORDER] : [])])
  const evidence = (Array.isArray(r.evidencia) ? r.evidencia : []).slice(0, 10).flatMap((e) => {
    const o = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>
    const tool = str(o.herramienta, 60)
    const fact = str(o.dato, 400)
    return tool && fact && allowed.has(tool) ? [{ tool, fact }] : []
  })
  if (!evidence.length) errors.push(`Sin evidencia válida: cita datos de herramientas que usaste en esta revisión (${Array.from(allowed).join(', ') || 'ninguna'})`)

  const h = (r.hipotesis && typeof r.hipotesis === 'object' ? r.hipotesis : {}) as Record<string, unknown>
  const hypothesis: Hypothesis = { metric: str(h.metrica, 200), current: str(h.actual, 200), expected: str(h.esperado, 200), byHours: Number.isInteger(h.plazo_horas) ? Math.min(720, Math.max(1, h.plazo_horas as number)) : 0 }
  if (!hypothesis.metric || !hypothesis.expected || !hypothesis.byHours) errors.push('Hipótesis incompleta: métrica, valor esperado y plazo en horas')

  const alternatives = (Array.isArray(r.alternativas) ? r.alternativas : []).slice(0, 5).flatMap((a) => {
    const o = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>
    const option = str(o.opcion, 200)
    const whyNot = str(o.por_que_no, 400)
    return option && whyNot ? [{ option, whyNot }] : []
  })
  if (!alternatives.length) errors.push('Falta al menos una alternativa considerada (puede ser «no hacer nada»)')

  const risks = str(r.riesgos, 800)
  if (!risks) errors.push('Faltan los riesgos')
  let confidence = typeof r.confianza === 'number' && r.confianza >= 0 && r.confianza <= 1 ? r.confianza : -1
  if (confidence < 0) errors.push('Confianza entre 0 y 1')

  const solid = evidence.filter((e) => !(THIRD_PARTY_TOOLS as readonly string[]).includes(e.tool))
  const lowTrust = evidence.length > 0 && !solid.length
  if (lowTrust && ctx.action && (ctx.action.risk === 'high' || ctx.action.risk === 'max')) errors.push('Una acción de riesgo alto no se sostiene solo con lo que escribieron clientes o socios: hacen falta cifras de otras herramientas')
  if (lowTrust) confidence = Math.min(confidence, LOW_TRUST_CAP)
  if (confidence >= 0 && confidence < MIN_CONFIDENCE) errors.push(`Confianza ${confidence.toFixed(2)} menor a ${MIN_CONFIDENCE}: no se propone`)

  const p = (r.plan && typeof r.plan === 'object' ? r.plan : null) as Record<string, unknown> | null
  const plan = p && typeof p.id === 'string' && /^[\w-]{1,40}$/.test(p.id) && Number.isInteger(p.orden) ? { id: p.id, order: Math.min(10, Math.max(1, p.orden as number)) } : null

  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    proposal: {
      actionId: String(r.action_id), params: (r.params && typeof r.params === 'object' ? r.params : {}) as Record<string, unknown>,
      what, why, evidence, hypothesis, alternatives, risks, confidence, forReview: confidence < REVIEW_CONFIDENCE, lowTrust, plan, againBecause: str(r.por_que_de_nuevo, 600) || null,
    },
  }
}
