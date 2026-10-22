/**
 * Closing the conversations the AI agent handles: on its own call (cerrar_conversacion: the matter is
 * done, spam, a message for another brand) and by inactivity (the contact stopped answering for 24 h).
 * A closed conversation reopens by itself when the contact writes again (inbound), and the agent picks it
 * up with the close summary in its context.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { CLOSE_REASON_LABEL, INACTIVITY_CLOSE_MS, inactivityCloseDecision, type CloseReason } from '@/lib/ai/conversation-core'

const logger = createLogger('ai-closing')

/** Where the agent stores that a conversation's recipient cannot be reached (see markUndeliverable). */
export const UNDELIVERABLE_KEY = 'aiUndeliverable'
const AFTER_HOURS_KEY = 'afterHours'

type Agent = { id: string; name: string }

/** RESOLVED with its trail: status event, close event with the summary and an internal note for the team. */
export async function closeConversation(conversationId: string, agent: Agent, reason: CloseReason, summary: string) {
  const label = CLOSE_REASON_LABEL[reason]
  const text = summary.trim().replace(/\s+/g, ' ').slice(0, 600)
  const actor = { actorType: 'ai', actorId: agent.id, actorName: agent.name }
  const updated = await prisma.conversation.updateMany({
    // Nobody took it meanwhile: a person, a handoff or paused automations keep it open
    where: { id: conversationId, status: { in: ['OPEN', 'IN_PROGRESS'] }, assignedToId: null, aiHandoffAt: null, automationsPaused: false },
    data: { status: 'RESOLVED', aiHandled: false, ...(reason === 'spam' ? { aiSpam: true } : {}) },
  })
  if (!updated.count) return false
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { workspaceId: true } })
  await prisma.conversationEvent.createMany({
    data: [
      { conversationId, type: 'ai_closed', ...actor, detail: `${label}${text ? `: ${text}` : ''}`.slice(0, 900) },
      { conversationId, type: 'status', ...actor, detail: 'RESOLVED' },
      ...(reason === 'spam' ? [{ conversationId, type: 'ai_spam', ...actor }] : []),
    ],
  })
  await prisma.conversationMessage.create({
    data: {
      conversationId, direction: 'OUTBOUND', isInternal: true, status: 'SENT', senderType: 'AI', aiAgentId: agent.id, aiAgentName: agent.name,
      body: `🤖 ${agent.name} cerró la conversación (${label.toLowerCase()})${text ? `: ${text}` : '.'}`,
    },
  })
  if (conv) emitInboxEvent({ type: 'status-update', conversationId, workspaceId: conv.workspaceId })
  // Handled: one satisfaction question (lib/inbox/csat-core.ts decides if it may go out)
  if (reason === 'gestionada') {
    const { askCsatOnClose } = await import('@/lib/inbox/csat')
    await askCsatOnClose(conversationId, reason)
  }
  return true
}

/** The last close of this conversation, for the agent's context when the contact writes again. */
export async function lastCloseSummary(conversationId: string) {
  const e = await prisma.conversationEvent.findFirst({ where: { conversationId, type: 'ai_closed' }, orderBy: { createdAt: 'desc' }, select: { detail: true, createdAt: true } })
  return e?.detail ? { detail: e.detail, at: e.createdAt } : null
}

/**
 * The provider says this recipient cannot get messages (invalid number…): the agent stops answering here
 * for good instead of handing off over and over. A person can still write from the inbox.
 */
