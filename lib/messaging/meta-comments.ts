import type { ChannelConnection, Conversation } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import type { MetaAppConfig } from '@/lib/messaging/provider-config'
import { fetchMentionedComment, fetchPostInfo, type MetaChannel, type PostInfo } from '@/lib/messaging/meta-graph'
import { getConnectionCredentials, getConnectionMeta } from '@/lib/messaging/meta-channels'
import { parseCommentChanges, type CommentEvent } from '@/lib/messaging/comment-events'
import { commentChannelOf, commentConversationKey, commentSettingsOf, isOwnComment } from '@/lib/ai/comments-core'
import { autopilotCovers, scheduleInboundAgent } from '@/lib/ai/autopilot'
import { resolveInboundContact } from '@/lib/inbox/contacts'
import { pickAutoAssignAgent } from '@/lib/messaging/meta-inbound'

const logger = createLogger('meta-comments')

const CAPTION_MAX = 300
const postCache = new Map<string, { at: number; info: PostInfo }>()
const POST_CACHE_MS = 60 * 60 * 1000

/** Post data by postId: memory → another conversation on the same post → Graph → what the webhook said. */
async function postInfo(app: MetaAppConfig, token: string | null, channel: MetaChannel, ev: CommentEvent): Promise<PostInfo> {
  const postId = ev.postId
  const fallback: PostInfo = { caption: null, permalink: ev.permalink, mediaUrl: null, isAd: ev.isAd === true }
  if (!postId) return fallback
  const cached = postCache.get(postId)
  if (cached && Date.now() - cached.at < POST_CACHE_MS) return cached.info
  const known = await prisma.conversation.findFirst({
    where: { postId, OR: [{ postPermalink: { not: null } }, { postCaption: { not: null } }] },
    select: { postCaption: true, postPermalink: true, postMediaUrl: true, isAd: true },
  })
  let info: PostInfo | null = known ? { caption: known.postCaption, permalink: known.postPermalink, mediaUrl: known.postMediaUrl, isAd: known.isAd } : null
  if (!info && token) {
    info = await fetchPostInfo(app, token, channel, postId).catch((err) => {
      logger.warn('Post lookup failed', { postId, err: err instanceof Error ? err.message : err })
      return null
    })
  }
  const merged: PostInfo = {
    caption: info?.caption?.slice(0, CAPTION_MAX) ?? null,
    permalink: info?.permalink || ev.permalink,
    mediaUrl: info?.mediaUrl ?? null,
    isAd: ev.isAd === true || Boolean(info?.isAd),
  }
  postCache.set(postId, { at: Date.now(), info: merged })
  return merged
}

async function ensureCommentConversation(params: {
  conn: ChannelConnection
  channel: MetaChannel
  ev: CommentEvent & { fromId: string; postId: string }
  post: PostInfo
}): Promise<Conversation> {
  const { conn, channel, ev, post } = params
  const commentChannel = commentChannelOf(channel)
  const key = commentConversationKey(ev.fromId, ev.postId)
  const existing = await prisma.conversation.findUnique({ where: { channel_contactPhone: { channel: commentChannel, contactPhone: key } } })
  if (existing) return existing

  // The same person as in direct messages: identity is their PSID / IGSID on the account's channel
  const contact = await resolveInboundContact({ workspaceId: conn.workspaceId, channel, externalId: ev.fromId, nameHint: ev.fromName })
  const assignedToId = (await autopilotCovers(conn.workspaceId, commentChannel, conn.id, conn.externalId)) ? null : await pickAutoAssignAgent()
  try {
    return await prisma.conversation.create({
      data: {
        channel: commentChannel,
        workspaceId: conn.workspaceId,
        contactPhone: key,
        contactName: contact.name || ev.fromName || `${channel === 'INSTAGRAM' ? 'Instagram' : 'Facebook'} · …${ev.fromId.slice(-4)}`,
        contactId: contact.id,
        userId: contact.userId,
        connectionId: conn.id,
        assignedToId,
        status: 'OPEN',
        unreadCount: 0,
        postId: ev.postId,
        postPermalink: post.permalink,
        postCaption: post.caption,
        postMediaUrl: post.mediaUrl,
        isAd: post.isAd,
        rootCommentId: ev.commentId,
        commentKind: ev.kind,
      },
    })
  } catch (err) {
    if ((err as { code?: string })?.code === 'P2002') {
      const raced = await prisma.conversation.findUnique({ where: { channel_contactPhone: { channel: commentChannel, contactPhone: key } } })
      if (raced) return raced
    }
    throw err
  }
}

