/**
 * Copilot: the agent helps the person handling a conversation (reply suggestions) and takes the
 * conversation over when nobody answers in time. Pure rules here; wiring in lib/ai/copilot.ts.
 */
import { isWithinHours, normalizeText, servesChannel, type AgentLike } from '@/lib/ai/runtime-core'

export type CopilotAgentLike = AgentLike & {
  copilotChannels: string[]
  copilotSuggest: string
  copilotTakeover: boolean
  copilotTakeoverMinutes: number
  copilotWarnMinutes: number
}

/** Past this age a client message can't be answered anyway (24h channel window). */
export const COPILOT_MAX_AGE_MS = 23 * 60 * 60 * 1000

const byAge = <T extends { createdAt: Date }>(a: T, b: T) => a.createdAt.getTime() - b.createdAt.getTime()

/** Oldest active agent with copilot on for this channel (declared explicitly, like the autopilot). */
export function copilotAgentFor<T extends CopilotAgentLike>(agents: T[], channel: string): T | null {
  return agents.filter((a) => a.status === 'active' && a.copilotChannels.includes(channel) && servesChannel(a, channel)).sort(byAge)[0] ?? null
}

export type CopilotConversation = {
  aiHandled: boolean
  aiHandoffAt: Date | null
  isTest: boolean
  aiSpam: boolean
  automationsPaused: boolean
  threadOwner: string | null
  status: string
  tags: string[]
  copilotSkipMessageId: string | null
}

export type CopilotTimer =
  | { action: 'none'; reason: string }
  | { action: 'wait' | 'warn' | 'takeover' | 'alert'; mode: 'takeover' | 'alert'; warnAt: Date; takeoverAt: Date; waitingMinutes: number }

/**
 * Where a conversation stands in the "nobody answered" timer. It only runs while the last message is
 * the client's, inside hours and inside the channel window. Conversations the AI itself handed off
 * (mandatory cases) or with an excluded tag are never taken over: they only raise an alert.
 */
export function copilotTimer(
  agent: Pick<CopilotAgentLike, 'copilotTakeover' | 'copilotTakeoverMinutes' | 'copilotWarnMinutes' | 'autopilotSkipTags' | 'hoursEnabled' | 'hoursTimezone' | 'hoursDays' | 'hoursStart' | 'hoursEnd'>,
  conv: CopilotConversation,
  lastMessage: { id: string; direction: string; sentAt: Date } | null,
  now: Date,
  accountTz: string,
): CopilotTimer {
  if (!agent.copilotTakeover) return { action: 'none', reason: 'takeover_off' }
  if (conv.aiHandled) return { action: 'none', reason: 'ai_handles' }
  if (conv.isTest || conv.aiSpam || conv.automationsPaused || conv.threadOwner) return { action: 'none', reason: 'excluded' }
  if (conv.status === 'RESOLVED' || conv.status === 'CLOSED') return { action: 'none', reason: 'closed' }
  if (!lastMessage || lastMessage.direction !== 'INBOUND') return { action: 'none', reason: 'answered' }
  if (conv.copilotSkipMessageId === lastMessage.id) return { action: 'none', reason: 'person_handles' }
  const elapsed = now.getTime() - lastMessage.sentAt.getTime()
  if (elapsed > COPILOT_MAX_AGE_MS) return { action: 'none', reason: 'window_closed' }
  if (!isWithinHours(agent, now, accountTz)) return { action: 'none', reason: 'outside_hours' }

  const skip = new Set(agent.autopilotSkipTags.map(normalizeText))
  const mode = conv.aiHandoffAt || conv.tags.some((t) => skip.has(normalizeText(t))) ? 'alert' : 'takeover'
  const minutes = Math.max(1, agent.copilotTakeoverMinutes)
  const warnMinutes = Math.min(Math.max(0, agent.copilotWarnMinutes), minutes - 1)
  const takeoverAt = new Date(lastMessage.sentAt.getTime() + minutes * 60_000)
  const warnAt = new Date(takeoverAt.getTime() - warnMinutes * 60_000)
  const waitingMinutes = Math.floor(elapsed / 60_000)
  const base = { mode, warnAt, takeoverAt, waitingMinutes } as const
  if (now >= takeoverAt) return { action: mode === 'alert' ? 'alert' : 'takeover', ...base }
  if (mode === 'takeover' && warnMinutes > 0 && now >= warnAt) return { action: 'warn', ...base }
  return { action: 'wait', ...base }
}

/** Splits the suggestion text from the "[[CONTEXTO]]" note the model may add for the person. */
export function splitSuggestion(raw: string): { text: string; context: string | null } {
  const [text, ...rest] = raw.split(/\[\[\s*CONTEXTO\s*\]\]/i)
  const context = rest.join(' ').replace(/\s+/g, ' ').trim()
  return { text: text.trim(), context: context || null }
}

/** used = sent as suggested; edited = sent after changes. Whitespace and case don't count as edits. */
export function suggestionOutcome(suggested: string, sent: string): 'used' | 'edited' {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()
  return norm(suggested) === norm(sent) ? 'used' : 'edited'
}
