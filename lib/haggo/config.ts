/** Haggo's configuration: types, defaults and validation. Pure (no database), so it is tested and shared with the UI. */

export const DOMAINS = ['ai_agents', 'marketing', 'operations', 'inbox', 'system', 'config', 'users', 'money'] as const
export type Domain = (typeof DOMAINS)[number]
export const DOMAIN_LABEL: Record<Domain, string> = {
  ai_agents: 'Agentes IA',
  marketing: 'Marketing',
  operations: 'Operación',
  inbox: 'Bandeja',
  system: 'Sistema',
  config: 'Configuración',
  users: 'Usuarios y socios',
  money: 'Dinero',
}

export const MODES = ['observer', 'copilot', 'autonomous'] as const
export type Mode = (typeof MODES)[number]
export const MODE_LABEL: Record<Mode, string> = { observer: 'Observador', copilot: 'Copiloto', autonomous: 'Autónomo' }

export const TRIGGERS = ['critical_incident', 'ai_down', 'error_spike'] as const
export type Trigger = (typeof TRIGGERS)[number]
export const TRIGGER_LABEL: Record<Trigger, string> = {
  critical_incident: 'Incidente crítico nuevo',
  ai_down: 'Proveedor de IA caído o sin crédito',
  error_spike: 'Pico de errores de la aplicación',
}

export const NOTICES = ['approvals', 'critical', 'budget', 'auto_undo', 'daily_report'] as const
export type Notice = (typeof NOTICES)[number]
export const NOTICE_LABEL: Record<Notice, string> = {
  approvals: 'Hay propuestas esperando tu aprobación (agrupadas, máximo cada 2 horas)',
  critical: 'Aparece una situación crítica nueva',
  budget: 'Haggo llegó a su tope de presupuesto',
  auto_undo: 'Haggo deshizo solo algo que había hecho',
  daily_report: 'El informe diario completo',
}

export const CYCLE_OPTIONS = [5, 15, 30, 60] as const

/** A window in which Haggo observes and proposes but executes nothing. `days` are the days it starts on (0 = domingo). */
export type QuietWindow = { days: number[]; from: string; to: string }

export type HaggoConfig = {
  enabled: boolean
  mode: Mode
  domainModes: Partial<Record<Domain, Mode>>
  mediumAllowed: Partial<Record<Domain, boolean>>
  maxRiskEnabled: Record<string, boolean>
  monthlyBudgetUsd: number
  dailyBudgetUsd: number
  maxActionsPerCycle: number
  maxActionsPerDay: number
  humanCooldownHours: number
  repeatCooldownHours: number
  cycleMinutes: number
  dailyReportHour: number | null
  weeklyReviewDay: number | null
  weeklyReviewHour: number
  proposalTtlHours: number
  triggers: Record<Trigger, boolean>
  quietHours: QuietWindow[]
  notify: Record<Notice, boolean>
  /** Who gets the emails; empty = the platform superadmins */
  notifyTo: string[]
  timezone: string
  model: string | null
}

export const DEFAULT_CONFIG: HaggoConfig = {
  enabled: true,
  mode: 'copilot',
  domainModes: {},
  mediumAllowed: {},
  maxRiskEnabled: {},
  monthlyBudgetUsd: 50,
  dailyBudgetUsd: 5,
  maxActionsPerCycle: 3,
  maxActionsPerDay: 20,
  humanCooldownHours: 24,
  repeatCooldownHours: 6,
  cycleMinutes: 15,
  dailyReportHour: 7,
  weeklyReviewDay: 1,
  weeklyReviewHour: 7,
  proposalTtlHours: 48,
  triggers: { critical_incident: true, ai_down: true, error_spike: true },
  quietHours: [],
  notify: { approvals: true, critical: true, budget: true, auto_undo: true, daily_report: false },
  notifyTo: [],
  timezone: 'America/Bogota',
  model: null,
}

const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const int = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback
}
const num = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 100) / 100 : fallback
}
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

function modeMap(v: unknown): Partial<Record<Domain, Mode>> {
  if (!isObj(v)) return {}
  const out: Partial<Record<Domain, Mode>> = {}
  for (const d of DOMAINS) if (MODES.includes(v[d] as Mode)) out[d] = v[d] as Mode
  return out
}

function boolMap<K extends string>(v: unknown, keys: readonly K[] | null): Partial<Record<K, boolean>> {
  if (!isObj(v)) return {}
  const out: Partial<Record<K, boolean>> = {}
  for (const [k, val] of Object.entries(v)) if (typeof val === 'boolean' && (!keys || keys.includes(k as K)) && /^[\w.:-]{1,60}$/.test(k)) out[k as K] = val
  return out
}

const EMAIL = /^[^\s@<>(),;:"]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$/

/** Up to 10 distinct, valid addresses (lowercased); anything else is dropped. */
export function parseEmails(v: unknown): string[] {
  const list = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[\s,;]+/) : []
  return Array.from(new Set(list.filter((x): x is string => typeof x === 'string').map((x) => x.trim().toLowerCase()).filter((x) => EMAIL.test(x)))).slice(0, 10)
}