/** Mentions only carry ids: the text, author and media come from Graph. */
async function hydrateMention(app: MetaAppConfig, token: string | null, conn: ChannelConnection, ev: CommentEvent): Promise<CommentEvent | null> {
  if (!token) return null
  const c = await fetchMentionedComment(app, token, conn.externalId, ev.commentId)
  if (!c) return null
  const username = c.username || c.from?.username || null
  return {
    ...ev,
    text: c.text || '',
    fromId: c.from?.id || (username ? `ig:${username}` : null),
    fromName: username ? `@${username}` : null,
    postId: ev.postId || c.media?.id || null,
    createdAt: c.timestamp ? new Date(c.timestamp) : null,
    permalink: c.media?.permalink || null,
  }
}

type Outcome = 'comment' | 'edited' | 'removed' | 'hidden' | 'own' | 'duplicate' | 'ad_excluded' | 'mention_off' | 'incomplete'

async function applyEvent(app: MetaAppConfig, conn: ChannelConnection, channel: MetaChannel, raw: CommentEvent): Promise<Outcome> {
  const settings = commentSettingsOf(conn.commentSettings)
  const meta = getConnectionMeta(conn)
  const token = getConnectionCredentials(conn)?.pageAccessToken ?? null
  const providerMessageId = `comment:${raw.commentId}`

  if (raw.verb === 'remove') {
    await prisma.conversationMessage.updateMany({ where: { commentId: raw.commentId }, data: { commentDeletedAt: new Date() } })
    return 'removed'
  }
  if (raw.verb === 'hide' || raw.verb === 'unhide') {
    await prisma.conversationMessage.updateMany({ where: { commentId: raw.commentId }, data: { commentHidden: raw.verb === 'hide' } })
    return 'hidden'
  }
  if (raw.kind === 'mention' && !settings.mentions) return 'mention_off'

  const ev = raw.kind === 'mention' ? await hydrateMention(app, token, conn, raw) : raw
  if (!ev) return 'incomplete'
  // Our own replies come back through the same webhook: answering them would loop forever
  if (isOwnComment(ev.fromId, [conn.externalId, meta.pageId])) return 'own'
  if (!ev.fromId || !ev.postId) return 'incomplete'

  if (ev.verb === 'edited') {
    const updated = await prisma.conversationMessage.updateMany({ where: { providerMessageId }, data: { body: ev.text || '[comentario]' } })
    if (updated.count > 0) return 'edited'
  }

  const post = await postInfo(app, token, channel, ev)
  if (post.isAd && !settings.includeAds) return 'ad_excluded'

  const conversation = await ensureCommentConversation({ conn, channel, ev: ev as CommentEvent & { fromId: string; postId: string }, post })
  const sentAt = ev.createdAt || new Date()
  let messageId: string
  try {
    const created = await prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        body: ev.text || '[comentario sin texto]',
        providerMessageId,
        commentId: ev.commentId,
        visibility: 'public',
        status: 'DELIVERED',
        senderType: 'CONTACT',
        sentAt,
        deliveredAt: new Date(),
      },
      select: { id: true },
    })
    messageId = created.id
  } catch (err) {
    if ((err as { code?: string })?.code === 'P2002') return 'duplicate'
    throw err
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      status: conversation.status === 'CLOSED' || conversation.status === 'RESOLVED' ? 'OPEN' : conversation.status,
      lastMessageAt: sentAt,
      lastMessageBody: (ev.text || '[comentario]').slice(0, 200),
      unreadCount: { increment: 1 },
      ...(conversation.postCaption || !post.caption ? {} : { postCaption: post.caption, postPermalink: post.permalink, postMediaUrl: post.mediaUrl }),
    },
  })
  emitInboxEvent({ type: 'new-message', conversationId: conversation.id, workspaceId: conversation.workspaceId })
  scheduleInboundAgent(conversation.id, messageId)
  return 'comment'
}

/**
 * Comment changes of one webhook entry. Accounts with comments off are logged as PAUSED by the caller
 * (see processMetaWebhookPayload) and never reach this function.
 */
export async function processCommentChanges(app: MetaAppConfig, conn: ChannelConnection, channel: MetaChannel, changes: unknown[]) {
  const { events, ignored } = parseCommentChanges(channel, changes)
  const counts: Record<string, number> = {}
  let error: string | null = null
  for (const key of ignored) counts[`ignorado:${key}`] = (counts[`ignorado:${key}`] || 0) + 1
  for (const ev of events) {
    try {
      const outcome = await applyEvent(app, conn, channel, ev)
      counts[outcome] = (counts[outcome] || 0) + 1
    } catch (err) {
      error = err instanceof Error ? err.message : 'error'
      logger.error('Error processing comment', { channel, commentId: ev.commentId, error })
    }
  }
  return { counts, error, commentEvents: events.length }
}
