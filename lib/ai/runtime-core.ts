/**
 * Pure decision logic of the agent runtime (no DB, no API) so every rule is unit-testable.
 * lib/ai/runtime.ts wires these to Prisma and the Messages API.
 */

export type AgentLike = {
  id: string
  name: string
  status: string
  createdAt: Date
  isDefault: boolean
  channels: string[]
  autopilot: boolean
  autopilotChannels: string[]
  autopilotAccounts: string[]
  autopilotSkipTags: string[]
  handoffKeywords: string[]
  handoffAfterTurns: number
  hoursEnabled: boolean
  hoursTimezone: string | null
  hoursDays: number[]
  hoursStart: string
  hoursEnd: string
  outsideHours: string
  outsideHoursMessage: string | null
  memoryWindow: number
  /** Copilot channels: a conversation handed to the AI on one of them is answered too */
  copilotChannels?: string[]
}

export const HUMAN_GRACE_MS = 30 * 60 * 1000
export const MIN_MEMORY_WINDOW = 4

const byAge = <T extends { createdAt: Date }>(a: T, b: T) => a.createdAt.getTime() - b.createdAt.getTime()

export function servesChannel(agent: Pick<AgentLike, 'channels'>, channel: string) {
  return agent.channels.length === 0 || agent.channels.includes(channel)
}

/**
 * pick(workspace, channel): the conversation's own agent if it is still active → the oldest active
 * agent that declares the channel → the default agent → the oldest active agent that serves it.
 */
export function pickAgent<T extends AgentLike>(agents: T[], channel: string, currentAgentId?: string | null): T | null {
  const active = agents.filter((a) => a.status === 'active').sort(byAge)
  if (currentAgentId) {
    const current = active.find((a) => a.id === currentAgentId)
    if (current && servesChannel(current, channel)) return current
  }
  const declaring = active.find((a) => a.channels.includes(channel))
  if (declaring) return declaring
  const fallback = active.filter((a) => servesChannel(a, channel))
  return fallback.find((a) => a.isDefault) ?? fallback[0] ?? null
}

