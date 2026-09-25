import { prisma } from '@/lib/prisma'
import { bogotaKey } from '@/lib/admin/overview-core'
import { periodOf } from '@/lib/ai/pricing'
import { getHaggoConfig, getHaggoRow, haggoSpend, HAGGO_KINDS } from '@/lib/haggo/store'
import { inQuietHours, nextRuns } from '@/lib/haggo/schedule'
import { DOMAINS } from '@/lib/haggo/config'
import { actionLabel } from '@/lib/haggo/actions/registry'
import { AUTONOMOUS_ACTOR } from '@/lib/haggo/actions/verify'

const SEV_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 }
const bySeverity = <T extends { severity: string; lastSeenAt: Date }>(a: T, b: T) => (SEV_ORDER[a.severity] ?? 3) - (SEV_ORDER[b.severity] ?? 3) || b.lastSeenAt.getTime() - a.lastSeenAt.getTime()

async function lastOf(type: string) {
  return prisma.haggoRun.findFirst({ where: { type }, orderBy: { startedAt: 'desc' }, select: { id: true, status: true, summary: true, startedAt: true, finishedAt: true, costUsd: true, trigger: true, error: true } })
}

/** «Ahora»: state, schedule, budget, open findings and the latest runs. */
export async function haggoOverview(now = new Date()) {
  const row = await getHaggoRow()
  const cfg = await getHaggoConfig(row)
  const [spend, cycle, daily, weekly, findings, runs, pending, decisions] = await Promise.all([
    haggoSpend(cfg, now),
    lastOf('cycle'), lastOf('daily'), lastOf('weekly'),
    prisma.haggoFinding.findMany({ where: { status: { in: ['new', 'seen'] } }, take: 60, select: { id: true, domain: true, severity: true, title: true, body: true, status: true, occurrences: true, createdAt: true, lastSeenAt: true, entityType: true, entityId: true } }),
    prisma.haggoRun.findMany({ orderBy: { startedAt: 'desc' }, take: 15, select: { id: true, type: true, trigger: true, status: true, summary: true, error: true, costUsd: true, startedAt: true, finishedAt: true } }),
    prisma.haggoAction.count({ where: { status: 'proposed' } }),
    prisma.haggoAction.findMany({ where: { status: { in: ['executed', 'failed', 'reverted', 'rejected'] } }, orderBy: { updatedAt: 'desc' }, take: 5, select: { id: true, tool: true, status: true, expectedImpact: true, updatedAt: true, decidedByEmail: true, verdict: true } }),
  ])
  return {
    config: cfg,
    decisions: decisions.map((d) => ({ ...d, label: actionLabel(d.tool), autonomous: d.decidedByEmail === AUTONOMOUS_ACTOR })),
    autonomousToday: await prisma.haggoAction.count({ where: { decidedByEmail: AUTONOMOUS_ACTOR, createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } } }),
    focus: row.focus,
    lastSnapshotAt: row.lastSnapshotAt,
    working: Boolean(row.lockedUntil && row.lockedUntil > now),
    quietNow: inQuietHours(cfg.quietHours, cfg.timezone, now),
    last: { cycle, daily, weekly },
    next: nextRuns(cfg, { cycle: cycle?.startedAt, daily: daily?.startedAt, weekly: weekly?.startedAt }, now),
    budget: { ...spend, monthlyUsd: cfg.monthlyBudgetUsd, dailyUsd: cfg.dailyBudgetUsd },
    findings: findings.sort(bySeverity),
    // Every area Haggo watches, with its worst open finding: the whole platform at a glance
    areas: DOMAINS.map((d) => {
      const mine = findings.filter((f) => f.domain === d)
      return { domain: d, critical: mine.filter((f) => f.severity === 'critical').length, warning: mine.filter((f) => f.severity === 'warning').length, info: mine.filter((f) => f.severity === 'info').length }
    }),
    runs,
    pendingApprovals: pending,
  }
}

