import type Anthropic from '@anthropic-ai/sdk'
import type { AiAgent, Conversation } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { callClaude, describeApiError, textOf, type Effort } from '@/lib/ai/anthropic'
import { getAiSettings } from '@/lib/ai/settings'
import { applySignature, formatForChannel, parseMarkers } from '@/lib/ai/format'
import { buildSystem, type CommentPromptContext } from '@/lib/ai/prompt'
import type { CommentSignals } from '@/lib/ai/comments-core'
import { recordGap, retrieve, type KnowledgeChunk, type Retrieval } from '@/lib/ai/knowledge'
import { buildToolDefs, executeTool, toolGuidance, toolsForMode, withImplicitTools, type ToolCallRecord, type ToolMode, type ToolRunState } from '@/lib/ai/tools'
import { auxBudgetAvailable, checkWorkspaceBudget } from '@/lib/ai/limits'
import { CONFIRM_WINDOW_MS, isClearYes, pendingActionsText } from '@/lib/ai/actions-core'
import { CLOSE_REASON_LABEL, dedupeReply, parseRelayNotice, relayContextText, type CloseReason } from '@/lib/ai/conversation-core'
import { closeConversation, lastCloseSummary } from '@/lib/ai/closing'
import { loadEffectiveRates } from '@/lib/payments/commission'
import type { UsageTokens } from '@/lib/ai/pricing'
import type { AiCallKind } from '@/lib/ai/calls'
import type { ProviderId } from '@/lib/ai/providers/types'
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
  | 'sensitive'

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
  /** Provider that answered the last round: OpenAI when Claude failed over */
  provider: ProviderId | null
  requestedModel: string
  rounds: number
  stopReason: string | null
  error: string | null
  /** Comment mode: raw signals for planCommentReply (text keeps the [[PRIVADO]] separator, unformatted) */
  comment?: CommentSignals
  /** cerrar_conversacion: the conversation closes once the reply went out */
  close?: { reason: CloseReason; summary: string } | null
  /** The reply was (almost) what the agent had just sent: nothing goes out */
  suppressed?: 'duplicate' | null
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
  kind: Extract<AiCallKind, 'agent_reply' | 'playground' | 'flow_step' | 'copilot_suggestion' | 'comment_reply' | 'comment_suggestion'>
  /** Copilot: drafts the reply a person will send. Read-only tools, no signature, no side effects. */
  copilot?: boolean
  /** Public comment on a post: the caller plans public / private replies and moderation from the signals */
  comment?: CommentPromptContext
  dryRun: boolean
  flowOutputs?: string[]
  now?: Date
}

/** Calls whose whole cost (tool rounds included) is reported under their own kind */
const KEEP_KIND_ON_TOOL_ROUNDS = new Set<AiCallKind>(['playground', 'copilot_suggestion', 'comment_reply', 'comment_suggestion'])

const emptyUsage = (): UsageTokens => ({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 })

async function accountTimezone(workspaceId: string) {
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { timezone: true } })
  return ws?.timezone || DEFAULT_TZ
}

let commissionCache: { at: number; text: string } | null = null

/** The commission in force, one line for the agent's context (cached a few minutes). */
async function commissionText() {
  if (commissionCache && Date.now() - commissionCache.at < 5 * 60_000) return commissionCache.text
  const r = await loadEffectiveRates().catch(() => null)
  const text = !r ? '' : r.enabled
    ? `Comisión vigente de LoHaggo: el socio paga ${r.partner} % del precio de cada servicio; el cliente paga una tarifa de servicio de ${r.client} % sobre el precio del socio.`
    : 'Comisión vigente de LoHaggo: ninguna por ahora (el socio recibe el 100 % y el cliente no paga tarifa de servicio).'
  commissionCache = { at: Date.now(), text }
  return text
}

const RELAY_WINDOW_MS = 24 * 3600_000