// ─── Time & hours ────────────────────────────────────────────────────────────

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function zonedParts(now: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const parts = fmt.formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return { weekday: WEEKDAYS.indexOf(get('weekday')), minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function isWithinHours(agent: Pick<AgentLike, 'hoursEnabled' | 'hoursTimezone' | 'hoursDays' | 'hoursStart' | 'hoursEnd'>, now: Date, accountTz: string) {
  if (!agent.hoursEnabled) return true
  const { weekday, minutes } = zonedParts(now, agent.hoursTimezone || accountTz)
  if (!agent.hoursDays.includes(weekday)) return false
  const start = toMinutes(agent.hoursStart)
  const end = toMinutes(agent.hoursEnd)
  // Overnight ranges (e.g. 22:00–06:00)
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end
}

/** «hoy es martes 24 de septiembre de 2026, 10:15» in the account's timezone. */
export function describeNow(now: Date, timeZone: string, locale = 'es-CO') {
  const date = new Intl.DateTimeFormat(locale, { timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now)
  const time = new Intl.DateTimeFormat(locale, { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now)
  return `${date.replace(/,/g, '')}, ${time}`
}

// ─── Pre-handoff (decided before spending a call) ────────────────────────────

export type PreHandoff =
  | { action: 'continue' }
  | { action: 'handoff'; reason: 'keyword' | 'max_turns' | 'outside_hours'; detail?: string }
  | { action: 'notice'; message: string }
  | { action: 'silent' }

export function normalizeText(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
}

export function matchKeyword(text: string, keywords: string[]) {
  const t = ` ${normalizeText(text).replace(/[^a-z0-9 ]/g, ' ')} `.replace(/\s+/g, ' ')
  return keywords.find((k) => {
    const n = normalizeText(k).replace(/[^a-z0-9 ]/g, ' ').trim()
    return n.length > 0 && t.includes(` ${n} `)
  }) ?? null
}

export const DEFAULT_OUTSIDE_HOURS_MESSAGE = 'Gracias por escribirnos. Ahora estamos fuera de horario; te respondemos en cuanto abramos.'

export function preHandoff(
  agent: Pick<AgentLike, 'handoffKeywords' | 'handoffAfterTurns' | 'hoursEnabled' | 'hoursTimezone' | 'hoursDays' | 'hoursStart' | 'hoursEnd' | 'outsideHours' | 'outsideHoursMessage'>,
  input: { text: string; turns: number; now: Date; accountTz: string },
): PreHandoff {
  const kw = matchKeyword(input.text, agent.handoffKeywords)
  if (kw) return { action: 'handoff', reason: 'keyword', detail: kw }
  if (agent.handoffAfterTurns > 0 && input.turns >= agent.handoffAfterTurns) return { action: 'handoff', reason: 'max_turns' }
  if (!isWithinHours(agent, input.now, input.accountTz)) {
    if (agent.outsideHours === 'handoff') return { action: 'handoff', reason: 'outside_hours' }
    if (agent.outsideHours === 'silent') return { action: 'silent' }
    return { action: 'notice', message: agent.outsideHoursMessage?.trim() || DEFAULT_OUTSIDE_HOURS_MESSAGE }
  }
  return { action: 'continue' }
}

// ─── Memory window ───────────────────────────────────────────────────────────

export type StoredMessage = { direction: 'INBOUND' | 'OUTBOUND'; body: string; isInternal?: boolean }

export function effectiveWindow(memoryWindow: number) {
  return Math.max(MIN_MEMORY_WINDOW, memoryWindow || 20)
}

/** Summarise when there is no summary yet or half a window of new messages fell out of the window. */
export function needsSummary(total: number, window: number, summarizedCount: number) {
  const older = total - window
  if (older <= 0) return false
  return summarizedCount === 0 || older - summarizedCount >= Math.max(2, Math.floor(window / 2))
}

/**
 * Converts stored messages into Messages API turns: inbound → user, outbound → assistant, internal
 * notes dropped, consecutive same-role turns merged, and the list always starts with a user turn.
 */
export function toTurns(messages: StoredMessage[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  const out: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (const m of messages) {
    if (m.isInternal || !m.body?.trim()) continue
    const role = m.direction === 'INBOUND' ? 'user' : 'assistant'
    const last = out[out.length - 1]
    if (last && last.role === role) last.content += `\n${m.body.trim()}`
    else out.push({ role, content: m.body.trim() })
  }
  while (out.length && out[0].role === 'assistant') out.shift()
  return out
}

// ─── Human guard (the one place that protects the human from the machine) ────

export type OutboundLike = { direction: string; isInternal: boolean; sentById: string | null; senderType: string | null; sentAt: Date }

export function isHumanMessage(m: OutboundLike) {
  if (m.direction !== 'OUTBOUND' || m.isInternal) return false
  if (m.senderType === 'AI' || m.senderType === 'AUTOMATION') return false
  // Sent from our inbox by a person, or from Meta's native inbox (echo we didn't originate)
  return Boolean(m.sentById) || m.senderType === 'HUMAN' || m.senderType === 'ECHO'
}

/**
 * A person wrote in the last 30 minutes → the machine stays out. Messages sent before the team
 * explicitly handed the conversation (back) to the AI don't count: that hand-back is their decision.
 */
export function hasRecentHumanActivity(messages: OutboundLike[], now: Date, graceMs = HUMAN_GRACE_MS, handedToAiAt?: Date | null) {
  return messages.some((m) =>
    isHumanMessage(m) &&
    now.getTime() - m.sentAt.getTime() < graceMs &&
    (!handedToAiAt || m.sentAt.getTime() > handedToAiAt.getTime()),
  )
}

// ─── Autopilot ───────────────────────────────────────────────────────────────

export type TakeOverConversation = {
  channel: string
  connectionId: string | null
  isTest: boolean
  assignedToId: string | null
  automationsPaused: boolean
  aiSpam: boolean
  threadOwner: string | null
  tags: string[]
  aiAgentId: string | null
  /** Set when the AI handed off; only "return to the AI" or a person closing the case clears it */
  aiHandoffAt: Date | null
  /** Meta page id / IG business id of the account the conversation came in through (stable across reconnects) */
  connectionExternalId?: string | null
  /** Already handed to the AI (by a person or a copilot takeover) */
  aiHandled?: boolean
}

export type TakeOverDecision =
  | { take: true; agent: AgentLike }
  | { take: false; reason: 'test' | 'human_owner' | 'human_recent' | 'handed_off' | 'paused' | 'spam' | 'thread_elsewhere' | 'skip_tag' | 'no_agent' | 'account_not_enabled' }

/**
 * Keys an agent's autopilotAccounts may hold for a conversation's channel account. The stable key is
 * CHANNEL:externalId (page / IG id), which survives reconnecting the account; the raw connection id
 * is accepted too for agents saved before that.
 */
export function accountKeysOf(conv: { channel: string; connectionId: string | null; connectionExternalId?: string | null }): string[] {
  if (!conv.connectionId) return [`${conv.channel}:default`]
  return conv.connectionExternalId ? [`${conv.channel}:${conv.connectionExternalId}`, conv.connectionId] : [conv.connectionId]
}

/** Active agents with autopilot on and this channel declared explicitly (never the "all channels" default). */
export function autopilotCandidates<T extends AgentLike>(agents: T[], channel: string): T[] {
  return agents
    .filter((a) => a.status === 'active' && a.autopilot && a.autopilotChannels.includes(channel) && servesChannel(a, channel))
    .sort(byAge)
}

export function accountAllowed(agent: Pick<AgentLike, 'autopilotAccounts'>, accountKeys: string[]) {
  return agent.autopilotAccounts.length === 0 || accountKeys.some((k) => agent.autopilotAccounts.includes(k))
}

/**
 * Every exit is negative except the last one: when in doubt, the machine does not answer.
 */
export function shouldTakeOverCore<T extends AgentLike>(
  conv: TakeOverConversation,
  ctx: { agents: T[]; recentHumanActivity: boolean },
): { take: true; agent: T } | Extract<TakeOverDecision, { take: false }> {
  if (conv.isTest) return { take: false, reason: 'test' }
  if (conv.assignedToId) return { take: false, reason: 'human_owner' }
  if (ctx.recentHumanActivity) return { take: false, reason: 'human_recent' }
  if (conv.aiHandoffAt) return { take: false, reason: 'handed_off' }
  if (conv.automationsPaused) return { take: false, reason: 'paused' }
  if (conv.aiSpam) return { take: false, reason: 'spam' }
  if (conv.threadOwner) return { take: false, reason: 'thread_elsewhere' }

  const candidates = autopilotCandidates(ctx.agents, conv.channel)
  // A conversation explicitly given to an agent that has copilot on this channel stays with that agent
  if (conv.aiHandled && conv.aiAgentId) {
    const owner = ctx.agents.find((a) => a.id === conv.aiAgentId && a.status === 'active' && (a.copilotChannels ?? []).includes(conv.channel) && servesChannel(a, conv.channel))
    if (owner && !candidates.includes(owner)) candidates.push(owner)
  }
  const skipTags = new Set(candidates.flatMap((a) => a.autopilotSkipTags.map(normalizeText)))
  if (conv.tags.some((t) => skipTags.has(normalizeText(t)))) return { take: false, reason: 'skip_tag' }
  if (candidates.length === 0) return { take: false, reason: 'no_agent' }

  const accountKeys = accountKeysOf(conv)
  const allowed = candidates.filter((a) => accountAllowed(a, accountKeys))
  if (allowed.length === 0) return { take: false, reason: 'account_not_enabled' }

  const current = conv.aiAgentId ? allowed.find((a) => a.id === conv.aiAgentId) : undefined
  const explicit = allowed.find((a) => accountKeys.some((k) => a.autopilotAccounts.includes(k)))
  return { take: true, agent: current ?? explicit ?? allowed[0] }
}
