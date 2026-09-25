import { DOMAINS, DOMAIN_LABEL, type Domain } from '@/lib/haggo/config'
import { localParts } from '@/lib/haggo/schedule'

/**
 * A directive's optional structured rule. Phase 3's policy enforces it; for now it is stored and shown.
 * `tools` are action names or prefixes ending in `*` (e.g. "marketing.*").
 */
export type DirectiveRule = {
  domain?: Domain
  tools?: string[]
  days?: number[]
  from?: string
  to?: string
  effect: 'forbid' | 'require_approval'
}

export const EFFECTS = ['forbid', 'require_approval'] as const
export const EFFECT_LABEL: Record<DirectiveRule['effect'], string> = { forbid: 'Prohibido', require_approval: 'Pedir aprobación' }
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const TOOL = /^[a-z][a-z0-9_.]{0,58}\*?$|^\*$/
const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

export type RuleResult = { ok: true; rule: DirectiveRule | null } | { ok: false; errors: string[] }

/** Validates a rule from the model or the UI. `null`/absent = text-only directive. Never trusts the input. */
export function parseRule(raw: unknown): RuleResult {
  if (raw == null || (typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw).length === 0)) return { ok: true, rule: null }
  if (typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['La regla debe ser un objeto'] }
  const r = raw as Record<string, unknown>
  const errors: string[] = []
  const rule: DirectiveRule = { effect: 'forbid' }
  if (!EFFECTS.includes(r.effect as DirectiveRule['effect'])) errors.push('Efecto inválido (prohibir o pedir aprobación)')
  else rule.effect = r.effect as DirectiveRule['effect']
  if (r.domain != null && r.domain !== '') {
    if (DOMAINS.includes(r.domain as Domain)) rule.domain = r.domain as Domain
    else errors.push(`Área desconocida: ${String(r.domain)}`)
  }
  if (r.tools != null) {
    const tools = Array.isArray(r.tools) ? r.tools : []
    const bad = tools.filter((t) => typeof t !== 'string' || !TOOL.test(t))
    if (!Array.isArray(r.tools) || bad.length) errors.push(`Acciones inválidas: ${bad.map(String).join(', ') || String(r.tools)}`)
    else if (tools.length) rule.tools = Array.from(new Set(tools as string[])).slice(0, 20)
  }
  if (r.days != null) {
    const days = Array.isArray(r.days) ? r.days : []
    if (!Array.isArray(r.days) || !days.length || days.some((d) => !Number.isInteger(d) || (d as number) < 0 || (d as number) > 6)) errors.push('Días inválidos (0 = domingo … 6 = sábado)')
    else rule.days = Array.from(new Set(days as number[])).sort()
  }
  const hasFrom = r.from != null && r.from !== ''
  const hasTo = r.to != null && r.to !== ''
  if (hasFrom || hasTo) {
    if (!hasFrom || !hasTo || typeof r.from !== 'string' || typeof r.to !== 'string' || !HHMM.test(r.from) || !HHMM.test(r.to) || r.from === r.to) errors.push('Horario inválido: indica desde y hasta en formato HH:MM')
    else { rule.from = r.from; rule.to = r.to }
  }
  if (!rule.domain && !rule.tools && !rule.days && !rule.from) errors.push('La regla no dice a qué se aplica (área, acciones, días u horario)')
  return errors.length ? { ok: false, errors } : { ok: true, rule }
}

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

/**
 * Whether a rule applies to an action at a moment (for phase 3's policy). All given conditions must
 * hold. A time window that crosses midnight belongs to the day it starts, like quiet hours.
 */
export function ruleMatches(rule: DirectiveRule, action: { domain: Domain; tool: string }, now: Date, timezone = 'America/Bogota') {
  if (rule.domain && rule.domain !== action.domain) return false
  if (rule.tools && !rule.tools.some((t) => t === '*' || t === action.tool || (t.endsWith('*') && action.tool.startsWith(t.slice(0, -1))))) return false
  if (!rule.days && !rule.from) return true
  const { day, hour, minute } = localParts(now, timezone)
  const t = hour * 60 + minute
  if (!rule.from || !rule.to) return rule.days!.includes(day)
  const from = minutes(rule.from)
  const to = minutes(rule.to)
  const days = rule.days ?? [0, 1, 2, 3, 4, 5, 6]
  if (from < to) return days.includes(day) && t >= from && t < to
  return (days.includes(day) && t >= from) || (days.includes((day + 6) % 7) && t < to)
}

/** «Prohibido · Marketing · domingos · 00:00–23:59» for the UI and the prompt. */
export function describeRule(rule: DirectiveRule | null) {
  if (!rule) return null
  const parts: string[] = [EFFECT_LABEL[rule.effect]]
  if (rule.domain) parts.push(DOMAIN_LABEL[rule.domain])
  if (rule.tools) parts.push(`acciones: ${rule.tools.join(', ')}`)
  if (rule.days) parts.push(rule.days.length === 7 ? 'todos los días' : rule.days.map((d) => DAY_NAMES[d]).join(', '))
  if (rule.from && rule.to) parts.push(`${rule.from}–${rule.to}`)
  return parts.join(' · ')
}

export function cleanDirectiveText(v: unknown) {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 500) : ''
}
