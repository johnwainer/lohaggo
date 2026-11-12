/**
 * What the SEO agent shows: the admin panel, Haggo's snapshot and its read tool all read from here, so
 * the three say the same thing. Every query falls back to empty (before the SQL runs the tables do not exist).
 */
import { prisma } from '@/lib/prisma'
import { getSeoSettings } from '@/lib/seo/agent/settings'
import { seoSpend } from '@/lib/seo/agent/agent'
import { webMarketingAgent } from '@/lib/seo/agent/marketing-bridge'
import type { SeoConfig } from '@/lib/seo/agent/settings-core'
import type { SeoBrief } from '@/lib/seo/agent/types'

const H = 3_600_000

export type SeoOpportunityView = {
  id: string; kind: string; title: string; detail: string | null; targetUrl: string | null; keyword: string | null; serviceSlug: string | null; citySlug: string | null
  score: number; impact: string; effort: string; status: string; source: string; evidence: unknown; brief: SeoBrief | null; briefedAt: string | null
  marketingIdeaId: string | null; dismissedReason: string | null; createdAt: string; resolvedAt: string | null
}

export type SeoCycleOutput = {
  health?: { score: number; parts: Array<{ label: string; score: number }> }
  gsc?: { state: 'ok' | 'off' | 'no_account' | 'no_access' | 'error'; message: string; serviceEmail?: string | null; days: number | null; clicks: number; impressions: number; top: Array<{ query: string; clicks: number; impressions: number; position: number }>; topPages: Array<{ path: string; clicks: number; impressions: number }> }
  pages?: Array<{ path: string; status: number | null; words: number; issues: Array<{ code: string; severity: 'critical' | 'warning' | 'info'; message: string }> }>
  counts?: { services: number; articles: number; zeroSearches: number; thinPartnerProfiles: number }
  unavailable?: string[]
  aiNote?: string | null
}

export type SeoReportOutput = { summary: string; findings: string[]; forMarketing: string[]; proposals: string[] }

export type SeoOverview = {
  config: SeoConfig
  tablesReady: boolean
  spend: { month: number; budget: number }
  lastCycle: { id: string; at: string; status: string; trigger: string; summary: string | null; error: string | null; output: SeoCycleOutput | null } | null
  lastReport: { at: string; output: SeoReportOutput } | null
  counts: { open: number; briefed: number; sent: number; done: number; dismissed: number; highOpen: number }
  byKind: Array<{ kind: string; open: number }>
  opportunities: SeoOpportunityView[]
  runs: Array<{ id: string; type: string; status: string; trigger: string; summary: string | null; error: string | null; costUsd: number; startedAt: string; finishedAt: string | null }>
  marketing: { agentId: string | null; ideasProposed: number }
}

const iso = (d: Date | null) => (d ? d.toISOString() : null)

