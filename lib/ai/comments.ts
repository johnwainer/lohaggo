import type { AiAgent, Conversation, ConversationMessage } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { setCommentHidden } from '@/lib/messaging/meta-graph'
import { describeGraphError, getConnectionCredentials, requireMetaApp } from '@/lib/messaging/meta-channels'
import { sendToConversation } from '@/lib/inbox/send'
import { AgentRuntimeService } from '@/lib/ai/runtime'
import { stillOurs } from '@/lib/ai/autopilot'
import { isWithinHours, matchKeyword } from '@/lib/ai/runtime-core'
import type { CommentPromptContext } from '@/lib/ai/prompt'
import {
  COMMENT_CHANNELS,
  baseChannelOf,
  canModerate,
  commentLimitReached,
  commentPrefilter,
  commentSettingsOf,
  describeSkip,
  isCommentChannel,
  planCommentReply,
  privateReplyAvailability,
  replyModeFor,
  sensitiveActionOf,
  type CommentSignals,
} from '@/lib/ai/comments-core'

const logger = createLogger('ai-comments')
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

type Actor = { actorType: string; actorId: string; actorName: string }

async function event(conversation: Conversation, type: string, actor: Actor, detail: string) {
  await prisma.conversationEvent.create({ data: { conversationId: conversation.id, type, ...actor, detail: detail.slice(0, 300) } })
  emitInboxEvent({ type: 'status-update', conversationId: conversation.id, workspaceId: conversation.workspaceId })
}

async function note(conversation: Conversation, agent: AiAgent, body: string) {
  await prisma.conversationMessage.create({
    data: { conversationId: conversation.id, direction: 'OUTBOUND', isInternal: true, status: 'SENT', senderType: 'AI', aiAgentId: agent.id, aiAgentName: agent.name, body },
  })
  emitInboxEvent({ type: 'new-message', conversationId: conversation.id, workspaceId: conversation.workspaceId })
}

/** AI replies already sent on this post in the last hour and on this account in the last day. */
async function commentCounts(conversation: Conversation) {
  const base = { direction: 'OUTBOUND' as const, isInternal: false, senderType: 'AI' }
  const [postLastHour, accountLastDay] = await Promise.all([
    conversation.postId
      ? prisma.conversationMessage.count({ where: { ...base, sentAt: { gte: new Date(Date.now() - HOUR_MS) }, conversation: { postId: conversation.postId, channel: conversation.channel } } })
      : 0,
    prisma.conversationMessage.count({
      where: { ...base, sentAt: { gte: new Date(Date.now() - DAY_MS) }, conversation: { connectionId: conversation.connectionId, channel: { in: [...COMMENT_CHANNELS] } } },
    }),
  ])
  return { postLastHour, accountLastDay }
}

async function privateAvailable(conversation: Conversation, message: ConversationMessage) {
  const replied = await prisma.conversationMessage.findMany({ where: { conversationId: conversation.id, direction: 'OUTBOUND', visibility: 'private' }, select: { commentId: true } })
  return privateReplyAvailability(message, replied.map((r) => r.commentId), new Date(), conversation.commentKind).ok
}

export async function commentModeration(conversation: Conversation) {
  const connection = conversation.connectionId ? await prisma.channelConnection.findUnique({ where: { id: conversation.connectionId } }) : null
  if (!connection || !isCommentChannel(conversation.channel)) return { connection: null, canHide: false }
  return { connection, canHide: canModerate(baseChannelOf(conversation.channel), commentSettingsOf(connection.commentSettings)) }
}

/** Hides or shows a comment on Meta and records it in the thread. Used by the AI and by the inbox. */
export async function hideComment(conversation: Conversation, message: Pick<ConversationMessage, 'id' | 'commentId'>, hidden: boolean, actor: Actor) {
  if (!isCommentChannel(conversation.channel) || !message.commentId) throw new Error('No es un comentario')
  const { connection, canHide } = await commentModeration(conversation)
  if (!connection) throw new Error('Esta conversación no tiene una cuenta conectada')
  if (!canHide) throw new Error('La cuenta no tiene el permiso para moderar comentarios: reconéctala con la opción de comentarios')
  const token = getConnectionCredentials(connection)?.pageAccessToken
  if (!token) throw new Error('Token de la página no disponible, vuelve a conectar la cuenta')
  try {
    await setCommentHidden(await requireMetaApp(), token, baseChannelOf(conversation.channel), message.commentId, hidden)
  } catch (err) {
    throw new Error(describeGraphError(err))
  }
  await prisma.conversationMessage.update({ where: { id: message.id }, data: { commentHidden: hidden } })
  await event(conversation, hidden ? 'comment_hidden' : 'comment_shown', actor, hidden ? 'Comentario ocultado' : 'Comentario visible de nuevo')
}

