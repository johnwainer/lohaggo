/**
 * The marketing agent's onboarding answers: shape, defaults and whitelisting of what the wizard can
 * write. Pure: every value is bounded here so the prompt and the scheduler can trust it.
 */
import type { MarketingChannel } from '@/lib/marketing/channel-rules'

export const AGENT_MODES = ['copilot', 'supervised', 'autopilot'] as const
export type AgentMode = (typeof AGENT_MODES)[number]
export const AGENT_STATUS = ['draft', 'active', 'paused', 'finished'] as const
export type AgentStatus = (typeof AGENT_STATUS)[number]

export const KPIS = ['reach', 'web_visits', 'clicks', 'conversations', 'engagement'] as const
export type Kpi = (typeof KPIS)[number]

export const KPI_LABEL: Record<Kpi, string> = {
  reach: 'Alcance',
  web_visits: 'Visitas al blog',
  clicks: 'Clics',
  conversations: 'Conversaciones en la bandeja',
  engagement: 'Tasa de interacción',
}

/** Main KPI suggested for each campaign objective (the person can change it). */
export const KPI_BY_OBJECTIVE: Record<string, Kpi> = {
  reach: 'reach', brand: 'reach', traffic: 'web_visits', leads: 'conversations', sales: 'conversations', engagement: 'engagement',
}

export const AGENT_CHANNELS: MarketingChannel[] = ['INSTAGRAM', 'FACEBOOK', 'WEB']

/** Formats the agent can produce without a person: it has photos, not video (reels need an uploaded video). */
export const AGENT_FORMATS: Record<MarketingChannel, readonly string[]> = {
  INSTAGRAM: ['feed', 'carousel'],
  FACEBOOK: ['foto', 'texto', 'enlace'],
  WEB: ['guía', 'lista', 'comparativa', 'preguntas', 'caso'],
}

export const AWARENESS = ['unaware', 'problem', 'solution', 'product'] as const
export type Awareness = (typeof AWARENESS)[number]
export const AWARENESS_LABEL: Record<Awareness, string> = {
  unaware: 'No sabe que tiene el problema',
  problem: 'Conoce el problema, no la solución',
  solution: 'Busca una solución, no nos conoce',
  product: 'Ya nos conoce',
}

export const EMOJI_LEVELS = ['none', 'few', 'moderate'] as const
export type EmojiLevel = (typeof EMOJI_LEVELS)[number]
export const IMAGE_SOURCES = ['pexels', 'ai', 'manual'] as const

export type ChannelPlan = { enabled: boolean; perWeek: number; formats: string[]; accountIds: string[] }

export type AgentConfig = {
  kpi: Kpi
  goal: number | null
  alwaysOn: boolean
  budget: { maxImageUsdPerPost: number }
  offer: {
    allServices: boolean
    serviceIds: string[]
    cities: string[]
    valueProp: string
    differentiators: string[]
    promos: Array<{ text: string; endsAt: string | null }>
    facts: string[]
    priceNotes: string
    links: Array<{ label: string; url: string }>
    allowedDomains: string[]
  }
  audience: {
    segments: Array<{ name: string; pains: string; motivations: string }>
    objections: string[]
    awareness: Awareness
    formal: boolean
  }
  voice: {
    adjectives: Array<{ word: string; example: string }>
    bannedWords: string[]
    bannedTopics: string[]
    emojis: Record<MarketingChannel, EmojiLevel>
    brandHashtags: string[]
    cta: string
    examples: string[]
  }
  channels: Record<MarketingChannel, ChannelPlan>
  schedule: {
    /** true: the agent picks the hour from results; false: only the person's windows, in order */
    smart: boolean
    /** Allowed weekdays, 0 = Sunday */
    days: number[]
    /** Allowed windows in Bogotá hours, [from, to) */
    windows: Array<{ from: number; to: number }>
    quietFrom: number
    quietTo: number
    minGapHours: number
    maxPerDay: number
    repeatDays: number
    draftLeadHours: number
  }
  images: { source: (typeof IMAGE_SOURCES)[number]; logo: boolean }
  notify: { email: boolean }
}

