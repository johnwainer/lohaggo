import type Anthropic from '@anthropic-ai/sdk'
import type { AiAgent, Conversation } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { callClaude, describeApiError, textOf, type Effort } from '@/lib/ai/anthropic'
import { getAiSettings } from '@/lib/ai/settings'
import { applySignature, formatForChannel, parseMarkers } from '@/lib/ai/format'
import { buildSystem } from '@/lib/ai/prompt'
import { recordGap, retrieve, type KnowledgeChunk, type Retrieval } from '@/lib/ai/knowledge'
import { buildToolDefs, executeTool, isWriteTool, toolGuidance, type ToolCallRecord, type ToolRunState } from '@/lib/ai/tools'
import { auxBudgetAvailable, checkWorkspaceBudget } from '@/lib/ai/limits'
import type { UsageTokens } from '@/lib/ai/pricing'
import type { AiCallKind } from '@/lib/ai/calls'
import {
  describeNow,
  effectiveWindow,
  needsSummary,
  pickAgent,
  preHandoff as preHandoffCore,
  toTurns,
  type PreHandoff,
} from '@/lib/ai/runtime-core'

const logger = createLogger('ai-runtime')

export const MAX_TOOL_ROUNDS = 6
const DEFAULT_TZ = 'America/Bogota'

export type HandoffReason =
  | 'model' // [[HANDOFF]]: the agent did not know
  | 'tool' // asignar_a_persona
  | 'refusal'
  | 'keyword'
  | 'max_turns'
  | 'outside_hours'
  | 'budget'
  | 'api_error'
  | 'tool_loop'
  | 'empty'
  | 'goal_done'

export type ReplyResult = {
  ok: boolean
  text: string
  handoff: boolean
  handoffReason: HandoffReason | null
  handoffDetail: string | null
  done: boolean
  spam: boolean
  toolsUsed: ToolCallRecord[]
  chunks: KnowledgeChunk[]
  knowledgeMode: Retrieval['mode']
  chosenOutput: string | null
  usage: UsageTokens
  costUsd: number
  /** Model that really answered the last round (what gets billed) */
  model: string | null
  requestedModel: string
  rounds: number
  stopReason: string | null
  error: string | null
}

export type ReplyOptions = {
  agent: AiAgent
  workspaceId: string
  channel: string
  conversationId: string | null
  userId: string | null
  contact: { name: string | null; phone: string | null; tags: string[]; fields: Record<string, unknown> }
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  text: string
  summary: string | null
  kind: Extract<AiCallKind, 'agent_reply' | 'playground' | 'flow_step' | 'copilot_suggestion'>
  /** Copilot: drafts the reply a person will send. Read-only tools, no signature, no side effects. */
  copilot?: boolean
  dryRun: boolean
  flowOutputs?: string[]
  now?: Date
}

const emptyUsage = (): UsageTokens => ({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 })

async function accountTimezone(workspaceId: string) {
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { timezone: true } })
  return ws?.timezone || DEFAULT_TZ
}

async function resolveModel(agent: AiAgent) {
  const settings = await getAiSettings()
  return settings.allowAgentModelOverride && agent.model?.trim() ? agent.model.trim() : settings.defaultModel
}