export function parseQuietHours(v: unknown): QuietWindow[] {
  if (!Array.isArray(v)) return []
  return v.slice(0, 14).flatMap((w) => {
    if (!isObj(w) || typeof w.from !== 'string' || typeof w.to !== 'string' || !HHMM.test(w.from) || !HHMM.test(w.to) || w.from === w.to) return []
    const days = Array.isArray(w.days) ? Array.from(new Set(w.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))).sort() : []
    return days.length ? [{ days, from: w.from, to: w.to }] : []
  })
}

/** Row (or a PUT body merged over the current config) → a valid config; anything invalid keeps the previous value. */
export function normalizeConfig(raw: Record<string, unknown> | null | undefined, base: HaggoConfig = DEFAULT_CONFIG): HaggoConfig {
  const r = raw ?? {}
  const has = (k: string) => Object.prototype.hasOwnProperty.call(r, k)
  const nullableHour = (k: 'dailyReportHour') => (has(k) ? (r[k] === null ? null : int(r[k], 0, 23, base[k] ?? 7)) : base[k])
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : base.enabled,
    mode: MODES.includes(r.mode as Mode) ? (r.mode as Mode) : base.mode,
    domainModes: has('domainModes') ? modeMap(r.domainModes) : base.domainModes,
    mediumAllowed: has('mediumAllowed') ? boolMap(r.mediumAllowed, DOMAINS) : base.mediumAllowed,
    maxRiskEnabled: has('maxRiskEnabled') ? (boolMap(r.maxRiskEnabled, null) as Record<string, boolean>) : base.maxRiskEnabled,
    monthlyBudgetUsd: has('monthlyBudgetUsd') ? num(r.monthlyBudgetUsd, 0, 10_000, base.monthlyBudgetUsd) : base.monthlyBudgetUsd,
    dailyBudgetUsd: has('dailyBudgetUsd') ? num(r.dailyBudgetUsd, 0, 1_000, base.dailyBudgetUsd) : base.dailyBudgetUsd,
    maxActionsPerCycle: has('maxActionsPerCycle') ? int(r.maxActionsPerCycle, 0, 50, base.maxActionsPerCycle) : base.maxActionsPerCycle,
    maxActionsPerDay: has('maxActionsPerDay') ? int(r.maxActionsPerDay, 0, 500, base.maxActionsPerDay) : base.maxActionsPerDay,
    humanCooldownHours: has('humanCooldownHours') ? int(r.humanCooldownHours, 0, 720, base.humanCooldownHours) : base.humanCooldownHours,
    repeatCooldownHours: has('repeatCooldownHours') ? int(r.repeatCooldownHours, 0, 720, base.repeatCooldownHours) : base.repeatCooldownHours,
    cycleMinutes: has('cycleMinutes') && CYCLE_OPTIONS.includes(Number(r.cycleMinutes) as (typeof CYCLE_OPTIONS)[number]) ? Number(r.cycleMinutes) : base.cycleMinutes,
    dailyReportHour: nullableHour('dailyReportHour'),
    weeklyReviewDay: has('weeklyReviewDay') ? (r.weeklyReviewDay === null ? null : int(r.weeklyReviewDay, 0, 6, base.weeklyReviewDay ?? 1)) : base.weeklyReviewDay,
    weeklyReviewHour: has('weeklyReviewHour') ? int(r.weeklyReviewHour, 0, 23, base.weeklyReviewHour) : base.weeklyReviewHour,
    proposalTtlHours: has('proposalTtlHours') ? int(r.proposalTtlHours, 1, 720, base.proposalTtlHours) : base.proposalTtlHours,
    triggers: has('triggers') ? { ...base.triggers, ...boolMap(r.triggers, TRIGGERS) } : base.triggers,
    quietHours: has('quietHours') ? parseQuietHours(r.quietHours) : base.quietHours,
    notify: has('notify') ? { ...base.notify, ...boolMap(r.notify, NOTICES) } : base.notify,
    // Stored inside the notify column as `recipients`; the settings form sends notifyTo
    notifyTo: has('notifyTo') ? parseEmails(r.notifyTo) : isObj(r.notify) && Array.isArray(r.notify.recipients) ? parseEmails(r.notify.recipients) : base.notifyTo,
    timezone: typeof r.timezone === 'string' && /^[A-Za-z_]+\/[A-Za-z_]+$/.test(r.timezone) ? r.timezone : base.timezone,
    model: has('model') ? (typeof r.model === 'string' && /^[\w.:-]{1,80}$/.test(r.model.trim()) ? r.model.trim() : null) : base.model,
  }
}

/** The mode that applies to a domain: its own setting, or the general one. Money never runs alone. */
export function modeFor(cfg: Pick<HaggoConfig, 'mode' | 'domainModes'>, domain: Domain): Mode {
  const m = cfg.domainModes[domain] ?? cfg.mode
  return domain === 'money' && m === 'autonomous' ? 'copilot' : m
}
