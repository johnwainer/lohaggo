import type { AiAgent, Conversation } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { sendToConversation } from '@/lib/inbox/send'
import { AgentRuntimeService } from '@/lib/ai/runtime'
import { callClaude, textOf } from '@/lib/ai/anthropic'
import { applySignature, formatForChannel, parseMarkers } from '@/lib/ai/format'
import { buildSystem } from '@/lib/ai/prompt'
import { retrieve } from '@/lib/ai/knowledge'
import { getAiSettings, hasTextProvider } from '@/lib/ai/settings'
import { auxBudgetAvailable } from '@/lib/ai/limits'
import { isCommentChannel } from '@/lib/ai/comments-core'
import { isRepeatedGibberish, isUndeliverableError } from '@/lib/ai/conversation-core'
import { isUndeliverableMarked, markUndeliverable, mergeCustomField, removeCustomField } from '@/lib/ai/closing'
import { AUDIO_NOTICE_TEXT, audioNoticeSent, markAudioNoticeSent, transcribeTurnAudio } from '@/lib/ai/transcribe'
import {
  FOLLOWUP_EVENT, SECOND_FOLLOWUP_EVENT, SECOND_FOLLOWUP_GAP_MS, funnelProgress, isHalfWay, isStopText, reengageInstruction, secondFollowupDecision, type PendingProposals,
} from '@/lib/ai/funnel-core'
import {
  HUMAN_GRACE_MS,
  accountAllowed,
  accountKeysOf,
  autopilotCandidates,
  describeNow,
  hasRecentHumanActivity,
  isWithinHours,
  shouldTakeOverCore,
  toTurns,
} from '@/lib/ai/runtime-core'

const logger = createLogger('ai-autopilot')

const DEBOUNCE_MS = 2500
const STALE_INBOUND_MS = 10 * 60 * 1000
const NOTICE_COOLDOWN_MS = 12 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * The single place that answers "did a person write here recently?". Used by the autopilot and by
 * the AI step of a flow alike.
 */
