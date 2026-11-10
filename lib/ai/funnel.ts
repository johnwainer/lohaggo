/**
 * Half-way requests nudge (inbox settings · funnel): one reminder, once per conversation, to a contact who
 * left a request half-way with the AI. Runs from the ai-maintenance cron before the generic re-engagement
 * and stamps the same reengagedAt, so a contact never gets both. Inside the 24 h window, only in team
 * hours, never after a STOP. The agent writes it (kind «reengagement», aux budget); without a model, a
 * plain text says what is missing.
 */
import type { AiAgent, Conversation } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { sendToConversation } from '@/lib/inbox/send'
import { getInboxSettings } from '@/lib/inbox/settings'
import { teamHours } from '@/lib/inbox/escalation-core'
import { callClaude, textOf } from '@/lib/ai/anthropic'
import { applySignature, formatForChannel, parseMarkers } from '@/lib/ai/format'
import { buildSystem } from '@/lib/ai/prompt'
import { retrieve } from '@/lib/ai/knowledge'
import { getAiSettings, hasTextProvider } from '@/lib/ai/settings'
import { auxBudgetAvailable } from '@/lib/ai/limits'
import { isUndeliverableMarked } from '@/lib/ai/closing'
import { describeNow } from '@/lib/ai/runtime-core'
import { FUNNEL_CHANNELS, FUNNEL_NUDGE_EVENT, funnelNudgeDecision, funnelProgress, nudgeFallbackText, nudgeInstruction, type FunnelProgress } from '@/lib/ai/funnel-core'

const logger = createLogger('ai-funnel')
const DAY_MS = 24 * 3600_000
const PROPOSAL_LOOKBACK_MS = 2 * DAY_MS

async function nudgeText(conv: Conversation, agent: AiAgent, progress: FunnelProgress, hours: number) {
  const fallback = nudgeFallbackText(progress, conv.contactName)
  const settings = await getAiSettings()
  if (!hasTextProvider(settings) || !(await auxBudgetAvailable())) return fallback
  try {
    const { AgentRuntimeService } = await import('@/lib/ai/runtime')
    const ws = await prisma.workspace.findUnique({ where: { id: conv.workspaceId }, select: { timezone: true } })
    const tz = ws?.timezone || 'America/Bogota'
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
        messages: [...memory.history, { role: 'user', content: nudgeInstruction(progress, hours) }],
      },
      { kind: 'reengagement', workspaceId: conv.workspaceId, agentId: agent.id, conversationId: conv.id },
    )
    const markers = parseMarkers(textOf(call.message))
    if (call.message.stop_reason === 'refusal' || !markers.text || markers.handoff) return fallback
    return markers.text
  } catch (err) {
    logger.warn('Funnel nudge written without the model', { conversationId: conv.id, err: err instanceof Error ? err.message : err })
    return fallback
  }
}

