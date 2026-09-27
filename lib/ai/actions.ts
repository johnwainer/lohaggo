/**
 * The record of what an inbox AI agent tried to do on the platform from a chat (AiAgentAction), plus the
 * trail every executed action leaves: a conversation event, the admin audit log and the origin stamp the
 * entity already carries. The entity rows themselves are written by lib/*\/ops.ts, the same functions the
 * app routes call.
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auditAdminAction } from '@/lib/admin-utils'
import { emitInboxEvent } from '@/lib/messaging/inbox-emitter'
import { CONFIRM_WINDOW_MS, dailyLimitFor, type ActionStatus } from '@/lib/ai/actions-core'
import { describeOrigin, type Origin } from '@/lib/ops/origin'

export type ActionAgent = { id: string; name: string }

export type RecordActionInput = {
  workspaceId: string
  conversationId: string
  agent: ActionAgent
  tool: string
  summary: string
  input: Record<string, unknown>
  status: ActionStatus
  entityType?: string | null
  entityId?: string | null
  result?: string | null
}

export async function recordAction(p: RecordActionInput) {
  const row = await prisma.aiAgentAction.create({
    data: {
      workspaceId: p.workspaceId, conversationId: p.conversationId, agentId: p.agent.id, agentName: p.agent.name,
      tool: p.tool, summary: p.summary.slice(0, 500), input: p.input as Prisma.InputJsonValue, status: p.status,
      entityType: p.entityType ?? null, entityId: p.entityId ?? null, result: p.result?.slice(0, 2000) ?? null,
      resolvedAt: p.status === 'proposed' || p.status === 'awaiting_approval' ? null : new Date(),
    },
  })
  if (p.status === 'awaiting_approval') {
    emitInboxEvent({ type: 'status-update', conversationId: p.conversationId, workspaceId: p.workspaceId })
    // D2: the team hears there is an action to approve
    const { waActionAwaiting } = await import('@/lib/messaging/wa-events')
    await waActionAwaiting({ actionId: row.id, conversationId: p.conversationId, workspaceId: p.workspaceId, summary: p.summary })
  }
  return row
}

export async function settleAction(id: string, p: { status: ActionStatus; result?: string | null; entityType?: string | null; entityId?: string | null; resolvedById?: string | null }) {
  return prisma.aiAgentAction.update({
    where: { id },
    data: { status: p.status, result: p.result?.slice(0, 2000) ?? undefined, entityType: p.entityType ?? undefined, entityId: p.entityId ?? undefined, resolvedById: p.resolvedById ?? undefined, resolvedAt: new Date() },
  })
}

/** The latest still-valid proposal of this tool in the conversation (the person is being asked to confirm it). */
export async function latestProposed(conversationId: string, tool: string, now = new Date()) {
  return prisma.aiAgentAction.findFirst({
    where: { conversationId, tool, status: 'proposed', createdAt: { gte: new Date(now.getTime() - CONFIRM_WINDOW_MS) } },
    orderBy: { createdAt: 'desc' },
  })
}

/** Older proposals nobody confirmed are closed as expired, so the inbox card does not show them forever. */
export async function expireStaleProposals(conversationId: string, now = new Date()) {
  await prisma.aiAgentAction.updateMany({
    where: { conversationId, status: 'proposed', createdAt: { lt: new Date(now.getTime() - CONFIRM_WINDOW_MS) } },
    data: { status: 'expired', resolvedAt: now },
  })
}

/** Executed (or awaiting) actions of this tool in the last 24 h: what counts against the daily limit. */
export async function dailyActionCount(conversationId: string, tool: string, now = new Date()) {
  return prisma.aiAgentAction.count({
    where: { conversationId, tool, status: { in: ['executed', 'awaiting_approval'] }, createdAt: { gte: new Date(now.getTime() - 24 * 3600_000) } },
  })
}

export async function overDailyLimit(conversationId: string, tool: string) {
  const limit = dailyLimitFor(tool)
  if (limit === null) return false
  return (await dailyActionCount(conversationId, tool)) >= limit
}

/**
 * The trail of an executed action: a fact in the thread («El agente creó la solicitud #…»), the admin
 * audit log with origin chat, and the inbox refresh. Notifications are the ops function's job (the same
 * ones the app sends).
 */
export async function leaveTrail(p: { workspaceId: string; conversationId: string; agent: ActionAgent; tool: string; summary: string; entityType: string; entityId: string; origin: Origin }) {
  await prisma.conversationEvent.create({
    data: { conversationId: p.conversationId, type: 'agent_action', actorType: 'ai', actorId: p.agent.id, actorName: p.agent.name, detail: `${p.summary} · ${p.entityType} ${p.entityId.slice(-6)}`.slice(0, 500) },
  })
  await auditAdminAction({
    actorId: p.agent.id,
    actorEmail: `agente:${p.agent.name}`,
    action: `CHAT_${p.tool.toUpperCase()}`,
    entityType: p.entityType,
    entityId: p.entityId,
    route: `/admin/inbox?conversation=${p.conversationId}`,
    details: JSON.stringify({ origen: 'chat', canal: p.origin.channel, agente: p.agent.name, agenteId: p.agent.id, conversacion: p.conversationId, resumen: p.summary, hecho: describeOrigin(p.origin) }).slice(0, 2000),
  })
  emitInboxEvent({ type: 'status-update', conversationId: p.conversationId, workspaceId: p.workspaceId })
}

export async function listActions(conversationId: string, take = 30) {
  return prisma.aiAgentAction.findMany({ where: { conversationId }, orderBy: { createdAt: 'desc' }, take })
}

/** Counts for Haggo and the agent screen: last N days by status and by tool. */
export async function actionStats(p: { workspaceId?: string; agentId?: string; days: number }) {
  const since = new Date(Date.now() - p.days * 24 * 3600_000)
  const where: Prisma.AiAgentActionWhereInput = { createdAt: { gte: since }, ...(p.workspaceId ? { workspaceId: p.workspaceId } : {}), ...(p.agentId ? { agentId: p.agentId } : {}) }
  const [byStatus, byTool] = await Promise.all([
    prisma.aiAgentAction.groupBy({ by: ['status'], where, _count: { _all: true } }),
    prisma.aiAgentAction.groupBy({ by: ['tool', 'status'], where, _count: { _all: true } }),
  ])
  return {
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])) as Record<string, number>,
    byTool: byTool.map((r) => ({ tool: r.tool, status: r.status, count: r._count._all })),
  }
}