export function commentPromptContext(conversation: Conversation, agent: AiAgent, opts: { privateAvailable: boolean; forced: boolean }): CommentPromptContext {
  return {
    postCaption: conversation.postCaption,
    isAd: conversation.isAd,
    isMention: conversation.commentKind === 'mention',
    replyMode: replyModeFor(agent, conversation.channel),
    privateAvailable: opts.privateAvailable,
    forced: opts.forced,
    hasTemplate: Boolean(agent.commentPublicTemplate?.trim()),
  }
}

/**
 * A client commented on a post and an agent has the comment channel on autopilot. Free filters
 * first (keywords, tags, limits, hours), then the model, then planCommentReply decides what is
 * published, what goes by private reply, what is hidden and what goes to a person.
 */
export async function handleCommentInbound(conversation: Conversation, agent: AiAgent, message: ConversationMessage) {
  const actor = { actorType: 'ai', actorId: agent.id, actorName: agent.name }
  if (message.commentDeletedAt) return { skipped: 'comment_deleted' }

  const pre = commentPrefilter(agent, message.body)
  if (pre.action === 'ignore') {
    await event(conversation, 'comment_ignored', actor, `${describeSkip(pre.reason)}${pre.detail ? `: ${pre.detail}` : ''}`)
    return { skipped: `comment_${pre.reason}` }
  }

  const ws = await prisma.workspace.findUnique({ where: { id: conversation.workspaceId }, select: { timezone: true } })
  if (!isWithinHours(agent, new Date(), ws?.timezone || 'America/Bogota')) {
    // A public "we're closed" notice under a post helps nobody: hand off or wait for a person
    if (agent.outsideHours === 'handoff') {
      await AgentRuntimeService.applyOutcome({ conversation, agent, handoff: true, handoffReason: 'outside_hours', handoffDetail: null, done: false, spam: false })
      return { handled: 'outside_hours_handoff' }
    }
    return { skipped: 'outside_hours' }
  }

  const limit = commentLimitReached(agent, await commentCounts(conversation))
  if (limit.reached) {
    await note(conversation, agent, `⏸️ Límite de respuestas a comentarios alcanzado (${limit.detail}). La IA no respondió este comentario.`)
    await event(conversation, 'comment_limit', actor, limit.detail)
    return { skipped: 'comment_limit' }
  }

  const { canHide } = await commentModeration(conversation)
  const canPrivate = await privateAvailable(conversation, message)
  const mode = replyModeFor(agent, conversation.channel)
  const sensitiveAction = sensitiveActionOf(agent)

  let signals: CommentSignals
  let done = false
  const keyword = matchKeyword(message.body, agent.handoffKeywords)
  if (keyword) {
    // Handoff keywords are sensitive by definition: no model call, the handoff message goes by private reply
    signals = { text: `[[PRIVADO]]${agent.handoffMessage}`, handoff: false, sensitive: true, ignore: false, offensive: false, spam: false }
  } else {
    const memory = await AgentRuntimeService.memory(conversation, agent)
    const history = [...memory.history]
    const pending = history.length && history[history.length - 1].role === 'user' ? history.pop()!.content : message.body
    const result = await AgentRuntimeService.reply({
      agent,
      workspaceId: conversation.workspaceId,
      channel: conversation.channel,
      conversationId: conversation.id,
      userId: conversation.userId,
      contact: { name: conversation.contactName, phone: null, tags: conversation.tags, fields: (conversation.customFields as Record<string, unknown>) || {} },
      history,
      text: pending,
      summary: memory.summary,
      kind: 'comment_reply',
      comment: commentPromptContext(conversation, agent, { privateAvailable: canPrivate, forced: pre.action === 'answer' }),
      dryRun: false,
    })
    // Budget, API error or refusal: never publish the handoff message under a post
    if (!result.comment) {
      await AgentRuntimeService.applyOutcome({ conversation, agent, handoff: true, handoffReason: result.handoffReason, handoffDetail: result.handoffDetail, done: false, spam: false })
      return { handled: 'handoff', reason: result.handoffReason }
    }
    signals = result.comment
    done = result.done
  }

  const fresh = await stillOurs(conversation.id, agent.id)
  if (!fresh) return { skipped: 'human_took_over' }

  const plan = planCommentReply({
    signals, mode, sensitiveAction, template: agent.commentPublicTemplate, contactName: fresh.contactName,
    hideOffensive: agent.commentHideOffensive, hideSpam: agent.commentHideSpam, canHide, privateAvailable: canPrivate, forced: pre.action === 'answer',
  })

  if (plan.outcome === 'ignored' || plan.outcome === 'nothing') {
    await event(fresh, 'comment_ignored', actor, plan.detail)
    return { skipped: 'comment_ignored' }
  }
  if (plan.outcome === 'hidden' || plan.outcome === 'moderation_noted') {
    if (plan.hide) {
      await hideComment(fresh, message, true, actor).catch(async (err) => {
        await event(fresh, 'comment_moderation', actor, `${plan.detail}: no se pudo ocultar (${err instanceof Error ? err.message : 'error'})`)
      })
    } else {
      await event(fresh, 'comment_moderation', actor, `${plan.detail}: no se respondió`)
    }
    if (signals.spam) await AgentRuntimeService.applyOutcome({ conversation: fresh, agent, handoff: false, handoffReason: null, handoffDetail: null, done: false, spam: true })
    return { handled: plan.outcome }
  }

  const sender = { type: 'AI' as const, agentId: agent.id, agentName: agent.name }
  let sendError: string | null = null
  if (plan.publicText) {
    const sent = await sendToConversation({ conversation: fresh, message: plan.publicText, sender, visibility: 'public', replyToCommentId: message.commentId })
    if (!sent.ok) sendError = sent.error
  }
  if (plan.privateText) {
    const sent = await sendToConversation({ conversation: fresh, message: plan.privateText, sender, visibility: 'private', replyToCommentId: message.commentId })
    if (!sent.ok) sendError = sendError ? `${sendError} · ${sent.error}` : sent.error
  }
  if (plan.publicText || plan.privateText) await prisma.conversation.update({ where: { id: fresh.id }, data: { aiTurns: { increment: 1 } } })

  // Handoff keywords always reach a person, whatever the sensitive-topic action says
  const handoff = plan.handoff || Boolean(sendError) || Boolean(keyword)
  if (handoff || done) {
    await AgentRuntimeService.applyOutcome({
      conversation: fresh, agent, handoff,
      handoffReason: sendError ? 'api_error' : keyword ? 'keyword' : signals.sensitive ? 'sensitive' : 'model',
      handoffDetail: sendError ? `No se pudo responder el comentario: ${sendError}` : keyword ?? plan.detail,
      done, spam: false, question: message.body,
    })
  }
  logger.info('Comment handled', { conversationId: fresh.id, outcome: plan.outcome, public: Boolean(plan.publicText), private: Boolean(plan.privateText), handoff })
  return { handled: 'comment_reply', handoff }
}

