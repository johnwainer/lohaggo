/**
 * The marketing agent's rules, with no DB and no API: autonomy per channel, the life of an idea and
 * its post, content guardrails, UTM links, when to publish, what the results say, and the checks on
 * what the model returns. Everything that decides whether something goes out lives here, tested.
 */
import type { MarketingChannel } from '@/lib/marketing/channel-rules'
import { countChars, countHashtags } from '@/lib/marketing/channel-rules'
import type { PostStatus } from '@/lib/marketing/publisher-core'
import { AGENT_CHANNELS, AGENT_FORMATS, AGENT_MODES, type AgentConfig, type AgentMode, type ChannelPlan, type Kpi } from '@/lib/marketing/agent-input'

const DAY = 24 * 3600_000
const CHANNEL_LABEL: Record<MarketingChannel, string> = { WEB: 'el blog', INSTAGRAM: 'Instagram', FACEBOOK: 'Facebook' }
export const WEEKDAY_NAME = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

// ─── Bogotá time (UTC-5 all year, no DST) ────────────────────────────────────

export function bogota(d: Date) {
  const x = new Date(d.getTime() - 5 * 3600_000)
  return { key: x.toISOString().slice(0, 10), weekday: x.getUTCDay(), hour: x.getUTCHours(), minute: x.getUTCMinutes() }
}
export const bogotaAt = (dayKey: string, hour: number) => new Date(`${dayKey}T${String(hour).padStart(2, '0')}:00:00-05:00`)
export const addDays = (dayKey: string, n: number) => new Date(Date.parse(`${dayKey}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10)
const weekdayOf = (dayKey: string) => new Date(`${dayKey}T12:00:00Z`).getUTCDay()
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`

// ─── Autonomy ────────────────────────────────────────────────────────────────

const rank = (m: AgentMode) => AGENT_MODES.indexOf(m)
const byRank = (r: number) => AGENT_MODES[Math.max(0, Math.min(AGENT_MODES.length - 1, r))]

export type ModeContext = { trialPostsRemaining: number; degradedReason: string | null }

/**
 * The mode that really applies to a piece: a channel can only be stricter than the agent; the trial
 * period and a degraded agent (budget, broken token) run in copilot whatever was configured.
 */
export function effectiveMode(mode: AgentMode, modeByChannel: Partial<Record<MarketingChannel, AgentMode>> | null, channels: MarketingChannel[], ctx: ModeContext): AgentMode {
  if (ctx.degradedReason || ctx.trialPostsRemaining > 0) return 'copilot'
  const perChannel = channels.length ? channels.map((c) => Math.min(rank(mode), rank(modeByChannel?.[c] ?? mode))) : [rank(mode)]
  return byRank(Math.min(...perChannel))
}

/** Why the agent must run in copilot right now, or null. */
export function degradation(p: { agentBudget: { spentUsd: number; capUsd: number }; workspaceBlocked: boolean; brokenAccounts: string[] }) {
  if (p.workspaceBlocked) return 'Se alcanzó el tope mensual de IA del workspace'
  if (p.agentBudget.capUsd > 0 && p.agentBudget.spentUsd >= p.agentBudget.capUsd) return 'Se agotó el presupuesto mensual del agente'
  if (p.brokenAccounts.length) return `Cuenta sin permiso para publicar: ${p.brokenAccounts.join(', ')}`
  return null
}

export function budgetLevel(spentUsd: number, capUsd: number): 'ok' | 'warn' | 'blocked' {
  if (capUsd <= 0) return 'blocked'
  const r = spentUsd / capUsd
  return r >= 1 ? 'blocked' : r >= 0.8 ? 'warn' : 'ok'
}

// ─── States of an idea and its post ─────────────────────────────────────────

export type IdeaState = 'idea_proposed' | 'idea_accepted' | 'idea_rejected' | 'idea_drafted' | 'idea_discarded'
export type AgentState = 'new' | IdeaState | PostStatus
export type AgentEvent =
  | 'idea_created' | 'idea_accepted' | 'idea_rejected'
  | 'drafted' | 'approved' | 'rejected' | 'scheduled' | 'cancelled' | 'edited'
  | 'due' | 'published' | 'partial' | 'failed' | 'paused'
export type AgentAction =
  | 'notify_ideas' | 'notify_approval' | 'notify_opt_out' | 'notify_draft_problem' | 'notify_published' | 'notify_failed'
  | 'schedule' | 'set_opt_out_deadline' | 'cancel_scheduled'
  | 'record_rejection' | 'reject_idea' | 'mark_idea_drafted' | 'consume_trial'

export type TransitionContext = {
  /** Draft passed channel validation and guardrails */
  valid?: boolean
  /** Guardrails sent it to a person (unauthorised number, low confidence…) */
  needsReview?: boolean
  /** The piece was written during the trial period */
  trial?: boolean
  canPublish?: boolean
  /** Cancel = drop it (archived) instead of keeping it approved out of the queue */
  discard?: boolean
}
export type Transition = { state: AgentState; actions: AgentAction[] }

/**
 * One step of the agent's workflow. Null = the event does not apply in that state (the caller refuses
 * it). The publishing itself stays with the existing worker: this only decides what goes to it.
 */
export function nextAgentState(current: AgentState, event: AgentEvent, mode: AgentMode, ctx: TransitionContext = {}): Transition | null {
  const t = (state: AgentState, ...actions: AgentAction[]): Transition => ({ state, actions })

  if (event === 'paused') {
    // Only what is queued comes out; drafts, reviews and published posts stay as they are
    if (current === 'scheduled') return t('approved', 'cancel_scheduled')
    return t(current)
  }

  switch (current) {
    case 'new':
      if (event === 'idea_created') return mode === 'copilot' ? t('idea_proposed', 'notify_ideas') : t('idea_accepted')
      return null
    case 'idea_proposed':
      if (event === 'idea_accepted') return t('idea_accepted')
      if (event === 'idea_rejected') return t('idea_rejected', 'record_rejection')
      return null
    case 'idea_accepted':
    case 'draft':
      if (event === 'idea_rejected' && current === 'idea_accepted') return t('idea_rejected', 'record_rejection')
      if (event === 'rejected' && current === 'draft') return t('archived', 'record_rejection', 'reject_idea')
      if (event === 'edited' && current === 'draft') return t('draft')
      if (event !== 'drafted') return null
      {
        const extra: AgentAction[] = current === 'idea_accepted' ? ['mark_idea_drafted'] : []
        if (ctx.trial) extra.push('consume_trial')
        if (!ctx.valid) return t('draft', ...extra, 'notify_draft_problem')
        if (ctx.needsReview || mode === 'copilot') return t('review', ...extra, 'notify_approval')
        if (mode === 'supervised') return t('scheduled', ...extra, 'schedule', 'set_opt_out_deadline', 'notify_opt_out')
        return t('scheduled', ...extra, 'schedule')
      }
    case 'review':
      if (event === 'approved') return ctx.canPublish ? t('approved', 'schedule') : null
      if (event === 'rejected') return t('archived', 'record_rejection', 'reject_idea')
      if (event === 'edited') return t('review')
      if (event === 'drafted') return ctx.valid ? t('review', 'notify_approval') : t('draft', 'notify_draft_problem')
      return null
    case 'approved':
      if (event === 'scheduled') return t('scheduled')
      if (event === 'rejected') return t('archived', 'record_rejection', 'reject_idea')
      if (event === 'edited') return ctx.canPublish ? t('approved') : t('review', 'notify_approval')
      return null
    case 'scheduled':
      if (event === 'cancelled') return ctx.discard ? t('archived', 'cancel_scheduled', 'record_rejection', 'reject_idea') : t('approved', 'cancel_scheduled')
      if (event === 'edited') return ctx.canPublish ? t('scheduled') : t('review', 'cancel_scheduled', 'notify_approval')
      if (event === 'due') return t('publishing')
      return null
    case 'publishing':
      if (event === 'published') return t('published', 'notify_published')
      if (event === 'partial') return t('partial', 'notify_failed')
      if (event === 'failed') return t('failed', 'notify_failed')
      return null
    default:
      return null
  }
}

/** The campaign's KPI now, from its published totals, to show against the goal. */
export function campaignKpi(kpi: Kpi, t: { reach: number; clicks: number; webViews: number; engagementRate: number | null }, conversations: number): number | null {
  switch (kpi) {
    case 'reach': return t.reach + t.webViews
    case 'web_visits': return t.webViews
    case 'clicks': return t.clicks
    case 'conversations': return conversations
    case 'engagement': return t.engagementRate
  }
}

// ─── Content guardrails ─────────────────────────────────────────────────────

export const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%$ ]/g, ' ').replace(/\s+/g, ' ').trim()

