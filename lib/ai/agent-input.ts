import { TOOL_NAMES, CRM_MODULES } from '@/lib/ai/tools'
import { COMMENT_CHANNELS, COMMENT_SCOPES_MODES, REPLY_MODES, SENSITIVE_ACTIONS } from '@/lib/ai/comments-core'

export const AGENT_CHANNELS = ['WHATSAPP', 'SMS', 'MESSENGER', 'INSTAGRAM'] as const
/** Configured in the agent's "Comentarios" tab, apart from messaging channels */
export const AGENT_COMMENT_CHANNELS = COMMENT_CHANNELS

/** Face catalog: agents store the key, never a URL. */
export const AVATARS = [
  { key: 'face-1', emoji: '👩🏽‍💼', bg: '#EDE9FE' },
  { key: 'face-2', emoji: '👨🏻‍💼', bg: '#FFEDD5' },
  { key: 'face-3', emoji: '👩🏼‍🔧', bg: '#DCFCE7' },
  { key: 'face-4', emoji: '👨🏾‍🔧', bg: '#DBEAFE' },
  { key: 'face-5', emoji: '🧑🏻‍💻', bg: '#FCE7F3' },
  { key: 'face-6', emoji: '👩🏻‍🦱', bg: '#FEF9C3' },
  { key: 'face-7', emoji: '👨🏽‍🦳', bg: '#E0F2FE' },
  { key: 'face-8', emoji: '🤖', bg: '#F3F4F6' },
] as const

export const LANGUAGES = ['auto', 'es', 'en', 'pt', 'fr'] as const

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined)
const list = (v: unknown, allowed?: readonly string[], max = 50) =>
  Array.isArray(v)
    ? Array.from(new Set(v.map((x) => String(x).trim()).filter((x) => x && (!allowed || allowed.includes(x))))).slice(0, max)
    : undefined
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]) => (typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : undefined)
const hhmm = (v: unknown) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : undefined)

export type AgentInput = Record<string, unknown>

/**
 * Whitelists and bounds what the screen can change. Returns only the provided fields (PATCH-friendly).
 * `allowModel`: the platform administrator decides whether agents may pick their own model.
 */
