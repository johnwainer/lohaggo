import type { MarketingChannel } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { latestSnapshots } from '@/lib/marketing/metrics'
import type { AgentConfig } from '@/lib/marketing/agent-input'
import { learningStats, type LearningRow, type LearningStats, type PostFeatures, type Rejection } from '@/lib/marketing/agent-core'
import type { Catalog, MomentFacts } from '@/lib/marketing/agent-prompt'

const DAY = 24 * 3600_000
/** Results count once the post has had two days to get its reach. */
export const MEASURE_AFTER_MS = 48 * 3600_000

export async function brandName(workspaceId: string) {
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true, isDefault: true } })
  return ws?.isDefault || !ws ? 'LoHaggo' : ws.name
}

/** Services the campaign promotes (or the whole catalog) with their base price, and active cities. */
export async function catalogFor(config: AgentConfig): Promise<Catalog & { prices: number[] }> {
  const [services, cities] = await Promise.all([
    prisma.service.findMany({
      where: config.offer.allServices || !config.offer.serviceIds.length ? {} : { id: { in: config.offer.serviceIds } },
      select: { name: true, basePrice: true, category: { select: { name: true } } },
      orderBy: [{ popular: 'desc' }, { name: 'asc' }],
      take: 80,
    }),
    prisma.cityConfig.findMany({ where: { status: 'ACTIVE' }, select: { name: true }, orderBy: { order: 'asc' }, take: 30 }),
  ])
  return {
    services: services.map((s) => ({ name: s.name.trim(), category: s.category?.name ?? null, basePrice: s.basePrice > 0 ? s.basePrice : null })),
    cities: cities.map((c) => c.name),
    prices: services.map((s) => s.basePrice).filter((p) => p > 0),
  }
}

const emptyFeatures = (): PostFeatures => ({ pillar: null, service: null, channels: [], format: {}, length: {}, hashtags: {}, weekday: null, hour: null, imageSource: null, cta: false, explore: false })

/**
 * One row per published send with at least 48 h of life: the post's features (hour and weekday of the
 * real publication), latest network metrics, blog views and inbox conversations on that post.
 * `agentId`: that agent's posts; `workspaceId`: every post of the workspace (for the hour table).
 */
export async function learningRows(scope: { agentId: string } | { workspaceId: string }, now = new Date(), days = 120): Promise<LearningRow[]> {
  const pubs = await prisma.marketingPublication.findMany({
    where: {
      status: 'published',
      publishedAt: { lte: new Date(now.getTime() - MEASURE_AFTER_MS), gte: new Date(now.getTime() - days * DAY) },
      post: 'agentId' in scope ? { agentId: scope.agentId } : { workspaceId: scope.workspaceId },
    },
    select: { id: true, channel: true, publishedAt: true, externalId: true, variantId: true, post: { select: { id: true, title: true, features: true } } },
    orderBy: { publishedAt: 'desc' },
    take: 400,
  })
  if (!pubs.length) return []
  const snaps = await latestSnapshots(pubs.filter((p) => p.channel !== 'WEB').map((p) => p.id))
  const webIds = pubs.filter((p) => p.channel === 'WEB').map((p) => p.variantId)
  const views = webIds.length ? await prisma.webPageView.groupBy({ by: ['variantId'], where: { variantId: { in: webIds } }, _sum: { views: true } }) : []
  const externalIds = pubs.map((p) => p.externalId).filter((x): x is string => Boolean(x))
  const convs = externalIds.length ? await prisma.conversation.groupBy({ by: ['postId'], where: { postId: { in: externalIds } }, _count: { _all: true } }) : []
  const viewsBy = new Map(views.map((v) => [v.variantId, v._sum.views ?? 0]))
  const convBy = new Map(convs.map((c) => [c.postId, c._count._all]))
  return pubs.map((p) => {
    const s = snaps.get(p.id)
    const at = new Date(p.publishedAt!.getTime() - 5 * 3600_000)
    const features: PostFeatures = { ...emptyFeatures(), ...((p.post.features as Partial<PostFeatures> | null) ?? {}), weekday: at.getUTCDay(), hour: at.getUTCHours() }
    return {
      postId: p.post.id,
      title: p.post.title,
      channel: p.channel as MarketingChannel,
      publishedAt: p.publishedAt!,
      features,
      metrics: {
        reach: s?.reach ?? 0, likes: s?.likes ?? 0, comments: s?.comments ?? 0, shares: s?.shares ?? 0, saves: s?.saves ?? 0, clicks: s?.clicks ?? 0,
        webViews: p.channel === 'WEB' ? viewsBy.get(p.variantId) ?? 0 : 0,
        conversations: p.externalId ? convBy.get(p.externalId) ?? 0 : 0,
      },
    }
  })
}

