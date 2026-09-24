import type { AiAgent, Conversation } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { AgentRuntimeService } from '@/lib/ai/runtime'
import { handleInbound, withAccountKey } from '@/lib/ai/autopilot'
import { accountAllowed, accountKeysOf } from '@/lib/ai/runtime-core'
import { COPILOT_MAX_AGE_MS, copilotAgentFor, copilotTimer, splitSuggestion, type CopilotTimer } from '@/lib/ai/copilot-core'

const logger = createLogger('ai-copilot')
const DEFAULT_TZ = 'America/Bogota'

/** Takeover reasons from shouldTakeOver under which the copilot still helps the person. */
const COPILOT_HELPS_WHEN = new Set(['human_owner', 'human_recent', 'handed_off', 'no_agent', 'account_not_enabled', 'skip_tag'])

export async function copilotAgentForConversation(conversation: Pick<Conversation, 'workspaceId' | 'channel' | 'connectionId'>) {
  const agents = await prisma.aiAgent.findMany({ where: { workspaceId: conversation.workspaceId, status: 'active', copilotChannels: { has: conversation.channel } } })
  const conv = await withAccountKey(conversation)
  const keys = accountKeysOf(conv)
  return copilotAgentFor(agents.filter((a) => accountAllowed(a, keys)), conversation.channel)
}

async function accountTz(workspaceId: string) {
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { timezone: true } })
  return ws?.timezone || DEFAULT_TZ
}

async function lastClientFacingMessage(conversationId: string) {
  return prisma.conversationMessage.findFirst({
    where: { conversationId, isInternal: false },
    orderBy: { sentAt: 'desc' },
    select: { id: true, direction: true, sentAt: true },
  })
}

export class CopilotError extends Error {}

/**
 * Drafts the reply the person handling the conversation could send. Same runtime, knowledge and
 * read-only tools as the agent; nothing is sent and no tool that writes can run.
 */
export async function suggestReply(conversationId: string, opts: { trigger: 'auto' | 'manual'; messageId?: string | null }) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } })
  if (!conversation) throw new CopilotError('Conversación no encontrada')
  if (conversation.aiHandled) throw new CopilotError('La IA ya lleva esta conversación')
  const agent = await copilotAgentForConversation(conversation)
  if (!agent) throw new CopilotError('Ningún agente tiene el copiloto activo en este canal')

  const memory = await AgentRuntimeService.memory(conversation, agent)
  const history = [...memory.history]
  const clientWaiting = history.length > 0 && history[history.length - 1].role === 'user'
  const text = clientWaiting
    ? history.pop()!.content
    : '[Aviso interno, no lo escribió el cliente] El cliente no ha escrito nada nuevo. Sugiere un mensaje breve de seguimiento para retomar la conversación donde quedó.'

  const result = await AgentRuntimeService.reply({
    agent,
    workspaceId: conversation.workspaceId,
    channel: conversation.channel,
    conversationId,
    userId: conversation.userId,
    contact: { name: conversation.contactName, phone: conversation.contactPhone, tags: conversation.tags, fields: (conversation.customFields as Record<string, unknown>) || {} },
    history,
    text,
    summary: memory.summary,
    kind: 'copilot_suggestion',
    copilot: true,
    dryRun: true,
  })
  if (!result.ok) throw new CopilotError(result.error || 'No se pudo generar la sugerencia')
  if (result.handoffReason === 'budget') throw new CopilotError('Tope mensual de IA alcanzado')
  const { text: suggestion, context } = splitSuggestion(result.text)
  if (!suggestion) throw new CopilotError('El agente no generó una sugerencia')

  await prisma.aiSuggestion.updateMany({ where: { conversationId, status: 'pending' }, data: { status: 'expired', resolvedAt: new Date() } })
  const saved = await prisma.aiSuggestion.create({
    data: {
      conversationId, agentId: agent.id, channel: conversation.channel, messageId: opts.messageId ?? null,
      text: suggestion.slice(0, 4000), context: context?.slice(0, 500) ?? null, trigger: opts.trigger, model: result.model, costUsd: result.costUsd,
    },
  })
  emitInboxEvent({ type: 'status-update', conversationId, workspaceId: conversation.workspaceId })
  return { ...saved, agentName: agent.name }
}

/** Called from the inbound pipeline when the autopilot does not take the conversation. */
export async function copilotOnInbound(conversation: Conversation, messageId: string, takeOverReason: string) {
  if (!COPILOT_HELPS_WHEN.has(takeOverReason) || conversation.aiHandled) return { skipped: 'not_applicable' }
  const agent = await copilotAgentForConversation(conversation)
  if (!agent) return { skipped: 'no_copilot' }
  if (agent.copilotSuggest !== 'auto') return { skipped: 'manual_only' }
  try {
    await suggestReply(conversation.id, { trigger: 'auto', messageId })
    return { handled: 'suggested' }
  } catch (err) {
    logger.warn('Copilot suggestion failed', { conversationId: conversation.id, err: err instanceof Error ? err.message : err })
    return { skipped: 'error' }
  }
}

/** Timer state for one conversation (inbox countdown and the takeover job). */
export async function copilotState(conversation: Conversation, agent?: AiAgent | null) {
  const copilot = agent === undefined ? await copilotAgentForConversation(conversation) : agent
  if (!copilot) return { agent: null, timer: { action: 'none', reason: 'no_copilot' } as CopilotTimer }
  const [last, tz] = await Promise.all([lastClientFacingMessage(conversation.id), accountTz(conversation.workspaceId)])
  return { agent: copilot, timer: copilotTimer(copilot, conversation, last, new Date(), tz), lastMessageId: last?.id ?? null }
}

