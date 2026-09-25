import type Anthropic from '@anthropic-ai/sdk'
import type { Domain } from '@/lib/haggo/config'

export type Risk = 'low' | 'medium' | 'high' | 'max'
export const RISKS: Risk[] = ['low', 'medium', 'high', 'max']
export const RISK_LABEL: Record<Risk, string> = { low: 'Bajo', medium: 'Medio', high: 'Alto', max: 'Máximo' }

/**
 * What an action does outside the database. `irreversible` means data or money that cannot be restored
 * (not a message already sent: that is `notifies_*`); with `changes_money` it forces risk high or max.
 */
export type SideEffect = 'notifies_customers' | 'notifies_partners' | 'customer_facing' | 'publishes' | 'spends' | 'changes_money' | 'irreversible'
export const SIDE_EFFECT_LABEL: Record<SideEffect, string> = {
  notifies_customers: 'avisa a clientes',
  notifies_partners: 'avisa a socios',
  customer_facing: 'cambia lo que leen o ven los clientes',
  publishes: 'publica en redes o en el blog',
  spends: 'gasta en IA',
  changes_money: 'mueve dinero',
  irreversible: 'no se puede deshacer',
}

export type Entity = { type: string; id: string }
export type Parsed<P> = { ok: true; params: P } | { ok: false; errors: string[] }
export type Diff = Array<{ field: string; from: unknown; to: unknown }>
export type ExecCtx = { actionId: string; approverId: string; approverEmail: string | null }

/**
 * One thing Haggo can do. The registry is the source of truth for id, risk and side effects: the policy
 * reads them from here, never from the model. `parse` validates what the model sends; `preview` never
 * writes; `undo` exists only when the action is really reversible, and `unchanged` tells whether the
 * entity is still as Haggo left it (undo refuses otherwise).
 */
export type HaggoActionDef<P = Record<string, unknown>> = {
  id: string
  domain: Domain
  risk: Risk
  label: string
  /** For the model: what it is for and when to use it */
  hint: string
  schema: Anthropic.Tool['input_schema']
  sideEffects: SideEffect[]
  parse: (raw: unknown) => Parsed<P>
  describe: (p: P) => string
  entity: (p: P) => Entity | null
  preconditions: (p: P) => Promise<{ ok: true; before: unknown } | { ok: false; reason: string }>
  preview: (p: P, before: unknown) => Promise<{ summary: string; diff: Diff }>
  execute: (p: P, ctx: ExecCtx, before: unknown) => Promise<{ after: unknown; result: string }>
  undo?: (p: P, before: unknown, after: unknown) => Promise<void>
  unchanged?: (p: P, after: unknown) => Promise<boolean>
}

// ─── Parsing helpers (strict: anything unexpected is an error) ─────────────

export const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
export const ID = /^[a-z0-9_-]{6,40}$/i

export function field<T>(errors: string[], ok: boolean, value: T, message: string): T {
  if (!ok) errors.push(message)
  return value
}

export function parseId(raw: Record<string, unknown>, key: string, errors: string[]) {
  const v = raw[key]
  return field(errors, typeof v === 'string' && ID.test(v), typeof v === 'string' ? v : '', `${key}: identificador inválido`)
}

export function parseDate(raw: Record<string, unknown>, key: string, errors: string[]) {
  const v = raw[key]
  const d = typeof v === 'string' ? new Date(v) : null
  return field(errors, Boolean(d && !Number.isNaN(d.getTime())), d ?? new Date(NaN), `${key}: fecha inválida (ISO 8601 con zona, p. ej. 2026-10-02T10:00:00-05:00)`)
}

export function parseBool(raw: Record<string, unknown>, key: string, errors: string[]) {
  return field(errors, typeof raw[key] === 'boolean', raw[key] === true, `${key}: debe ser true o false`)
}

export function parseText(raw: Record<string, unknown>, key: string, errors: string[], opts: { min?: number; max: number; optional?: boolean }) {
  const v = raw[key]
  if (v == null && opts.optional) return undefined
  const ok = typeof v === 'string' && v.trim().length >= (opts.min ?? 1) && v.trim().length <= opts.max
  return field(errors, ok, typeof v === 'string' ? v.trim() : '', `${key}: texto de ${opts.min ?? 1} a ${opts.max} caracteres`)
}

export function done<P>(errors: string[], params: P): Parsed<P> {
  return errors.length ? { ok: false, errors } : { ok: true, params }
}

export function requireObj(raw: unknown): Record<string, unknown> | null {
  return isObj(raw) ? raw : null
}

export const when = (d: Date | string | null | undefined) => (d ? new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(d)) : '—')