/** Ideas and agent posts people rejected, with their reason (the agent learns what not to propose). */
export async function rejectionsFor(agentId: string, now = new Date(), days = 60): Promise<Rejection[]> {
  const since = new Date(now.getTime() - days * DAY)
  const [ideas, posts] = await Promise.all([
    prisma.marketingIdea.findMany({ where: { agentId, status: 'rejected', updatedAt: { gte: since } }, select: { pillar: true, service: true, angle: true, rejectedReason: true }, orderBy: { updatedAt: 'desc' }, take: 30 }),
    prisma.marketingPost.findMany({ where: { agentId, rejectedReason: { not: null }, updatedAt: { gte: since } }, select: { pillar: true, title: true, rejectedReason: true, agentMeta: true }, orderBy: { updatedAt: 'desc' }, take: 30 }),
  ])
  return [
    ...ideas.map((i) => ({ kind: 'idea' as const, pillar: i.pillar, service: i.service, reason: i.rejectedReason, what: i.angle })),
    ...posts.map((p) => ({ kind: 'post' as const, pillar: p.pillar, service: (p.agentMeta as { service?: string } | null)?.service ?? null, reason: p.rejectedReason, what: p.title })),
  ]
}

/** What the agent already has in the horizon: its scheduled posts per channel and its open ideas. */
export async function plannedPieces(agentId: string, now: Date, horizonDays: number) {
  const end = new Date(now.getTime() + horizonDays * DAY)
  const [pubs, drafts, ideas] = await Promise.all([
    prisma.marketingPublication.findMany({ where: { post: { agentId }, status: { in: ['scheduled', 'publishing', 'processing', 'published'] }, scheduledAt: { gte: now, lte: end } }, select: { channel: true, scheduledAt: true, postId: true } }),
    // Written but not scheduled yet (in review, approved): they will take a slot near their idea's day
    prisma.marketingPost.findMany({ where: { agentId, status: { in: ['draft', 'review', 'approved'] } }, select: { id: true, ideaId: true, variants: { select: { channel: true } } } }),
    prisma.marketingIdea.findMany({ where: { agentId, status: { in: ['proposed', 'accepted', 'drafted'] }, targetDate: { gte: new Date(now.getTime() - DAY), lte: end } }, select: { id: true, channels: true, targetDate: true, postId: true, status: true } }),
  ])
  const out: Array<{ channel: MarketingChannel; at: Date }> = pubs.map((p) => ({ channel: p.channel, at: p.scheduledAt }))
  const scheduledPosts = new Set(pubs.map((p) => p.postId))
  const ideaDate = new Map(ideas.map((i) => [i.id, i.targetDate]))
  for (const d of drafts) {
    if (scheduledPosts.has(d.id)) continue
    const at = (d.ideaId && ideaDate.get(d.ideaId)) || new Date(now.getTime() + DAY)
    for (const v of d.variants) out.push({ channel: v.channel, at })
  }
  for (const i of ideas) {
    if (i.status === 'drafted' || i.postId) continue
    for (const c of i.channels) if (c === 'WEB' || c === 'FACEBOOK' || c === 'INSTAGRAM') out.push({ channel: c, at: i.targetDate })
  }
  return out
}

/** Services and angles of the agent's recent and upcoming pieces (to avoid repeating them). */
export async function recentTopics(agentId: string, now: Date, days: number) {
  const since = new Date(now.getTime() - Math.max(days, 1) * DAY)
  const ideas = await prisma.marketingIdea.findMany({
    where: { agentId, status: { in: ['proposed', 'accepted', 'drafted'] }, targetDate: { gte: since } },
    select: { service: true, angle: true, targetDate: true },
    take: 200,
  })
  return ideas.map((i) => ({ service: i.service, angle: i.angle, at: i.targetDate }))
}

