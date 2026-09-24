import { prisma } from '@/lib/prisma'
import { sendToConversation } from '@/lib/inbox/send'
import { AgentRuntimeService } from '@/lib/ai/runtime'
import { humanActiveRecently } from '@/lib/ai/autopilot'

/**
 * "AI agent" step of a flow. The flow engine must call this with the PUBLISHED version's step config
 * (never the draft). Same runtime as the autopilot and the playground; the model picks the next
 * output with elegir_salida, restricted to exactly the outputs configured in the step.
 */
export async function runFlowAiStep(params: { conversationId: string; agentId?: string | null; outputs: string[]; instruction?: string }) {
  const conversation = await prisma.conversation.findUnique({ where: { id: params.conversationId } })
  if (!conversation) return { ok: false as const, reason: 'no_conversation' }
  // Same rule as the autopilot: a person wrote in the last 30 minutes → the machine stays out
  if (conversation.assignedToId || conversation.automationsPaused || (await humanActiveRecently(conversation.id))) {
    return { ok: false as const, reason: 'human_active' }
  }
  const agent = params.agentId
    ? await prisma.aiAgent.findFirst({ where: { id: params.agentId, workspaceId: conversation.workspaceId, status: 'active' } })
    : await AgentRuntimeService.pick(conversation.workspaceId, conversation.channel, conversation.aiAgentId)
  if (!agent) return { ok: false as const, reason: 'no_agent' }

  const memory = await AgentRuntimeService.memory(conversation, agent)
  const history = [...memory.history]
  const text = history.length && history[history.length - 1].role === 'user' ? history.pop()!.content : params.instruction || '(continúa la conversación)'
  const result = await AgentRuntimeService.reply({
    agent,
    workspaceId: conversation.workspaceId,
    channel: conversation.channel,
    conversationId: conversation.id,
    userId: conversation.userId,
    contact: { name: conversation.contactName, phone: conversation.contactPhone, tags: conversation.tags, fields: (conversation.customFields as Record<string, unknown>) || {} },
    history,
    text,
    summary: memory.summary,
    kind: 'flow_step',
    dryRun: false,
    flowOutputs: params.outputs,
  })
  if (result.text && !result.spam) {
    await sendToConversation({ conversation, message: result.text, sender: { type: 'AI', agentId: agent.id, agentName: agent.name } })
  }
  if (result.handoff || result.done || result.spam) {
    await AgentRuntimeService.applyOutcome({ conversation, agent, handoff: result.handoff, handoffReason: result.handoffReason, handoffDetail: result.handoffDetail, done: result.done, spam: result.spam, question: text })
  }
  const output = result.chosenOutput && params.outputs.includes(result.chosenOutput) ? result.chosenOutput : null
  return { ok: true as const, output, handoff: result.handoff, model: result.model }
}