export type GuardrailIssue = { code: string; message: string; channel?: MarketingChannel; severity: 'block' | 'review' }
export type GuardrailContext = {
  now: Date
  promos: Array<{ text: string; endsAt: string | null }>
  /** Texts the person wrote (facts, price notes, promos): numbers found there are allowed */
  allowedTexts: string[]
  /** Catalog prices (basePrice) */
  prices: number[]
  bannedWords: string[]
  bannedTopics: string[]
  ownDomains: string[]
  allowedDomains: string[]
  allowedHandles?: string[]
  confidence?: number | null
  confidenceThreshold?: number
}
export type GuardrailResult = { ok: boolean; needsReview: boolean; issues: GuardrailIssue[] }

const MONTHS = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre'
const MONEY_RE = /\$\s?\d[\d.,]*(?:\s?(?:mil|millones|millón|k)\b)?|\b\d[\d.,]*\s?(?:pesos|cop)\b|\bcop\s?\d[\d.,]*/gi
const PERCENT_RE = /\d+(?:[.,]\d+)?\s?%/g
const DATE_RE = new RegExp(`\\b\\d{1,2}\\s+de\\s+(?:${MONTHS})\\b|\\b\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?\\b`, 'gi')
const URL_RE = /https?:\/\/[^\s)\]>"'<]+|\bwww\.[^\s)\]>"'<]+/gi
const HANDLE_RE = /(^|[^\w@])@([A-Za-z0-9._]{2,30})/g
const CODE_RE = /\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{4,}\b/g

/** "$50.000", "50 mil", "15 %", "1.200.000 pesos" → the number. Colombian notation: "." thousands, "," decimals. */
export function amountOf(token: string): number | null {
  const t = token.toLowerCase()
  const m = t.match(/\d[\d.,]*/)
  if (!m) return null
  let raw = m[0].replace(/[.,]$/, '')
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) raw = raw.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(,\d{3})+$/.test(raw)) raw = raw.replace(/,/g, '')
  else raw = raw.replace(',', '.')
  let n = Number(raw)
  if (!Number.isFinite(n)) return null
  if (/\bmil\b|\dk\b/.test(t)) n *= 1000
  if (/millones|millón/.test(t)) n *= 1_000_000
  return n
}

function numbersIn(text: string) {
  return (text.match(/\$?\s?\d[\d.,]*(?:\s?(?:mil|millones|millón|k)\b)?/gi) || []).map(amountOf).filter((n): n is number => n !== null)
}

function hostOf(url: string) {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}
const hostAllowed = (host: string, domains: string[]) => domains.some((d) => host === d || host.endsWith(`.${d}`))

export function linksIn(text: string) {
  return (text.match(URL_RE) || []).map((u) => u.replace(/[.,;:!?]+$/, ''))
}

/** Codes like "LLUVIA20" in a promo: if a post repeats one, it talks about that promo. */
function promoMentioned(text: string, promo: string) {
  const t = ` ${norm(text)} `
  if (norm(promo).length >= 12 && t.includes(` ${norm(promo)} `)) return true
  return (promo.match(CODE_RE) || []).some((code) => new RegExp(`\\b${code}\\b`, 'i').test(text))
}

/**
 * Checks every channel's text before anything is scheduled. "block": it cannot go out as it is (the
 * agent corrects once, then a person). "review": it may go out, but only after a person approves it.
 */
