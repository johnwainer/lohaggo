import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { AUX_KINDS } from '@/lib/ai/calls'
import { periodOf } from '@/lib/ai/pricing'
import { getAiSettings } from '@/lib/ai/settings'

const logger = createLogger('ai-limits')

export type BudgetState = 'ok' | 'warn' | 'blocked'

export type BudgetEval = { state: BudgetState; pct: number }

/** Highest of the two ratios (cost, calls) decides. No cap = unlimited. */
export function evaluateBudget(
  usage: { costUsd: number; calls: number },
  caps: { costCapUsd: number | null; callCap: number | null },
): BudgetEval {
  const ratios: number[] = []
  if (caps.costCapUsd != null && caps.costCapUsd >= 0) ratios.push(caps.costCapUsd === 0 ? Infinity : usage.costUsd / caps.costCapUsd)
  if (caps.callCap != null && caps.callCap >= 0) ratios.push(caps.callCap === 0 ? Infinity : usage.calls / caps.callCap)
  if (!ratios.length) return { state: 'ok', pct: 0 }
  const r = Math.max(...ratios)
  const pct = Number.isFinite(r) ? Math.round(r * 100) : 100
  if (r >= 1) return { state: 'blocked', pct }
  if (r >= 0.8) return { state: 'warn', pct }
  return { state: 'ok', pct }
}

/** Text calls count on both providers: failing over to OpenAI must not escape the monthly cap. */
export async function workspaceUsage(workspaceId: string, period = periodOf(new Date())) {
  const agg = await prisma.aiCall.aggregate({
    where: { workspaceId, period, provider: { in: ['anthropic', 'openai'] }, kind: { not: 'image_generation' } },
    _sum: { costUsd: true },
    _count: { _all: true },
  })
  const emb = await prisma.aiCall.aggregate({ where: { workspaceId, period, provider: 'voyage' }, _sum: { costUsd: true } })
  return { costUsd: (agg._sum.costUsd ?? 0) + (emb._sum.costUsd ?? 0), calls: agg._count._all }
}

/**
 * Monthly cap per workspace. At 80 % it records a warning once per period; at 100 % the agent stops
 * answering and hands off (the caller does that — it never fails silently).
 */
export async function checkWorkspaceBudget(workspaceId: string) {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { aiMonthlyCostCapUsd: true, aiMonthlyCallCap: true, aiCapWarnedPeriod: true },
  })
  if (!ws) return { state: 'ok' as BudgetState, pct: 0 }
  if (ws.aiMonthlyCostCapUsd == null && ws.aiMonthlyCallCap == null) return { state: 'ok' as BudgetState, pct: 0 }
  const usage = await workspaceUsage(workspaceId)
  const result = evaluateBudget(usage, { costCapUsd: ws.aiMonthlyCostCapUsd, callCap: ws.aiMonthlyCallCap })
  const period = periodOf(new Date())
  if (result.state !== 'ok' && ws.aiCapWarnedPeriod !== period) {
    await prisma.workspace.update({ where: { id: workspaceId }, data: { aiCapWarnedPeriod: period } }).catch(() => null)
    logger.warn('AI monthly budget threshold reached', { workspaceId, ...result })
  }
  return result
}

/** Daily money cap for auxiliary calls (summaries, re-engagement). */
export async function auxBudgetAvailable() {
  const settings = await getAiSettings()
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  const agg = await prisma.aiCall.aggregate({ where: { kind: { in: AUX_KINDS }, createdAt: { gte: since } }, _sum: { costUsd: true } })
  return (agg._sum.costUsd ?? 0) < settings.auxDailyBudgetUsd
}