async function takeOver(conversation: Conversation, agent: AiAgent, lastMessageId: string, waitingMinutes: number) {
  const previous = conversation.assignedToId ? await prisma.user.findUnique({ where: { id: conversation.assignedToId }, select: { name: true } }) : null
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { aiHandled: true, aiAgentId: agent.id, aiAgentName: agent.name, assignedToId: null, aiTurns: 0, copilotAlertedMessageId: null },
  })
  await prisma.aiSuggestion.updateMany({ where: { conversationId: conversation.id, status: 'pending' }, data: { status: 'expired', resolvedAt: new Date() } })
  await prisma.conversationEvent.create({
    data: { conversationId: conversation.id, type: 'ai_started', actorType: 'ai', actorId: agent.id, actorName: agent.name, detail: `La IA retomó: ${waitingMinutes} min sin respuesta` },
  })
  await prisma.conversationMessage.create({
    data: {
      conversationId: conversation.id, direction: 'OUTBOUND', isInternal: true, status: 'SENT', senderType: 'AI', aiAgentId: agent.id, aiAgentName: agent.name,
      body: `🤖 ${agent.name} retomó la conversación porque el cliente llevaba ${waitingMinutes} min sin respuesta${previous ? ` (la llevaba ${previous.name})` : ''}. Pulsa "Intervenir" para recuperarla.`,
    },
  })
  emitInboxEvent({ type: 'status-update', conversationId: conversation.id, workspaceId: conversation.workspaceId })
  await handleInbound(conversation.id, lastMessageId, { debounceMs: 0, maxAgeMs: COPILOT_MAX_AGE_MS })
}

async function alert(conversation: Conversation, agent: AiAgent, lastMessageId: string, waitingMinutes: number) {
  await prisma.conversation.update({ where: { id: conversation.id }, data: { priority: 'high', copilotAlertedMessageId: lastMessageId } })
  await prisma.conversationEvent.create({
    data: { conversationId: conversation.id, type: 'copilot_alert', actorType: 'ai', actorId: agent.id, actorName: agent.name, detail: `${waitingMinutes} min sin respuesta` },
  })
  await prisma.conversationMessage.create({
    data: {
      conversationId: conversation.id, direction: 'OUTBOUND', isInternal: true, status: 'SENT', senderType: 'AI', aiAgentId: agent.id, aiAgentName: agent.name,
      body: `⚠️ El cliente lleva ${waitingMinutes} min sin respuesta. Este caso lo debe atender una persona, así que la IA no lo retoma.`,
    },
  })
  emitInboxEvent({ type: 'status-update', conversationId: conversation.id, workspaceId: conversation.workspaceId })
}

/**
 * Runs every minute: conversations held by a person (or nobody) on copilot channels whose client has
 * waited longer than the agent's limit are taken over, or only flagged when it is a case the AI must
 * not take (it handed it off itself, or it carries an excluded tag).
 */
export async function runCopilotTakeovers(limit = 40) {
  const agents = await prisma.aiAgent.findMany({ where: { status: 'active', copilotTakeover: true, NOT: { copilotChannels: { isEmpty: true } } } })
  let tookOver = 0
  let alerted = 0
  for (const agent of agents) {
    const oldest = new Date(Date.now() - COPILOT_MAX_AGE_MS)
    const newest = new Date(Date.now() - Math.max(1, agent.copilotTakeoverMinutes) * 60_000)
    const conversations = await prisma.conversation.findMany({
      where: {
        workspaceId: agent.workspaceId, channel: { in: agent.copilotChannels as never[] }, aiHandled: false, isTest: false, aiSpam: false,
        automationsPaused: false, threadOwner: null, status: { in: ['OPEN', 'IN_PROGRESS'] }, lastMessageAt: { gte: oldest, lte: newest },
      },
      orderBy: { lastMessageAt: 'asc' },
      take: limit,
    })
    for (const conversation of conversations) {
      try {
        // The conversation's own copilot agent decides (several agents may share a channel)
        const owner = await copilotAgentForConversation(conversation)
        if (owner?.id !== agent.id) continue
        const { timer, lastMessageId } = await copilotState(conversation, agent)
        if (!lastMessageId || (timer.action !== 'takeover' && timer.action !== 'alert')) continue
        if (timer.action === 'takeover') {
          await takeOver(conversation, agent, lastMessageId, timer.waitingMinutes)
          tookOver++
        } else if (conversation.copilotAlertedMessageId !== lastMessageId) {
          await alert(conversation, agent, lastMessageId, timer.waitingMinutes)
          alerted++
        }
      } catch (err) {
        logger.warn('Copilot takeover failed', { conversationId: conversation.id, err: err instanceof Error ? err.message : err })
      }
    }
  }
  return { tookOver, alerted }
}

/** Resolves the pending suggestion when the person sends a message (used, edited or ignored). */
export async function resolveSuggestionOnSend(conversationId: string, sentText: string, suggestionId: string | null, userId: string) {
  const { suggestionOutcome } = await import('@/lib/ai/copilot-core')
  if (suggestionId) {
    const s = await prisma.aiSuggestion.findFirst({ where: { id: suggestionId, conversationId } })
    if (s && (s.status === 'pending' || s.status === 'inserted')) {
      await prisma.aiSuggestion.update({ where: { id: s.id }, data: { status: suggestionOutcome(s.text, sentText), resolvedAt: new Date(), resolvedById: userId } })
    }
  }
  await prisma.aiSuggestion.updateMany({ where: { conversationId, status: { in: ['pending', 'inserted'] } }, data: { status: 'ignored', resolvedAt: new Date(), resolvedById: userId } })
  await prisma.conversation.update({ where: { id: conversationId }, data: { copilotAlertedMessageId: null } })
}
