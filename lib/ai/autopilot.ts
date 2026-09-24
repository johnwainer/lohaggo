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
import { getAiSettings } from '@/lib/ai/settings'
import { auxBudgetAvailable } from '@/lib/ai/limits'
import { isCommentChannel } from '@/lib/ai/comments-core'
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

/** Called after an inbound message is stored, on every channel. */
export async function handleInbound(conversationId: string, messageId: string, opts: { debounceMs?: number; maxAgeMs?: number } = {}) {
  await new Promise((r) => setTimeout(r, opts.debounceMs ?? DEBOUNCE_MS))

  const message = await prisma.conversationMessage.findUnique({ where: { id: messageId } })
  if (!message || message.direction !== 'INBOUND') return { skipped: 'not_inbound' }
  if (Date.now() - message.sentAt.getTime() > (opts.maxAgeMs ?? STALE_INBOUND_MS)) return { skipped: 'stale' }
  // Several messages in a row: only the handler of the latest one answers (it sees them all)
  const latest = await prisma.conversationMessage.findFirst({ where: { conversationId, direction: 'INBOUND' }, orderBy: { sentAt: 'desc' }, select: { id: true } })
  if (latest?.id !== messageId) return { skipped: 'newer_message' }

  let conversation = await prisma.conversation.findUnique({ where: { id: conversationId } })
  if (!conversation) return { skipped: 'no_conversation' }
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

  const memory = await AgentRuntimeService.memory(conversation, agent)
  const history = [...memory.history]
  // Everything the client wrote since our last answer is the "new message"
  const pending = history.length && history[history.length - 1].role === 'user' ? history.pop()!.content : message.body
  // A chat that started by answering our private reply to a comment: the agent sees that comment first
  if (conversation.channel === 'MESSENGER' || conversation.channel === 'INSTAGRAM') {
    const { privateReplyContext } = await import('@/lib/ai/comments')
    history.unshift(...(await privateReplyContext(conversation, history.length).catch(() => [])))
  }

  const result = await AgentRuntimeService.reply({
    agent,
    workspaceId: conversation.workspaceId,
    channel: conversation.channel,
    conversationId,
    userId: conversation.userId,
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

  if (result.text && !result.spam) {
    const sent = await sendAsAgent(fresh, agent, result.text)
    if (!sent.ok && !result.handoff) {
      result.handoff = true
      result.handoffReason = 'api_error'
      result.handoffDetail = `No se pudo enviar: ${sent.error}`
    }
    await prisma.conversation.update({ where: { id: conversationId }, data: { aiTurns: { increment: 1 } } })
  }
  if (result.handoff || result.done || result.spam) {
    await AgentRuntimeService.applyOutcome({
      conversation: fresh, agent, handoff: result.handoff, handoffReason: result.handoffReason, handoffDetail: result.handoffDetail,
      done: result.done, spam: result.spam, question: pending,
    })
  }
  return { handled: 'reply', handoff: result.handoff, model: result.model }
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

/**
 * One follow-up, once, when the client stopped answering for N hours: never outside hours, never to
 * a conversation with a person in charge, never outside the channel's 24h window.
 */
export async function runReengagement(limit = 30) {
  const agents = await prisma.aiAgent.findMany({ where: { status: 'active', reengageAfterHours: { gt: 0 } } })
  if (!agents.length) return { sent: 0 }
  const settings = await getAiSettings()
  if (!settings.anthropicKey) return { sent: 0 }
  let sent = 0

  for (const agent of agents) {
    const cutoff = new Date(Date.now() - agent.reengageAfterHours * 3600_000)
    const convs = await prisma.conversation.findMany({
      where: {
        aiHandled: true, aiAgentId: agent.id, assignedToId: null, reengagedAt: null, isTest: false, aiSpam: false,
        channel: { notIn: ['FACEBOOK_COMMENT', 'INSTAGRAM_COMMENT'] },
        automationsPaused: false, status: { in: ['OPEN', 'IN_PROGRESS'] }, lastMessageAt: { lt: cutoff, gt: new Date(Date.now() - DAY_MS) },
      },
      take: limit,
    })
    for (const conv of convs) {
      if (!(await auxBudgetAvailable())) return { sent, stopped: 'aux_budget' }
      const last = await prisma.conversationMessage.findFirst({ where: { conversationId: conv.id, isInternal: false }, orderBy: { sentAt: 'desc' } })
      const lastInbound = await prisma.conversationMessage.findFirst({ where: { conversationId: conv.id, direction: 'INBOUND' }, orderBy: { sentAt: 'desc' }, select: { sentAt: true } })
      if (!last || last.direction !== 'OUTBOUND' || last.senderType !== 'AI') continue
      if (!lastInbound || Date.now() - lastInbound.sentAt.getTime() > DAY_MS - 30 * 60_000) continue
      const ws = await prisma.workspace.findUnique({ where: { id: conv.workspaceId }, select: { timezone: true } })
      const tz = ws?.timezone || 'America/Bogota'
      if (!isWithinHours(agent, new Date(), tz)) continue
      if (!(await stillOurs(conv.id, agent.id))) continue

      const memory = await AgentRuntimeService.memory(conv, agent)
      const knowledge = await retrieve({ workspaceId: conv.workspaceId, agentId: agent.id, query: memory.history.map((h) => h.content).join('\n').slice(-1500) })
      const system = buildSystem(agent, {
        knowledge, nowText: describeNow(new Date(), tz), timezone: tz, channel: conv.channel,
        contact: { name: conv.contactName, tags: conv.tags, fields: (conv.customFields as Record<string, unknown>) || {}, linkedUser: Boolean(conv.userId) },
        summary: memory.summary, toolGuidance: '',
      })
      try {
        const call = await callClaude(
          {
            model: settings.allowAgentModelOverride && agent.model ? agent.model : settings.defaultModel,
            system,
            maxTokens: agent.maxTokens,
            effort: 'low',
            messages: [
              ...(memory.history.length ? memory.history : toTurns([{ direction: 'INBOUND', body: '(sin mensajes)' }])),
              { role: 'user', content: `[Aviso interno de la plataforma, no lo escribió el cliente] El cliente no responde desde hace ${agent.reengageAfterHours} horas. Escribe un único mensaje breve y amable de seguimiento para retomar la conversación donde quedó, sin presionar.` },
            ],
          },
          { kind: 'reengagement', workspaceId: conv.workspaceId, agentId: agent.id, conversationId: conv.id },
        )
        const markers = parseMarkers(textOf(call.message))
        if (call.message.stop_reason === 'refusal' || !markers.text) continue
        const text = applySignature(formatForChannel(markers.text, conv.channel), agent.signatureMode, agent.signatureText, false)
        const res = await sendAsAgent(conv, agent, text)
        await prisma.conversation.update({ where: { id: conv.id }, data: { reengagedAt: new Date() } })
        if (res.ok) {
          sent++
          emitInboxEvent({ type: 'new-message', conversationId: conv.id, workspaceId: conv.workspaceId })
        }
      } catch (err) {
        logger.warn('Re-engagement failed', { conversationId: conv.id, err: err instanceof Error ? err.message : err })
      }
    }
  }
  return { sent }
}