export async function humanActiveRecently(conversationId: string, now = new Date()) {
  const since = new Date(now.getTime() - HUMAN_GRACE_MS)
  const [recent, handBack] = await Promise.all([
    prisma.conversationMessage.findMany({
      where: { conversationId, direction: 'OUTBOUND', isInternal: false, sentAt: { gte: since } },
      select: { direction: true, isInternal: true, sentById: true, senderType: true, sentAt: true },
    }),
    // Last time the conversation was handed to the AI (by a person or by the autopilot)
    prisma.conversationEvent.findFirst({
      where: { conversationId, type: 'ai_started', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ])
  return hasRecentHumanActivity(recent, now, HUMAN_GRACE_MS, handBack?.createdAt ?? null)
}

/** True when an autopilot agent covers this channel/account: new conversations then skip human auto-assign. */
export async function autopilotCovers(workspaceId: string, channel: string, connectionId: string | null, connectionExternalId?: string | null) {
  try {
    const agents = await prisma.aiAgent.findMany({ where: { workspaceId, status: 'active' } })
    const keys = accountKeysOf({ channel, connectionId, connectionExternalId })
    return autopilotCandidates(agents, channel).some((a) => accountAllowed(a, keys, channel))
  } catch {
    return false
  }
}

/** The conversation plus the stable id of its channel account, as shouldTakeOverCore expects it. */
export async function withAccountKey<T extends { connectionId: string | null }>(conversation: T) {
  const connection = conversation.connectionId
    ? await prisma.channelConnection.findUnique({ where: { id: conversation.connectionId }, select: { externalId: true } })
    : null
  return { ...conversation, connectionExternalId: connection?.externalId ?? null }
}

export async function shouldTakeOver(conversation: Conversation) {
  const [agents, recentHumanActivity, conv] = await Promise.all([
    prisma.aiAgent.findMany({ where: { workspaceId: conversation.workspaceId, status: 'active' } }),
    humanActiveRecently(conversation.id),
    withAccountKey(conversation),
  ])
  return shouldTakeOverCore(conv, { agents, recentHumanActivity })
}

async function markStarted(conversation: Conversation, agent: AiAgent) {
  const changed = !conversation.aiHandled || conversation.aiAgentId !== agent.id
  if (!changed) return conversation
  const updated = await prisma.conversation.update({
    where: { id: conversation.id },
    data: { aiHandled: true, aiAgentId: agent.id, aiAgentName: agent.name, aiTurns: 0 },
  })
  await prisma.conversationEvent.create({ data: { conversationId: conversation.id, type: 'ai_started', actorType: 'ai', actorId: agent.id, actorName: agent.name } })
  await prisma.aiAgent.update({ where: { id: agent.id }, data: { conversations: { increment: 1 } } })
  return updated
}

export async function stillOurs(conversationId: string, agentId: string) {
  const c = await prisma.conversation.findUnique({ where: { id: conversationId } })
  if (!c || !c.aiHandled || c.aiAgentId !== agentId || c.assignedToId || c.automationsPaused) return null
  if (await humanActiveRecently(conversationId)) return null
  return c
}

async function sendAsAgent(conversation: Conversation, agent: AiAgent, text: string) {
  const result = await sendToConversation({ conversation, message: text, sender: { type: 'AI', agentId: agent.id, agentName: agent.name } })
  if (!result.ok) logger.warn('AI send failed', { conversationId: conversation.id, error: result.error })
  return result
}

/**
 * Called after an inbound message is stored, on every channel. A turn that throws never leaves the contact
 * silent: the conversation goes back to a person (lib/inbox/ai-failure.ts); the error is rethrown for the caller.
 */
export async function handleInbound(conversationId: string, messageId: string, opts: { debounceMs?: number; maxAgeMs?: number } = {}) {
  try {
    return await inboundTurn(conversationId, messageId, opts)
  } catch (err) {
    const { handleAiReplyFailure } = await import('@/lib/inbox/ai-failure')
    await handleAiReplyFailure({ conversationId, error: err instanceof Error ? err.message : String(err) })
    throw err
  }
}

async function inboundTurn(conversationId: string, messageId: string, opts: { debounceMs?: number; maxAgeMs?: number }) {
  await new Promise((r) => setTimeout(r, opts.debounceMs ?? DEBOUNCE_MS))

  const message = await prisma.conversationMessage.findUnique({ where: { id: messageId } })
  if (!message || message.direction !== 'INBOUND') return { skipped: 'not_inbound' }
  if (Date.now() - message.sentAt.getTime() > (opts.maxAgeMs ?? STALE_INBOUND_MS)) return { skipped: 'stale' }
  // Several messages in a row: only the handler of the latest one answers (it sees them all)
  const latest = await prisma.conversationMessage.findFirst({ where: { conversationId, direction: 'INBOUND' }, orderBy: { sentAt: 'desc' }, select: { id: true } })
  if (latest?.id !== messageId) return { skipped: 'newer_message' }

  let conversation = await prisma.conversation.findUnique({ where: { id: conversationId } })
  if (!conversation) return { skipped: 'no_conversation' }
  // The provider said this recipient cannot get our messages: the agent does not try again here
  if (isUndeliverableMarked(conversation.customFields)) return { skipped: 'undeliverable' }
  if (conversation.reengagedAt) await prisma.conversation.update({ where: { id: conversationId }, data: { reengagedAt: null } })

  const decision = await shouldTakeOver(conversation)
  if (!decision.take) {
    // The autopilot stays out; a copilot agent may still help the person who handles it
    const { copilotOnInbound } = await import('@/lib/ai/copilot')
    await copilotOnInbound(conversation, messageId, decision.reason).catch(() => null)
    return { skipped: decision.reason }
  }
  const agent = decision.agent as AiAgent
  conversation = await markStarted(conversation, agent)

  // Public comments on posts follow their own rules (public / private reply, moderation, limits)
  if (isCommentChannel(conversation.channel)) {
    const { handleCommentInbound } = await import('@/lib/ai/comments')
    return handleCommentInbound(conversation, agent, message)
  }

  const ws = await prisma.workspace.findUnique({ where: { id: conversation.workspaceId }, select: { timezone: true } })
  const accountTz = ws?.timezone || 'America/Bogota'
  const pre = AgentRuntimeService.preHandoff(agent, { text: message.body, turns: conversation.aiTurns, now: new Date(), accountTz })

  // Outside hours the message waits: answerAfterHours() replies when the agent's hours open
  if (pre.action === 'silent' || pre.action === 'notice') await markAfterHours(conversation, messageId)
  if (pre.action === 'silent') return { skipped: 'outside_hours_silent' }
  if (pre.action === 'notice') {
    const recentNotice = await prisma.conversationMessage.findFirst({
      where: { conversationId, direction: 'OUTBOUND', senderType: 'AI', body: { startsWith: pre.message.slice(0, 40) }, sentAt: { gte: new Date(Date.now() - NOTICE_COOLDOWN_MS) } },
    })
    if (!recentNotice) await sendAsAgent(conversation, agent, formatForChannel(pre.message, conversation.channel))
    return { handled: 'outside_hours_notice' }
  }
  if (pre.action === 'handoff') {
    await sendAsAgent(conversation, agent, applySignature(formatForChannel(agent.handoffMessage, conversation.channel), agent.signatureMode, agent.signatureText, true))
    await AgentRuntimeService.applyOutcome({ conversation, agent, handoff: true, handoffReason: pre.reason, handoffDetail: pre.detail ?? null, done: false, spam: false })
    return { handled: 'pre_handoff', reason: pre.reason }
  }

  // Evident spam (the same nonsense over and over): marked and closed without spending a call
  const lastInbound = await prisma.conversationMessage.findMany({ where: { conversationId, direction: 'INBOUND' }, orderBy: { sentAt: 'desc' }, take: 5, select: { body: true, mediaUrl: true } })
  if (agent.ignoreSpam && isRepeatedGibberish(lastInbound.filter((m) => !m.mediaUrl).map((m) => m.body).reverse())) {
    await AgentRuntimeService.applyOutcome({ conversation, agent, handoff: false, handoffReason: null, handoffDetail: null, done: false, spam: true, close: { reason: 'spam', summary: 'Texto sin sentido repetido' } })
    return { handled: 'spam' }
  }

  // Voice notes become text before the agent reads them; when that fails, it asks once to write instead
  const audio = await transcribeTurnAudio(conversation, agent.id).catch((err) => {
    logger.warn('Transcription step failed', { conversationId, err: err instanceof Error ? err.message : err })
    return { transcribed: 0, failed: 0, hasText: true }
  })
  if (audio.failed && !audio.transcribed && !audio.hasText) {
    if (await audioNoticeSent(conversationId)) return { skipped: 'audio_untranscribed' }
    const sent = await sendAsAgent(conversation, agent, formatForChannel(AUDIO_NOTICE_TEXT, conversation.channel))
    if (sent.ok) {
      await markAudioNoticeSent(conversationId, agent)
      await prisma.conversation.update({ where: { id: conversationId }, data: { aiTurns: { increment: 1 } } })
    }
    return { handled: 'audio_notice' }
  }

  const turnStartedAt = new Date()
  const memory = await AgentRuntimeService.memory(conversation, agent)
  const history = [...memory.history]
  // Everything the client wrote since our last answer is the "new message"
  const pending = history.length && history[history.length - 1].role === 'user' ? history.pop()!.content : message.body
  // A chat that started by answering our private reply to a comment: the agent sees that comment first
  if (conversation.channel === 'MESSENGER' || conversation.channel === 'INSTAGRAM') {
    const { privateReplyContext } = await import('@/lib/ai/comments')
    history.unshift(...(await privateReplyContext(conversation, history.length).catch(() => [])))
  }

  // WhatsApp proves the number: a chat from the phone of exactly one client/partner account is linked to it
  // (and that phone counts as confirmed) before the agent reads it, so it never asks for a code
  let userId = conversation.userId
  if (conversation.channel === 'WHATSAPP') {
    const { linkByWhatsappNumber } = await import('@/lib/accounts/link')
    const byNumber = await linkByWhatsappNumber({ conversationId, actor: { agentId: agent.id, agentName: agent.name } }).catch(() => null)
    if (byNumber?.ok) userId = byNumber.userId
  }

  const result = await AgentRuntimeService.reply({
    agent,
    workspaceId: conversation.workspaceId,
    channel: conversation.channel,
    conversationId,
    userId,
    contact: { name: conversation.contactName, phone: conversation.contactPhone, tags: conversation.tags, fields: (conversation.customFields as Record<string, unknown>) || {} },
    history,
    text: pending,
    summary: memory.summary,
    kind: 'agent_reply',
    dryRun: false,
  })

  // A person may have stepped in while the model was thinking: never talk over them
  const fresh = await stillOurs(conversationId, agent.id)
  if (!fresh) return { skipped: 'human_took_over' }
  // The person wrote again meanwhile: that message's turn answers everything, unless this turn already did
  // something on the platform (then its confirmation must go out)
  const newer = await prisma.conversationMessage.findFirst({ where: { conversationId, direction: 'INBOUND', sentAt: { gt: message.sentAt }, id: { not: messageId } }, orderBy: { sentAt: 'desc' }, select: { id: true } })
  if (newer) {
    const acted = await prisma.aiAgentAction.count({ where: { conversationId, status: { in: ['executed', 'proposed', 'awaiting_approval'] }, createdAt: { gte: turnStartedAt } } })
    if (!acted) return { skipped: 'newer_message_arrived' }
  }

  if (result.text && !result.spam) {
    const sent = await sendAsAgent(fresh, agent, result.text)
    if (!sent.ok && isUndeliverableError(sent.error)) {
      // An invalid number does not get better with a handoff: mark it and stop answering here
      await markUndeliverable(conversationId, agent, sent.error)
      return { handled: 'undeliverable' }
    }
    if (!sent.ok && !result.handoff) {
      result.handoff = true
      result.handoffReason = 'api_error'
      result.handoffDetail = `No se pudo enviar: ${sent.error}`
    }
    await prisma.conversation.update({ where: { id: conversationId }, data: { aiTurns: { increment: 1 } } })
  }
  if (result.handoff || result.done || result.spam || result.close) {
    await AgentRuntimeService.applyOutcome({
      conversation: fresh, agent, handoff: result.handoff, handoffReason: result.handoffReason, handoffDetail: result.handoffDetail,
      done: result.done, spam: result.spam, question: pending, close: result.close ?? null,
    })
  }
  // The provider failed (applyOutcome already handed it off): the trail and the incident count
  if (result.handoffReason === 'api_error') {
    const { handleAiReplyFailure } = await import('@/lib/inbox/ai-failure')
    await handleAiReplyFailure({ conversationId, error: result.handoffDetail || result.error || 'Error del proveedor de IA', alreadyHandedOff: true })
  }
  return { handled: 'reply', handoff: result.handoff, model: result.model }
}

const AFTER_HOURS_KEY = 'afterHours'
/** Answers left for opening time are dropped after this long (the person likely moved on or a person replied) */
const AFTER_HOURS_MAX_MS = 72 * 3600_000

async function markAfterHours(conversation: Conversation, messageId: string) {
  await mergeCustomField(conversation.id, AFTER_HOURS_KEY, { messageId, at: new Date().toISOString() }).catch(() => null)
}

/**
 * Messages that arrived outside an agent's hours («silent» or «notice»): once the hours open, the agent
 * answers the latest one (it reads everything the person wrote). Runs from the copilot cron every minute.
 */
export async function answerAfterHours(limit = 20) {
  const convs = await prisma.conversation.findMany({
    where: { aiHandled: true, aiAgentId: { not: null }, assignedToId: null, status: { in: ['OPEN', 'IN_PROGRESS'] }, lastMessageAt: { gt: new Date(Date.now() - AFTER_HOURS_MAX_MS) } },
    select: { id: true, aiAgentId: true, workspaceId: true, customFields: true },
    orderBy: { lastMessageAt: 'asc' },
    take: 300,
  })
  let answered = 0
  for (const c of convs) {
    if (answered >= limit) break
    const fields = c.customFields && typeof c.customFields === 'object' ? (c.customFields as Record<string, unknown>) : {}
    const mark = fields[AFTER_HOURS_KEY] as { messageId?: string; at?: string } | undefined
    if (!mark?.messageId) continue
    const agent = await prisma.aiAgent.findUnique({ where: { id: c.aiAgentId! } })
    if (!agent || agent.status !== 'active') continue
    const ws = await prisma.workspace.findUnique({ where: { id: c.workspaceId }, select: { timezone: true } })
    if (!isWithinHours(agent, new Date(), ws?.timezone || 'America/Bogota')) continue
    await removeCustomField(c.id, AFTER_HOURS_KEY)
    const latest = await prisma.conversationMessage.findFirst({ where: { conversationId: c.id, direction: 'INBOUND' }, orderBy: { sentAt: 'desc' }, select: { id: true } })
    // Someone already answered after it arrived: nothing is left to reply
    const replied = await prisma.conversationMessage.findFirst({ where: { conversationId: c.id, direction: 'OUTBOUND', isInternal: false, sentAt: { gt: new Date(mark.at ?? 0) }, senderType: { not: 'AUTOMATION' } }, select: { id: true } })
    if (!latest || replied) continue
    await handleInbound(c.id, latest.id, { debounceMs: 0, maxAgeMs: AFTER_HOURS_MAX_MS }).catch((err) => logger.warn('After-hours answer failed', { conversationId: c.id, err: err instanceof Error ? err.message : err }))
    answered++
  }
  return { answered }
}

// ─── Background task registry (webhooks answer 200 first, then the agent works) ──

const pending = new Set<Promise<unknown>>()

export function scheduleInboundAgent(conversationId: string, messageId: string) {
  const task = handleInbound(conversationId, messageId)
    .catch((err) => logger.error('Autopilot failed', { conversationId, err: err instanceof Error ? err.message : err }))
    .finally(() => pending.delete(task))
  pending.add(task)
}

/** Await agent work started during this invocation before the serverless function ends. */
export async function drainAgentTasks() {
  while (pending.size) await Promise.allSettled(Array.from(pending))
}

// ─── Re-engagement ──────────────────────────────────────────────────────────

/** Open requests of the client with proposals nobody answered yet: real counts and lowest prices. */
async function pendingProposalsOf(userId: string | null, now: Date): Promise<PendingProposals[]> {
  if (!userId) return []
  const rows = await prisma.serviceRequest.findMany({
    where: { userId, status: 'ACTIVE', expiresAt: { gt: now }, proposals: { some: { status: 'PENDING' } } },
    select: { id: true, service: { select: { name: true } }, proposals: { where: { status: 'PENDING' }, select: { price: true } } },
    orderBy: { createdAt: 'desc' },
    take: 3,
  })
  return rows.map((r) => ({ requestRef: r.id.slice(-6), service: r.service.name, count: r.proposals.length, minPrice: Math.min(...r.proposals.map((p) => Number(p.price))) }))
}

async function isOptedOut(conv: Conversation) {
  const row = await prisma.messagingOptOut.findFirst({
    where: { channel: conv.channel, isActive: true, OR: [{ destination: conv.contactPhone }, ...(conv.userId ? [{ userId: conv.userId }] : [])] },
    select: { id: true },
  })
  return Boolean(row)
}

/** The agent writes the follow-up from the conversation and the internal notice; null when it has nothing to say. */
async function writeFollowup(conv: Conversation, agent: AiAgent, tz: string, instruction: string) {
  const settings = await getAiSettings()
  const memory = await AgentRuntimeService.memory(conv, agent)
  const knowledge = await retrieve({ workspaceId: conv.workspaceId, agentId: agent.id, query: memory.history.map((h) => h.content).join('\n').slice(-1500) })
  const system = buildSystem(agent, {
    knowledge, nowText: describeNow(new Date(), tz), timezone: tz, channel: conv.channel,
    contact: { name: conv.contactName, tags: conv.tags, fields: (conv.customFields as Record<string, unknown>) || {}, linkedUser: Boolean(conv.userId) },
    summary: memory.summary, toolGuidance: '',
  })
  const call = await callClaude(
    {
      model: settings.allowAgentModelOverride && agent.model ? agent.model : settings.defaultModel,
      system,
      maxTokens: agent.maxTokens,
      effort: 'low',
      messages: [
        ...(memory.history.length ? memory.history : toTurns([{ direction: 'INBOUND', body: '(sin mensajes)' }])),
        { role: 'user', content: instruction },
      ],
    },
    { kind: 'reengagement', workspaceId: conv.workspaceId, agentId: agent.id, conversationId: conv.id },
  )
  const markers = parseMarkers(textOf(call.message))
  if (call.message.stop_reason === 'refusal' || !markers.text || markers.handoff) return null
  return applySignature(formatForChannel(markers.text, conv.channel), agent.signatureMode, agent.signatureText, false)
}

/**
 * Follow-ups when the client stopped answering, aimed at the next step (lib/ai/funnel-core.ts
 * reengageInstruction): the proposals waiting for them with their real count and lowest price, what a
 * half-built request lacks, or else where it stopped. One per silence (reengagedAt, shared with the funnel
 * nudge); a second one only with proposals waiting, late in the 24 h window. Never at night (team hours of
 * the inbox settings and the agent's hours), never after a STOP, never to a conversation a person has.
 */
export async function runReengagement(limit = 30) {
  const agents = await prisma.aiAgent.findMany({ where: { status: 'active', reengageAfterHours: { gt: 0 } } })
  if (!agents.length) return { sent: 0 }
  const settings = await getAiSettings()
  if (!hasTextProvider(settings)) return { sent: 0 }
  const now = new Date()
  const { getInboxSettings } = await import('@/lib/inbox/settings')
  const { teamHours } = await import('@/lib/inbox/escalation-core')
  const teamOpen = teamHours(now, (await getInboxSettings()).escalation).open
  if (!teamOpen) return { sent: 0 }
  const { cop } = await import('@/lib/ai/actions-core')
  let sent = 0
  let second = 0

  for (const agent of agents) {
    const base = {
      aiHandled: true, aiAgentId: agent.id, assignedToId: null, isTest: false, aiSpam: false,
      channel: { notIn: ['FACEBOOK_COMMENT', 'INSTAGRAM_COMMENT'] as Conversation['channel'][] },
      automationsPaused: false, status: { in: ['OPEN', 'IN_PROGRESS'] as Conversation['status'][] },
    }
    const cutoff = new Date(now.getTime() - agent.reengageAfterHours * 3600_000)
    const firsts = await prisma.conversation.findMany({ where: { ...base, reengagedAt: null, lastMessageAt: { lt: cutoff, gt: new Date(now.getTime() - DAY_MS) } }, take: limit })
    const seconds = await prisma.conversation.findMany({
      where: { ...base, reengagedAt: { not: null, lt: new Date(now.getTime() - SECOND_FOLLOWUP_GAP_MS) }, userId: { not: null }, lastMessageAt: { gt: new Date(now.getTime() - DAY_MS) } },
      take: limit,
    })

    for (const [conv, isSecond] of [...firsts.map((c) => [c, false] as const), ...seconds.map((c) => [c, true] as const)]) {
      if (!(await auxBudgetAvailable())) return { sent, second, stopped: 'aux_budget' }
      const last = await prisma.conversationMessage.findFirst({ where: { conversationId: conv.id, isInternal: false }, orderBy: { sentAt: 'desc' } })
      const lastInbound = await prisma.conversationMessage.findFirst({ where: { conversationId: conv.id, direction: 'INBOUND' }, orderBy: { sentAt: 'desc' }, select: { sentAt: true, body: true } })
      if (!last || last.direction !== 'OUTBOUND' || last.senderType !== 'AI') continue
      if (!lastInbound || now.getTime() - lastInbound.sentAt.getTime() > DAY_MS - 30 * 60_000) continue
      if (isStopText(lastInbound.body) || (await isOptedOut(conv))) continue
      const ws = await prisma.workspace.findUnique({ where: { id: conv.workspaceId }, select: { timezone: true } })
      const tz = ws?.timezone || 'America/Bogota'
      if (!isWithinHours(agent, now, tz)) continue
      const pending = await pendingProposalsOf(conv.userId, now)

      if (isSecond) {
        const already = await prisma.conversationEvent.findFirst({ where: { conversationId: conv.id, type: SECOND_FOLLOWUP_EVENT, createdAt: { gte: lastInbound.sentAt } }, select: { id: true } })
        const decision = secondFollowupDecision({
          now, channel: conv.channel, teamOpen, optedOut: false, lastInbound, lastMessage: last, reengagedAt: conv.reengagedAt,
          alreadySecond: Boolean(already), pendingCount: pending.reduce((n, p) => n + p.count, 0),
        })
        if (!decision.send) continue
      }
      const fresh = await stillOurs(conv.id, agent.id)
      if (!fresh) continue
      const hours = Math.max(1, Math.round((now.getTime() - lastInbound.sentAt.getTime()) / 3600_000))
      const progress = isSecond ? null : funnelProgress(conv.customFields as Record<string, unknown> | null, null)

      try {
        if (!isSecond) {
          // Claimed before writing: two overlapping runs (or the funnel nudge) never both follow up
          const claim = await prisma.conversation.updateMany({ where: { id: conv.id, reengagedAt: null }, data: { reengagedAt: now } })
          if (claim.count !== 1) continue
        }
        const text = await writeFollowup(fresh, agent, tz, reengageInstruction({ hours, pending, progress, second: isSecond, money: cop }))
        await prisma.conversationEvent.create({
          data: { conversationId: conv.id, type: isSecond ? SECOND_FOLLOWUP_EVENT : FOLLOWUP_EVENT, actorType: 'ai', actorId: agent.id, actorName: agent.name, detail: pending.length ? `propuestas: ${pending.map((p) => p.count).join('+')}` : progress && isHalfWay(progress) ? 'solicitud a medias' : 'retomar' },
        })
        if (!text) continue
        const res = await sendAsAgent(fresh, agent, text)
        if (res.ok) {
          if (isSecond) second++
          else sent++
          emitInboxEvent({ type: 'new-message', conversationId: conv.id, workspaceId: conv.workspaceId })
        }
      } catch (err) {
        logger.warn('Re-engagement failed', { conversationId: conv.id, err: err instanceof Error ? err.message : err })
      }
    }
  }
  return { sent, second }
}
