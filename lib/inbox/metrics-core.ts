/**
 * Inbox metrics math. Pure: the queries live in lib/inbox/metrics.ts.
 *
 * Only real replies count as an answer: a message a person sent (from our inbox or Meta's) or a reply written
 * by an AI agent. Automatic notices never do: templates and automations (senderType AUTOMATION), the
 * satisfaction survey, booking follow-ups, the booking chat relay, the agent's holding message, its
 * out-of-hours notice and its canned «te comunico con una persona», and Meta's own instant replies.
 */
import { DEFAULT_OUTSIDE_HOURS_MESSAGE } from '@/lib/ai/runtime-core'
import { teamHours } from '@/lib/inbox/escalation-core'

export const METRIC_PERIODS = [7, 30, 90] as const
export type MetricPeriod = (typeof METRIC_PERIODS)[number]

export function parsePeriod(raw: string | null | undefined): MetricPeriod {
  return raw === '30' ? 30 : raw === '90' ? 90 : 7
}

export const METRIC_CHANNELS = ['WHATSAPP', 'MESSENGER', 'INSTAGRAM', 'SMS', 'EMAIL'] as const
export type MetricChannel = (typeof METRIC_CHANNELS)[number]

export const CHANNEL_NAMES: Record<string, string> = { WHATSAPP: 'WhatsApp', MESSENGER: 'Messenger', INSTAGRAM: 'Instagram', SMS: 'SMS', EMAIL: 'Correo', PUSH: 'Push' }

export function parseChannel(raw: string | null | undefined): MetricChannel | null {
  return (METRIC_CHANNELS as readonly string[]).includes(raw ?? '') ? (raw as MetricChannel) : null
}

/** Senders that write as «AI» but are system notices, not an agent answering */
export const NON_REPLY_AGENT_IDS = ['csat', 'booking-followup', 'chat-relay'] as const
/** A Meta echo this soon after the contact's message is the page's instant reply / away message, not a person */
export const AUTO_ECHO_MS = 5_000
/** Conversion windows after the contact's first message of the period */
export const REQUEST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
export const BOOKING_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

const CLOSE_STATUSES = new Set(['RESOLVED', 'CLOSED'])
const INACTIVITY_CLOSE_LABEL = 'Sin respuesta del cliente'
const CLEANUP_ACTOR_PREFIX = 'Limpieza'

type DateLike = Date | string