/**
 * When a client answers a private reply, the chat starts on Messenger / Instagram with no context.
 * Returns the comment and our private reply (last 7 days) as the first turns of that chat's history.
 */
export async function privateReplyContext(conversation: Pick<Conversation, 'contactId' | 'channel'>, historyLength: number) {
  if (!conversation.contactId || historyLength > 6 || (conversation.channel !== 'MESSENGER' && conversation.channel !== 'INSTAGRAM')) return []
  const reply = await prisma.conversationMessage.findFirst({
    where: {
      direction: 'OUTBOUND', visibility: 'private', sentAt: { gte: new Date(Date.now() - 7 * DAY_MS) },
      conversation: { contactId: conversation.contactId, channel: conversation.channel === 'INSTAGRAM' ? 'INSTAGRAM_COMMENT' : 'FACEBOOK_COMMENT' },
    },
    orderBy: { sentAt: 'desc' },
    select: { body: true, commentId: true, conversation: { select: { postCaption: true } } },
  })
  if (!reply?.commentId) return []
  const comment = await prisma.conversationMessage.findFirst({ where: { commentId: reply.commentId, direction: 'INBOUND' }, select: { body: true } })
  if (!comment) return []
  const post = reply.conversation.postCaption?.trim() ? ` (publicación: «${reply.conversation.postCaption.trim().slice(0, 120)}»)` : ''
  return [
    { role: 'user' as const, content: `[Comentario público del cliente${post}] ${comment.body}` },
    { role: 'assistant' as const, content: reply.body },
  ]
}