export function checkGuardrails(texts: Array<{ channel: MarketingChannel; text: string; linkUrl?: string | null }>, ctx: GuardrailContext): GuardrailResult {
  const issues: GuardrailIssue[] = []
  const add = (i: GuardrailIssue) => { if (!issues.some((x) => x.code === i.code && x.message === i.message)) issues.push(i) }
  const allowedAmounts = [...ctx.prices, ...ctx.allowedTexts.flatMap(numbersIn), ...ctx.promos.filter((p) => !isExpired(p, ctx.now)).flatMap((p) => numbersIn(p.text))]
  const allowedNorm = norm([...ctx.allowedTexts, ...ctx.promos.filter((p) => !isExpired(p, ctx.now)).map((p) => p.text)].join(' '))
  const own = [...ctx.ownDomains, ...ctx.allowedDomains]
  const handles = (ctx.allowedHandles || []).map((h) => h.replace(/^@/, '').toLowerCase())

  for (const { channel, text, linkUrl } of texts) {
    const n = ` ${norm(text)} `
    for (const tok of [...(text.match(MONEY_RE) || []), ...(text.match(PERCENT_RE) || [])]) {
      const v = amountOf(tok)
      if (v === null || allowedAmounts.some((a) => Math.abs(a - v) < 0.5)) continue
      add({ code: 'number', channel, severity: 'review', message: `«${tok.trim()}» no está en la oferta configurada: revisa el precio o porcentaje` })
    }
    for (const tok of text.match(DATE_RE) || []) {
      if (allowedNorm.includes(norm(tok))) continue
      add({ code: 'date', channel, severity: 'review', message: `La fecha «${tok}» no está en la configuración: confírmala` })
    }
    for (const p of ctx.promos) {
      if (isExpired(p, ctx.now) && promoMentioned(text, p.text)) add({ code: 'expired_promo', channel, severity: 'block', message: `Menciona una promoción vencida: «${p.text.slice(0, 60)}»` })
    }
    for (const w of ctx.bannedWords) {
      if (norm(w) && n.includes(` ${norm(w)} `)) add({ code: 'banned_word', channel, severity: 'block', message: `Usa una expresión prohibida: «${w}»` })
    }
    for (const topic of ctx.bannedTopics) {
      if (norm(topic) && n.includes(` ${norm(topic)} `)) add({ code: 'banned_topic', channel, severity: 'block', message: `Toca un tema prohibido: «${topic}»` })
    }
    for (const url of [...linksIn(text), ...(linkUrl ? [linkUrl] : [])]) {
      const host = hostOf(url)
      if (!host || !hostAllowed(host, own)) add({ code: 'domain', channel, severity: 'block', message: `Enlace a un sitio no autorizado: ${host || url}` })
    }
    for (const m of Array.from(text.matchAll(HANDLE_RE))) {
      if (!handles.includes(m[2].toLowerCase())) add({ code: 'mention', channel, severity: 'review', message: `Menciona a @${m[2]}: confirma que es correcto` })
    }
  }
  if (ctx.confidence != null && ctx.confidenceThreshold != null && ctx.confidence < ctx.confidenceThreshold) {
    add({ code: 'low_confidence', severity: 'review', message: `El agente tiene poca confianza en esta pieza (${Math.round(ctx.confidence * 100)} %)` })
  }
  return { ok: !issues.some((i) => i.severity === 'block'), needsReview: issues.some((i) => i.severity === 'review'), issues }
}

export function isExpired(promo: { endsAt: string | null }, now: Date) {
  return Boolean(promo.endsAt && new Date(promo.endsAt).getTime() < now.getTime())
}

// ─── UTM ────────────────────────────────────────────────────────────────────

export type UtmParams = { channel: MarketingChannel; campaignSlug: string; postId: string }

export function utmFor(p: UtmParams) {
  return {
    utm_source: p.channel === 'WEB' ? 'blog' : p.channel === 'INSTAGRAM' ? 'instagram' : 'facebook',
    utm_medium: p.channel === 'WEB' ? 'organic' : 'social',
    utm_campaign: p.campaignSlug,
    utm_content: p.postId,
  }
}

/** Our own links carry the campaign's UTM (overwriting stale ones); other sites' links are left alone. */
export function withUtm(url: string, p: UtmParams, ownDomains: string[]) {
  const host = hostOf(url)
  if (!host || !hostAllowed(host, ownDomains)) return url
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    for (const [k, v] of Object.entries(utmFor(p))) u.searchParams.set(k, v)
    return u.toString()
  } catch {
    return url
  }
}

export function applyUtmToText(text: string, p: UtmParams, ownDomains: string[]) {
  return text.replace(URL_RE, (m) => {
    const trail = m.match(/[.,;:!?]+$/)?.[0] ?? ''
    return withUtm(m.slice(0, m.length - trail.length), p, ownDomains) + trail
  })
}

export function hasUtm(url: string) {
  return /[?&]utm_source=/.test(url) && /[?&]utm_campaign=/.test(url)
}

// ─── Repetition and quotas ──────────────────────────────────────────────────

const words = (s: string) => new Set(norm(s).split(' ').filter((w) => w.length > 3))
export function similarity(a: string, b: string) {
  const A = words(a)
  const B = words(b)
  if (!A.size || !B.size) return 0
  let inter = 0
  A.forEach((w) => { if (B.has(w)) inter++ })
  return inter / (A.size + B.size - inter)
}

/** Same service with a similar angle in the last `days` days. */
export function isRepeat(idea: { service: string | null; angle: string; at: Date }, recent: Array<{ service: string | null; angle: string; at: Date }>, days: number) {
  if (days <= 0) return false
  return recent.some((r) =>
    Math.abs(r.at.getTime() - idea.at.getTime()) < days * DAY &&
    norm(r.service || '') === norm(idea.service || '') &&
    similarity(r.angle, idea.angle) >= 0.5,
  )
}

/**
 * Pieces still missing per channel in the planning horizon (frequency minus what is already planned),
 * with target days spread over the horizon on allowed weekdays.
 */
export function calendarGaps(p: { now: Date; horizonDays: number; channels: Record<MarketingChannel, ChannelPlan>; planned: Array<{ channel: MarketingChannel; at: Date }>; days: number[] }) {
  const end = p.now.getTime() + p.horizonDays * DAY
  const today = bogota(p.now).key
  const out: Array<{ channel: MarketingChannel; needed: number; dates: string[] }> = []
  for (const channel of AGENT_CHANNELS) {
    const plan = p.channels[channel]
    if (!plan.enabled || plan.perWeek <= 0) continue
    const planned = p.planned.filter((x) => x.channel === channel && x.at.getTime() >= p.now.getTime() && x.at.getTime() <= end)
    const target = Math.round((plan.perWeek * p.horizonDays) / 7)
    const needed = Math.max(0, target - planned.length)
    if (!needed) continue
    const taken = new Set(planned.map((x) => bogota(x.at).key))
    const step = p.horizonDays / target
    const dates: string[] = []
    for (let i = 0; i < target && dates.length < needed; i++) {
      let key = addDays(today, Math.max(1, Math.round(1 + i * step)))
      for (let guard = 0; guard < 7 && (!p.days.includes(weekdayOf(key)) || taken.has(key) || dates.includes(key)); guard++) key = addDays(key, 1)
      if (Date.parse(`${key}T00:00:00-05:00`) > end) break
      if (!taken.has(key) && !dates.includes(key)) dates.push(key)
    }
    out.push({ channel, needed, dates })
  }
  return out
}

