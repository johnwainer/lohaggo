/**
 * The AI could not answer a contact (the agent run threw, or returned an API error): the contact must never
 * stay silent. With aiFailure.backToQueue the conversation goes back to a person («Por responder», AI off,
 * aiHandoffAt set so the escalation ladder takes it); with aiFailure.incident the critical `ai:agent-failing`
 * incident is opened or counted once more (same type the runtime opens, so admins hear it by WhatsApp once).
 */
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { patchInboxState } from '@/lib/inbox/state'
import { getInboxSettings } from '@/lib/inbox/settings'

const logger = createLogger('inbox-ai-failure')

export const AI_FAILING_INCIDENT = 'ai:agent-failing'

/** Open (or refresh) the critical incident. `openIfMissing` false only counts one more occurrence on an open one. */
export async function touchAiFailingIncident(input: { agentName: string; error: string; openIfMissing: boolean }) {
  const open = await prisma.adminIncident.findFirst({ where: { type: AI_FAILING_INCIDENT, status: { in: ['OPEN', 'ACKNOWLEDGED'] } }, select: { id: true } })
  if (open) {
    await prisma.adminIncident.update({ where: { id: open.id }, data: { occurrences: { increment: 1 }, lastSeenAt: new Date() } })
    return
  }
  if (!input.openIfMissing) return
  const { openIncident } = await import('@/lib/ops/platform-ops')
  await openIncident({
    type: AI_FAILING_INCIDENT, severity: 'CRITICAL', source: 'inbox-ai-failure',
    title: `El agente «${input.agentName}» no puede responder a los clientes`,
    description: `Un mensaje de un cliente quedó para una persona porque la IA falló: ${input.error}`.slice(0, 2000),
  })
}

/**
 * `alreadyHandedOff`: the runtime returned api_error and applyOutcome already did the handoff; only the trail
 * and the incident count are added (the runtime opens the incident itself). Never throws.
 */
export async function handleAiReplyFailure(input: { conversationId: string; error: string; alreadyHandedOff?: boolean }) {
  try {
    const settings = (await getInboxSettings()).aiFailure
    const conv = await prisma.conversation.findUnique({
      where: { id: input.conversationId },
      select: { id: true, workspaceId: true, aiHandled: true, aiAgentId: true, aiAgentName: true, status: true, assignedToId: true },
    })
    if (!conv) return
    const agentName = conv.aiAgentName || 'Agente IA'
    const error = input.error.slice(0, 300)

    if (settings.backToQueue && !input.alreadyHandedOff) {
      await prisma.conversation.update({
        where: { id: conv.id },
        data: {
          priority: 'high',
          ...(conv.status === 'RESOLVED' || conv.status === 'CLOSED' ? { status: 'OPEN' } : {}),
          // The AI dropped it (or was about to take it, nobody owns it): a person owes the answer, counted from now
          // by the ladder as a handoff, so the ladder never skips it waiting for an autopilot that keeps failing
          ...(conv.aiHandled || !conv.assignedToId ? { aiHandled: false, aiTurns: 0, aiHandoffAt: new Date() } : {}),
        },
      })
      await patchInboxState(conv.id, { awaitingReply: true, snoozedUntil: null, snoozedBy: null })
      await prisma.conversationMessage.create({
        data: {
          conversationId: conv.id, direction: 'OUTBOUND', isInternal: true, status: 'SENT', senderType: 'AUTOMATION',
          body: `⚠️ La IA no pudo responder este mensaje (${error.slice(0, 160)}). La conversación volvió a «Por responder» para que una persona conteste.`,
        },
      })
    }
    await prisma.conversationEvent.create({
      data: {
        conversationId: conv.id, type: 'ai_failure', actorType: 'system', actorId: conv.aiAgentId, actorName: agentName,
        detail: `${settings.backToQueue || input.alreadyHandedOff ? 'Vuelve a «Por responder»' : 'Sin respuesta de la IA'}: ${error}`.slice(0, 900),
      },
    })
    if (settings.incident) await touchAiFailingIncident({ agentName, error, openIfMissing: !input.alreadyHandedOff })
    emitInboxEvent({ type: 'status-update', conversationId: conv.id, workspaceId: conv.workspaceId })
  } catch (err) {
    logger.warn('AI failure not recorded', { conversationId: input.conversationId, err: err instanceof Error ? err.message : err })
  }
}