/** The last client↔partner message we forwarded into this conversation, and a relay waiting for the yes. */
async function relayContext(conversationId: string, pending: Array<{ tool: string; summary: string; input: unknown; createdAt: Date }>, now: Date) {
  const notice = await prisma.conversationMessage.findFirst({
    where: { conversationId, direction: 'OUTBOUND', aiAgentId: 'chat-relay', sentAt: { gte: new Date(now.getTime() - RELAY_WINDOW_MS) } },
    orderBy: { sentAt: 'desc' },
    select: { body: true, sentAt: true },
  }).catch(() => null)
  const parsed = notice ? parseRelayNotice(notice.body) : null
  const relay = pending.find((p) => p.tool === 'enviar_mensaje_reserva')
  const input = (relay?.input ?? {}) as Record<string, unknown>
  return relayContextText({
    lastNotice: parsed && notice ? { ...parsed, minutesAgo: Math.max(0, Math.round((now.getTime() - notice.sentAt.getTime()) / 60_000)) } : null,
    pendingMessage: relay
      ? { recipient: relay.summary.match(/^Enviar a (.+?), en el chat/)?.[1] ?? 'la otra parte', ref: String(input.ref ?? ''), text: String(input.mensaje ?? ''), minutesAgo: Math.max(0, Math.round((now.getTime() - relay.createdAt.getTime()) / 60_000)) }
      : null,
  })
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
      prisma.conversationMessage.findMany({ where, orderBy: { sentAt: 'desc' }, take: window, select: { direction: true, body: true, mediaType: true, mediaUrl: true } }),
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
    // Public comments come from anyone: like the copilot, the agent only reads there (no accounts, tasks or status changes)
    const modeFlags = { copilot: Boolean(opts.copilot), comment: Boolean(opts.comment) }
    const agent = { ...opts.agent, tools: withImplicitTools(toolsForMode(opts.agent.tools, modeFlags), modeFlags) }
    const mode: ToolMode = opts.dryRun && !opts.copilot ? 'playground' : opts.copilot ? 'copilot' : 'autopilot'
    const now = opts.now ?? new Date()
    const requestedModel = await resolveModel(agent)
    const result: ReplyResult = {
      ok: true, text: '', handoff: false, handoffReason: null, handoffDetail: null, done: false, spam: false,
      toolsUsed: [], chunks: [], knowledgeMode: 'none', chosenOutput: null, usage: emptyUsage(), costUsd: 0,
      model: null, provider: null, requestedModel, rounds: 0, stopReason: null, error: null,
    }

    // Monthly cap: stop answering and hand off, never fail silently
    const budget = await checkWorkspaceBudget(opts.workspaceId)
    if (budget.state === 'blocked') {
      return { ...result, handoff: true, handoffReason: 'budget', handoffDetail: `Tope mensual de IA alcanzado (${budget.pct}%)`, text: agent.handoffMessage }
    }

    const tz = await accountTimezone(opts.workspaceId)
    const state: ToolRunState = { handoff: null, chosenOutput: null, chunks: [], close: null }
    const toolCtx = {
      agent, workspaceId: opts.workspaceId, conversationId: opts.conversationId, userId: opts.userId,
      contact: { name: opts.contact.name, phone: opts.contact.phone, channel: opts.channel }, dryRun: opts.dryRun, mode, state,
      personText: opts.text, turnStartedAt: new Date(),
    }
    const [knowledge, pendingRows, unread] = await Promise.all([
      retrieve({ workspaceId: opts.workspaceId, agentId: agent.id, query: opts.text }),
      mode === 'autopilot' && opts.conversationId
        ? prisma.aiAgentAction.findMany({
            where: { conversationId: opts.conversationId, status: 'proposed', createdAt: { gte: new Date(now.getTime() - CONFIRM_WINDOW_MS) } },
            orderBy: { createdAt: 'desc' }, take: 3,
            select: { tool: true, summary: true, input: true, createdAt: true },
          }).catch(() => [])
        : Promise.resolve([]),
      mode === 'autopilot' && opts.userId && agent.tools.includes('ver_mensajes_reserva')
        ? import('@/lib/chat/ops').then((m) => m.unreadCountForUser(opts.userId!)).catch(() => 0)
        : Promise.resolve(0),
    ])
    result.knowledgeMode = knowledge.mode
    result.chunks = knowledge.mode === 'full' ? [] : [...knowledge.chunks]

    // A plain yes to the only message waiting to be relayed sends it right away: the model tends to lose
    // the relay and ask «what do you want me to tell him?» after the person already confirmed it
    let pending = pendingRows
    const done: string[] = []
    if (mode === 'autopilot' && opts.conversationId && pending.length === 1 && pending[0].tool === 'enviar_mensaje_reserva' && agent.tools.includes('enviar_mensaje_reserva') && isClearYes(opts.text)) {
      const record = await executeTool('enviar_mensaje_reserva', { ...((pending[0].input ?? {}) as Record<string, unknown>), confirmado: true }, toolCtx)
      result.toolsUsed.push(record)
      done.push(`Con el sí de la persona ya ejecutaste enviar_mensaje_reserva (${pending[0].summary}). Resultado: ${record.output} Confírmaselo en una frase; no le preguntes nada más sobre ese mensaje ni lo vuelvas a enviar.`)
      pending = []
    }

    const [commission, relay, closedBefore] = await Promise.all([
      opts.comment ? Promise.resolve('') : commissionText(),
      mode === 'autopilot' && opts.conversationId && agent.tools.includes('enviar_mensaje_reserva') ? relayContext(opts.conversationId, pending, now).catch(() => '') : Promise.resolve(''),
      mode === 'autopilot' && opts.conversationId ? lastCloseSummary(opts.conversationId).catch(() => null) : Promise.resolve(null),
    ])
    const closedText = closedBefore ? `Esta conversación ya se había cerrado (${describeNow(closedBefore.at, tz)}): ${closedBefore.detail}. La persona volvió a escribir: retómala desde ahí, sin presentarte de nuevo.` : ''

    const system = buildSystem(agent, {
      knowledge,
      nowText: describeNow(now, tz),
      timezone: tz,
      channel: opts.channel,
      contact: { name: opts.contact.name, tags: opts.contact.tags, fields: opts.contact.fields, linkedUser: Boolean(opts.userId) },
      summary: opts.summary,
      pendingActions: [
        ...done,
        pendingActionsText(pending, now),
        relay,
        unread ? `Tiene ${unread} mensaje${unread === 1 ? '' : 's'} sin leer en el chat de sus reservas: cuéntaselo y léeselos con ver_mensajes_reserva si quiere.` : '',
        commission,
        closedText,
      ].filter(Boolean).join('\n'),
      toolGuidance: toolGuidance(agent, opts.flowOutputs),
      copilot: opts.copilot,
      flowOutputs: opts.flowOutputs,
      comment: opts.comment,
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

    let final: Anthropic.Message | null = null
    let emptyRetried = false
    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const call = await callClaude(
          { model: requestedModel, system, messages: merged, tools, maxTokens: agent.maxTokens, effort },
          { kind: round === 0 || KEEP_KIND_ON_TOOL_ROUNDS.has(opts.kind) ? opts.kind : 'tools_round', workspaceId: opts.workspaceId, agentId: agent.id, conversationId: opts.conversationId },
        )
        result.rounds = round + 1
        result.model = call.model
        result.provider = call.provider
        result.costUsd += call.costUsd
        for (const k of Object.keys(result.usage) as Array<keyof UsageTokens>) result.usage[k] += call.usage[k]
        final = call.message
        result.stopReason = call.message.stop_reason

        if (call.message.stop_reason === 'refusal') break
        if (call.message.stop_reason !== 'tool_use') {
          // An empty answer gets one more try before it becomes a handoff (a marker alone is not empty)
          const raw = textOf(call.message).trim()
          if (!raw && !emptyRetried && !state.handoff && !state.close && round < MAX_TOOL_ROUNDS - 1) {
            emptyRetried = true
            if (call.message.content.length) merged.push({ role: 'assistant', content: call.message.content })
            appendUserText(merged, '[Aviso interno de la plataforma, no lo escribió la persona] Tu respuesta llegó vacía. Escribe ahora el mensaje para la persona.')
            continue
          }
          break
        }

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
      // A customer was left without an answer: the team hears it once (open incident = already told), not after days
      if (!opts.dryRun) void reportAgentFailure(agent.name, error)
      return { ...result, ok: false, error, handoff: true, handoffReason: 'api_error', handoffDetail: error, text: agent.handoffMessage }
    }

    result.chunks.push(...state.chunks)
    result.chosenOutput = state.chosenOutput
    result.close = state.close ?? null

    if (final?.stop_reason === 'refusal') {
      return { ...result, handoff: true, handoffReason: 'refusal', handoffDetail: final.stop_details?.category ?? null, text: agent.handoffMessage }
    }

    const markers = parseMarkers(final ? textOf(final) : '')
    if (opts.comment) {
      result.done = markers.done
      if (state.handoff) {
        result.handoff = true
        result.handoffReason = 'tool'
        result.handoffDetail = state.handoff.reason
      } else if (markers.handoff || markers.sensitive) {
        result.handoff = markers.handoff
        result.handoffReason = markers.sensitive ? 'sensitive' : 'model'
      }
      result.spam = markers.spam
      result.text = markers.text
      result.comment = {
        text: markers.text, handoff: result.handoff, sensitive: markers.sensitive, ignore: markers.ignore, offensive: markers.offensive, spam: markers.spam,
        usedTools: result.toolsUsed.length > 0,
      }
      return result
    }
    result.done = markers.done
    result.spam = (markers.spam && agent.ignoreSpam) || state.close?.reason === 'spam'
    if (result.spam) return { ...result, text: '' }

    if (state.handoff) {
      result.handoff = true
      result.handoffReason = 'tool'
      result.handoffDetail = state.handoff.reason
      result.close = null
    } else if (state.close) {
      // Closing (done, another brand) is the agent's decision: no handoff on top, not even for an empty text
      result.handoff = false
      result.handoffReason = null
    } else if (markers.handoff && !result.handoff) {
      result.handoff = true
      result.handoffReason = 'model'
    }
    if (!markers.text && !result.handoff && !state.close) {
      result.handoff = true
      result.handoffReason = 'empty'
    }

    // A close always says goodbye (except spam): the contact must not be left without an answer
    const closingLine = state.close && state.close.reason !== 'spam' && !markers.text
      ? state.close.reason === 'otra_marca'
        ? 'Esta cuenta atiende LoHaggo, servicios para el hogar; por aquí no podemos ayudarte con eso. ¡Gracias por escribir!'
        : '¡Con gusto! Si necesitas algo más, escríbenos por aquí.'
      : ''
    let body = markers.text || closingLine || (result.handoff ? agent.handoffMessage : '')
    if (!opts.copilot && !result.handoff && body) {
      const previous = opts.history.filter((h) => h.role === 'assistant').map((h) => h.content)
      const deduped = dedupeReply(body, previous)
      if (deduped.dropped !== 'none') logger.info('Repeated reply trimmed', { conversationId: opts.conversationId, dropped: deduped.dropped })
      if (deduped.dropped === 'duplicate') {
        result.suppressed = 'duplicate'
        return { ...result, text: '' }
      }
      body = deduped.text
    }
    result.text = opts.copilot
      ? formatForChannel(body, opts.channel)
      : applySignature(formatForChannel(body, opts.channel), agent.signatureMode, agent.signatureText, result.handoff || result.done || Boolean(result.close))
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
    close?: { reason: CloseReason; summary: string } | null
  }) {
    const { conversation, agent } = params
    const actor = { actorType: 'ai', actorId: agent.id, actorName: agent.name }

    if (params.spam) {
      // Evident spam: no answer and the conversation closes (the contact stays as it is)
      const closed = await closeConversation(conversation.id, agent, 'spam', params.close?.summary || 'Marcada como spam por el agente').catch(() => false)
      if (!closed) {
        await prisma.conversation.update({ where: { id: conversation.id }, data: { aiSpam: true, aiHandled: false } })
        await prisma.conversationEvent.create({ data: { conversationId: conversation.id, type: 'ai_spam', ...actor } })
        emitInboxEvent({ type: 'status-update', conversationId: conversation.id, workspaceId: conversation.workspaceId })
      }
      return
    }

    if (params.close && !params.handoff) {
      if (params.done) await prisma.conversationEvent.create({ data: { conversationId: conversation.id, type: 'ai_done', ...actor, detail: agent.goalDoneAction } })
      await closeConversation(conversation.id, agent, params.close.reason, params.close.summary || CLOSE_REASON_LABEL[params.close.reason])
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
      // D1: the admins of this account with WhatsApp on hear that a person is needed
      if (!conversation.isTest) {
        const { waHandoff } = await import('@/lib/messaging/wa-events')
        await waHandoff({ conversationId: conversation.id, workspaceId: conversation.workspaceId, channel: conversation.channel, reason: (detail || label).slice(0, 160) })
      }
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
  sensitive: 'Tema sensible en un comentario',
}

async function pickLeastLoadedMember(workspaceId: string): Promise<string | null> {
  let members = await prisma.workspaceMember.findMany({ where: { workspaceId, user: { isActive: true, role: 'ADMIN' } }, select: { userId: true } })
  // A handoff never ends with nobody: without members, any active admin takes it
  if (!members.length) members = (await prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } })).map((u) => ({ userId: u.id }))
  if (!members.length) return null
  const counts = await prisma.conversation.groupBy({
    by: ['assignedToId'],
    where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, assignedToId: { in: members.map((m) => m.userId) } },
    _count: { _all: true },
  })
  const load = new Map(counts.map((c) => [c.assignedToId, c._count._all]))
  return [...members].sort((a, b) => (load.get(a.userId) ?? 0) - (load.get(b.userId) ?? 0))[0].userId
}