// ─── Smart scheduling ───────────────────────────────────────────────────────

/** Below this many measured posts in a channel the agent uses the baseline hours. */
export const MIN_MEASURED = 8
/** Weight of the channel average in the smoothed score (as if it were this many posts). */
const PRIOR_WEIGHT = 3

/**
 * Baseline for Colombia while there is little data (Bogotá time, 0 = Sunday). Common benchmarks for
 * Latin American audiences: Instagram at lunch and after work, Facebook at lunch and evening, the blog
 * on weekday mornings (search). Hours in order of preference. Adjust here.
 */
export const BASE_SLOTS: Record<MarketingChannel, { days: number[]; hours: number[] }> = {
  INSTAGRAM: { days: [2, 3, 4, 5], hours: [12, 19, 11, 18, 20] },
  FACEBOOK: { days: [1, 2, 3, 4, 5], hours: [13, 20, 12, 19] },
  WEB: { days: [2, 3, 4], hours: [9, 8] },
}

export type SlotPerformance = {
  channelMean: number
  byHour: Record<number, { n: number; mean: number }>
  byWeekday: Record<number, { n: number; mean: number }>
}

export type SlotInput = {
  channel: MarketingChannel
  /** The idea's target day (the agent looks there first, then later) */
  target: Date
  /** Nothing before this (now + lead, or now + opt-out margin in supervised mode) */
  earliest: Date
  horizonEnd: Date
  smart: boolean
  allowedDays: number[]
  windows: Array<{ from: number; to: number }>
  quietFrom: number
  quietTo: number
  minGapHours: number
  maxPerDay: number
  /** Scheduled or published in this channel, any account of the workspace */
  taken: Date[]
  kpi: Kpi
  measured: number
  performance: SlotPerformance | null
  explore: number
  /** 0..1, injected so tests are deterministic */
  random: number
}
export type SlotChoice = { at: Date; reason: string; kind: 'base' | 'custom' | 'learned' | 'explore' }

export function inQuiet(hour: number, from: number, to: number) {
  if (from === to) return false
  return from < to ? hour >= from && hour < to : hour >= from || hour < to
}

function hoursOf(windows: Array<{ from: number; to: number }>) {
  const out: number[] = []
  for (const w of windows) for (let h = w.from; h < w.to; h++) if (!out.includes(h)) out.push(h)
  return out.length ? out : Array.from({ length: 14 }, (_, i) => i + 7)
}

export function formatKpi(kpi: Kpi, v: number) {
  const f = (x: number, d = 1) => x.toFixed(d).replace('.', ',')
  if (kpi === 'engagement') return `${f(v)} % de interacción`
  if (kpi === 'reach') return `${Math.round(v)} personas alcanzadas de media`
  if (kpi === 'conversations') return `${f(v)} conversaciones por cada 1.000 alcanzados`
  return `${f(v)} ${kpi === 'web_visits' ? 'visitas' : 'clics'} de media`
}

const smooth = (s: { n: number; mean: number } | undefined, prior: number) => (s ? (s.n * s.mean + PRIOR_WEIGHT * prior) / (s.n + PRIOR_WEIGHT) : prior)

/**
 * When a piece goes out. Few data: the first free baseline slot from the target day. Enough data:
 * the best smoothed slot within 2 days of the target, except a share of the time (exploration) when
 * it tries a little-tested hour. Never in quiet hours, never closer than the minimum gap to another
 * piece of the same channel, never above the daily cap. Null if nothing fits in the horizon.
 */
export function pickSlot(i: SlotInput): SlotChoice | null {
  const start = bogota(i.target.getTime() > i.earliest.getTime() ? i.target : i.earliest).key
  const end = bogota(i.horizonEnd).key
  const learned = i.smart && i.measured >= MIN_MEASURED && Boolean(i.performance)
  const allowedHours = hoursOf(i.windows)
  const base = BASE_SLOTS[i.channel]
  let days = i.allowedDays
  let hours = allowedHours
  if (i.smart && !learned) {
    const d = base.days.filter((x) => i.allowedDays.includes(x))
    const h = base.hours.filter((x) => allowedHours.includes(x))
    if (d.length) days = d
    if (h.length) hours = h
  }
  const gap = i.minGapHours * 3600_000
  const perDay = new Map<string, number>()
  for (const t of i.taken) perDay.set(bogota(t).key, (perDay.get(bogota(t).key) ?? 0) + 1)

  const candidates: Array<{ at: Date; hour: number; weekday: number; away: number }> = []
  for (let key = start, away = 0; key <= end && away < 62; key = addDays(key, 1), away++) {
    const weekday = weekdayOf(key)
    if (!days.includes(weekday) || (perDay.get(key) ?? 0) >= i.maxPerDay) continue
    for (const hour of hours) {
      if (inQuiet(hour, i.quietFrom, i.quietTo)) continue
      const at = bogotaAt(key, hour)
      if (at.getTime() < i.earliest.getTime() || at.getTime() > i.horizonEnd.getTime() + DAY) continue
      if (i.taken.some((t) => Math.abs(t.getTime() - at.getTime()) < gap)) continue
      candidates.push({ at, hour, weekday, away })
    }
  }
  if (!candidates.length) return null
  const label = (c: { weekday: number; hour: number }) => `${capital(WEEKDAY_NAME[c.weekday])} ${hh(c.hour)}`

  if (!learned) {
    const c = candidates[0]
    const reason = i.smart
      ? `${label(c)}: horario base de ${CHANNEL_LABEL[i.channel]} en Colombia (${i.measured} de ${MIN_MEASURED} publicaciones medidas para aprender tus horarios)`
      : `${label(c)}: primera franja libre de tus horarios`
    return { at: c.at, reason, kind: i.smart ? 'base' : 'custom' }
  }

  const perf = i.performance!
  const near = candidates.filter((c) => c.away <= 2)
  const pool = near.length ? near : candidates
  if (i.random < i.explore) {
    const untested = pool.filter((c) => (perf.byHour[c.hour]?.n ?? 0) < 2)
    if (untested.length) {
      const c = untested[0]
      return { at: c.at, reason: `${label(c)}: franja poco probada en ${CHANNEL_LABEL[i.channel]}; la probamos para aprender`, kind: 'explore' }
    }
  }
  const score = (c: { hour: number; weekday: number; away: number }) => {
    const h = smooth(perf.byHour[c.hour], perf.channelMean)
    const w = smooth(perf.byWeekday[c.weekday], perf.channelMean)
    const combined = perf.channelMean > 0 ? (h * w) / perf.channelMean : h
    return combined * (1 - 0.05 * c.away)
  }
  const best = pool.reduce((a, b) => (score(b) > score(a) ? b : a))
  const stat = perf.byHour[best.hour]
  const reason = stat && stat.n > 0
    ? `${label(best)}: tu mejor franja disponible en ${CHANNEL_LABEL[i.channel]}, ${formatKpi(i.kpi, stat.mean)} (${stat.n} ${stat.n === 1 ? 'publicación' : 'publicaciones'})`
    : `${label(best)}: franja estimada con tu media de ${CHANNEL_LABEL[i.channel]} (${formatKpi(i.kpi, perf.channelMean)})`
  return { at: best.at, reason, kind: 'learned' }
}