/** Timestamps from json_agg come without a zone (Postgres `timestamp` holds UTC): read them as UTC. */
export function toDate(v: DateLike | null | undefined): Date | null {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return v
  const s = /[zZ]|[+-]\d\d:?\d\d$/.test(v) ? v : `${v}Z`
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

const secondsBetween = (from: Date, to: Date) => Math.max(0, (to.getTime() - from.getTime()) / 1000)

// ─── Statistics ─────────────────────────────────────────────────────────────

/** Linear-interpolated percentile (p in 0..1); null without values. */
export function percentile(values: number[], p: number): number | null {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (!sorted.length) return null
  const idx = (sorted.length - 1) * Math.min(1, Math.max(0, p))
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

export function median(values: number[]): number | null {
  return percentile(values, 0.5)
}

export type DurationStats = { count: number; medianSeconds: number | null; p90Seconds: number | null }

export function durationStats(seconds: number[]): DurationStats {
  return { count: seconds.length, medianSeconds: median(seconds), p90Seconds: percentile(seconds, 0.9) }
}

// ─── Real replies ───────────────────────────────────────────────────────────

export type ReplyCandidate = {
  sentAt: DateLike
  senderType: string | null
  sentById: string | null
  aiAgentId: string | null
  body: string | null
  isInternal?: boolean
  /** An escalation_holding event was written right after it: it is the holding message */
  nearHolding?: boolean
}

export type ReplyKind = 'human' | 'ai'

function normalizeText(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

/** The message starts like one of the agent's fixed texts (handoff, out of hours). */
export function isCannedText(body: string | null, canned: string[]): boolean {
  const text = normalizeText(body ?? '')
  if (!text) return false
  return [...canned, DEFAULT_OUTSIDE_HOURS_MESSAGE].some((c) => {
    const prefix = normalizeText(c ?? '').slice(0, 40).trim()
    return prefix.length >= 12 && text.startsWith(prefix)
  })
}

/**
 * What an outbound message is with respect to the contact's message at `anchor`: a person's reply, an AI
 * agent's reply, or nothing (automatic). `canned` = fixed texts of each agent by id.
 */
export function classifyReply(m: ReplyCandidate, anchor: Date, canned: Map<string, string[]> = new Map()): ReplyKind | null {
  if (m.isInternal) return null
  const at = toDate(m.sentAt)
  if (!at || at.getTime() < anchor.getTime()) return null
  const type = m.senderType
  if (type === 'AUTOMATION' || type === 'CONTACT') return null
  if (type === 'HUMAN' || (m.sentById && type !== 'AI')) return 'human'
  if (type === 'ECHO') return at.getTime() - anchor.getTime() < AUTO_ECHO_MS ? null : 'human'
  if (type === 'AI') {
    if (!m.aiAgentId || (NON_REPLY_AGENT_IDS as readonly string[]).includes(m.aiAgentId)) return null
    if (m.nearHolding) return null
    if (isCannedText(m.body, canned.get(m.aiAgentId) ?? [])) return null
    return 'ai'
  }
  return null
}

export type FirstReplies = {
  human: { at: Date; by: string | null } | null
  ai: { at: Date; agentId: string } | null
  first: { at: Date; kind: ReplyKind } | null
}

/** The first real reply of a person and of an AI agent after the contact's message. */
export function firstRealReplies(candidates: ReplyCandidate[], anchor: Date, canned?: Map<string, string[]>): FirstReplies {
  const sorted = [...candidates].sort((a, b) => (toDate(a.sentAt)?.getTime() ?? 0) - (toDate(b.sentAt)?.getTime() ?? 0))
  let human: FirstReplies['human'] = null
  let ai: FirstReplies['ai'] = null
  for (const m of sorted) {
    const kind = classifyReply(m, anchor, canned)
    const at = toDate(m.sentAt) as Date
    if (kind === 'human' && !human) human = { at, by: m.sentById }
    if (kind === 'ai' && !ai) ai = { at, agentId: m.aiAgentId as string }
    if (human && ai) break
  }
  const first = human && (!ai || human.at <= ai.at) ? { at: human.at, kind: 'human' as const } : ai ? { at: ai.at, kind: 'ai' as const } : null
  return { human, ai, first }
}

// ─── Conversation timeline (events) ─────────────────────────────────────────

export type EventRow = { type: string; actorType: string | null; actorId: string | null; actorName: string | null; detail: string | null; createdAt: DateLike }

export type Timeline = {
  resolution: { at: Date; actorType: string | null; actorId: string | null } | null
  autoClosed: boolean
  closes: Date[]
  handoff: { at: Date; agentId: string | null; detail: string | null } | null
  aiStarted: boolean
  csatAsked: boolean
  csatScore: number | null
  newAccount: boolean
}

/**
 * Reads the conversation's events: the first close that resolved it (not one by inactivity), closes by
 * inactivity (the agent's 24 h close and the inbox cleanup), the first handoff, the survey and account links.
 */
export function readTimeline(events: EventRow[]): Timeline {
  const rows = events
    .map((e) => ({ ...e, at: toDate(e.createdAt) }))
    .filter((e): e is EventRow & { at: Date } => e.at !== null)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
  const inactivityAiCloses = rows.filter((e) => e.type === 'ai_closed' && (e.detail ?? '').startsWith(INACTIVITY_CLOSE_LABEL))
  const t: Timeline = { resolution: null, autoClosed: false, closes: [], handoff: null, aiStarted: false, csatAsked: false, csatScore: null, newAccount: false }
  for (const e of rows) {
    if (e.type === 'status' && CLOSE_STATUSES.has(e.detail ?? '')) {
      t.closes.push(e.at)
      const inactivity = (e.actorName ?? '').startsWith(CLEANUP_ACTOR_PREFIX)
        || inactivityAiCloses.some((c) => c.actorId === e.actorId && Math.abs(c.at.getTime() - e.at.getTime()) < 10_000)
      if (inactivity) t.autoClosed = true
      else if (!t.resolution) t.resolution = { at: e.at, actorType: e.actorType, actorId: e.actorId }
    } else if (e.type === 'ai_handoff' && !t.handoff) {
      t.handoff = { at: e.at, agentId: e.actorId, detail: e.detail }
    } else if (e.type === 'ai_started') {
      t.aiStarted = true
    } else if (e.type === 'csat_asked') {
      t.csatAsked = true
    } else if (e.type === 'csat_answered') {
      const m = /^([1-5])/.exec((e.detail ?? '').trim())
      if (m) t.csatScore = Number(m[1])
    } else if (e.type === 'account_linked' || e.type === 'account_created') {
      t.newAccount = true
    }
  }
  return t
}

/** ai_handoff details are «Motivo: detalle» (or just «Motivo»): the most frequent reasons first. */
export function topHandoffReasons(details: Array<string | null>, limit = 5) {
  const counts = new Map<string, number>()
  for (const d of details) {
    const reason = (d ?? '').split(':')[0].trim() || 'Sin motivo'
    counts.set(reason, (counts.get(reason) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason))
    .slice(0, limit)
}

// ─── Conversion ─────────────────────────────────────────────────────────────

export type ConversionRow = { userId: string; originConversationId: string | null; createdAt: DateLike }

/** Created from the conversation, or by the same account within the window after the contact wrote. */
export function convertedBy(conv: { id: string; userId: string | null; anchor: Date }, rows: ConversionRow[], windowMs: number): boolean {
  const from = conv.anchor.getTime()
  return rows.some((r) => {
    if (r.originConversationId === conv.id) return true
    if (!conv.userId || r.userId !== conv.userId) return false
    const at = toDate(r.createdAt)?.getTime() ?? NaN
    return at >= from && at <= from + windowMs
  })
}

export type Funnel = { conversations: number; withAccount: number; newAccounts: number; requests: number; bookings: number }

const emptyFunnel = (): Funnel => ({ conversations: 0, withAccount: 0, newAccounts: 0, requests: 0, bookings: 0 })

// ─── Summary ────────────────────────────────────────────────────────────────

export type ConversationInput = {
  id: string
  channel: string
  status: string
  userId: string | null
  /** The contact's first message in the period */
  firstIn: DateLike
  /** The contact's last message after it that is not a survey digit (reopening) */
  lastIn: DateLike | null
  candidates: ReplyCandidate[]
  /** People (user ids) and AI agents that wrote to the contact after firstIn */
  humans: string[]
  agents: string[]
  events: EventRow[]
}

export type ActorRow = {
  id: string
  conversations: number
  firstResponse: DurationStats
  resolved: number
  csatAverage: number | null
  csatCount: number
  handoffs: number
}

type ActorAcc = { conversations: Set<string>; firstResponse: number[]; resolved: number; csat: number[]; handoffs: number }

function acc(map: Map<string, ActorAcc>, id: string): ActorAcc {
  let a = map.get(id)
  if (!a) { a = { conversations: new Set(), firstResponse: [], resolved: 0, csat: [], handoffs: 0 }; map.set(id, a) }
  return a
}

const average = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)

function actorRows(map: Map<string, ActorAcc>): ActorRow[] {
  return Array.from(map.entries())
    .map(([id, a]) => ({
      id,
      conversations: a.conversations.size,
      firstResponse: durationStats(a.firstResponse),
      resolved: a.resolved,
      csatAverage: average(a.csat),
      csatCount: a.csat.length,
      handoffs: a.handoffs,
    }))
    .sort((x, y) => y.conversations - x.conversations || x.id.localeCompare(y.id))
}

export type SummaryContext = {
  canned?: Map<string, string[]>
  requests?: ConversionRow[]
  bookings?: ConversionRow[]
  /** Team hours check for the inside / outside split (defaults to the escalation settings) */
  isTeamHours?: (at: Date) => boolean
}

export function summarizeConversations(rows: ConversationInput[], ctx: SummaryContext = {}) {
  const isOpen = ctx.isTeamHours ?? ((at: Date) => teamHours(at).open)
  const any: number[] = [], ai: number[] = [], human: number[] = [], inside: number[] = [], outside: number[] = []
  const resolution: number[] = []
  let unanswered = 0, resolved = 0, autoClosed = 0, reopened = 0
  let aiInvolved = 0, handedOff = 0, aiClosed = 0, aiOnly = 0
  let csatAsked = 0
  const csatScores: number[] = []
  const handoffDetails: Array<string | null> = []
  const total = emptyFunnel()
  const byChannel = new Map<string, Funnel & { firstResponse: number[] }>()
  const people = new Map<string, ActorAcc>()
  const agents = new Map<string, ActorAcc>()

  for (const r of rows) {
    const anchor = toDate(r.firstIn)
    if (!anchor) continue
    const replies = firstRealReplies(r.candidates, anchor, ctx.canned)
    const t = readTimeline(r.events)
    const lastIn = toDate(r.lastIn)

    // First response
    if (replies.first) {
      const s = secondsBetween(anchor, replies.first.at)
      any.push(s)
      ;(isOpen(anchor) ? inside : outside).push(s)
    } else unanswered++
    if (replies.ai) ai.push(secondsBetween(anchor, replies.ai.at))
    if (replies.human) {
      // A person's clock starts when the conversation became theirs: the contact's message or the AI's handoff
      const start = t.handoff && t.handoff.at <= replies.human.at && t.handoff.at > anchor ? t.handoff.at : anchor
      const s = secondsBetween(start, replies.human.at)
      human.push(s)
      if (replies.human.by) acc(people, replies.human.by).firstResponse.push(s)
    }
    if (replies.ai) acc(agents, replies.ai.agentId).firstResponse.push(secondsBetween(anchor, replies.ai.at))

    // Resolution, closes, reopenings
    if (t.resolution) {
      resolved++
      resolution.push(secondsBetween(anchor, t.resolution.at))
      if (t.resolution.actorId) {
        if (t.resolution.actorType === 'user') acc(people, t.resolution.actorId).resolved++
        if (t.resolution.actorType === 'ai') acc(agents, t.resolution.actorId).resolved++
      }
    }
    if (t.autoClosed) autoClosed++
    if (lastIn && t.closes.some((c) => c < lastIn)) reopened++

    // AI
    const involved = r.agents.length > 0 || t.aiStarted || t.handoff !== null
    if (involved) aiInvolved++
    if (t.handoff) {
      handedOff++
      handoffDetails.push(t.handoff.detail)
      if (t.handoff.agentId) acc(agents, t.handoff.agentId).handoffs++
    }
    const humanWrote = r.humans.length > 0 || replies.human !== null
    const aiWrote = r.agents.length > 0 || replies.ai !== null
    if (t.resolution && (humanWrote || aiWrote)) {
      aiClosed++
      if (aiWrote && !humanWrote) aiOnly++
    }

    // CSAT
    if (t.csatAsked) csatAsked++
    if (t.csatScore !== null) csatScores.push(t.csatScore)

    // People and agents that took part
    for (const id of r.humans) {
      const a = acc(people, id)
      a.conversations.add(r.id)
      if (t.csatScore !== null) a.csat.push(t.csatScore)
      if (t.handoff) a.handoffs++
    }
    for (const id of r.agents) {
      const a = acc(agents, id)
      a.conversations.add(r.id)
      if (t.csatScore !== null) a.csat.push(t.csatScore)
    }
    if (t.handoff?.agentId) acc(agents, t.handoff.agentId).conversations.add(r.id)

    // Conversion
    const ch = byChannel.get(r.channel) ?? { ...emptyFunnel(), firstResponse: [] }
    byChannel.set(r.channel, ch)
    if (replies.first) ch.firstResponse.push(secondsBetween(anchor, replies.first.at))
    const conv = { id: r.id, userId: r.userId, anchor }
    const step = {
      withAccount: r.userId !== null,
      newAccounts: t.newAccount,
      requests: convertedBy(conv, ctx.requests ?? [], REQUEST_WINDOW_MS),
      bookings: convertedBy(conv, ctx.bookings ?? [], BOOKING_WINDOW_MS),
    }
    for (const f of [total, ch]) {
      f.conversations++
      if (step.withAccount) f.withAccount++
      if (step.newAccounts) f.newAccounts++
      if (step.requests) f.requests++
      if (step.bookings) f.bookings++
    }
  }

  const distribution = [1, 2, 3, 4, 5].map((score) => csatScores.filter((s) => s === score).length)
  return {
    conversations: rows.length,
    firstResponse: {
      any: durationStats(any),
      ai: durationStats(ai),
      human: durationStats(human),
      insideHours: durationStats(inside),
      outsideHours: durationStats(outside),
      unanswered,
    },
    resolution: { ...durationStats(resolution), resolved },
    autoClosed,
    reopened,
    ai: { involved: aiInvolved, closed: aiClosed, byAi: aiOnly, rate: aiClosed ? aiOnly / aiClosed : null },
    handoffs: { total: handedOff, rate: aiInvolved ? handedOff / aiInvolved : null, top: topHandoffReasons(handoffDetails) },
    csat: { asked: csatAsked, answered: csatScores.length, average: average(csatScores), distribution },
    funnel: {
      total,
      byChannel: Array.from(byChannel.entries())
        .map(([channel, f]) => ({ channel, conversations: f.conversations, withAccount: f.withAccount, newAccounts: f.newAccounts, requests: f.requests, bookings: f.bookings, firstResponse: durationStats(f.firstResponse) }))
        .sort((a, b) => b.conversations - a.conversations),
    },
    people: actorRows(people),
    agents: actorRows(agents),
  }
}

export type ConversationSummary = ReturnType<typeof summarizeConversations>

// ─── Copilot suggestions ────────────────────────────────────────────────────

/** Prod rows say used/discarded/expired; the code also writes edited/ignored/inserted. Every status is counted. */
export function copilotCounts(groups: Array<{ status: string; count: number }>) {
  const c = { generated: 0, used: 0, edited: 0, inserted: 0, discarded: 0, ignored: 0, expired: 0, pending: 0 }
  for (const g of groups) {
    c.generated += g.count
    const key = g.status as keyof typeof c
    if (key in c && key !== 'generated') c[key] += g.count
  }
  return { ...c, useRate: c.generated ? (c.used + c.edited) / c.generated : null }
}

// ─── Formatting ─────────────────────────────────────────────────────────────

/** «45 s», «4 min», «1 h 20 min», «2 d 3 h» */
export function formatSeconds(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—'
  const s = Math.round(seconds)
  if (s < 60) return `${s} s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`
  const d = Math.floor(h / 24)
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`
}

export function percent(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)} %`
}

export const rate = (part: number, whole: number): number | null => (whole ? part / whole : null)

// ─── CSV ────────────────────────────────────────────────────────────────────

export function csvCell(value: string | number | null | undefined): string {
  let v = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`
  return `"${v.replace(/"/g, '""')}"`
}

type NamedActor = ActorRow & { name: string }

export type CsvInput = ConversationSummary & {
  days: number
  channel: string | null
  since: string
  people: NamedActor[]
  agents: NamedActor[]
  copilot: ReturnType<typeof copilotCounts>
}

const secs = (v: number | null) => (v === null ? '' : Math.round(v))
const ratio = (v: number | null) => (v === null ? '' : v.toFixed(3))

/** Aggregates only: names of team members and agents, never contacts. */
export function metricsToCsv(m: CsvInput): string {
  const lines: Array<Array<string | number | null>> = []
  lines.push(['Sección', 'Métrica', 'Valor', 'Detalle'])
  const add = (section: string, metric: string, value: string | number | null, detail: string | number | null = '') => lines.push([section, metric, value, detail])
  add('Periodo', 'Días', m.days, `desde ${m.since.slice(0, 10)}`)
  add('Periodo', 'Canal', m.channel ? CHANNEL_NAMES[m.channel] ?? m.channel : 'Todos')
  add('Periodo', 'Conversaciones', m.conversations)
  const fr = m.firstResponse
  for (const [label, s] of [['Todas', fr.any], ['IA', fr.ai], ['Persona', fr.human], ['En horario del equipo', fr.insideHours], ['Fuera de horario', fr.outsideHours]] as const) {
    add('Primera respuesta (s)', `${label} · mediana`, secs(s.medianSeconds), `${s.count} respondidas`)
    add('Primera respuesta (s)', `${label} · p90`, secs(s.p90Seconds))
  }
  add('Primera respuesta (s)', 'Sin respuesta', fr.unanswered)
  add('Resolución (s)', 'Mediana', secs(m.resolution.medianSeconds), `${m.resolution.resolved} resueltas`)
  add('Resolución (s)', 'p90', secs(m.resolution.p90Seconds))
  add('Cierres', 'Cerradas por inactividad', m.autoClosed)
  add('Cierres', 'Reabiertas', m.reopened)
  add('IA', 'Conversaciones con IA', m.ai.involved)
  add('IA', 'Resueltas solo por la IA', m.ai.byAi, `de ${m.ai.closed} resueltas`)
  add('IA', 'Traspasos a una persona', m.handoffs.total, `tasa ${ratio(m.handoffs.rate)}`)
  for (const h of m.handoffs.top) add('Motivos de traspaso', h.reason, h.count)
  add('CSAT', 'Encuestas enviadas', m.csat.asked)
  add('CSAT', 'Respuestas', m.csat.answered)
  add('CSAT', 'Promedio', m.csat.average === null ? '' : m.csat.average.toFixed(2))
  m.csat.distribution.forEach((n, i) => add('CSAT', `Calificación ${i + 1}`, n))
  for (const f of [{ channel: 'Todos', ...m.funnel.total }, ...m.funnel.byChannel.map((c) => ({ ...c, channel: CHANNEL_NAMES[c.channel] ?? c.channel }))]) {
    add(`Conversión · ${f.channel}`, 'Conversaciones', f.conversations)
    add(`Conversión · ${f.channel}`, 'Con cuenta', f.withAccount)
    add(`Conversión · ${f.channel}`, 'Cuenta creada o vinculada en el chat', f.newAccounts)
    add(`Conversión · ${f.channel}`, 'Con solicitud (7 días)', f.requests)
    add(`Conversión · ${f.channel}`, 'Con reserva (14 días)', f.bookings)
  }
  for (const [k, v] of Object.entries(m.copilot)) if (k !== 'useRate') add('Copiloto', k, v as number)
  lines.push([])
  lines.push(['Tipo', 'Nombre', 'Conversaciones', 'Primera respuesta mediana (s)', 'Primera respuesta p90 (s)', 'Resueltas', 'CSAT promedio', 'CSAT respuestas', 'Traspasos'])
  for (const [type, list] of [['Persona', m.people], ['Agente IA', m.agents]] as const) {
    for (const a of list) {
      lines.push([type, a.name, a.conversations, secs(a.firstResponse.medianSeconds), secs(a.firstResponse.p90Seconds), a.resolved, a.csatAverage === null ? '' : a.csatAverage.toFixed(2), a.csatCount, a.handoffs])
    }
  }
  return '﻿' + lines.map((l) => l.map(csvCell).join(',')).join('\r\n')
}
