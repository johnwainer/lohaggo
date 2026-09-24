import type { Conversation } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { shouldTakeOverCore } from '@/lib/ai/runtime-core'
import { withAccountKey } from '@/lib/ai/autopilot'

/** A pending client message older than this can't be answered anyway (24h channel window). */
export const PENDING_MAX_AGE_MS = 23 * 60 * 60 * 1000

export const AI_ASSIGN_ERRORS: Record<string, string> = {
  test: 'Es una conversación de prueba',
  thread_elsewhere: 'El hilo está en la bandeja nativa de Meta',
  skip_tag: 'Tiene una etiqueta excluida del piloto automático',
  no_agent: 'Ningún agente con piloto automático atiende este canal',
  account_not_enabled: 'Ningún agente con piloto automático atiende esta cuenta',
}

type Actor = { id: string; name: string }

/**
 * Hands a conversation to an AI agent (same rules as the autopilot, minus the ones this action
 * resolves itself: human owner, recent human message, pause, previous handoff). Returns the id of a
 * client message still waiting for an answer, if any, so the caller can have the agent answer it.
 */
export async function assignToAi(conversation: Conversation, actor: Actor, preferredAgentId?: string | null) {
  const agents = await prisma.aiAgent.findMany({ where: { workspaceId: conversation.workspaceId, status: 'active' } })
  const conv = await withAccountKey(conversation)
  const decision = shouldTakeOverCore(
    { ...conv, aiAgentId: preferredAgentId ?? conversation.aiAgentId, assignedToId: null, automationsPaused: false, aiSpam: false, aiHandoffAt: null },
    { agents, recentHumanActivity: false },
  )
  if (!decision.take) return { ok: false as const, reason: decision.reason, error: AI_ASSIGN_ERRORS[decision.reason] || 'No se puede asignar a la IA' }

  const agent = decision.agent
  const updated = await prisma.conversation.update({
    where: { id: conversation.id },
    data: { aiHandled: true, aiAgentId: agent.id, aiAgentName: agent.name, assignedToId: null, automationsPaused: false, aiSpam: false, aiTurns: 0, priority: 'normal', aiHandoffAt: null },
    include: { assignedTo: { select: { id: true, name: true, email: true } } },
  })
  if (!conversation.aiHandled || conversation.aiAgentId !== agent.id) {
    await prisma.conversationEvent.create({ data: { conversationId: conversation.id, type: 'ai_started', actorType: 'ai', actorId: agent.id, actorName: agent.name, detail: `Asignada por ${actor.name}` } })
  }
  emitInboxEvent({ type: 'status-update', conversationId: conversation.id, workspaceId: conversation.workspaceId })

  const last = await prisma.conversationMessage.findFirst({
    where: { conversationId: conversation.id, isInternal: false },
    orderBy: { sentAt: 'desc' },
    select: { id: true, direction: true, sentAt: true },
  })
  const pendingMessageId = last?.direction === 'INBOUND' && Date.now() - last.sentAt.getTime() < PENDING_MAX_AGE_MS ? last.id : null
  return { ok: true as const, conversation: updated, agent, pendingMessageId }
}

/** Assigns a person (or nobody). A person in charge switches the AI off for the conversation. */
export async function assignToPerson(conversation: Conversation, actor: Actor, userId: string | null) {
  const updated = await prisma.conversation.update({
    where: { id: conversation.id },
    data: { assignedToId: userId, aiHandled: false, aiTurns: 0 },
    include: { assignedTo: { select: { id: true, name: true, email: true } } },
  })
  if (conversation.assignedToId !== userId || conversation.aiHandled) {
    await prisma.conversationEvent.create({
      data: { conversationId: conversation.id, type: 'assigned', actorType: 'user', actorId: actor.id, actorName: actor.name, detail: updated.assignedTo?.name || 'Sin asignar' },
    })
  }
  emitInboxEvent({ type: 'status-update', conversationId: conversation.id, workspaceId: conversation.workspaceId })
  return updated
}
