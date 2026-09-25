import { prisma } from '@/lib/prisma'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { sanitizeAgentInput } from '@/lib/ai/agent-input'

/**
 * AI agent operations shared by the admin routes and Haggo. No permission checks nor audit: the caller
 * does both.
 */

/**
 * Open conversations an agent was answering go back to people with high priority. Without this a
 * paused agent leaves its customers without an answer (the runtime only picks active agents).
 */
export async function releaseAgentConversations(agentId: string) {
  const rows = await prisma.conversation.findMany({ where: { aiAgentId: agentId, aiHandled: true, status: { in: ['OPEN', 'IN_PROGRESS'] } }, select: { id: true, workspaceId: true } })
  if (!rows.length) return []
  await prisma.conversation.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { aiHandled: false, priority: 'high' } })
  for (const r of rows) emitInboxEvent({ type: 'status-update', conversationId: r.id, workspaceId: r.workspaceId })
  return rows.map((r) => r.id)
}

/** Pause (releasing its conversations) or reactivate an inbox agent. Returns what it was before. */
export async function setAiAgentStatus(agentId: string, status: 'active' | 'paused') {
  const agent = await prisma.aiAgent.findUnique({ where: { id: agentId }, select: { id: true, status: true } })
  if (!agent) throw new Error('Agente no encontrado')
  if (agent.status !== status) await prisma.aiAgent.update({ where: { id: agentId }, data: { status } })
  const released = status === 'paused' ? await releaseAgentConversations(agentId) : []
  return { previous: agent.status, released }
}

export const INSTRUCTION_FIELDS = ['instructions', 'goal', 'tone'] as const
export type InstructionFields = Partial<Record<(typeof INSTRUCTION_FIELDS)[number], string>>

/** Changes what the agent is told (instructions, goal, tone) with the same limits as its screen. */
export async function updateAgentInstructions(agentId: string, fields: InstructionFields) {
  const agent = await prisma.aiAgent.findUnique({ where: { id: agentId }, select: { instructions: true, goal: true, tone: true } })
  if (!agent) throw new Error('Agente no encontrado')
  const data = sanitizeAgentInput(fields, { allowModel: false }) as InstructionFields
  const clean = Object.fromEntries(INSTRUCTION_FIELDS.filter((k) => typeof data[k] === 'string').map((k) => [k, data[k]])) as InstructionFields
  if (!Object.keys(clean).length) throw new Error('Nada que cambiar')
  await prisma.aiAgent.update({ where: { id: agentId }, data: clean })
  return { previous: Object.fromEntries(Object.keys(clean).map((k) => [k, agent[k as keyof typeof agent] ?? ''])) as InstructionFields }
}