/** Autonomy and limits kept in their own columns (filtered and enforced in code). */
export type AgentSettings = {
  mode: AgentMode
  modeByChannel: Partial<Record<MarketingChannel, AgentMode>> | null
  optOutHours: number
  trialPostsRemaining: number
  monthlyBudgetUsd: number
  confidenceThreshold: number
  exploreRatio: number
  horizonDays: number
}

export const DEFAULT_SETTINGS: AgentSettings = {
  mode: 'copilot', modeByChannel: null, optOutHours: 24, trialPostsRemaining: 5, monthlyBudgetUsd: 10, confidenceThreshold: 0.7, exploreRatio: 0.3, horizonDays: 14,
}

export function defaultAgentConfig(objective = 'reach'): AgentConfig {
  return {
    kpi: KPI_BY_OBJECTIVE[objective] ?? 'reach',
    goal: null,
    alwaysOn: false,
    budget: { maxImageUsdPerPost: 0.1 },
    offer: { allServices: true, serviceIds: [], cities: [], valueProp: '', differentiators: [], promos: [], facts: [], priceNotes: '', links: [], allowedDomains: [] },
    audience: { segments: [{ name: 'Cliente final', pains: '', motivations: '' }], objections: [], awareness: 'problem', formal: false },
    voice: { adjectives: [], bannedWords: [], bannedTopics: ['política', 'religión', 'competencia por su nombre'], emojis: { INSTAGRAM: 'moderate', FACEBOOK: 'few', WEB: 'none' }, brandHashtags: ['#LoHaggo'], cta: '', examples: [] },
    channels: {
      INSTAGRAM: { enabled: true, perWeek: 4, formats: ['feed', 'carousel'], accountIds: [] },
      FACEBOOK: { enabled: true, perWeek: 3, formats: ['foto', 'enlace'], accountIds: [] },
      WEB: { enabled: true, perWeek: 1, formats: ['guía', 'lista'], accountIds: [] },
    },
    schedule: { smart: true, days: [1, 2, 3, 4, 5, 6], windows: [{ from: 8, to: 21 }], quietFrom: 21, quietTo: 7, minGapHours: 3, maxPerDay: 1, repeatDays: 21, draftLeadHours: 72 },
    images: { source: 'pexels', logo: true },
    notify: { email: true },
  }
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T) => (typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback)
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
const int = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && v !== null && v !== '' ? Math.min(max, Math.max(min, n)) : fallback
}
const float = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v)
  return Number.isFinite(n) && v !== null && v !== '' ? Math.min(max, Math.max(min, n)) : fallback
}
const list = (v: unknown, maxItems: number, maxLen: number) =>
  Array.isArray(v) ? Array.from(new Set(v.map((x) => str(x, maxLen)).filter(Boolean))).slice(0, maxItems) : []
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

/** A domain as the person may type it ("https://www.x.com/", "x.com") → "x.com". Null if it is not one. */
export function normalizeDomain(v: string) {
  const d = v.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0]
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) ? d : null
}

function httpsUrl(v: unknown) {
  const s = str(v, 500)
  return /^https:\/\/[^\s]+$/i.test(s) ? s : null
}