export const AgentRuntimeService = {
  /** Active agent for a channel; the conversation's own agent wins so later turns never switch agent. */
  async pick(workspaceId: string, channel: string, currentAgentId?: string | null) {
    const agents = await prisma.aiAgent.findMany({ where: { workspaceId, status: 'active' } })
    return pickAgent(agents, channel, currentAgentId)
  },

  buildSystem,

  preHandoff(agent: AiAgent, input: { text: string; turns: number; now: Date; accountTz: string }): PreHandoff {
    return preHandoffCore(agent, input)
  },

  /**
   * Last memoryWindow messages as API turns + a stored summary of everything older, refreshed with
   * the fallback model when enough messages fell out of the window (and the daily aux budget allows).
   */
  async memory(conversation: Pick<Conversation, 'id' | 'workspaceId' | 'aiSummary' | 'aiSummaryCount'>, agent: AiAgent, opts: { excludeMessageId?: string } = {}) {
    const window = effectiveWindow(agent.memoryWindow)
    const where = { conversationId: conversation.id, isInternal: false, ...(opts.excludeMessageId ? { id: { not: opts.excludeMessageId } } : {}) }
    const [total, recent] = await Promise.all([
      prisma.conversationMessage.count({ where }),
      prisma.conversationMessage.findMany({ where, orderBy: { sentAt: 'desc' }, take: window, select: { direction: true, body: true } }),
    ])
    let summary = conversation.aiSummary
    if (needsSummary(total, window, conversation.aiSummaryCount) && (await auxBudgetAvailable())) {
      summary = await this.summarize(conversation, agent, total - window).catch((err) => {
        logger.warn('Summary failed', { err: err instanceof Error ? err.message : err })
        return conversation.aiSummary
      })
    }
    return { history: toTurns([...recent].reverse()), summary, total }
  },

  async summarize(conversation: Pick<Conversation, 'id' | 'workspaceId' | 'aiSummary' | 'aiSummaryCount'>, agent: AiAgent, olderCount: number) {
    const settings = await getAiSettings()
    const older = await prisma.conversationMessage.findMany({
      where: { conversationId: conversation.id, isInternal: false },
      orderBy: { sentAt: 'asc' },
      skip: conversation.aiSummaryCount,
      take: olderCount - conversation.aiSummaryCount,
      select: { direction: true, body: true },
    })
    const transcript = older.map((m) => `${m.direction === 'INBOUND' ? 'Cliente' : 'Negocio'}: ${m.body}`).join('\n')
    const { message } = await callClaude(
      {
        model: settings.fallbackModel,
        maxTokens: 400,
        effort: 'low',
        messages: [{
          role: 'user',
          content: `${conversation.aiSummary ? `Resumen previo:\n${conversation.aiSummary}\n\n` : ''}Mensajes nuevos:\n${transcript}\n\nEscribe un resumen de 4 a 6 frases en texto corrido, sin Markdown, con los nombres, cifras, fechas y acuerdos, y lo que quedó pendiente.`,
        }],
      },
      { kind: 'summary', workspaceId: conversation.workspaceId, agentId: agent.id, conversationId: conversation.id, allowFallback: false },
    )
    const summary = textOf(message)
    if (summary) {
      await prisma.conversation.update({ where: { id: conversation.id }, data: { aiSummary: summary, aiSummaryCount: olderCount } })
    }
    return summary || conversation.aiSummary
  },

  /**
   * System + history + new message, the agent's tools, the tool loop (all tool_results of a round in
   * one user message, up to 6 rounds), markers, channel formatting. Used by autopilot, flows and the
   * playground alike, so testing an agent tests what it answers in production.
   */
  async reply(opts: ReplyOptions): Promise<ReplyResult> {
    // In copilot mode the agent only reads: tools that write stay out of its reach entirely
    const agent = opts.copilot ? { ...opts.agent, tools: opts.agent.tools.filter((t) => !isWriteTool(t)) } : opts.agent
    const now = opts.now ?? new Date()
    const requestedModel = await resolveModel(agent)
    const result: ReplyResult = {
      ok: true, text: '', handoff: false, handoffReason: null, handoffDetail: null, done: false, spam: false,
      toolsUsed: [], chunks: [], knowledgeMode: 'none', chosenOutput: null, usage: emptyUsage(), costUsd: 0,
      model: null, requestedModel, rounds: 0, stopReason: null, error: null,
    }

    // Monthly cap: stop answering and hand off, never fail silently
    const budget = await checkWorkspaceBudget(opts.workspaceId)
    if (budget.state === 'blocked') {
      return { ...result, handoff: true, handoffReason: 'budget', handoffDetail: `Tope mensual de IA alcanzado (${budget.pct}%)`, text: agent.handoffMessage }
    }

    const tz = await accountTimezone(opts.workspaceId)
    const knowledge = await retrieve({ workspaceId: opts.workspaceId, agentId: agent.id, query: opts.text })
    result.knowledgeMode = knowledge.mode
    result.chunks = knowledge.mode === 'full' ? [] : [...knowledge.chunks]

    const system = buildSystem(agent, {
      knowledge,
      nowText: describeNow(now, tz),
      timezone: tz,
      channel: opts.channel,
      contact: { name: opts.contact.name, tags: opts.contact.tags, fields: opts.contact.fields, linkedUser: Boolean(opts.userId) },
      summary: opts.summary,
      toolGuidance: toolGuidance(agent, opts.flowOutputs),
      copilot: opts.copilot,
      flowOutputs: opts.flowOutputs,
    })
    const tools = buildToolDefs(agent, opts.flowOutputs)
    const effort: Effort = tools.length ? 'medium' : 'low'
    const messages: Anthropic.MessageParam[] = [...opts.history, { role: 'user', content: opts.text }]
    // The API requires alternating turns starting with user; merge a trailing duplicate user turn
    const merged: Anthropic.MessageParam[] = []
    for (const m of messages) {
      const last = merged[merged.length - 1]
      if (last && last.role === m.role && typeof last.content === 'string' && typeof m.content === 'string') last.content = `${last.content}\n${m.content}`
      else merged.push({ ...m })
    }

    const state: ToolRunState = { handoff: null, chosenOutput: null, chunks: [] }
    const toolCtx = {
      agent, workspaceId: opts.workspaceId, conversationId: opts.conversationId, userId: opts.userId,
      contact: { name: opts.contact.name, phone: opts.contact.phone, channel: opts.channel }, dryRun: opts.dryRun, state,
    }

    let final: Anthropic.Message | null = null
    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const call = await callClaude(
          { model: requestedModel, system, messages: merged, tools, maxTokens: agent.maxTokens, effort },
          { kind: round === 0 || opts.kind === 'playground' ? opts.kind : 'tools_round', workspaceId: opts.workspaceId, agentId: agent.id, conversationId: opts.conversationId },
        )
        result.rounds = round + 1
        result.model = call.model
        result.costUsd += call.costUsd
        for (const k of Object.keys(result.usage) as Array<keyof UsageTokens>) result.usage[k] += call.usage[k]
        final = call.message
        result.stopReason = call.message.stop_reason

        if (call.message.stop_reason === 'refusal') break
        if (call.message.stop_reason !== 'tool_use') break

        const uses = call.message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
        const records = await Promise.all(uses.map((u) => executeTool(u.name, (u.input || {}) as Record<string, unknown>, toolCtx)))
        result.toolsUsed.push(...records)
        merged.push({ role: 'assistant', content: call.message.content })
        merged.push({
          role: 'user',
          content: uses.map((u, i) => ({ type: 'tool_result' as const, tool_use_id: u.id, content: records[i].output, ...(records[i].isError ? { is_error: true } : {}) })),
        })
        if (round === MAX_TOOL_ROUNDS - 1) {
          result.handoff = true
          result.handoffReason = 'tool_loop'
        }
      }
    } catch (err) {
      // Report the real reason; never dress an API failure up as an answer
      const error = describeApiError(err)
      logger.error('Agent reply failed', { agentId: agent.id, conversationId: opts.conversationId, error })
      return { ...result, ok: false, error, handoff: true, handoffReason: 'api_error', handoffDetail: error, text: agent.handoffMessage }
    }

    result.chunks.push(...state.chunks)
    result.chosenOutput = state.chosenOutput

    if (final?.stop_reason === 'refusal') {
      return { ...result, handoff: true, handoffReason: 'refusal', handoffDetail: final.stop_details?.category ?? null, text: agent.handoffMessage }
    }

    const markers = parseMarkers(final ? textOf(final) : '')
    result.done = markers.done
    result.spam = markers.spam && agent.ignoreSpam
    if (result.spam) return { ...result, text: '' }

    if (state.handoff) {
      result.handoff = true
      result.handoffReason = 'tool'
      result.handoffDetail = state.handoff.reason
    } else if (markers.handoff && !result.handoff) {
      result.handoff = true
      result.handoffReason = 'model'
    }
    if (!markers.text && !result.handoff) {
      result.handoff = true
      result.handoffReason = 'empty'
    }

    const body = markers.text || (result.handoff ? agent.handoffMessage : '')
    result.text = opts.copilot
      ? formatForChannel(body, opts.channel)
      : applySignature(formatForChannel(body, opts.channel), agent.signatureMode, agent.signatureText, result.handoff || result.done)
    return result
  },

  /**
   * Applies a reply's consequences to a real conversation. Handoff: AI off, pending (OPEN), high
   * priority, assigned to the least-loaded workspace member, ai_handoff fact, internal note for the
   * team. Goal done: the configured action. Spam: no answer, the conversation (not the contact) is marked.
   */
  async applyOutcome(params: {
    conversation: Conversation
    agent: AiAgent
    handoff: boolean
    handoffReason: HandoffReason | null
    handoffDetail: string | null
    done: boolean
    spam: boolean
    question?: string
  }) {
    const { conversation, agent } = params
    const actor = { actorType: 'ai', actorId: agent.id, actorName: agent.name }

    if (params.spam) {
      await prisma.conversation.update({ where: { id: conversation.id }, data: { aiSpam: true, aiHandled: false } })
      await prisma.conversationEvent.create({ data: { conversationId: conversation.id, type: 'ai_spam', ...actor } })
      emitInboxEvent({ type: 'status-update', conversationId: conversation.id, workspaceId: conversation.workspaceId })
      return
    }

    let handoff = params.handoff
    let reason = params.handoffReason
    let detail = params.handoffDetail

    if (params.done) {
      await prisma.conversationEvent.create({ data: { conversationId: conversation.id, type: 'ai_done', ...actor, detail: agent.goalDoneAction } })
      if (agent.goalDoneAction === 'close') {
        await prisma.conversation.update({ where: { id: conversation.id }, data: { status: 'RESOLVED', aiHandled: false } })
        await prisma.conversationEvent.create({ data: { conversationId: conversation.id, type: 'status', ...actor, detail: 'RESOLVED' } })
      } else if (agent.goalDoneAction === 'tag' && agent.goalDoneTag?.trim()) {
        const tag = agent.goalDoneTag.trim().toLowerCase()
        const fresh = await prisma.conversation.findUnique({ where: { id: conversation.id }, select: { tags: true } })
        if (fresh && !fresh.tags.includes(tag)) await prisma.conversation.update({ where: { id: conversation.id }, data: { tags: [...fresh.tags, tag] } })
      } else if (agent.goalDoneAction === 'handoff' && !handoff) {
        handoff = true
        reason = 'goal_done'
        detail = 'Objetivo cumplido'
      }
    }

    if (handoff) {
      const assignee = await pickLeastLoadedMember(conversation.workspaceId)
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { aiHandled: false, status: 'OPEN', priority: 'high', assignedToId: assignee, aiTurns: 0, aiHandoffAt: new Date() },
      })
      await prisma.aiAgent.update({ where: { id: agent.id }, data: { handoffs: { increment: 1 } } })
      const label = HANDOFF_LABEL[reason || 'model'] || 'Traspaso'
      await prisma.conversationEvent.create({ data: { conversationId: conversation.id, type: 'ai_handoff', ...actor, detail: detail ? `${label}: ${detail}` : label } })
      if (assignee) {
        const person = await prisma.user.findUnique({ where: { id: assignee }, select: { name: true } })
        await prisma.conversationEvent.create({ data: { conversationId: conversation.id, type: 'assigned', ...actor, detail: person?.name || 'Equipo' } })
      }
      await prisma.conversationMessage.create({
        data: {
          conversationId: conversation.id, direction: 'OUTBOUND', isInternal: true, status: 'SENT', senderType: 'AI',
          aiAgentId: agent.id, aiAgentName: agent.name,
          body: `🤖 ${agent.name} traspasó la conversación. ${label}${detail ? `: ${detail}` : ''}.`,
        },
      })
      // Every "didn't know" handoff feeds the knowledge-gap list
      if ((reason === 'model' || reason === 'empty') && params.question?.trim()) {
        await recordGap({ workspaceId: conversation.workspaceId, agentId: agent.id, conversationId: conversation.id, question: params.question })
      }
    }
    emitInboxEvent({ type: 'status-update', conversationId: conversation.id, workspaceId: conversation.workspaceId })
  },
}

export const HANDOFF_LABEL: Record<HandoffReason, string> = {
  model: 'No supo responder',
  tool: 'Pidió pasar a una persona',
  refusal: 'El modelo declinó responder',
  keyword: 'Palabra clave de traspaso',
  max_turns: 'Tope de turnos alcanzado',
  outside_hours: 'Fuera de horario',
  budget: 'Tope mensual de IA',
  api_error: 'Error del proveedor de IA',
  tool_loop: 'Demasiadas vueltas de herramientas',
  empty: 'Respuesta vacía',
  goal_done: 'Objetivo cumplido',
}

async function pickLeastLoadedMember(workspaceId: string): Promise<string | null> {
  const members = await prisma.workspaceMember.findMany({ where: { workspaceId, user: { isActive: true, role: 'ADMIN' } }, select: { userId: true } })
  if (!members.length) return null
  const counts = await prisma.conversation.groupBy({
    by: ['assignedToId'],
    where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, assignedToId: { in: members.map((m) => m.userId) } },
    _count: { _all: true },
  })
  const load = new Map(counts.map((c) => [c.assignedToId, c._count._all]))
  return [...members].sort((a, b) => (load.get(a.userId) ?? 0) - (load.get(b.userId) ?? 0))[0].userId
}