// ─── Learning ───────────────────────────────────────────────────────────────

export type PostFeatures = {
  pillar: string | null
  service: string | null
  channels: MarketingChannel[]
  format: Partial<Record<MarketingChannel, string>>
  length: Partial<Record<MarketingChannel, number>>
  hashtags: Partial<Record<MarketingChannel, number>>
  weekday: number | null
  hour: number | null
  imageSource: string | null
  cta: boolean
  explore: boolean
}

export function postFeatures(p: {
  pillar: string | null; service: string | null; explore: boolean; cta: string | null; imageSource: string | null
  variants: Array<{ channel: MarketingChannel; body: string; format: string | null }>; at: Date | null
}): PostFeatures {
  const f: PostFeatures = { pillar: p.pillar, service: p.service, channels: p.variants.map((v) => v.channel), format: {}, length: {}, hashtags: {}, weekday: null, hour: null, imageSource: p.imageSource, cta: Boolean(p.cta?.trim()), explore: p.explore }
  for (const v of p.variants) {
    if (v.format) f.format[v.channel] = v.format
    f.length[v.channel] = countChars(v.body)
    f.hashtags[v.channel] = countHashtags(v.body)
  }
  if (p.at) Object.assign(f, { weekday: bogota(p.at).weekday, hour: bogota(p.at).hour })
  return f
}

export type RowMetrics = { reach: number; likes: number; comments: number; shares: number; saves: number; clicks: number; webViews: number; conversations: number }
export type LearningRow = { postId: string; title: string; channel: MarketingChannel; publishedAt: Date; features: PostFeatures; metrics: RowMetrics }

/** Value of the campaign's KPI for one channel send; null when that channel cannot measure it. */
export function kpiValue(kpi: Kpi, channel: MarketingChannel, m: RowMetrics): number | null {
  const web = channel === 'WEB'
  switch (kpi) {
    case 'reach': return web ? m.webViews : m.reach
    case 'web_visits': return web ? m.webViews : m.clicks
    case 'clicks': return web ? m.webViews : m.clicks
    case 'engagement': return web || !m.reach ? null : ((m.likes + m.comments + m.shares + m.saves + m.clicks) / m.reach) * 100
    case 'conversations': return web || !m.reach ? null : (m.conversations * 1000) / m.reach
  }
}

const hourBucket = (h: number | null) => (h === null ? null : h < 11 ? 'mañana' : h < 15 ? 'mediodía' : h < 18 ? 'tarde' : 'noche')
const lengthBucket = (n: number | undefined, channel: MarketingChannel) => {
  if (n == null) return null
  const [a, b] = channel === 'WEB' ? [3500, 7000] : [300, 900]
  return n < a ? 'corto' : n < b ? 'medio' : 'largo'
}
const hashtagBucket = (n: number | undefined) => (n == null ? null : n === 0 ? '0' : n <= 4 ? '1-4' : n <= 12 ? '5-12' : '13+')

export const DIMENSIONS = ['pillar', 'format', 'channel', 'slot', 'weekday', 'service', 'length', 'hashtags', 'imageSource', 'explore'] as const
export type Dimension = (typeof DIMENSIONS)[number]
export const DIMENSION_LABEL: Record<Dimension, string> = {
  pillar: 'Pilar', format: 'Formato', channel: 'Canal', slot: 'Franja', weekday: 'Día', service: 'Servicio', length: 'Longitud', hashtags: 'Hashtags', imageSource: 'Imagen', explore: 'Exploración',
}

function dimValue(d: Dimension, r: LearningRow): string | null {
  const f = r.features
  switch (d) {
    case 'pillar': return f.pillar
    case 'format': return f.format[r.channel] ? `${r.channel}:${f.format[r.channel]}` : null
    case 'channel': return r.channel
    case 'slot': return hourBucket(f.hour)
    case 'weekday': return f.weekday === null ? null : WEEKDAY_NAME[f.weekday]
    case 'service': return f.service
    case 'length': return lengthBucket(f.length[r.channel], r.channel)
    case 'hashtags': return r.channel === 'WEB' ? null : hashtagBucket(f.hashtags[r.channel])
    case 'imageSource': return f.imageSource
    case 'explore': return f.explore ? 'prueba' : 'lo que funciona'
  }
}

export type DimensionStat = { value: string; n: number; lift: number; smoothedLift: number; meanValue: number; lowData: boolean }
export type Rejection = { kind: 'idea' | 'post'; pillar: string | null; service: string | null; reason: string | null; what?: string }

/**
 * What worked: each send's KPI compared with the channel's average (lift 1 = average), grouped by
 * every variable the agent controls. Smoothed toward 1 so two lucky posts do not make a rule.
 */