function isoDay(v: unknown) {
  const s = str(v, 30)
  if (!s) return null
  const d = new Date(s.length === 10 ? `${s}T23:59:59-05:00` : s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Whole config from whatever the wizard sent, on top of the previous one (missing sections keep their value). */
export function sanitizeAgentConfig(raw: unknown, prev: AgentConfig = defaultAgentConfig()): AgentConfig {
  const b = obj(raw)
  const offer = obj(b.offer ?? prev.offer)
  const audience = obj(b.audience ?? prev.audience)
  const voice = obj(b.voice ?? prev.voice)
  const channels = obj(b.channels ?? prev.channels)
  const schedule = obj(b.schedule ?? prev.schedule)
  const images = obj(b.images ?? prev.images)
  const notify = obj(b.notify ?? prev.notify)
  const budget = obj(b.budget ?? prev.budget)
  const emojis = obj(voice.emojis)

  const ch = (c: MarketingChannel): ChannelPlan => {
    const x = obj(channels[c])
    const p = prev.channels[c]
    return {
      enabled: bool(x.enabled, p.enabled),
      perWeek: int(x.perWeek, 0, 14, p.perWeek),
      formats: list(x.formats, 5, 20).filter((f) => AGENT_FORMATS[c].includes(f)),
      accountIds: c === 'WEB' ? [] : list(x.accountIds, 5, 40),
    }
  }

  const windows = (Array.isArray(schedule.windows) ? schedule.windows : prev.schedule.windows)
    .map((w) => ({ from: int(obj(w).from, 0, 23, 8), to: int(obj(w).to, 1, 24, 21) }))
    .filter((w) => w.to > w.from)
    .slice(0, 4)

  const config: AgentConfig = {
    kpi: oneOf(b.kpi, KPIS, prev.kpi),
    goal: b.goal === null || b.goal === '' ? null : b.goal === undefined ? prev.goal : float(b.goal, 0, 1e9, 0) || null,
    alwaysOn: bool(b.alwaysOn, prev.alwaysOn),
    budget: { maxImageUsdPerPost: float(budget.maxImageUsdPerPost, 0, 2, prev.budget.maxImageUsdPerPost) },
    offer: {
      allServices: bool(offer.allServices, true),
      serviceIds: list(offer.serviceIds, 60, 40),
      cities: list(offer.cities, 30, 60),
      valueProp: str(offer.valueProp, 600),
      differentiators: list(offer.differentiators, 8, 200),
      promos: (Array.isArray(offer.promos) ? offer.promos : [])
        .map((p) => ({ text: str(obj(p).text, 300), endsAt: isoDay(obj(p).endsAt) }))
        .filter((p) => p.text)
        .slice(0, 8),
      facts: list(offer.facts, 12, 200),
      priceNotes: str(offer.priceNotes, 600),
      links: (Array.isArray(offer.links) ? offer.links : [])
        .map((l) => ({ label: str(obj(l).label, 80), url: httpsUrl(obj(l).url) }))
        .filter((l): l is { label: string; url: string } => Boolean(l.url))
        .slice(0, 10),
      allowedDomains: list(offer.allowedDomains, 10, 100).map(normalizeDomain).filter((d): d is string => Boolean(d)),
    },
    audience: {
      segments: (Array.isArray(audience.segments) ? audience.segments : [])
        .map((s) => ({ name: str(obj(s).name, 80), pains: str(obj(s).pains, 500), motivations: str(obj(s).motivations, 500) }))
        .filter((s) => s.name)
        .slice(0, 5),
      objections: list(audience.objections, 10, 200),
      awareness: oneOf(audience.awareness, AWARENESS, prev.audience.awareness),
      formal: bool(audience.formal, prev.audience.formal),
    },
    voice: {
      adjectives: (Array.isArray(voice.adjectives) ? voice.adjectives : [])
        .map((a) => ({ word: str(obj(a).word, 40), example: str(obj(a).example, 300) }))
        .filter((a) => a.word)
        .slice(0, 3),
      bannedWords: list(voice.bannedWords, 40, 60),
      bannedTopics: list(voice.bannedTopics, 20, 100),
      emojis: {
        INSTAGRAM: oneOf(emojis.INSTAGRAM, EMOJI_LEVELS, prev.voice.emojis.INSTAGRAM),
        FACEBOOK: oneOf(emojis.FACEBOOK, EMOJI_LEVELS, prev.voice.emojis.FACEBOOK),
        WEB: oneOf(emojis.WEB, EMOJI_LEVELS, prev.voice.emojis.WEB),
      },
      brandHashtags: list(voice.brandHashtags, 5, 40).map((h) => (h.startsWith('#') ? h : `#${h}`)).filter((h) => /^#[A-Za-z0-9_À-ɏ]+$/.test(h)),
      cta: str(voice.cta, 200),
      examples: list(voice.examples, 5, 2200),
    },
    channels: { INSTAGRAM: ch('INSTAGRAM'), FACEBOOK: ch('FACEBOOK'), WEB: ch('WEB') },
    schedule: {
      smart: bool(schedule.smart, prev.schedule.smart),
      days: Array.from(new Set((Array.isArray(schedule.days) ? schedule.days : prev.schedule.days).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))).sort(),
      windows: windows.length ? windows : [{ from: 8, to: 21 }],
      quietFrom: int(schedule.quietFrom, 0, 23, prev.schedule.quietFrom),
      quietTo: int(schedule.quietTo, 0, 23, prev.schedule.quietTo),
      minGapHours: int(schedule.minGapHours, 1, 72, prev.schedule.minGapHours),
      maxPerDay: int(schedule.maxPerDay, 1, 5, prev.schedule.maxPerDay),
      repeatDays: int(schedule.repeatDays, 0, 120, prev.schedule.repeatDays),
      draftLeadHours: int(schedule.draftLeadHours, 12, 168, prev.schedule.draftLeadHours),
    },
    images: { source: oneOf(images.source, IMAGE_SOURCES, prev.images.source), logo: bool(images.logo, prev.images.logo) },
    notify: { email: bool(notify.email, prev.notify.email) },
  }
  for (const c of AGENT_CHANNELS) if (config.channels[c].enabled && !config.channels[c].formats.length) config.channels[c].formats = [AGENT_FORMATS[c][0]]
  if (!config.schedule.days.length) config.schedule.days = [1, 2, 3, 4, 5]
  return config
}

/** Stored config (may be from an older version) → full config with defaults. */
export function readAgentConfig(stored: unknown): AgentConfig {
  return sanitizeAgentConfig(stored, defaultAgentConfig())
}

/** Autonomy and limits. `mode` changes are checked by the route (permission + explicit confirmation). */
export function sanitizeAgentSettings(raw: unknown, prev: AgentSettings = DEFAULT_SETTINGS): AgentSettings {
  const b = obj(raw)
  const byChannel = b.modeByChannel === null ? null : b.modeByChannel === undefined ? prev.modeByChannel : obj(b.modeByChannel)
  let modeByChannel: AgentSettings['modeByChannel'] = null
  if (byChannel) {
    const out: Partial<Record<MarketingChannel, AgentMode>> = {}
    for (const c of AGENT_CHANNELS) {
      const m = (byChannel as Record<string, unknown>)[c]
      if (typeof m === 'string' && (AGENT_MODES as readonly string[]).includes(m)) out[c] = m as AgentMode
    }
    modeByChannel = Object.keys(out).length ? out : null
  }
  return {
    mode: oneOf(b.mode, AGENT_MODES, prev.mode),
    modeByChannel,
    optOutHours: int(b.optOutHours, 2, 72, prev.optOutHours),
    trialPostsRemaining: int(b.trialPostsRemaining, 0, 50, prev.trialPostsRemaining),
    monthlyBudgetUsd: float(b.monthlyBudgetUsd, 0, 500, prev.monthlyBudgetUsd),
    confidenceThreshold: float(b.confidenceThreshold, 0.3, 0.95, prev.confidenceThreshold),
    exploreRatio: float(b.exploreRatio, 0, 0.6, prev.exploreRatio),
    horizonDays: int(b.horizonDays, 3, 30, prev.horizonDays),
  }
}

/** More autonomy than before (copilot → supervised/autopilot, or a channel loosened): needs publish permission and an explicit confirmation. */
export function raisesAutonomy(prev: Pick<AgentSettings, 'mode' | 'modeByChannel'>, next: Pick<AgentSettings, 'mode' | 'modeByChannel'>) {
  const rank = (m: AgentMode) => AGENT_MODES.indexOf(m)
  const eff = (s: Pick<AgentSettings, 'mode' | 'modeByChannel'>, c: MarketingChannel) => Math.min(rank(s.mode), rank(s.modeByChannel?.[c] ?? s.mode))
  return AGENT_CHANNELS.some((c) => eff(next, c) > eff(prev, c))
}
