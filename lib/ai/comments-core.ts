/**
 * Comments on Facebook / Instagram posts answered by the agents. Pure rules (no DB, no API) so every
 * decision is unit-testable; wiring in lib/ai/comments.ts and lib/messaging/meta-comments.ts.
 */
import { matchKeyword, normalizeText } from '@/lib/ai/runtime-core'

export const COMMENT_CHANNELS = ['FACEBOOK_COMMENT', 'INSTAGRAM_COMMENT'] as const
export type CommentChannel = (typeof COMMENT_CHANNELS)[number]

export const REPLY_MODES = ['public_and_private', 'public_only', 'private_only'] as const
export type ReplyMode = (typeof REPLY_MODES)[number]
export const SENSITIVE_ACTIONS = ['private_and_handoff', 'private_only', 'handoff_only'] as const
export type SensitiveAction = (typeof SENSITIVE_ACTIONS)[number]
export const COMMENT_SCOPES_MODES = ['intent', 'all'] as const

/** Meta allows one private reply per comment, within 7 days of the comment. */
export const PRIVATE_REPLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export const DEFAULT_SENSITIVE_ACK = '{nombre}, te escribimos por mensaje privado para ayudarte.'

export function isCommentChannel(channel: string): channel is CommentChannel {
  return channel === 'FACEBOOK_COMMENT' || channel === 'INSTAGRAM_COMMENT'
}

/** The Meta account a comment channel belongs to: Facebook comments live on the Page (Messenger connection). */
export function baseChannelOf(channel: CommentChannel): 'MESSENGER' | 'INSTAGRAM' {
  return channel === 'INSTAGRAM_COMMENT' ? 'INSTAGRAM' : 'MESSENGER'
}

export function commentChannelOf(channel: 'MESSENGER' | 'INSTAGRAM'): CommentChannel {
  return channel === 'INSTAGRAM' ? 'INSTAGRAM_COMMENT' : 'FACEBOOK_COMMENT'
}

/** Comment conversations are one per person and post. */
export function commentConversationKey(commenterId: string, postId: string) {
  return `${commenterId}:${postId}`
}

export type CommentAgentLike = {
  commentReplyMode: unknown
  commentPublicTemplate: string | null
  commentScope: string
  commentAlwaysKeywords: string[]
  commentNeverKeywords: string[]
  commentIgnoreTagOnly: boolean
  commentSensitiveAction: string
  commentHideOffensive: boolean
  commentHideSpam: boolean
  commentMaxPerPostPerHour: number
  commentMaxPerAccountPerDay: number
}

export function replyModeFor(agent: Pick<CommentAgentLike, 'commentReplyMode'>, channel: string): ReplyMode {
  const map = agent.commentReplyMode && typeof agent.commentReplyMode === 'object' ? (agent.commentReplyMode as Record<string, unknown>) : {}
  const mode = map[channel]
  return typeof mode === 'string' && (REPLY_MODES as readonly string[]).includes(mode) ? (mode as ReplyMode) : 'public_and_private'
}

export function sensitiveActionOf(agent: Pick<CommentAgentLike, 'commentSensitiveAction'>): SensitiveAction {
  return (SENSITIVE_ACTIONS as readonly string[]).includes(agent.commentSensitiveAction) ? (agent.commentSensitiveAction as SensitiveAction) : 'private_and_handoff'
}

// ─── Pre-filter (decided before spending a call) ─────────────────────────────

const MENTION_RE = /@[A-Za-z0-9._]+/g

/** Only tags to other people ("@ana @luis 👀"): nothing addressed to the business. */
export function isTagOnly(text: string) {
  const mentions = text.match(MENTION_RE)
  if (!mentions?.length) return false
  return !/[a-z0-9]/.test(normalizeText(text.replace(MENTION_RE, ' ')))
}

export type Prefilter =
  | { action: 'ignore'; reason: 'never_keyword' | 'tag_only' | 'empty'; detail?: string }
  | { action: 'answer'; reason: 'always_keyword' | 'scope_all'; detail?: string }
  | { action: 'model' }

/**
 * Order: never-keywords → always-keywords → tag-only → scope. "answer" means the model may not
 * choose to ignore the comment; "model" lets it decide with [[IGNORAR]].
 */
export function commentPrefilter(
  agent: Pick<CommentAgentLike, 'commentNeverKeywords' | 'commentAlwaysKeywords' | 'commentIgnoreTagOnly' | 'commentScope'>,
  text: string,
): Prefilter {
  if (!text.trim()) return { action: 'ignore', reason: 'empty' }
  const never = matchKeyword(text, agent.commentNeverKeywords)
  if (never) return { action: 'ignore', reason: 'never_keyword', detail: never }
  const always = matchKeyword(text, agent.commentAlwaysKeywords)
  if (always) return { action: 'answer', reason: 'always_keyword', detail: always }
  if (agent.commentIgnoreTagOnly && isTagOnly(text)) return { action: 'ignore', reason: 'tag_only' }
  if (agent.commentScope === 'all') return { action: 'answer', reason: 'scope_all' }
  return { action: 'model' }
}