export async function markUndeliverable(conversationId: string, agent: Agent, error: string) {
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { customFields: true, workspaceId: true } })
  if (!conv) return
  const fields = conv.customFields && typeof conv.customFields === 'object' ? { ...(conv.customFields as Record<string, unknown>) } : {}
  fields[UNDELIVERABLE_KEY] = { at: new Date().toISOString(), error: error.slice(0, 200) }
  await prisma.conversation.update({ where: { id: conversationId }, data: { customFields: fields as Prisma.InputJsonValue, aiHandled: false } })
  await prisma.conversationEvent.create({ data: { conversationId, type: 'ai_undeliverable', actorType: 'ai', actorId: agent.id, actorName: agent.name, detail: error.slice(0, 300) } })
  await prisma.conversationMessage.create({
    data: {
      conversationId, direction: 'OUTBOUND', isInternal: true, status: 'SENT', senderType: 'AI', aiAgentId: agent.id, aiAgentName: agent.name,
      body: `🤖 ${agent.name} no puede enviar mensajes a este contacto (${error.slice(0, 160)}). La IA deja de responder en esta conversación.`,
    },
  })
  emitInboxEvent({ type: 'status-update', conversationId, workspaceId: conv.workspaceId })
}

export function isUndeliverableMarked(customFields: unknown) {
  return Boolean(customFields && typeof customFields === 'object' && (customFields as Record<string, unknown>)[UNDELIVERABLE_KEY])
}

/**
 * Conversations the AI handles whose contact went quiet: the agent spoke last more than 24 h ago and
 * nothing waits (no person in charge, no handoff, no action waiting for a yes). Up to `limit` per run.
 */
export async function closeInactiveConversations(limit = 20, now = new Date()) {
  const convs = await prisma.conversation.findMany({
    where: {
      aiHandled: true, aiAgentId: { not: null }, assignedToId: null, aiHandoffAt: null, isTest: false, automationsPaused: false,
      status: { in: ['OPEN', 'IN_PROGRESS'] },
      channel: { notIn: ['FACEBOOK_COMMENT', 'INSTAGRAM_COMMENT'] },
      lastMessageAt: { lt: new Date(now.getTime() - INACTIVITY_CLOSE_MS), gt: new Date(now.getTime() - 30 * 24 * 3600_000) },
    },
    orderBy: { lastMessageAt: 'asc' },
    take: 200,
    select: { id: true, status: true, aiHandled: true, assignedToId: true, aiHandoffAt: true, isTest: true, aiAgentId: true, aiAgentName: true, customFields: true },
  })
  if (!convs.length) return { closed: 0, checked: 0 }
  const ids = convs.map((c) => c.id)
  const [lastMessages, pending] = await Promise.all([
    prisma.conversationMessage.findMany({
      where: { conversationId: { in: ids }, isInternal: false },
      orderBy: { sentAt: 'desc' },
      distinct: ['conversationId'],
      select: { conversationId: true, direction: true, senderType: true, sentAt: true },
    }),
    prisma.aiAgentAction.groupBy({ by: ['conversationId'], where: { conversationId: { in: ids }, status: { in: ['proposed', 'awaiting_approval'] }, createdAt: { gt: new Date(now.getTime() - 7 * 24 * 3600_000) } }, _count: { _all: true } }),
  ])
  const lastBy = new Map(lastMessages.map((m) => [m.conversationId, m]))
  const pendingBy = new Map(pending.map((p) => [p.conversationId, p._count._all]))

  let closed = 0
  for (const c of convs) {
    if (closed >= limit) break
    const fields = c.customFields && typeof c.customFields === 'object' ? (c.customFields as Record<string, unknown>) : {}
    const decision = inactivityCloseDecision({
      status: c.status, aiHandled: c.aiHandled, assignedToId: c.assignedToId, aiHandoffAt: c.aiHandoffAt, isTest: c.isTest,
      lastMessage: lastBy.get(c.id) ?? null, pendingActions: pendingBy.get(c.id) ?? 0, waitingAfterHours: Boolean(fields[AFTER_HOURS_KEY]),
    }, now)
    if (!decision.close) continue
    try {
      const ok = await closeConversation(c.id, { id: c.aiAgentId!, name: c.aiAgentName || 'Agente IA' }, 'sin_respuesta', 'El contacto no respondió en 24 horas al último mensaje del agente.')
      if (ok) closed++
    } catch (err) {
      logger.warn('Inactivity close failed', { conversationId: c.id, err: err instanceof Error ? err.message : err })
    }
  }
  return { closed, checked: convs.length }
}
