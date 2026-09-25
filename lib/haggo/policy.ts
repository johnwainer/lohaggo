import { modeFor, type HaggoConfig } from '@/lib/haggo/config'
import { describeRule, ruleMatches, type DirectiveRule } from '@/lib/haggo/directives'
import type { HaggoActionDef } from '@/lib/haggo/actions/types'

/**
 * Autonomy (phase 4): an `execute` verdict runs without a click. It only happens where the superadmin put
 * a domain in autonomous mode, for low risk (and medium where allowed), never for money, high or max
 * risk, and never from the chat. Setting this to false turns every `execute` back into `propose`.
 */
export const AUTONOMY_ENABLED = true

export type Verdict = 'blocked' | 'propose' | 'execute'
export type Origin = 'cycle' | 'chat' | 'report'

export type PolicyInput = {
  action: Pick<HaggoActionDef, 'id' | 'domain' | 'risk' | 'sideEffects'>
  origin: Origin
  now: Date
  config: HaggoConfig
  directives: Array<{ id: string; text: string; rule: DirectiveRule | null }>
  counters: { cycleActions: number; dayActions: number }
  lastHumanChangeAt: Date | null
  lastSameActionAt: Date | null
  budgetBlocked: boolean
  quietNow: boolean
  /** From the proposal: evidence only from third-party text, or confidence below 0.5 */
  weakEvidence?: boolean
  /** Only true in phase 4 */
  autonomyEnabled?: boolean
}

export type Decision = { verdict: Verdict; reasons: string[] }

/** Runs without a click only from Haggo's own reviews; in the chat the superadmin approves the card. */
export const actsAlone = (d: Pick<Decision, 'verdict'>, origin: Origin) => d.verdict === 'execute' && origin !== 'chat'

const H = 3600_000

/**
 * Decides, in this order (the first rule that blocks wins; the ones that only lower to «propose» add
 * their reason and keep going):
 * 1. Haggo stopped → blocked
 * 2. Max-risk action: off in maxRiskEnabled → blocked; on → at most propose, never execute
 * 3. A directive that forbids it now → blocked, quoting the directive
 * 4. A person changed the entity recently → blocked from a cycle or report (Haggo does not step on a
 *    person's fresh work); from the chat → propose with a warning (the superadmin is asking for it)
 * 5. The same action on the same entity recently → blocked
 * 6. Over the per-cycle or per-day limit → propose (left to the superadmin)
 * 7. Domain mode: observer → blocked (it stays a recommendation); copilot → propose
 * 8. Autonomous: low → execute; medium → execute only with mediumAllowed[domain]; high → propose
 * 9. A directive that requires approval, quiet hours, no budget or weak evidence → at most propose
 * Then, with autonomy disabled (phase 3), execute → propose.
 */
export function decide(i: PolicyInput): Decision {
  const reasons: string[] = []
  const { action, config } = i
  let ceiling: Verdict = 'execute'
  const lower = (v: Verdict, why: string) => {
    reasons.push(why)
    if (v === 'propose' && ceiling === 'execute') ceiling = 'propose'
  }

  if (!config.enabled) return { verdict: 'blocked', reasons: ['Haggo está detenido'] }

  if (action.risk === 'max') {
    if (!config.maxRiskEnabled[action.id]) return { verdict: 'blocked', reasons: ['Acción de riesgo máximo apagada en Ajustes'] }
    lower('propose', 'Acción de riesgo máximo: siempre requiere aprobación')
  }

  const matching = i.directives.filter((d) => d.rule && ruleMatches(d.rule, { domain: action.domain, tool: action.id }, i.now, config.timezone))
  const forbid = matching.find((d) => d.rule!.effect === 'forbid')
  if (forbid) return { verdict: 'blocked', reasons: [`Lo prohíbe la directiva «${forbid.text}» (${describeRule(forbid.rule)})`] }

  if (i.lastHumanChangeAt && i.now.getTime() - i.lastHumanChangeAt.getTime() < config.humanCooldownHours * H) {
    if (i.origin !== 'chat') return { verdict: 'blocked', reasons: [`Una persona lo cambió hace menos de ${config.humanCooldownHours} h`] }
    lower('propose', `Ojo: una persona lo cambió hace menos de ${config.humanCooldownHours} h`)
  }

  if (i.lastSameActionAt && i.now.getTime() - i.lastSameActionAt.getTime() < config.repeatCooldownHours * H) {
    return { verdict: 'blocked', reasons: [`Haggo ya hizo esto sobre lo mismo hace menos de ${config.repeatCooldownHours} h`] }
  }

  if (i.counters.cycleActions >= config.maxActionsPerCycle) lower('propose', `Límite de ${config.maxActionsPerCycle} acciones por ciclo`)
  if (i.counters.dayActions >= config.maxActionsPerDay) lower('propose', `Límite de ${config.maxActionsPerDay} acciones por día`)

  const mode = modeFor(config, action.domain)
  if (mode === 'observer') return { verdict: 'blocked', reasons: ['El área está en modo observador: queda como recomendación'] }
  if (mode === 'copilot') lower('propose', 'El área está en modo copiloto')
  else if (action.risk === 'high') lower('propose', 'Riesgo alto: siempre requiere aprobación')
  else if (action.risk === 'medium' && !config.mediumAllowed[action.domain]) lower('propose', 'Riesgo medio sin permiso para actuar solo en esta área')

  const approval = matching.find((d) => d.rule!.effect === 'require_approval')
  if (approval) lower('propose', `La directiva «${approval.text}» pide aprobación`)
  if (i.quietNow) lower('propose', 'Horas sin actuar solo')
  if (i.budgetBlocked) lower('propose', 'Presupuesto de Haggo agotado')
  // Prompt injection guard: what rests on third-party text or low confidence never runs alone
  if (i.weakEvidence) lower('propose', 'Evidencia débil o de terceros: necesita tu aprobación')

  if (ceiling === 'execute' && !(i.autonomyEnabled ?? AUTONOMY_ENABLED)) lower('propose', 'La autonomía todavía no está activada')
  return { verdict: ceiling, reasons }
}
