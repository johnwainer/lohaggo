import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-utils'
import { prisma } from '@/lib/prisma'
import { periodOf } from '@/lib/ai/pricing'
import { aiWorkspacesWith, getAiAccess } from '@/lib/ai/permissions'
import { evaluateBudget } from '@/lib/ai/limits'

/** Cost report for a period (YYYY-MM): by workspace, agent, call kind and model. */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const access = await getAiAccess(admin)
  const scope = aiWorkspacesWith(access, 'ai.view')
  const period = /^\d{4}-\d{2}$/.test(request.nextUrl.searchParams.get('period') || '')
    ? request.nextUrl.searchParams.get('period')!
    : periodOf(new Date())

  const where = { period, ...(scope === null ? {} : { workspaceId: { in: scope } }) }
  const sum = { costUsd: true, inputTokens: true, outputTokens: true, cacheReadTokens: true, cacheWriteTokens: true } as const
  const [byWorkspace, byAgent, byKind, byModel, workspaces, agents] = await Promise.all([
    prisma.aiCall.groupBy({ by: ['workspaceId'], where, _sum: sum, _count: { _all: true } }),
    prisma.aiCall.groupBy({ by: ['agentId'], where, _sum: sum, _count: { _all: true } }),
    prisma.aiCall.groupBy({ by: ['kind'], where, _sum: sum, _count: { _all: true } }),
    prisma.aiCall.groupBy({ by: ['provider', 'model'], where, _sum: sum, _count: { _all: true } }),
    prisma.workspace.findMany({
      where: scope === null ? {} : { id: { in: scope } },
      select: { id: true, name: true, aiMonthlyCostCapUsd: true, aiMonthlyCallCap: true },
    }),
    prisma.aiAgent.findMany({ where: scope === null ? {} : { workspaceId: { in: scope } }, select: { id: true, name: true } }),
  ])

  const wsName = new Map(workspaces.map((w) => [w.id, w.name]))
  const agentName = new Map(agents.map((a) => [a.id, a.name]))
  const row = (r: { _sum: Record<string, number | null>; _count: { _all: number } }) => ({
    calls: r._count._all,
    costUsd: Math.round((r._sum.costUsd ?? 0) * 10000) / 10000,
    inputTokens: r._sum.inputTokens ?? 0,
    outputTokens: r._sum.outputTokens ?? 0,
    cacheReadTokens: r._sum.cacheReadTokens ?? 0,
    cacheWriteTokens: r._sum.cacheWriteTokens ?? 0,
  })

  const budgets = workspaces.map((w) => {
    const used = byWorkspace.find((r) => r.workspaceId === w.id)
    const usage = { costUsd: used?._sum.costUsd ?? 0, calls: used?._count._all ?? 0 }
    return { workspaceId: w.id, name: w.name, costCapUsd: w.aiMonthlyCostCapUsd, callCap: w.aiMonthlyCallCap, ...usage, ...evaluateBudget(usage, { costCapUsd: w.aiMonthlyCostCapUsd, callCap: w.aiMonthlyCallCap }) }
  })

  return NextResponse.json({
    period,
    byWorkspace: byWorkspace.map((r) => ({ workspaceId: r.workspaceId, name: r.workspaceId ? wsName.get(r.workspaceId) ?? r.workspaceId : 'Plataforma', ...row(r) })),
    byAgent: byAgent.map((r) => ({ agentId: r.agentId, name: r.agentId ? agentName.get(r.agentId) ?? 'Agente eliminado' : 'Sin agente', ...row(r) })),
    byKind: byKind.map((r) => ({ kind: r.kind, ...row(r) })),
    byModel: byModel.map((r) => ({ provider: r.provider, model: r.model, ...row(r) })),
    budgets,
  })
}