export function learningStats(rows: LearningRow[], kpi: Kpi, rejections: Rejection[] = []) {
  const valued = rows.map((r) => ({ r, v: kpiValue(kpi, r.channel, r.metrics) })).filter((x): x is { r: LearningRow; v: number } => x.v !== null)
  const channelMean = new Map<MarketingChannel, number>()
  for (const c of AGENT_CHANNELS) {
    const vs = valued.filter((x) => x.r.channel === c).map((x) => x.v)
    if (vs.length) channelMean.set(c, vs.reduce((a, b) => a + b, 0) / vs.length)
  }
  const lifted = valued.map((x) => {
    const mean = channelMean.get(x.r.channel) ?? 0
    return { ...x, lift: mean > 0 ? x.v / mean : 1 }
  })

  const byDimension = {} as Record<Dimension, DimensionStat[]>
  for (const d of DIMENSIONS) {
    const groups = new Map<string, { n: number; lift: number; value: number }>()
    for (const x of lifted) {
      const key = dimValue(d, x.r)
      if (key === null) continue
      const g = groups.get(key) ?? { n: 0, lift: 0, value: 0 }
      g.n++
      g.lift += x.lift
      g.value += x.v
      groups.set(key, g)
    }
    byDimension[d] = Array.from(groups.entries())
      .map(([value, g]) => ({ value, n: g.n, lift: g.lift / g.n, smoothedLift: (g.lift + PRIOR_WEIGHT) / (g.n + PRIOR_WEIGHT), meanValue: g.value / g.n, lowData: g.n < 3 }))
      .sort((a, b) => b.smoothedLift - a.smoothedLift)
  }

  const perPost = new Map<string, { postId: string; title: string; lifts: number[]; channels: MarketingChannel[] }>()
  for (const x of lifted) {
    const p = perPost.get(x.r.postId) ?? { postId: x.r.postId, title: x.r.title, lifts: [], channels: [] }
    p.lifts.push(x.lift)
    p.channels.push(x.r.channel)
    perPost.set(x.r.postId, p)
  }
  const ranked = Array.from(perPost.values()).map((p) => ({ postId: p.postId, title: p.title, channels: p.channels, lift: p.lifts.reduce((a, b) => a + b, 0) / p.lifts.length })).sort((a, b) => b.lift - a.lift)

  const reasons = new Map<string, number>()
  for (const r of rejections) if (r.reason) reasons.set(r.reason, (reasons.get(r.reason) ?? 0) + 1)

  return {
    kpi,
    measured: valued.length,
    posts: perPost.size,
    channelMean: Object.fromEntries(channelMean) as Partial<Record<MarketingChannel, number>>,
    byDimension,
    best: ranked.slice(0, 3),
    worst: ranked.length > 3 ? ranked.slice(-3).reverse() : [],
    rejections: { total: rejections.length, byReason: Array.from(reasons.entries()).map(([reason, n]) => ({ reason, n })).sort((a, b) => b.n - a.n).slice(0, 10), items: rejections.slice(0, 20) },
  }
}
export type LearningStats = ReturnType<typeof learningStats>

/** Per-channel hour and weekday table for pickSlot, from the measured sends. */
export function slotPerformance(rows: LearningRow[], kpi: Kpi, channel: MarketingChannel): { measured: number; performance: SlotPerformance | null } {
  const vs = rows.filter((r) => r.channel === channel && r.features.hour !== null).map((r) => ({ r, v: kpiValue(kpi, channel, r.metrics) })).filter((x): x is { r: LearningRow; v: number } => x.v !== null)
  if (!vs.length) return { measured: 0, performance: null }
  const channelMean = vs.reduce((a, b) => a + b.v, 0) / vs.length
  const group = (key: (r: LearningRow) => number | null) => {
    const out: Record<number, { n: number; mean: number }> = {}
    for (const x of vs) {
      const k = key(x.r)
      if (k === null) continue
      const g = out[k] ?? { n: 0, mean: 0 }
      g.mean = (g.mean * g.n + x.v) / (g.n + 1)
      g.n++
      out[k] = g
    }
    return out
  }
  return { measured: vs.length, performance: { channelMean, byHour: group((r) => r.features.hour), byWeekday: group((r) => r.features.weekday) } }
}

// ─── What the model returns ─────────────────────────────────────────────────

export type Pillar = { name: string; weight: number; description: string; services: string[]; angles: string[] }
export type Strategy = {
  summary: string
  pillars: Pillar[]
  keyMessages: Array<{ segment: string; message: string }>
  formatMix: Array<{ channel: MarketingChannel; formats: Array<{ format: string; share: number }> }>
  weeklyCalendar: Array<{ weekday: number; channel: MarketingChannel; pillar: string }>
  kpi: { name: string; target: string; measurement: string }
  hypotheses: string[]
  risks: string[]
  /** Angles to avoid learned from results (the retrospective may add; never the banned topics) */
  avoid?: string[]
}
export type IdeaDraft = {
  pillar: string; service: string | null; angle: string; hypothesis: string; channels: MarketingChannel[]
  formats: Partial<Record<MarketingChannel, string>>; targetDate: string; slotHint: 'morning' | 'midday' | 'evening' | null
  rationale: string; explore: boolean; confidence: number
}
export type PostDraft = {
  title: string; brief: string; service: string | null; cta: string; confidence: number; risks: string[]; hypothesis: string
  image: { query: string; alt: string; prompt: string }
  web: { body: string; seoTitle: string; seoDescription: string; slug: string; excerpt: string; tags: string[]; category: string } | null
  instagram: { caption: string; format: string } | null
  facebook: { text: string; link: string | null } | null
}
export type Recommendation =
  | { type: 'pillar_weight'; pillar: string; weight: number; reason: string }
  | { type: 'frequency'; channel: MarketingChannel; perWeek: number; reason: string }
  | { type: 'format'; channel: MarketingChannel; format: string; direction: 'more' | 'less'; reason: string }
  | { type: 'slot'; channel: MarketingChannel; note: string; reason: string }
  | { type: 'avoid'; topic: string; reason: string }
  | { type: 'test'; idea: string; reason: string }
export type Retrospective = { insights: string[]; recommendations: Recommendation[] }

export type Parsed<T> = { ok: true; value: T } | { ok: false; errors: string[] }

type Json = Record<string, unknown>
const isObj = (v: unknown): v is Json => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const arr = (v: unknown) => (Array.isArray(v) ? v : [])
const strs = (v: unknown, maxItems: number, maxLen: number) => arr(v).map((x) => s(x, maxLen)).filter(Boolean).slice(0, maxItems)
const chan = (v: unknown): MarketingChannel | null => (v === 'WEB' || v === 'INSTAGRAM' || v === 'FACEBOOK' ? v : null)
const num01 = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null)

/** The `input` of the named tool call in the model's answer, or null if it did not call it. */
export function toolInput(content: ReadonlyArray<{ type: string; name?: string; input?: unknown }>, name: string): unknown | null {
  const block = content.find((b) => b.type === 'tool_use' && b.name === name)
  return block ? block.input ?? null : null
}