export function sanitizeAgentInput(body: AgentInput, opts: { allowModel: boolean }) {
  const out: Record<string, unknown> = {}
  const set = (k: string, v: unknown) => { if (v !== undefined) out[k] = v }

  set('name', text(body.name, 80))
  set('avatar', oneOf(body.avatar, AVATARS.map((a) => a.key)))
  set('goal', text(body.goal, 1000))
  set('instructions', text(body.instructions, 12000))
  set('tone', text(body.tone, 200))
  set('language', oneOf(body.language, LANGUAGES))
  set('status', oneOf(body.status, ['active', 'paused'] as const))
  if (opts.allowModel && body.model !== undefined) out.model = text(body.model, 100) || null
  if (body.maxTokens !== undefined) out.maxTokens = clampInt(body.maxTokens, 128, 4096, 512)
  if (body.memoryWindow !== undefined) out.memoryWindow = clampInt(body.memoryWindow, 4, 100, 20)

  set('channels', list(body.channels, AGENT_CHANNELS))
  if (typeof body.isDefault === 'boolean') out.isDefault = body.isDefault

  set('handoffKeywords', list(body.handoffKeywords, undefined, 100)?.map((k) => k.slice(0, 60)))
  if (body.handoffAfterTurns !== undefined) out.handoffAfterTurns = clampInt(body.handoffAfterTurns, 0, 200, 0)
  if (typeof body.handoffOnUnknown === 'boolean') out.handoffOnUnknown = body.handoffOnUnknown
  set('handoffMessage', text(body.handoffMessage, 500))

  if (typeof body.autopilot === 'boolean') out.autopilot = body.autopilot
  set('autopilotChannels', list(body.autopilotChannels, AGENT_CHANNELS))
  set('autopilotAccounts', list(body.autopilotAccounts, undefined, 100))
  set('autopilotSkipTags', list(body.autopilotSkipTags, undefined, 50)?.map((t) => t.toLowerCase().slice(0, 40)))
  if (body.reengageAfterHours !== undefined) out.reengageAfterHours = clampInt(body.reengageAfterHours, 0, 23, 0)

  set('copilotChannels', list(body.copilotChannels, AGENT_CHANNELS))
  set('copilotSuggest', oneOf(body.copilotSuggest, ['auto', 'manual'] as const))
  if (typeof body.copilotTakeover === 'boolean') out.copilotTakeover = body.copilotTakeover
  if (body.copilotTakeoverMinutes !== undefined) out.copilotTakeoverMinutes = clampInt(body.copilotTakeoverMinutes, 1, 720, 10)
  if (body.copilotWarnMinutes !== undefined) out.copilotWarnMinutes = clampInt(body.copilotWarnMinutes, 0, 60, 2)

  set('commentChannels', list(body.commentChannels, AGENT_COMMENT_CHANNELS))
  set('commentCopilotChannels', list(body.commentCopilotChannels, AGENT_COMMENT_CHANNELS))
  set('commentAccounts', list(body.commentAccounts, undefined, 100))
  if (body.commentReplyMode !== undefined) {
    const raw = body.commentReplyMode && typeof body.commentReplyMode === 'object' ? (body.commentReplyMode as Record<string, unknown>) : {}
    const modes: Record<string, string> = {}
    for (const ch of AGENT_COMMENT_CHANNELS) {
      const m = oneOf(raw[ch], REPLY_MODES)
      if (m) modes[ch] = m
    }
    out.commentReplyMode = modes
  }
  if (body.commentPublicTemplate !== undefined) out.commentPublicTemplate = text(body.commentPublicTemplate, 300) || null
  set('commentScope', oneOf(body.commentScope, COMMENT_SCOPES_MODES))
  set('commentAlwaysKeywords', list(body.commentAlwaysKeywords, undefined, 100)?.map((k) => k.slice(0, 60)))
  set('commentNeverKeywords', list(body.commentNeverKeywords, undefined, 100)?.map((k) => k.slice(0, 60)))
  if (typeof body.commentIgnoreTagOnly === 'boolean') out.commentIgnoreTagOnly = body.commentIgnoreTagOnly
  set('commentSensitiveAction', oneOf(body.commentSensitiveAction, SENSITIVE_ACTIONS))
  if (typeof body.commentHideOffensive === 'boolean') out.commentHideOffensive = body.commentHideOffensive
  if (typeof body.commentHideSpam === 'boolean') out.commentHideSpam = body.commentHideSpam
  if (body.commentMaxPerPostPerHour !== undefined) out.commentMaxPerPostPerHour = clampInt(body.commentMaxPerPostPerHour, 1, 1000, 20)
  if (body.commentMaxPerAccountPerDay !== undefined) out.commentMaxPerAccountPerDay = clampInt(body.commentMaxPerAccountPerDay, 1, 1000, 200)

  set('tools', list(body.tools, TOOL_NAMES))
  set('crmModules', list(body.crmModules, Object.keys(CRM_MODULES)))
  if (body.webhookUrl !== undefined) {
    const url = text(body.webhookUrl, 500) || null
    if (url && !/^https:\/\/[^\s]+$/.test(url)) throw new Error('El webhook debe ser una URL https://')
    out.webhookUrl = url
  }

  set('goalDoneAction', oneOf(body.goalDoneAction, ['none', 'close', 'tag', 'handoff'] as const))
  if (body.goalDoneTag !== undefined) out.goalDoneTag = text(body.goalDoneTag, 40)?.toLowerCase() || null

  if (typeof body.hoursEnabled === 'boolean') out.hoursEnabled = body.hoursEnabled
  if (body.hoursTimezone !== undefined) {
    const tz = text(body.hoursTimezone, 60) || null
    if (tz) {
      try { new Intl.DateTimeFormat('en-US', { timeZone: tz }) } catch { throw new Error('Zona horaria inválida') }
    }
    out.hoursTimezone = tz
  }
  if (Array.isArray(body.hoursDays)) out.hoursDays = Array.from(new Set(body.hoursDays.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))).sort()
  set('hoursStart', hhmm(body.hoursStart))
  set('hoursEnd', hhmm(body.hoursEnd))
  set('outsideHours', oneOf(body.outsideHours, ['notice', 'handoff', 'silent'] as const))
  if (body.outsideHoursMessage !== undefined) out.outsideHoursMessage = text(body.outsideHoursMessage, 500) || null

  if (typeof body.ignoreSpam === 'boolean') out.ignoreSpam = body.ignoreSpam
  set('signatureMode', oneOf(body.signatureMode, ['off', 'every', 'final'] as const))
  if (body.signatureText !== undefined) out.signatureText = text(body.signatureText, 120) || null

  if (out.name === '') throw new Error('El nombre es obligatorio')
  return out
}

export function resolutionRate(conversations: number, handoffs: number) {
  if (!conversations) return null
  return Math.max(0, Math.round(((conversations - handoffs) / conversations) * 100))
}