/** One pass of the nudge over conversations that went quiet between nudgeAfterHours and 24 h ago. */
export async function runFunnelNudges(limit = 20, now = new Date()) {
  const config = await getInboxSettings()
  if (!config.funnel.nudgeEnabled) return { nudged: 0 }
  const teamOpen = teamHours(now, config.escalation).open
  if (!teamOpen) return { nudged: 0 }
  const hours = config.funnel.nudgeAfterHours

  const convs = await prisma.conversation.findMany({
    where: {
      aiHandled: true, aiAgentId: { not: null }, assignedToId: null, aiHandoffAt: null, reengagedAt: null,
      isTest: false, aiSpam: false, automationsPaused: false, threadOwner: null,
      channel: { in: FUNNEL_CHANNELS as Conversation['channel'][] },
      status: { in: ['OPEN', 'IN_PROGRESS'] },
      lastMessageAt: { lt: new Date(now.getTime() - hours * 3600_000), gt: new Date(now.getTime() - DAY_MS) },
    },
    orderBy: { lastMessageAt: 'asc' },
    take: 200,
  })

  let nudged = 0
  const { stillOurs } = await import('@/lib/ai/autopilot')
  for (const conv of convs) {
    if (nudged >= limit) break
    try {
      const [already, lastMessage, lastInbound, optOut, proposal, agent] = await Promise.all([
        prisma.conversationEvent.findFirst({ where: { conversationId: conv.id, type: FUNNEL_NUDGE_EVENT }, select: { id: true } }),
        prisma.conversationMessage.findFirst({ where: { conversationId: conv.id, isInternal: false }, orderBy: { sentAt: 'desc' }, select: { direction: true, senderType: true } }),
        prisma.conversationMessage.findFirst({ where: { conversationId: conv.id, direction: 'INBOUND' }, orderBy: { sentAt: 'desc' }, select: { sentAt: true, body: true } }),
        prisma.messagingOptOut.findFirst({
          where: { channel: conv.channel, isActive: true, OR: [{ destination: conv.contactPhone }, ...(conv.userId ? [{ userId: conv.userId }] : [])] },
          select: { id: true },
        }),
        prisma.aiAgentAction.findFirst({
          where: { conversationId: conv.id, tool: 'crear_solicitud', status: { in: ['proposed', 'expired'] }, createdAt: { gte: new Date(now.getTime() - PROPOSAL_LOOKBACK_MS) } },
          orderBy: { createdAt: 'desc' },
          select: { input: true, createdAt: true },
        }),
        prisma.aiAgent.findUnique({ where: { id: conv.aiAgentId! } }),
      ])
      if (!agent || agent.status !== 'active') continue
      const progress = funnelProgress(conv.customFields as Record<string, unknown> | null, (proposal?.input as Record<string, unknown> | null) ?? null)
      // Created by the agent (executed crear_solicitud) or by the person in the app since the funnel started
      const since = proposal?.createdAt ?? new Date(now.getTime() - PROPOSAL_LOOKBACK_MS)
      const [executed, appRequest] = await Promise.all([
        prisma.aiAgentAction.count({ where: { conversationId: conv.id, tool: 'crear_solicitud', status: 'executed', createdAt: { gte: since } } }),
        conv.userId ? prisma.serviceRequest.count({ where: { userId: conv.userId, createdAt: { gte: since } } }) : Promise.resolve(0),
      ])
      const decision = funnelNudgeDecision({
        now, channel: conv.channel, nudgeAfterHours: hours, teamOpen,
        lastInbound: lastInbound ? { sentAt: lastInbound.sentAt, body: lastInbound.body } : null,
        lastMessage, alreadyNudged: Boolean(already), reengaged: Boolean(conv.reengagedAt), optedOut: Boolean(optOut),
        undeliverable: isUndeliverableMarked(conv.customFields), requestCreated: executed + appRequest > 0, progress,
      })
      if (!decision.send) continue
      const fresh = await stillOurs(conv.id, agent.id)
      if (!fresh) continue

      // Stamped before sending (a failed send is not retried every 15 minutes) and claimed atomically: two overlapping cron runs never both send
      const claim = await prisma.conversation.updateMany({ where: { id: fresh.id, reengagedAt: null }, data: { reengagedAt: new Date() } })
      if (claim.count !== 1) continue
      const body = await nudgeText(fresh, agent, progress, hours)
      const text = applySignature(formatForChannel(body, fresh.channel), agent.signatureMode, agent.signatureText, false)
      await prisma.conversationEvent.create({ data: { conversationId: fresh.id, type: FUNNEL_NUDGE_EVENT, actorType: 'ai', actorId: agent.id, actorName: agent.name, detail: decision.missing.slice(0, 200) } })
      const res = await sendToConversation({ conversation: fresh, message: text, sender: { type: 'AI', agentId: agent.id, agentName: agent.name } })
      if (!res.ok) {
        logger.warn('Funnel nudge not sent', { conversationId: fresh.id, error: res.error })
        continue
      }
      nudged++
      emitInboxEvent({ type: 'new-message', conversationId: fresh.id, workspaceId: fresh.workspaceId })
    } catch (err) {
      logger.warn('Funnel nudge failed', { conversationId: conv.id, err: err instanceof Error ? err.message : err })
    }
  }
  return { nudged }
}
