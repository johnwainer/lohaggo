import { createLogger } from '@/lib/logger'
import { getMetaAppConfig, META_GRAPH_DEFAULT_VERSION, type MetaAppConfig } from '@/lib/messaging/provider-config'

const logger = createLogger('meta-graph')

export type MetaChannel = 'MESSENGER' | 'INSTAGRAM'

export class MetaGraphError extends Error {
  code: number | null
  subcode: number | null
  status: number
  type: string | null

  constructor(message: string, opts: { code?: number | null; subcode?: number | null; status: number; type?: string | null }) {
    super(message)
    this.name = 'MetaGraphError'
    this.code = opts.code ?? null
    this.subcode = opts.subcode ?? null
    this.status = opts.status
    this.type = opts.type ?? null
  }
}

function graphBase(version?: string) {
  const v = (version || META_GRAPH_DEFAULT_VERSION).replace(/^\/+|\/+$/g, '')
  return `https://graph.facebook.com/${v}`
}

export function facebookDialogUrl(version?: string) {
  const v = (version || META_GRAPH_DEFAULT_VERSION).replace(/^\/+|\/+$/g, '')
  return `https://www.facebook.com/${v}/dialog/oauth`
}

type GraphFetchOptions = {
  method?: 'GET' | 'POST' | 'DELETE'
  token?: string
  query?: Record<string, string | number | undefined>
  body?: unknown
  version?: string
  timeoutMs?: number
}

/**
 * Single entry point for every Graph API call. Errors are normalised into MetaGraphError
 * so callers can branch on `code` (e.g. 100 = missing param, 190 = bad token, 10/200/3/230 = permissions).
 */