// ─── Model output ────────────────────────────────────────────────────────────

const PRIVATE_RE = /\[\[\s*PRIVADO\s*\]\]/i
const CONTEXT_RE = /\[\[\s*CONTEXTO\s*\]\]/i

const clean = (s: string) => s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()

/** "public [[PRIVADO]] private"; without the marker everything is the public text. */
export function splitPublicPrivate(text: string): { publicText: string; privateText: string } {
  const [pub, ...rest] = text.split(PRIVATE_RE)
  return { publicText: clean(pub), privateText: clean(rest.join('\n')) }
}

/** Copilot drafts: public, private and the [[CONTEXTO]] note for the person, in whatever order the model wrote them. */
export function splitCommentSuggestion(raw: string): { publicText: string; privateText: string; context: string | null } {
  const { publicText, privateText } = splitPublicPrivate(raw)
  const cut = (s: string) => {
    const [text, ...ctx] = s.split(CONTEXT_RE)
    return { text: clean(text), context: ctx.join(' ').replace(/\s+/g, ' ').trim() }
  }
  const pub = cut(publicText)
  const priv = cut(privateText)
  return { publicText: pub.text, privateText: priv.text, context: pub.context || priv.context || null }
}

export function fillTemplate(template: string, name: string | null | undefined) {
  const first = name?.trim().replace(/^@/, '').split(/\s+/)[0] || ''
  const out = template.replace(/\{\s*nombre\s*\}/gi, first)
  // "{nombre}, …" with no known name must not start with a comma
  return out.replace(/^[\s,]+/, '').replace(/\s{2,}/g, ' ').replace(/^./, (c) => c.toUpperCase()).trim()
}

// ─── Private reply ───────────────────────────────────────────────────────────

export type PrivateReplyAvailability = { ok: true } | { ok: false; reason: string }

/** One private reply per comment, within 7 days, never for mentions on other people's posts. */
export function privateReplyAvailability(
  target: { commentId: string | null; sentAt: Date } | null,
  repliedCommentIds: Array<string | null>,
  now: Date,
  commentKind?: string | null,
): PrivateReplyAvailability {
  if (commentKind === 'mention') return { ok: false, reason: 'Las menciones no admiten respuesta privada' }
  if (!target?.commentId) return { ok: false, reason: 'No hay un comentario al que responder' }
  if (repliedCommentIds.includes(target.commentId)) return { ok: false, reason: 'Ya se envió la respuesta privada a este comentario' }
  if (now.getTime() - target.sentAt.getTime() > PRIVATE_REPLY_WINDOW_MS) return { ok: false, reason: 'Pasaron más de 7 días desde el comentario: Meta no permite la respuesta privada' }
  return { ok: true }
}

// ─── Limits ──────────────────────────────────────────────────────────────────

export function commentLimitReached(
  agent: Pick<CommentAgentLike, 'commentMaxPerPostPerHour' | 'commentMaxPerAccountPerDay'>,
  counts: { postLastHour: number; accountLastDay: number },
): { reached: false } | { reached: true; detail: string } {
  if (counts.postLastHour >= Math.max(1, agent.commentMaxPerPostPerHour)) {
    return { reached: true, detail: `${agent.commentMaxPerPostPerHour} respuestas por publicación en la última hora` }
  }
  if (counts.accountLastDay >= Math.max(1, agent.commentMaxPerAccountPerDay)) {
    return { reached: true, detail: `${agent.commentMaxPerAccountPerDay} respuestas de la cuenta en las últimas 24 horas` }
  }
  return { reached: false }
}

// ─── What to do with the model's answer ──────────────────────────────────────

export type CommentSignals = {
  text: string
  handoff: boolean
  sensitive: boolean
  ignore: boolean
  offensive: boolean
  spam: boolean
  /** A tool ran (platform data, catalog, knowledge): its output may be personal, so nothing of it goes public */
  usedTools?: boolean
}

export type CommentPlan = {
  outcome: 'reply' | 'ignored' | 'hidden' | 'moderation_noted' | 'handoff' | 'nothing'
  publicText: string | null
  privateText: string | null
  hide: boolean
  handoff: boolean
  /** Why the plan was chosen, for the thread's event */
  detail: string
}

/**
 * Turns the model's answer into actions. Sensitive topics (refunds, complaints, safety, personal
 * data) are never answered in public: at most a neutral acknowledgement pointing to the private reply.
 */