/** «Análisis»: findings by status and the daily/weekly reports. */
export async function haggoAnalysis(opts: { status?: string; take?: number } = {}) {
  const status = opts.status === 'closed' ? { in: ['resolved', 'dismissed'] } : { in: ['new', 'seen'] }
  const [findings, reports] = await Promise.all([
    prisma.haggoFinding.findMany({ where: { status }, orderBy: { lastSeenAt: 'desc' }, take: opts.take ?? 100 }),
    prisma.haggoRun.findMany({ where: { type: { in: ['daily', 'weekly'] } }, orderBy: { startedAt: 'desc' }, take: 30, select: { id: true, type: true, status: true, summary: true, report: true, output: true, error: true, costUsd: true, startedAt: true } }),
  ])
  return { findings: findings.sort(bySeverity), reports }
}

/** «Costo»: this month by kind and day, against the budget. */
export async function haggoCosts(now = new Date()) {
  const cfg = await getHaggoConfig()
  const period = periodOf(now)
  const [spend, byKind, calls, runsByType] = await Promise.all([
    haggoSpend(cfg, now),
    prisma.aiCall.groupBy({ by: ['kind', 'provider'], where: { kind: { in: [...HAGGO_KINDS] }, period }, _sum: { costUsd: true, inputTokens: true, outputTokens: true, cacheReadTokens: true }, _count: { _all: true } }),
    prisma.aiCall.findMany({ where: { kind: { in: [...HAGGO_KINDS] }, period }, select: { createdAt: true, costUsd: true } }),
    prisma.haggoRun.groupBy({ by: ['type', 'status'], where: { startedAt: { gte: new Date(`${period}-01T05:00:00Z`) } }, _count: { _all: true }, _sum: { costUsd: true } }),
  ])
  const perDay = new Map<string, number>()
  for (const c of calls) perDay.set(bogotaKey(c.createdAt), (perDay.get(bogotaKey(c.createdAt)) ?? 0) + c.costUsd)
  return {
    period,
    budget: { ...spend, monthlyUsd: cfg.monthlyBudgetUsd, dailyUsd: cfg.dailyBudgetUsd },
    byKind: byKind.map((r) => ({ kind: r.kind, provider: r.provider, calls: r._count._all, costUsd: r._sum.costUsd ?? 0, inputTokens: (r._sum.inputTokens ?? 0) + (r._sum.cacheReadTokens ?? 0), outputTokens: r._sum.outputTokens ?? 0 })),
    perDay: Array.from(perDay.entries()).sort().map(([day, costUsd]) => ({ day, costUsd: Math.round(costUsd * 10000) / 10000 })),
    runs: runsByType.map((r) => ({ type: r.type, status: r.status, count: r._count._all, costUsd: r._sum.costUsd ?? 0 })),
  }
}

/** For the dashboard and TV: short, cheap, never throws (Haggo's tables may not exist yet). */
export async function haggoBrief() {
  try {
    const [row, findings, decisions, pending, cycle] = await Promise.all([
      getHaggoRow(),
      prisma.haggoFinding.findMany({ where: { status: { in: ['new', 'seen'] } }, take: 30, select: { id: true, domain: true, severity: true, title: true, lastSeenAt: true } }),
      prisma.haggoAction.findMany({ where: { status: { in: ['executed', 'reverted', 'failed'] } }, orderBy: { updatedAt: 'desc' }, take: 5, select: { id: true, tool: true, reason: true, status: true, updatedAt: true } }),
      prisma.haggoAction.count({ where: { status: 'proposed' } }),
      lastOf('cycle'),
    ])
    const cfg = await getHaggoConfig(row)
    const spend = await haggoSpend(cfg)
    return {
      enabled: cfg.enabled, mode: cfg.mode, focus: row.focus, lastCycleAt: cycle?.startedAt ?? null, lastStatus: cycle?.status ?? null, lastSummary: cycle?.summary ?? null,
      findings: findings.sort(bySeverity).slice(0, 5).map((f) => ({ ...f, lastSeenAt: f.lastSeenAt.toISOString() })),
      counts: { critical: findings.filter((f) => f.severity === 'critical').length, warning: findings.filter((f) => f.severity === 'warning').length },
      decisions: decisions.map((d) => ({ ...d, label: actionLabel(d.tool), updatedAt: d.updatedAt.toISOString() })),
      pendingApprovals: pending,
      budget: { monthUsd: spend.monthUsd, monthlyUsd: cfg.monthlyBudgetUsd, blocked: spend.blocked },
    }
  } catch {
    return null
  }
}

export type HaggoBrief = NonNullable<Awaited<ReturnType<typeof haggoBrief>>>