export async function seoOverview(): Promise<SeoOverview> {
  const config = await getSeoSettings()
  let tablesReady = true
  const guard = async <T,>(p: PromiseLike<T>, fallback: T): Promise<T> => {
    try { return await p } catch { tablesReady = false; return fallback }
  }
  const [rows, cycle, report, runs, byStatus, byKind, spend, agent, proposed] = await Promise.all([
    guard(prisma.seoOpportunity.findMany({ where: { OR: [{ status: { in: ['open', 'briefed', 'sent'] } }, { resolvedAt: { gte: new Date(Date.now() - 14 * 24 * H) } }] }, orderBy: { score: 'desc' }, take: 300 }), []),
    guard(prisma.seoRun.findFirst({ where: { type: 'cycle' }, orderBy: { startedAt: 'desc' } }), null),
    guard(prisma.seoRun.findFirst({ where: { type: 'report', status: 'ok' }, orderBy: { startedAt: 'desc' }, select: { startedAt: true, output: true } }), null),
    guard(prisma.seoRun.findMany({ orderBy: { startedAt: 'desc' }, take: 20 }), []),
    guard(prisma.seoOpportunity.groupBy({ by: ['status'], _count: { _all: true } }), []),
    guard(prisma.seoOpportunity.groupBy({ by: ['kind'], where: { status: { in: ['open', 'briefed'] } }, _count: { _all: true } }), []),
    guard(seoSpend(), 0),
    webMarketingAgent().catch(() => null),
    guard(prisma.marketingIdea.count({ where: { status: 'proposed', channels: { has: 'WEB' } } }), 0),
  ])
  const n = (s: string) => byStatus.find((r) => r.status === s)?._count._all ?? 0
  return {
    config, tablesReady, spend: { month: Math.round(spend * 100) / 100, budget: config.monthlyBudgetUsd },
    lastCycle: cycle ? { id: cycle.id, at: cycle.startedAt.toISOString(), status: cycle.status, trigger: cycle.trigger, summary: cycle.summary, error: cycle.error, output: (cycle.output as SeoCycleOutput | null) ?? null } : null,
    lastReport: report ? { at: report.startedAt.toISOString(), output: report.output as SeoReportOutput } : null,
    counts: { open: n('open'), briefed: n('briefed'), sent: n('sent'), done: n('done'), dismissed: n('dismissed'), highOpen: rows.filter((r) => ['open', 'briefed'].includes(r.status) && r.impact === 'high').length },
    byKind: byKind.map((k) => ({ kind: k.kind, open: k._count._all })),
    opportunities: rows.map((r) => ({
      id: r.id, kind: r.kind, title: r.title, detail: r.detail, targetUrl: r.targetUrl, keyword: r.keyword, serviceSlug: r.serviceSlug, citySlug: r.citySlug,
      score: r.score, impact: r.impact, effort: r.effort, status: r.status, source: r.source, evidence: r.evidence, brief: (r.brief as SeoBrief | null) ?? null, briefedAt: iso(r.briefedAt),
      marketingIdeaId: r.marketingIdeaId, dismissedReason: r.dismissedReason, createdAt: r.createdAt.toISOString(), resolvedAt: iso(r.resolvedAt),
    })),
    runs: runs.map((r) => ({ id: r.id, type: r.type, status: r.status, trigger: r.trigger, summary: r.summary, error: r.error, costUsd: r.costUsd, startedAt: r.startedAt.toISOString(), finishedAt: iso(r.finishedAt) })),
    marketing: { agentId: agent?.id ?? null, ideasProposed: proposed },
  }
}

/** The small picture Haggo reads each cycle (numbers only). */
export type SeoSnapshot = {
  enabled: boolean
  tablesReady: boolean
  hoursSinceCycle: number | null
  lastCycleFailed: boolean
  health: number | null
  open: number
  highOpen: number
  gsc: 'ok' | 'off' | 'no_account' | 'no_access' | 'error' | 'unknown'
  pagesWithCritical: Array<{ path: string; message: string }>
  briefsWaiting: number
  budgetPct: number
  noMarketingAgent: boolean
}

export async function seoSnapshot(now = new Date()): Promise<SeoSnapshot> {
  const o = await seoOverview()
  const out = o.lastCycle?.output
  const critical = (out?.pages ?? []).flatMap((p) => p.issues.filter((i) => i.severity === 'critical').map((i) => ({ path: p.path, message: i.message }))).slice(0, 6)
  return {
    enabled: o.config.enabled, tablesReady: o.tablesReady,
    hoursSinceCycle: o.lastCycle ? Math.round((now.getTime() - new Date(o.lastCycle.at).getTime()) / H) : null,
    lastCycleFailed: o.lastCycle?.status === 'error',
    health: out?.health?.score ?? null, open: o.counts.open + o.counts.briefed, highOpen: o.counts.highOpen,
    gsc: out?.gsc?.state ?? 'unknown', pagesWithCritical: critical,
    briefsWaiting: o.opportunities.filter((x) => x.status === 'briefed' && x.brief).length,
    budgetPct: o.spend.budget > 0 ? Math.round((o.spend.month / o.spend.budget) * 100) : 0,
    noMarketingAgent: !o.marketing.agentId,
  }
}
