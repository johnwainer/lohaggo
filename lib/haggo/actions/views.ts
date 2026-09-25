import type { HaggoAction, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAction } from '@/lib/haggo/actions/registry'
import { STATUS_LABEL, type ActionStatus } from '@/lib/haggo/actions/state'
import { RISK_LABEL, SIDE_EFFECT_LABEL, type Risk } from '@/lib/haggo/actions/types'

/** What the admin sees of an action: plain data, labels in Spanish, nothing the UI must guess. */
export function actionView(a: HaggoAction) {
  const def = getAction(a.tool)
  const evidence = (a.evidence ?? {}) as { items?: Array<{ tool: string; fact: string }>; lowTrust?: boolean; forReview?: boolean; risks?: string; policy?: string[]; againBecause?: string | null }
  return {
    id: a.id,
    tool: a.tool,
    label: def?.label ?? a.tool,
    domain: a.domain,
    risk: a.risk as Risk,
    riskLabel: RISK_LABEL[a.risk as Risk] ?? a.risk,
    sideEffects: (def?.sideEffects ?? []).map((s) => SIDE_EFFECT_LABEL[s]),
    reversible: Boolean(def?.undo),
    status: a.status as ActionStatus,
    statusLabel: STATUS_LABEL[a.status as ActionStatus] ?? a.status,
    origin: a.origin,
    what: a.expectedImpact,
    why: a.reason,
    evidence: evidence.items ?? [],
    lowTrust: Boolean(evidence.lowTrust),
    forReview: Boolean(evidence.forReview),
    risks: evidence.risks ?? null,
    policy: evidence.policy ?? [],
    againBecause: evidence.againBecause ?? null,
    hypothesis: a.hypothesis as { metric: string; current: string; expected: string; byHours: number } | null,
    alternatives: (a.alternatives as Array<{ option: string; whyNot: string }> | null) ?? [],
    confidence: a.confidence,
    preview: a.preview as { summary: string; diff: Array<{ field: string; from: unknown; to: unknown }> } | null,
    result: (a.result as { message?: string } | null)?.message ?? null,
    error: a.error,
    planId: a.planId,
    planOrder: a.planOrder,
    decidedByEmail: a.decidedByEmail,
    decisionNote: a.decisionNote,
    createdAt: a.createdAt,
    decidedAt: a.decidedAt,
    executedAt: a.executedAt,
    revertedAt: a.revertedAt,
    expiresAt: a.expiresAt,
    canUndo: a.status === 'executed' && Boolean(def?.undo),
    needsTypedConfirm: a.risk === 'max',
  }
}
export type ActionView = ReturnType<typeof actionView>

const RISK_ORDER: Record<string, number> = { max: 0, high: 1, medium: 2, low: 3 }

/** Pending first by risk and confidence; history newest first, filterable. */
export async function listActions(q: { view: 'pending' | 'history'; domain?: string | null; origin?: string | null; status?: string | null; take?: number }) {
  const where: Prisma.HaggoActionWhereInput = q.view === 'pending' ? { status: 'proposed' } : { status: q.status ? q.status : { not: 'proposed' } }
  if (q.domain) where.domain = q.domain
  if (q.origin) where.origin = q.origin
  const rows = await prisma.haggoAction.findMany({ where, orderBy: { createdAt: 'desc' }, take: Math.min(200, q.take ?? 100) })
  const views = rows.map(actionView)
  if (q.view === 'pending') views.sort((a, b) => (RISK_ORDER[a.risk] ?? 9) - (RISK_ORDER[b.risk] ?? 9) || (b.confidence ?? 0) - (a.confidence ?? 0))
  return views
}

export async function actionsByIds(ids: string[]) {
  if (!ids.length) return []
  return (await prisma.haggoAction.findMany({ where: { id: { in: ids } } })).map(actionView)
}
