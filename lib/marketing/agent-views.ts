import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { campaignStats } from '@/lib/marketing/stats'
import { mkCan, type MarketingAccess, type MarketingPermission } from '@/lib/marketing/permissions'
import { KPI_LABEL } from '@/lib/marketing/agent-input'
import { campaignKpi } from '@/lib/marketing/agent-core'
import { agentSpend, configOf, loadAgent, modeFor, settingsOf, strategyOf, type Agent } from '@/lib/marketing/agent'

/** The agent if the person has `perm` in its workspace; otherwise a 404 (no hint that it exists). */
export async function agentFor(access: MarketingAccess, id: string, perm: MarketingPermission): Promise<{ agent: Agent } | { response: NextResponse }> {
  const agent = await loadAgent(id)
  if (!agent || !mkCan(access, agent.workspaceId, 'marketing.view')) return { response: NextResponse.json({ error: 'Agente no encontrado' }, { status: 404 }) }
  if (!mkCan(access, agent.workspaceId, perm)) return { response: NextResponse.json({ error: 'No tienes permiso para esta acción' }, { status: 403 }) }
  return { agent }
}

const PLAN_EVERY_MS = 6 * 3600_000

/** A row of the agents list: state, mode, cost this month and the KPI against the goal. */
export async function agentSummary(agent: Agent) {
  const config = configOf(agent)
  const [spent, stats, counts] = await Promise.all([
    agentSpend(agent.id),
    campaignStats(agent.campaignId),
    Promise.all([
      prisma.marketingIdea.count({ where: { agentId: agent.id, status: 'proposed' } }),
      prisma.marketingPost.count({ where: { agentId: agent.id, status: { in: ['review', 'draft'] } } }),
      prisma.marketingPost.count({ where: { agentId: agent.id, status: 'scheduled' } }),
      prisma.marketingPost.count({ where: { agentId: agent.id, status: { in: ['published', 'partial'] } } }),
    ]),
  ])
  const conversations = stats.posts.reduce((a, p) => a + p.inboxConversations, 0)
  const channels = (['INSTAGRAM', 'FACEBOOK', 'WEB'] as const).filter((c) => config.channels[c].enabled)
  return {
    id: agent.id,
    workspaceId: agent.workspaceId,
    campaign: { id: agent.campaign.id, name: agent.campaign.name, color: agent.campaign.color, objective: agent.campaign.objective, startsAt: agent.campaign.startsAt, endsAt: agent.campaign.endsAt },
    status: agent.status,
    mode: agent.mode,
    effectiveMode: modeFor(agent, [...channels]),
    degradedReason: agent.degradedReason,
    trialPostsRemaining: agent.trialPostsRemaining,
    strategyReady: Boolean(agent.strategy),
    strategyApprovedAt: agent.strategyApprovedAt,
    lastRunAt: agent.lastRunAt,
    nextPlanAt: agent.status === 'active' && agent.strategyApprovedAt ? new Date((agent.lastPlannedAt?.getTime() ?? Date.now()) + (agent.lastPlannedAt ? PLAN_EVERY_MS : 0)) : null,
    spentUsd: Math.round(spent * 100) / 100,
    monthlyBudgetUsd: agent.monthlyBudgetUsd,
    kpi: { key: config.kpi, label: KPI_LABEL[config.kpi], value: campaignKpi(config.kpi, stats.totals, conversations), goal: config.goal },
    counts: { ideasProposed: counts[0], toApprove: counts[1], upcoming: counts[2], published: counts[3] },
    channels,
  }
}

const postSelect = {
  id: true, title: true, status: true, pillar: true, scheduledAt: true, publishedAt: true, optOutDeadline: true, agentMeta: true, rejectedReason: true, ideaId: true, updatedAt: true,
  variants: { select: { channel: true, body: true, format: true, seoTitle: true } },
  media: { select: { url: true, kind: true }, orderBy: { position: 'asc' as const }, take: 3 },
  publications: { where: { status: { not: 'cancelled' } }, select: { channel: true, status: true, scheduledAt: true, publishedAt: true, permalink: true, connection: { select: { name: true } } } },
}

/** Everything the agent's screen shows. */
export async function agentDetail(agent: Agent, access: MarketingAccess) {
  const [summary, ideas, toApprove, upcoming, recent, runs, learnings] = await Promise.all([
    agentSummary(agent),
    prisma.marketingIdea.findMany({ where: { agentId: agent.id, status: { in: ['proposed', 'accepted', 'rejected', 'drafted'] }, targetDate: { gte: new Date(Date.now() - 30 * 24 * 3600_000) } }, orderBy: [{ status: 'asc' }, { targetDate: 'asc' }], take: 80 }),
    prisma.marketingPost.findMany({ where: { agentId: agent.id, status: { in: ['review', 'draft'] } }, select: postSelect, orderBy: { updatedAt: 'desc' }, take: 30 }),
    prisma.marketingPost.findMany({ where: { agentId: agent.id, status: { in: ['scheduled', 'approved', 'publishing'] } }, select: postSelect, orderBy: { scheduledAt: 'asc' }, take: 30 }),
    prisma.marketingPost.findMany({ where: { agentId: agent.id, status: { in: ['published', 'partial', 'failed'] } }, select: postSelect, orderBy: { publishedAt: 'desc' }, take: 10 }),
    prisma.marketingAgentRun.findMany({ where: { agentId: agent.id }, orderBy: { startedAt: 'desc' }, take: 40, select: { id: true, type: true, status: true, summary: true, error: true, costUsd: true, tokensIn: true, tokensOut: true, model: true, startedAt: true, finishedAt: true } }),
    prisma.marketingAgentLearning.findMany({ where: { agentId: agent.id }, orderBy: { createdAt: 'desc' }, take: 5 }),
  ])
  return {
    agent: {
      ...summary,
      config: configOf(agent),
      settings: settingsOf(agent),
      strategy: strategyOf(agent),
      strategyProposedAt: agent.strategyProposedAt,
      autonomyConfirmedAt: agent.autonomyConfirmedAt,
      campaign: { ...summary.campaign, description: agent.campaign.description },
    },
    ideas, toApprove, upcoming, recent, runs, learnings,
    permissions: { edit: mkCan(access, agent.workspaceId, 'marketing.edit'), publish: mkCan(access, agent.workspaceId, 'marketing.publish') },
  }
}