export function parseStrategy(input: unknown): Parsed<Strategy> {
  if (!isObj(input)) return { ok: false, errors: ['La respuesta no es un objeto'] }
  const errors: string[] = []
  const pillars = arr(input.pillars).filter(isObj).map((p) => ({
    name: s(p.name, 60), weight: typeof p.weight === 'number' && p.weight > 0 ? p.weight : 0, description: s(p.description, 400),
    services: strs(p.services, 10, 80), angles: strs(p.angles, 8, 160),
  })).filter((p) => p.name && p.weight > 0)
  if (pillars.length < 3 || pillars.length > 5) errors.push(`Debe haber de 3 a 5 pilares con nombre y peso (hay ${pillars.length})`)
  if (new Set(pillars.map((p) => norm(p.name))).size !== pillars.length) errors.push('Hay pilares repetidos')
  const total = pillars.reduce((a, p) => a + p.weight, 0)
  // Weights as percentages that add up to 100
  let acc = 0
  pillars.forEach((p, i) => {
    p.weight = i === pillars.length - 1 ? 100 - acc : Math.round((p.weight / (total || 1)) * 100)
    acc += p.weight
  })
  const summary = s(input.summary, 1200)
  if (!summary) errors.push('Falta el resumen de la estrategia')
  const kpi = isObj(input.kpi) ? { name: s(input.kpi.name, 80), target: s(input.kpi.target, 200), measurement: s(input.kpi.measurement, 300) } : null
  if (!kpi?.name) errors.push('Falta el KPI')
  if (errors.length) return { ok: false, errors }
  const names = new Set(pillars.map((p) => p.name))
  return {
    ok: true,
    value: {
      summary, pillars, kpi: kpi!,
      keyMessages: arr(input.keyMessages).filter(isObj).map((m) => ({ segment: s(m.segment, 80), message: s(m.message, 400) })).filter((m) => m.segment && m.message).slice(0, 8),
      formatMix: arr(input.formatMix).filter(isObj).map((m) => ({
        channel: chan(m.channel)!,
        formats: arr(m.formats).filter(isObj).map((f) => ({ format: s(f.format, 30), share: typeof f.share === 'number' ? Math.max(0, Math.min(100, Math.round(f.share))) : 0 })).filter((f) => f.format),
      })).filter((m) => m.channel),
      weeklyCalendar: arr(input.weeklyCalendar).filter(isObj).map((w) => ({ weekday: typeof w.weekday === 'number' ? Math.round(w.weekday) : -1, channel: chan(w.channel)!, pillar: s(w.pillar, 60) }))
        .filter((w) => w.weekday >= 0 && w.weekday <= 6 && w.channel && names.has(w.pillar)).slice(0, 30),
      hypotheses: strs(input.hypotheses, 8, 300),
      risks: strs(input.risks, 8, 300),
      avoid: [],
    },
  }
}

/**
 * Ideas the model proposed, keeping only valid ones: known pillar, enabled channels, allowed formats,
 * target day inside the horizon. Null service = general content; an unknown service is dropped.
 */
export function parseIdeas(input: unknown, ctx: { pillars: string[]; channels: MarketingChannel[]; services: string[]; fromDay: string; toDay: string; max: number }): Parsed<{ ideas: IdeaDraft[]; dropped: string[] }> {
  if (!isObj(input) || !Array.isArray(input.ideas)) return { ok: false, errors: ['La respuesta no trae la lista de ideas'] }
  const dropped: string[] = []
  const ideas: IdeaDraft[] = []
  const pillarByNorm = new Map(ctx.pillars.map((p) => [norm(p), p]))
  const serviceByNorm = new Map(ctx.services.map((x) => [norm(x), x]))
  for (const raw of input.ideas.filter(isObj)) {
    const angle = s(raw.angle, 300)
    const pillar = pillarByNorm.get(norm(s(raw.pillar, 60)))
    const channels = Array.from(new Set(arr(raw.channels).map(chan).filter((c): c is MarketingChannel => Boolean(c) && ctx.channels.includes(c as MarketingChannel))))
    const day = s(raw.targetDate, 10)
    const serviceRaw = s(raw.service, 80)
    const service = serviceRaw ? serviceByNorm.get(norm(serviceRaw)) ?? null : null
    const why = !angle ? 'sin ángulo' : !pillar ? `pilar desconocido «${s(raw.pillar, 60)}»` : !channels.length ? 'sin canales válidos' : !/^\d{4}-\d{2}-\d{2}$/.test(day) || day < ctx.fromDay || day > ctx.toDay ? `fecha fuera del horizonte (${day || '—'})` : serviceRaw && !service ? `servicio fuera del catálogo «${serviceRaw}»` : null
    if (why) { dropped.push(`${angle.slice(0, 60) || '—'}: ${why}`); continue }
    const formats: Partial<Record<MarketingChannel, string>> = {}
    const f = isObj(raw.formats) ? raw.formats : {}
    for (const c of channels) {
      const v = s(f[c], 30)
      formats[c] = AGENT_FORMATS[c].includes(v) ? v : AGENT_FORMATS[c][0]
    }
    const hint = raw.slotHint === 'morning' || raw.slotHint === 'midday' || raw.slotHint === 'evening' ? raw.slotHint : null
    ideas.push({ pillar: pillar!, service, angle, hypothesis: s(raw.hypothesis, 300), channels, formats, targetDate: day, slotHint: hint, rationale: s(raw.rationale, 300), explore: raw.explore === true, confidence: num01(raw.confidence) ?? 0.5 })
    if (ideas.length >= ctx.max) break
  }
  if (!ideas.length) return { ok: false, errors: ['Ninguna idea válida', ...dropped.slice(0, 5)] }
  return { ok: true, value: { ideas, dropped } }
}