/** Times already taken in a channel by any account of the workspace (scheduled or out), for spacing. */
export async function takenSlots(workspaceId: string, channel: MarketingChannel, from: Date, to: Date, excludePostId?: string) {
  const pubs = await prisma.marketingPublication.findMany({
    where: {
      channel,
      status: { in: ['scheduled', 'publishing', 'processing', 'published'] },
      post: { workspaceId },
      ...(excludePostId ? { postId: { not: excludePostId } } : {}),
      OR: [{ scheduledAt: { gte: from, lte: to } }, { publishedAt: { gte: from, lte: to } }],
    },
    select: { scheduledAt: true, publishedAt: true },
    take: 500,
  })
  return pubs.map((p) => p.publishedAt ?? p.scheduledAt)
}

/** Everything the "moment" block of the prompt needs. */
export async function momentFacts(agent: { id: string; workspaceId: string; horizonDays: number }, config: AgentConfig, now = new Date()): Promise<{ facts: MomentFacts; stats: LearningStats | null }> {
  const end = new Date(now.getTime() + agent.horizonDays * DAY)
  const [pubs, ideas, learning, rows, rejections, editor] = await Promise.all([
    prisma.marketingPublication.findMany({
      where: { post: { workspaceId: agent.workspaceId }, status: { in: ['scheduled', 'publishing', 'processing', 'published'] }, scheduledAt: { gte: new Date(now.getTime() - 14 * DAY), lte: end } },
      select: { channel: true, scheduledAt: true, publishedAt: true, status: true, post: { select: { title: true, pillar: true } } },
      orderBy: { scheduledAt: 'asc' },
      take: 60,
    }),
    prisma.marketingIdea.findMany({ where: { agentId: agent.id, status: { in: ['proposed', 'accepted'] }, targetDate: { gte: now, lte: end } }, select: { angle: true, pillar: true, channels: true, targetDate: true, status: true }, take: 40 }),
    prisma.marketingAgentLearning.findFirst({ where: { agentId: agent.id }, orderBy: { createdAt: 'desc' }, select: { insights: true } }),
    learningRows({ agentId: agent.id }, now),
    rejectionsFor(agent.id, now),
    // What the editor had to ask on this agent's recent pieces: learned so the first version already avoids it
    prisma.marketingReview.findMany({ where: { agentId: agent.id, reviewer: 'editor', verdict: { in: ['changes', 'rejected'] }, createdAt: { gte: new Date(now.getTime() - 30 * DAY) } }, orderBy: { createdAt: 'desc' }, take: 20, select: { instructions: true } }).catch(() => []),
  ])
  const editorNotes = Array.from(new Set(editor.flatMap((r) => ((r.instructions as Array<{ change?: unknown }> | null) ?? []).map((i) => (typeof i.change === 'string' ? i.change.trim().slice(0, 240) : '')).filter(Boolean)))).slice(0, 8)
  const stats = rows.length ? learningStats(rows, config.kpi, rejections) : null
  const bodies = stats ? await prisma.marketingPostVariant.findMany({ where: { postId: { in: [...stats.best, ...stats.worst].map((p) => p.postId) } }, select: { postId: true, channel: true, body: true } }) : []
  const textOf = (postId: string) => bodies.find((b) => b.postId === postId && b.channel !== 'WEB')?.body ?? bodies.find((b) => b.postId === postId)?.body ?? ''
  const result = (lift: number) => `${lift.toFixed(2).replace('.', ',')}× la media`
  return {
    stats,
    facts: {
      now,
      calendar: [
        ...pubs.map((p) => ({ at: p.publishedAt ?? p.scheduledAt, channel: p.channel, title: p.post.title, pillar: p.post.pillar, status: p.status === 'published' ? 'publicada' : 'programada' })),
        ...ideas.flatMap((i) => i.channels.filter((c): c is MarketingChannel => c === 'WEB' || c === 'FACEBOOK' || c === 'INSTAGRAM').map((c) => ({ at: i.targetDate, channel: c, title: i.angle, pillar: i.pillar, status: i.status === 'proposed' ? 'idea propuesta' : 'idea aceptada' }))),
      ],
      learnings: learning?.insights ?? null,
      stats,
      best: stats ? stats.best.map((p) => ({ title: p.title, text: textOf(p.postId), result: result(p.lift) })) : [],
      worst: stats ? stats.worst.map((p) => ({ title: p.title, text: textOf(p.postId), result: result(p.lift) })) : [],
      editorNotes,
      rejected: rejections.slice(0, 15).map((r) => ({ what: `${r.kind === 'idea' ? 'Idea' : 'Pieza'}: ${r.what ?? r.pillar ?? ''}`, reason: r.reason })),
    },
  }
}