export function planCommentReply(input: {
  signals: CommentSignals
  mode: ReplyMode
  sensitiveAction: SensitiveAction
  template: string | null
  contactName: string | null
  hideOffensive: boolean
  hideSpam: boolean
  canHide: boolean
  privateAvailable: boolean
  /** The pre-filter said this comment must be answered */
  forced: boolean
}): CommentPlan {
  const { signals: s, mode } = input
  const none = { publicText: null, privateText: null, hide: false, handoff: false }

  if (s.offensive) {
    const hide = input.hideOffensive && input.canHide
    return { ...none, outcome: hide ? 'hidden' : 'moderation_noted', hide, detail: 'Comentario ofensivo' }
  }
  if (s.spam) {
    const hide = input.hideSpam && input.canHide
    return { ...none, outcome: hide ? 'hidden' : 'moderation_noted', hide, detail: 'Spam' }
  }

  const { publicText, privateText } = splitPublicPrivate(s.text)
  const template = input.template?.trim() ? fillTemplate(input.template, input.contactName) : null

  // Enforced here, not only in the prompt: whatever a tool returned is answered by private reply only
  if (s.usedTools && !s.sensitive && !s.handoff && !(s.ignore && !input.forced)) {
    const privateMsg = privateText || publicText
    if (!privateMsg) return { ...none, outcome: 'nothing', detail: 'Respuesta vacía' }
    if (!input.privateAvailable) return { ...none, outcome: 'handoff', handoff: true, detail: 'La respuesta usa datos que no se pueden publicar' }
    const ack = mode === 'private_only' ? template : template || fillTemplate(DEFAULT_SENSITIVE_ACK, input.contactName)
    return { ...none, outcome: 'reply', publicText: ack, privateText: privateMsg, detail: 'Respuesta con datos consultados: por privado' }
  }

  if (s.sensitive || s.handoff) {
    const reason = s.sensitive ? 'Tema sensible' : 'Requiere una persona'
    const privateMsg = privateText || publicText
    if (input.sensitiveAction === 'handoff_only' || !input.privateAvailable || !privateMsg) {
      return { ...none, outcome: 'handoff', handoff: true, detail: reason }
    }
    const ack = mode === 'public_and_private' ? template || fillTemplate(DEFAULT_SENSITIVE_ACK, input.contactName) : null
    return {
      outcome: 'reply',
      publicText: ack,
      privateText: privateMsg,
      hide: false,
      handoff: input.sensitiveAction === 'private_and_handoff',
      detail: reason,
    }
  }

  if (s.ignore && !input.forced) return { ...none, outcome: 'ignored', detail: 'La IA decidió no responder' }

  if (mode === 'public_only') {
    const text = publicText || privateText
    return text ? { ...none, outcome: 'reply', publicText: text, detail: 'Respuesta pública' } : { ...none, outcome: 'nothing', detail: 'Respuesta vacía' }
  }

  if (mode === 'private_only') {
    const text = privateText || publicText
    if (!text) return { ...none, outcome: 'nothing', detail: 'Respuesta vacía' }
    if (!input.privateAvailable) return { ...none, outcome: 'handoff', handoff: true, detail: 'No se puede responder en privado' }
    return { ...none, outcome: 'reply', publicText: template, privateText: text, detail: 'Respuesta privada' }
  }

  // public_and_private
  const pub = template || publicText || (!input.privateAvailable ? privateText : '')
  const priv = input.privateAvailable ? privateText : ''
  if (!pub && !priv) return { ...none, outcome: 'nothing', detail: 'Respuesta vacía' }
  return { ...none, outcome: 'reply', publicText: pub || null, privateText: priv || null, detail: 'Respuesta pública y privada' }
}

/** Never answer our own comments (our replies come back through the same webhook). */
export function isOwnComment(fromId: string | null | undefined, ownIds: Array<string | null | undefined>) {
  return !!fromId && ownIds.some((id) => id && String(id) === String(fromId))
}

/** Missing scopes for comments on a connection; null while the token was never checked. */
export function requiredCommentScopes(channel: 'MESSENGER' | 'INSTAGRAM', mentions: boolean) {
  if (channel === 'MESSENGER') return ['pages_read_engagement', 'pages_read_user_content', 'pages_manage_engagement']
  return ['instagram_manage_comments', ...(mentions ? ['instagram_manage_mentions'] : [])]
}

export function missingScopes(required: string[], granted: string[] | null | undefined) {
  if (!granted) return null
  return required.filter((s) => !granted.includes(s))
}

export type CommentSettings = { enabled: boolean; includeAds: boolean; mentions: boolean; grantedScopes: string[] | null; checkedAt: string | null }

export function commentSettingsOf(raw: unknown): CommentSettings {
  const s = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    enabled: s.enabled === true,
    includeAds: s.includeAds !== false,
    mentions: s.mentions === true,
    grantedScopes: Array.isArray(s.grantedScopes) ? s.grantedScopes.map(String) : null,
    checkedAt: typeof s.checkedAt === 'string' ? s.checkedAt : null,
  }
}

/** Hiding needs the manage permission; unknown (never diagnosed) is allowed and Meta has the last word. */
export function canModerate(channel: 'MESSENGER' | 'INSTAGRAM', settings: Pick<CommentSettings, 'grantedScopes'>) {
  if (!settings.grantedScopes) return true
  return settings.grantedScopes.includes(channel === 'MESSENGER' ? 'pages_manage_engagement' : 'instagram_manage_comments')
}

export function describeSkip(reason: string) {
  const labels: Record<string, string> = {
    never_keyword: 'Palabra clave para no responder',
    tag_only: 'Solo etiqueta a otras personas',
    empty: 'Comentario sin texto',
  }
  return labels[reason] || reason
}