export function parseDraft(input: unknown, channels: MarketingChannel[]): Parsed<PostDraft> {
  if (!isObj(input)) return { ok: false, errors: ['La respuesta no es un objeto'] }
  const errors: string[] = []
  const title = s(input.title, 200)
  if (!title) errors.push('Falta el título')
  const w = isObj(input.web) ? input.web : null
  const ig = isObj(input.instagram) ? input.instagram : null
  const fb = isObj(input.facebook) ? input.facebook : null
  const web = w ? { body: s(w.body, 60_000), seoTitle: s(w.seoTitle, 120), seoDescription: s(w.seoDescription, 320), slug: s(w.slug, 90), excerpt: s(w.excerpt, 500), tags: strs(w.tags, 8, 40), category: s(w.category, 60) } : null
  const instagram = ig ? { caption: s(ig.caption, 2300), format: AGENT_FORMATS.INSTAGRAM.includes(s(ig.format, 20)) ? s(ig.format, 20) : 'feed' } : null
  const facebook = fb ? { text: s(fb.text, 5000), link: s(fb.link, 500) || null } : null
  if (channels.includes('WEB') && !web?.body) errors.push('Falta el artículo del blog')
  if (channels.includes('INSTAGRAM') && !instagram?.caption) errors.push('Falta el texto de Instagram')
  if (channels.includes('FACEBOOK') && !facebook?.text) errors.push('Falta el texto de Facebook')
  const confidence = num01(input.confidence)
  if (confidence === null) errors.push('Falta la confianza (0 a 1)')
  const img = isObj(input.image) ? input.image : {}
  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    value: {
      title, brief: s(input.brief, 1000), service: s(input.service, 80) || null, cta: s(input.cta, 200), confidence: confidence!,
      risks: strs(input.risks, 6, 300), hypothesis: s(input.hypothesis, 300),
      image: { query: s(img.query, 80), alt: s(img.alt, 200), prompt: s(img.prompt, 800) },
      web: channels.includes('WEB') ? web : null,
      instagram: channels.includes('INSTAGRAM') ? instagram : null,
      facebook: channels.includes('FACEBOOK') ? facebook : null,
    },
  }
}

export function parseRetrospective(input: unknown): Parsed<Retrospective> {
  if (!isObj(input)) return { ok: false, errors: ['La respuesta no es un objeto'] }
  const insights = strs(input.insights, 10, 400)
  if (insights.length < 3) return { ok: false, errors: ['Se esperaban al menos 3 hallazgos'] }
  const recommendations: Recommendation[] = []
  for (const r of arr(input.recommendations).filter(isObj).slice(0, 10)) {
    const reason = s(r.reason, 300)
    const channel = chan(r.channel)
    if (r.type === 'pillar_weight' && s(r.pillar, 60) && typeof r.weight === 'number') recommendations.push({ type: 'pillar_weight', pillar: s(r.pillar, 60), weight: Math.round(r.weight), reason })
    else if (r.type === 'frequency' && channel && typeof r.perWeek === 'number') recommendations.push({ type: 'frequency', channel, perWeek: Math.round(r.perWeek), reason })
    else if (r.type === 'format' && channel && s(r.format, 30) && (r.direction === 'more' || r.direction === 'less')) recommendations.push({ type: 'format', channel, format: s(r.format, 30), direction: r.direction, reason })
    else if (r.type === 'slot' && channel && s(r.note, 200)) recommendations.push({ type: 'slot', channel, note: s(r.note, 200), reason })
    else if (r.type === 'avoid' && s(r.topic, 120)) recommendations.push({ type: 'avoid', topic: s(r.topic, 120), reason })
    else if (r.type === 'test' && s(r.idea, 200)) recommendations.push({ type: 'test', idea: s(r.idea, 200), reason })
  }
  return { ok: true, value: { insights, recommendations } }
}

/**
 * Applies the retrospective within the limits: a pillar moves at most 15 points, a channel's frequency
 * at most 1 per week (1 to 14), formats only among the allowed ones. Never touches autonomy, budget,
 * banned topics or the offer. Pure: returns the new config and strategy.
 */
export function applyRecommendations(config: AgentConfig, strategy: Strategy, recs: Recommendation[]) {
  const nextConfig: AgentConfig = JSON.parse(JSON.stringify(config))
  const nextStrategy: Strategy = JSON.parse(JSON.stringify(strategy))
  const applied: string[] = []
  const skipped: string[] = []
  for (const r of recs) {
    if (r.type === 'pillar_weight') {
      const p = nextStrategy.pillars.find((x) => norm(x.name) === norm(r.pillar))
      if (!p) { skipped.push(`Pilar desconocido: ${r.pillar}`); continue }
      const target = Math.max(5, Math.min(60, r.weight))
      const next = Math.max(p.weight - 15, Math.min(p.weight + 15, target))
      if (next === p.weight) continue
      p.weight = next
      applied.push(`Pilar «${p.name}» al ${next} %`)
    } else if (r.type === 'frequency') {
      const plan = nextConfig.channels[r.channel]
      if (!plan.enabled) { skipped.push(`${r.channel} está apagado`); continue }
      const next = Math.max(1, Math.min(14, plan.perWeek + Math.sign(r.perWeek - plan.perWeek)))
      if (next === plan.perWeek) continue
      plan.perWeek = next
      applied.push(`${CHANNEL_LABEL[r.channel]}: ${next} por semana`)
    } else if (r.type === 'format') {
      const plan = nextConfig.channels[r.channel]
      if (!AGENT_FORMATS[r.channel].includes(r.format)) { skipped.push(`Formato no disponible: ${r.format}`); continue }
      if (r.direction === 'more' && !plan.formats.includes(r.format)) { plan.formats.push(r.format); applied.push(`${CHANNEL_LABEL[r.channel]}: añade ${r.format}`) }
      if (r.direction === 'less' && plan.formats.includes(r.format) && plan.formats.length > 1) { plan.formats = plan.formats.filter((f) => f !== r.format); applied.push(`${CHANNEL_LABEL[r.channel]}: deja ${r.format}`) }
    } else if (r.type === 'avoid') {
      nextStrategy.avoid = Array.from(new Set([...(nextStrategy.avoid || []), r.topic])).slice(-20)
      applied.push(`Evitar: ${r.topic}`)
    }
  }
  // Pillar weights back to 100 %
  const total = nextStrategy.pillars.reduce((a, p) => a + p.weight, 0)
  if (total !== 100 && total > 0) {
    let acc = 0
    nextStrategy.pillars.forEach((p, i) => {
      p.weight = i === nextStrategy.pillars.length - 1 ? 100 - acc : Math.round((p.weight / total) * 100)
      acc += p.weight
    })
  }
  return { config: nextConfig, strategy: nextStrategy, applied, skipped }
}

/** Pillars in the order the plan should fill them: the one furthest below its share goes first. */
export function pillarDeficit(pillars: Pillar[], recent: Array<{ pillar: string | null }>) {
  const total = recent.length || 1
  return pillars
    .map((p) => ({ pillar: p.name, target: p.weight, actual: Math.round((recent.filter((r) => r.pillar && norm(r.pillar) === norm(p.name)).length / total) * 100) }))
    .sort((a, b) => (b.target - b.actual) - (a.target - a.actual))
}