export async function graphFetch<T = Record<string, unknown>>(path: string, opts: GraphFetchOptions = {}): Promise<T> {
  const cleanPath = path.replace(/^\/+/, '')
  const url = new URL(`${graphBase(opts.version)}/${cleanPath}`)
  for (const [k, v] of Object.entries(opts.query || {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  }

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`
  let body: string | undefined
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15000)
  let res: Response
  try {
    res = await fetch(url.toString(), { method: opts.method || 'GET', headers, body, signal: controller.signal, cache: 'no-store' })
  } catch (err) {
    clearTimeout(timer)
    throw new MetaGraphError(err instanceof Error ? err.message : 'Network error', { status: 0 })
  }
  clearTimeout(timer)

  const text = await res.text()
  let data: Record<string, unknown> = {}
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    data = { raw: text }
  }

  if (!res.ok || (data && typeof data === 'object' && 'error' in data)) {
    const errObj = (data?.error && typeof data.error === 'object' ? data.error : {}) as Record<string, unknown>
    // Meta returns OAuth rejections in `error_message`, not `error_description`
    const message =
      (errObj.message as string | undefined) ||
      (data.error_message as string | undefined) ||
      (data.error_description as string | undefined) ||
      `Graph API error (${res.status})`
    logger.warn('Graph API error', { path: cleanPath, status: res.status, code: errObj.code, subcode: errObj.error_subcode, message })
    throw new MetaGraphError(message, {
      code: typeof errObj.code === 'number' ? errObj.code : null,
      subcode: typeof errObj.error_subcode === 'number' ? errObj.error_subcode : null,
      status: res.status,
      type: typeof errObj.type === 'string' ? errObj.type : null,
    })
  }

  return data as T
}

// ─── OAuth ───────────────────────────────────────────────────────────────────

export const META_SCOPES: Record<MetaChannel, string[]> = {
  MESSENGER: ['pages_show_list', 'pages_messaging', 'pages_manage_metadata'],
  INSTAGRAM: ['pages_show_list', 'instagram_basic', 'instagram_manage_messages', 'pages_manage_metadata'],
}

/** Extra scopes asked only when the account is connected with the comments option. */
export const COMMENT_SCOPES: Record<MetaChannel, string[]> = {
  MESSENGER: ['pages_read_engagement', 'pages_read_user_content', 'pages_manage_engagement'],
  INSTAGRAM: ['instagram_manage_comments'],
}
export const MENTION_SCOPE = 'instagram_manage_mentions'

/** Publishing posts from the marketing module (always asked: it is how the business uses its pages). */
export const PUBLISH_SCOPES: Record<MetaChannel, string[]> = {
  MESSENGER: ['pages_manage_posts', 'pages_read_engagement'],
  INSTAGRAM: ['instagram_content_publish'],
}

export type OAuthOptions = { comments?: boolean; mentions?: boolean }

export function scopesFor(channel: MetaChannel, options: OAuthOptions = {}) {
  const scopes = [...META_SCOPES[channel], ...PUBLISH_SCOPES[channel]]
  if (options.comments) scopes.push(...COMMENT_SCOPES[channel])
  if (options.comments && options.mentions && channel === 'INSTAGRAM') scopes.push(MENTION_SCOPE)
  return Array.from(new Set(scopes))
}

export function buildOAuthUrl(params: { app: MetaAppConfig; redirectUri: string; state: string; channel: MetaChannel; options?: OAuthOptions }) {
  const url = new URL(facebookDialogUrl(params.app.graphVersion))
  url.searchParams.set('client_id', params.app.appId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('state', params.state)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', scopesFor(params.channel, params.options).join(','))
  url.searchParams.set('auth_type', 'rerequest')
  if (params.app.configId) url.searchParams.set('config_id', params.app.configId)
  return url.toString()
}

export async function exchangeCodeForUserToken(app: MetaAppConfig, code: string, redirectUri: string) {
  const data = await graphFetch<{ access_token: string; token_type?: string; expires_in?: number }>('oauth/access_token', {
    version: app.graphVersion,
    query: { client_id: app.appId, client_secret: app.appSecret, redirect_uri: redirectUri, code },
  })
  return data.access_token
}

export async function exchangeLongLivedToken(app: MetaAppConfig, shortToken: string) {
  const data = await graphFetch<{ access_token: string; expires_in?: number }>('oauth/access_token', {
    version: app.graphVersion,
    query: {
      grant_type: 'fb_exchange_token',
      client_id: app.appId,
      client_secret: app.appSecret,
      fb_exchange_token: shortToken,
    },
  })
  return { token: data.access_token, expiresIn: data.expires_in ?? null }
}

export type MetaPageCandidate = {
  id: string
  name: string
  pageId: string
  username?: string | null
  pageAccessToken: string
}

type AccountsResponse = {
  data: Array<{
    id: string
    name: string
    access_token: string
    instagram_business_account?: { id: string; username?: string }
  }>
  paging?: { next?: string }
}

export async function listPagesForChannel(app: MetaAppConfig, userToken: string, channel: MetaChannel): Promise<MetaPageCandidate[]> {
  const data = await graphFetch<AccountsResponse>('me/accounts', {
    version: app.graphVersion,
    token: userToken,
    query: { fields: 'id,name,access_token,instagram_business_account{id,username}', limit: 100 },
  })
  const pages = data.data || []
  if (channel === 'MESSENGER') {
    return pages.map((p) => ({ id: p.id, name: p.name, pageId: p.id, pageAccessToken: p.access_token }))
  }
  return pages
    .filter((p) => p.instagram_business_account?.id)
    .map((p) => ({
      id: p.instagram_business_account!.id,
      name: p.instagram_business_account!.username ? `@${p.instagram_business_account!.username}` : p.name,
      pageId: p.id,
      username: p.instagram_business_account!.username || null,
      pageAccessToken: p.access_token,
    }))
}

// ─── Page subscriptions ──────────────────────────────────────────────────────

export const MESSENGER_SUBSCRIBED_FIELDS_FULL = [
  'messages',
  'messaging_postbacks',
  'messaging_referrals',
  'messaging_optins',
  'message_echoes',
  'message_reactions',
  'message_deliveries',
  'message_reads',
  'messaging_handovers',
  'standby',
]
export const MESSENGER_SUBSCRIBED_FIELDS_MIN = ['messages', 'messaging_postbacks']

/**
 * Subscribes the app to a Page. `subscribed_fields` replaces the whole list, and Meta rejects the
 * entire call if one field is invalid, so we fall back to a minimal set on failure.
 */
export async function subscribePageToApp(app: MetaAppConfig, pageId: string, pageAccessToken: string, fields: string[]) {
  await graphFetch(`${pageId}/subscribed_apps`, {
    version: app.graphVersion,
    method: 'POST',
    token: pageAccessToken,
    query: { subscribed_fields: fields.join(',') },
  })
  return fields
}

/**
 * `feed` (Page comments) is added when comments are on for the Page. Without the comment permissions
 * Meta rejects it, so each fallback keeps messaging working: full+feed → min+feed → full → min.
 */
export async function subscribePageWithFallback(app: MetaAppConfig, pageId: string, pageAccessToken: string, channel: MetaChannel, opts: { feed?: boolean } = {}) {
  if (channel !== 'MESSENGER') return subscribePageToApp(app, pageId, pageAccessToken, ['messages'])
  const attempts = opts.feed
    ? [[...MESSENGER_SUBSCRIBED_FIELDS_FULL, 'feed'], [...MESSENGER_SUBSCRIBED_FIELDS_MIN, 'feed'], MESSENGER_SUBSCRIBED_FIELDS_FULL, MESSENGER_SUBSCRIBED_FIELDS_MIN]
    : [MESSENGER_SUBSCRIBED_FIELDS_FULL, MESSENGER_SUBSCRIBED_FIELDS_MIN]
  let lastError: unknown = null
  for (const fields of attempts) {
    try {
      return await subscribePageToApp(app, pageId, pageAccessToken, fields)
    } catch (err) {
      lastError = err
      logger.warn('Page subscription rejected, trying a smaller set', { pageId, fields: fields.join(','), err: err instanceof Error ? err.message : err })
    }
  }
  throw lastError
}

export async function isPageSubscribed(app: MetaAppConfig, pageId: string, pageAccessToken: string) {
  const data = await graphFetch<{ data?: Array<{ id: string; subscribed_fields?: string[] }> }>(`${pageId}/subscribed_apps`, {
    version: app.graphVersion,
    token: pageAccessToken,
  })
  const entry = (data.data || []).find((d) => String(d.id) === String(app.appId))
  return { subscribed: Boolean(entry), fields: entry?.subscribed_fields || [] }
}

// ─── Messaging ───────────────────────────────────────────────────────────────

export type SendMessagePayload =
  | { text: string }
  | { attachment: { type: 'image' | 'video' | 'audio' | 'file'; payload: { url: string; is_reusable?: boolean } } }

export async function sendMetaMessage(params: {
  app: MetaAppConfig
  pageAccessToken: string
  recipientId: string
  message: SendMessagePayload
  messagingType?: 'RESPONSE' | 'UPDATE' | 'MESSAGE_TAG'
  tag?: string
}) {
  const body: Record<string, unknown> = {
    recipient: { id: params.recipientId },
    message: params.message,
    messaging_type: params.messagingType || 'RESPONSE',
  }
  if (params.tag) body.tag = params.tag
  return graphFetch<{ message_id: string; recipient_id: string }>('me/messages', {
    version: params.app.graphVersion,
    method: 'POST',
    token: params.pageAccessToken,
    body,
  })
}

export async function takeThreadControl(app: MetaAppConfig, pageAccessToken: string, recipientId: string) {
  return graphFetch('me/take_thread_control', {
    version: app.graphVersion,
    method: 'POST',
    token: pageAccessToken,
    body: { recipient: { id: recipientId }, metadata: 'Recuperado desde LoHaggo' },
  })
}

/** Best-effort profile lookup. Fails without advanced access; callers must swallow errors. */
export async function fetchContactProfile(app: MetaAppConfig, pageAccessToken: string, psid: string, channel: MetaChannel) {
  const fields = channel === 'INSTAGRAM' ? 'name,username,profile_pic' : 'first_name,last_name,name,profile_pic'
  const data = await graphFetch<{ name?: string; first_name?: string; last_name?: string; username?: string }>(psid, {
    version: app.graphVersion,
    token: pageAccessToken,
    query: { fields },
  })
  const name = data.name || [data.first_name, data.last_name].filter(Boolean).join(' ') || null
  return { name, username: data.username || null }
}

// ─── Comments ────────────────────────────────────────────────────────────────

/** Public reply under a comment. Facebook: /{comment}/comments; Instagram: /{comment}/replies. */
export async function replyToComment(app: MetaAppConfig, pageAccessToken: string, channel: MetaChannel, commentId: string, message: string) {
  return graphFetch<{ id: string }>(`${commentId}/${channel === 'INSTAGRAM' ? 'replies' : 'comments'}`, {
    version: app.graphVersion,
    method: 'POST',
    token: pageAccessToken,
    body: { message },
  })
}

/** Reply to a comment where the business was @mentioned on someone else's Instagram media. */
export async function replyToMention(app: MetaAppConfig, pageAccessToken: string, igUserId: string, mediaId: string, commentId: string, message: string) {
  return graphFetch<{ id: string }>(`${igUserId}/mentions`, {
    version: app.graphVersion,
    method: 'POST',
    token: pageAccessToken,
    body: { comment_id: commentId, media_id: mediaId, message },
  })
}

/** Private reply: a direct message tied to the comment (one per comment, within 7 days). */
export async function sendPrivateReply(app: MetaAppConfig, pageAccessToken: string, commentId: string, message: string) {
  return graphFetch<{ recipient_id?: string; message_id?: string }>('me/messages', {
    version: app.graphVersion,
    method: 'POST',
    token: pageAccessToken,
    body: { recipient: { comment_id: commentId }, message: { text: message } },
  })
}

export async function setCommentHidden(app: MetaAppConfig, pageAccessToken: string, channel: MetaChannel, commentId: string, hidden: boolean) {
  return graphFetch<{ success?: boolean }>(commentId, {
    version: app.graphVersion,
    method: 'POST',
    token: pageAccessToken,
    query: channel === 'INSTAGRAM' ? { hide: String(hidden) } : { is_hidden: String(hidden) },
  })
}

export type PostInfo = { caption: string | null; permalink: string | null; mediaUrl: string | null; isAd: boolean }

/** Post / media shown above a comment conversation. Unpublished Page posts are ad creatives ("dark posts"). */
export async function fetchPostInfo(app: MetaAppConfig, pageAccessToken: string, channel: MetaChannel, postId: string): Promise<PostInfo> {
  if (channel === 'INSTAGRAM') {
    const data = await graphFetch<{ caption?: string; permalink?: string; media_url?: string; thumbnail_url?: string; media_product_type?: string }>(postId, {
      version: app.graphVersion,
      token: pageAccessToken,
      query: { fields: 'caption,permalink,media_url,thumbnail_url,media_product_type' },
    })
    return { caption: data.caption ?? null, permalink: data.permalink ?? null, mediaUrl: data.thumbnail_url || data.media_url || null, isAd: data.media_product_type === 'AD' }
  }
  const data = await graphFetch<{ message?: string; permalink_url?: string; full_picture?: string; is_published?: boolean; promotion_status?: string }>(postId, {
    version: app.graphVersion,
    token: pageAccessToken,
    query: { fields: 'message,permalink_url,full_picture,is_published,promotion_status' },
  })
  return {
    caption: data.message ?? null,
    permalink: data.permalink_url ?? null,
    mediaUrl: data.full_picture ?? null,
    isAd: data.is_published === false || data.promotion_status === 'active',
  }
}

/** A comment that @mentions the business on someone else's media (the webhook only carries ids). */
export async function fetchMentionedComment(app: MetaAppConfig, pageAccessToken: string, igUserId: string, commentId: string) {
  // Goes inside a field expression: only Meta's numeric ids are accepted
  if (!/^\d+(_\d+)?$/.test(commentId)) return null
  const data = await graphFetch<{
    mentioned_comment?: { id: string; text?: string; timestamp?: string; username?: string; from?: { id?: string; username?: string }; media?: { id: string; caption?: string; permalink?: string; media_url?: string } }
  }>(igUserId, {
    version: app.graphVersion,
    token: pageAccessToken,
    query: { fields: `mentioned_comment.comment_id(${commentId}){id,text,timestamp,username,from,media{id,caption,permalink,media_url}}` },
  })
  return data.mentioned_comment ?? null
}

export type TokenDebug = { valid: boolean; type: string | null; scopes: string[]; expiresAt: Date | null; neverExpires: boolean; error: string | null; errorSubcode: number | null }

/** Full debug_token view of a token: validity, type, scopes and expiry (0 = never expires). */
export async function debugToken(app: MetaAppConfig, token: string): Promise<TokenDebug> {
  const d = await graphFetch<{ data?: { is_valid?: boolean; type?: string; scopes?: string[]; expires_at?: number; error?: { message?: string; subcode?: number } } }>('debug_token', {
    version: app.graphVersion,
    query: { input_token: token, access_token: `${app.appId}|${app.appSecret}` },
  })
  const x = d.data || {}
  const exp = typeof x.expires_at === 'number' ? x.expires_at : null
  return {
    valid: x.is_valid !== false,
    type: x.type ?? null,
    scopes: x.scopes ?? [],
    expiresAt: exp ? new Date(exp * 1000) : null,
    neverExpires: exp === 0,
    error: x.error?.message ?? null,
    errorSubcode: x.error?.subcode ?? null,
  }
}

/** Page token derived from a user or system-user token that manages the page. */
export async function pageTokenFrom(app: MetaAppConfig, userToken: string, pageId: string) {
  const d = await graphFetch<{ access_token?: string }>(pageId, { version: app.graphVersion, token: userToken, query: { fields: 'access_token' } })
  if (!d.access_token) throw new MetaGraphError('El token no administra esta página', { status: 403 })
  return d.access_token
}

/** Scopes actually granted to the stored token (debug_token with the app token). */
export async function fetchGrantedScopes(app: MetaAppConfig, token: string) {
  const data = await graphFetch<{ data?: { scopes?: string[]; is_valid?: boolean } }>('debug_token', {
    version: app.graphVersion,
    query: { input_token: token, access_token: `${app.appId}|${app.appSecret}` },
  })
  return { scopes: data.data?.scopes ?? [], valid: data.data?.is_valid !== false }
}

// ─── Capability probing (no real traffic) ────────────────────────────────────

const NO_PERMISSION_CODES = new Set([3, 10, 190, 200, 230])

/**
 * Sends `/me/messages` without a recipient. Error 100 ("param recipient is required") means the
 * token has messaging permission; permission-style codes mean it does not.
 */
export async function probeSendCapability(app: MetaAppConfig, pageAccessToken: string): Promise<{ ok: boolean; detail: string }> {
  try {
    await graphFetch('me/messages', {
      version: app.graphVersion,
      method: 'POST',
      token: pageAccessToken,
      body: { message: { text: 'probe' } },
    })
    return { ok: true, detail: 'ok' }
  } catch (err) {
    if (err instanceof MetaGraphError) {
      if (err.code === 100) return { ok: true, detail: 'ok' }
      if (err.code !== null && NO_PERMISSION_CODES.has(err.code)) return { ok: false, detail: `(#${err.code}) ${err.message}` }
      return { ok: false, detail: err.message }
    }
    return { ok: false, detail: err instanceof Error ? err.message : 'unknown' }
  }
}

// ─── Pending folder polling ──────────────────────────────────────────────────

export type PendingThreadMessage = {
  id: string
  message?: string
  from?: { id: string; name?: string; username?: string; email?: string }
  created_time: string
  attachments?: { data?: Array<{ id?: string; mime_type?: string; image_data?: { url?: string }; file_url?: string; video_data?: { url?: string } }> }
}

export async function listPendingConversations(app: MetaAppConfig, pageAccessToken: string, pageId: string, channel: MetaChannel) {
  const data = await graphFetch<{ data?: Array<{ id: string; updated_time: string }> }>(`${pageId}/conversations`, {
    version: app.graphVersion,
    token: pageAccessToken,
    query: { platform: channel === 'INSTAGRAM' ? 'instagram' : 'messenger', folder: 'pending', fields: 'id,updated_time', limit: 25 },
  })
  return data.data || []
}

export async function fetchThreadMessages(app: MetaAppConfig, pageAccessToken: string, threadId: string) {
  const data = await graphFetch<{
    participants?: { data?: Array<{ id: string; name?: string; username?: string }> }
    messages?: { data?: PendingThreadMessage[] }
  }>(threadId, {
    version: app.graphVersion,
    token: pageAccessToken,
    query: { fields: 'participants,messages.limit(50){id,message,from,created_time,attachments}' },
  })
  return { participants: data.participants?.data || [], messages: data.messages?.data || [] }
}

export async function loadMetaApp(): Promise<MetaAppConfig | null> {
  return getMetaAppConfig()
}
