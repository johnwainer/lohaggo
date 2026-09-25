import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction } from '@/lib/admin-utils'
import { prisma } from '@/lib/prisma'
import { aiAuth, can, forbidden } from '@/lib/ai/route-auth'
import { resolutionRate, sanitizeAgentInput } from '@/lib/ai/agent-input'
import { getAiSettings } from '@/lib/ai/settings'
import { assertPublicHttpsUrl } from '@/lib/ai/net'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await aiAuth()
  if (!auth.ok) return auth.response
  const { id } = await context.params
  const agent = await prisma.aiAgent.findUnique({ where: { id } })
  if (!agent || !can(auth, agent.workspaceId, 'ai.view')) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const [cost, byProvider, last] = await Promise.all([
    prisma.aiCall.aggregate({ where: { agentId: id, createdAt: { gte: monthStart } }, _sum: { costUsd: true }, _count: { _all: true } }),
    prisma.aiCall.groupBy({ by: ['provider'], where: { agentId: id, createdAt: { gte: monthStart }, provider: { in: ['anthropic', 'openai'] } }, _count: { _all: true } }),
    prisma.aiCall.findFirst({ where: { agentId: id, provider: { in: ['anthropic', 'openai'] } }, orderBy: { createdAt: 'desc' }, select: { provider: true, model: true, createdAt: true } }),
  ])
  return NextResponse.json({
    agent: { ...agent, resolution: resolutionRate(agent.conversations, agent.handoffs) },
    monthCost: { costUsd: cost._sum.costUsd ?? 0, calls: cost._count._all, byProvider: byProvider.map((r) => ({ provider: r.provider, calls: r._count._all })), last },
    permissions: {
      edit: can(auth, agent.workspaceId, 'ai.edit'),
      knowledge: can(auth, agent.workspaceId, 'ai.knowledge'),
      test: can(auth, agent.workspaceId, 'ai.test'),
    },
  })
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await aiAuth()
  if (!auth.ok) return auth.response
  const { id } = await context.params
  const existing = await prisma.aiAgent.findUnique({ where: { id } })
  if (!existing || !can(auth, existing.workspaceId, 'ai.view')) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (!can(auth, existing.workspaceId, 'ai.edit')) return forbidden()

  const body = await request.json().catch(() => ({}))
  const settings = await getAiSettings()
  let data: Record<string, unknown>
  try {
    data = sanitizeAgentInput(body, { allowModel: settings.allowAgentModelOverride })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Datos inválidos' }, { status: 400 })
  }
  if (typeof data.webhookUrl === 'string') {
    try { await assertPublicHttpsUrl(data.webhookUrl) } catch (err) {
      return NextResponse.json({ error: `Webhook: ${err instanceof Error ? err.message : 'no permitido'}` }, { status: 400 })
    }
  }

  const agent = await prisma.aiAgent.update({ where: { id }, data })
  if (data.isDefault === true) await prisma.aiAgent.updateMany({ where: { workspaceId: agent.workspaceId, id: { not: id } }, data: { isDefault: false } })
  await auditAdminAction({
    actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'AI_AGENT_UPDATE', entityType: 'AiAgent', entityId: id,
    details: JSON.stringify(Object.keys(data)), request,
  })
  return NextResponse.json({ agent: { ...agent, resolution: resolutionRate(agent.conversations, agent.handoffs) } })
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await aiAuth()
  if (!auth.ok) return auth.response
  const { id } = await context.params
  const existing = await prisma.aiAgent.findUnique({ where: { id } })
  if (!existing || !can(auth, existing.workspaceId, 'ai.edit')) return forbidden()
  // Conversations it was handling go back to the human queue; history keeps its name on each message
  await prisma.conversation.updateMany({ where: { aiAgentId: id, aiHandled: true }, data: { aiHandled: false, priority: 'high' } })
  await prisma.aiAgent.delete({ where: { id } })
  await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'AI_AGENT_DELETE', entityType: 'AiAgent', entityId: id, details: existing.name, request })
  return NextResponse.json({ ok: true })
}
