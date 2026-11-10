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
import { ASK_TURN_MS, AWAITING_YES_MS, CONFIRM_WINDOW_MS, NO_LATE_YES_TOOLS, dailyLimitFor, sameActionCore, type ActionStatus } from '@/lib/ai/actions-core'
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
  // The copilot suggests on every message: the same action already waiting is not queued (nor alerted) again
  if (p.status === 'awaiting_approval') {
    const waiting = await prisma.aiAgentAction.findMany({ where: { conversationId: p.conversationId, tool: p.tool, status: 'awaiting_approval' }, select: { id: true, input: true } })
    const same = waiting.find((w) => sameActionCore(w.input, p.input))
    if (same) return prisma.aiAgentAction.findUniqueOrThrow({ where: { id: same.id } })
  }
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

/** Moves an action out of `from` atomically; false when someone else (another turn, another admin) got it first. */
export async function claimAction(id: string, from: 'proposed' | 'awaiting_approval') {
  const r = await prisma.aiAgentAction.updateMany({ where: { id, status: from }, data: { status: 'confirmed' } })
  return r.count === 1
}

/** The latest still-valid proposal of this tool in the conversation (the person is being asked to confirm it). */
export async function latestProposed(conversationId: string, tool: string, now = new Date()) {
  return prisma.aiAgentAction.findFirst({
    where: { conversationId, tool, status: 'proposed', createdAt: { gte: new Date(now.getTime() - CONFIRM_WINDOW_MS) } },
    orderBy: { createdAt: 'desc' },
  })
}

/** Messages the person sent this long before the turn are still part of it (debounced together). */
const CURRENT_BATCH_MS = 3 * 60_000

/**
 * The latest proposal, even past the window, when it is still the last thing said to the person and their
 * current message is the first answer to it: nothing went out after the turn that asked it (from the agent
 * or a person of the team), and nothing came in before this turn. Their late «sí» answers it.
 * Money and irreversible actions (NO_LATE_YES_TOOLS) are left out.
 */
export async function awaitingProposal(conversationId: string, now = new Date()) {
  const p = await prisma.aiAgentAction.findFirst({
    where: { conversationId, status: 'proposed', createdAt: { gte: new Date(now.getTime() - AWAITING_YES_MS) } },
    orderBy: { createdAt: 'desc' },
  })
  if (!p || NO_LATE_YES_TOOLS.includes(p.tool)) return null
  if (now.getTime() - p.createdAt.getTime() <= CONFIRM_WINDOW_MS) return p
  const [saidSince, firstAnswer] = await Promise.all([
    prisma.conversationMessage.count({
      where: { conversationId, direction: 'OUTBOUND', isInternal: false, sentAt: { gt: new Date(p.createdAt.getTime() + ASK_TURN_MS), lte: now } },
    }),
    prisma.conversationMessage.findFirst({
      where: { conversationId, direction: 'INBOUND', sentAt: { gt: p.createdAt, lte: now } },
      orderBy: { sentAt: 'asc' }, select: { sentAt: true },
    }),
  ])
  if (saidSince) return null
  // An earlier answer («no, mejor no», another photo) that went unanswered also ends it
  if (firstAnswer && now.getTime() - firstAnswer.sentAt.getTime() > CURRENT_BATCH_MS) return null
  return p
}

/** Every still-valid proposal of this tool in the conversation, newest first; `stillAsked` marks one kept by awaitingProposal. */
export async function proposedInWindow(conversationId: string, tool: string, now = new Date()) {
  const [rows, waiting] = await Promise.all([
    prisma.aiAgentAction.findMany({
      where: { conversationId, tool, status: 'proposed', createdAt: { gte: new Date(now.getTime() - CONFIRM_WINDOW_MS) } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    awaitingProposal(conversationId, now),
  ])
  const out = rows.map((r) => ({ ...r, stillAsked: false }))
  if (waiting && waiting.tool === tool && !rows.some((r) => r.id === waiting.id)) out.push({ ...waiting, stillAsked: true })
  return out
}

/** Older proposals nobody confirmed are closed as expired, so the inbox card does not show them forever. */
export async function expireStaleProposals(conversationId: string, now = new Date()) {
  const waiting = await awaitingProposal(conversationId, now)
  await prisma.aiAgentAction.updateMany({
    where: { conversationId, status: 'proposed', createdAt: { lt: new Date(now.getTime() - CONFIRM_WINDOW_MS) }, ...(waiting ? { id: { not: waiting.id } } : {}) },
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