/** One open incident per failing period: critical, so admins get it by WhatsApp; resolving it re-arms the alarm. */
async function reportAgentFailure(agentName: string, error: string) {
  try {
    const open = await prisma.adminIncident.findFirst({ where: { type: 'ai:agent-failing', status: { in: ['OPEN', 'ACKNOWLEDGED'] } }, select: { id: true } })
    if (open) return
    const { openIncident } = await import('@/lib/ops/platform-ops')
    await openIncident({
      type: 'ai:agent-failing', severity: 'CRITICAL', source: 'ai-runtime',
      title: `El agente «${agentName}» no puede responder a los clientes`,
      description: `Cada mensaje pasa a una persona porque la IA rechaza la respuesta: ${error}`.slice(0, 2000),
    })
  } catch (err) {
    logger.warn('Could not open the agent failure incident', { err: err instanceof Error ? err.message : err })
  }
}

/** Adds a text to the trailing user turn (a tool_result round or the person's message) or opens a new one. */
function appendUserText(messages: Anthropic.MessageParam[], text: string) {
  const last = messages[messages.length - 1]
  if (last?.role === 'user') {
    if (typeof last.content === 'string') last.content = `${last.content}\n\n${text}`
    else last.content = [...last.content, { type: 'text', text }]
    return
  }
  messages.push({ role: 'user', content: text })
}
