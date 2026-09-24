import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { emptyTotals, engagementRate, latestSnapshots, type MetricTotals } from '@/lib/marketing/metrics'

type PubRow = Prisma.MarketingPublicationGetPayload<{ select: typeof pubSelect }>
const pubSelect = {
  id: true, postId: true, channel: true, externalId: true, permalink: true, publishedAt: true, variantId: true,
  connection: { select: { name: true } },
  post: { select: { title: true, campaignId: true, campaign: { select: { name: true, color: true } } } },
} satisfies Prisma.MarketingPublicationSelect

const add = (t: MetricTotals, s: Partial<MetricTotals>) => {
  for (const k of Object.keys(t) as Array<keyof MetricTotals>) t[k] += Number(s[k] ?? 0)
}

/** Totals by channel, post and campaign from the latest snapshot of each publication + blog views + inbox comments. */
async function aggregate(pubs: PubRow[], range: { from?: string; to?: string } = {}) {
  const snaps = await latestSnapshots(pubs.filter((p) => p.channel !== 'WEB').map((p) => p.id))
  const webVariantIds = pubs.filter((p) => p.channel === 'WEB').map((p) => p.variantId)
  const views = webVariantIds.length
    ? await prisma.webPageView.findMany({ where: { variantId: { in: webVariantIds }, ...(range.from || range.to ? { day: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } } : {}) }, select: { variantId: true, day: true, views: true } })
    : []
  const viewsByVariant = new Map<string, number>()
  const viewsByDay = new Map<string, number>()
  for (const v of views) {
    viewsByVariant.set(v.variantId, (viewsByVariant.get(v.variantId) ?? 0) + v.views)
    viewsByDay.set(v.day, (viewsByDay.get(v.day) ?? 0) + v.views)
  }
  // Comments received in the inbox on these posts (comment conversations carry the network's post id)
  const externalIds = pubs.map((p) => p.externalId).filter((x): x is string => Boolean(x))
  const comments = externalIds.length
    ? await prisma.conversation.groupBy({ by: ['postId'], where: { postId: { in: externalIds } }, _count: { _all: true } })
    : []
  const convByPost = new Map(comments.map((c) => [c.postId, c._count._all]))

  const totals = emptyTotals()
  const byChannel: Record<string, MetricTotals & { publications: number }> = {}
  const byPost = new Map<string, { postId: string; title: string; campaign: string | null; channels: Set<string>; totals: MetricTotals; inboxConversations: number; publishedAt: Date | null; links: Array<{ channel: string; account: string | null; permalink: string | null }> }>()
  const byCampaign = new Map<string, { campaignId: string; name: string; color: string; posts: Set<string>; totals: MetricTotals }>()

  for (const p of pubs) {
    const s = snaps.get(p.id)
    const t: Partial<MetricTotals> = p.channel === 'WEB'
      ? { webViews: viewsByVariant.get(p.variantId) ?? 0 }
      : s ? { reach: s.reach, impressions: s.impressions, likes: s.likes, comments: s.comments, shares: s.shares, saves: s.saves, clicks: s.clicks, videoViews: s.videoViews } : {}
    add(totals, t)
    const ch = (byChannel[p.channel] ??= { ...emptyTotals(), publications: 0 })
    ch.publications++
    add(ch, t)
    const row = byPost.get(p.postId) ?? { postId: p.postId, title: p.post.title, campaign: p.post.campaign?.name ?? null, channels: new Set<string>(), totals: emptyTotals(), inboxConversations: 0, publishedAt: p.publishedAt, links: [] }
    row.channels.add(p.channel)
    add(row.totals, t)
    row.inboxConversations += p.externalId ? convByPost.get(p.externalId) ?? 0 : 0
    row.links.push({ channel: p.channel, account: p.connection?.name ?? null, permalink: p.permalink })
    if (p.publishedAt && (!row.publishedAt || p.publishedAt < row.publishedAt)) row.publishedAt = p.publishedAt
    byPost.set(p.postId, row)
    if (p.post.campaignId && p.post.campaign) {
      const c = byCampaign.get(p.post.campaignId) ?? { campaignId: p.post.campaignId, name: p.post.campaign.name, color: p.post.campaign.color, posts: new Set<string>(), totals: emptyTotals() }
      c.posts.add(p.postId)
      add(c.totals, t)
      byCampaign.set(p.post.campaignId, c)
    }
  }

  const publishedByDay = new Map<string, number>()
  for (const p of pubs) if (p.publishedAt) publishedByDay.set(p.publishedAt.toISOString().slice(0, 10), (publishedByDay.get(p.publishedAt.toISOString().slice(0, 10)) ?? 0) + 1)
  const days = Array.from(new Set(Array.from(viewsByDay.keys()).concat(Array.from(publishedByDay.keys())))).sort()

  return {
    totals: { ...totals, engagementRate: engagementRate(totals), publications: pubs.length, posts: byPost.size },
    byChannel: Object.entries(byChannel).map(([channel, t]) => ({ channel, ...t, engagementRate: engagementRate(t) })),
    posts: Array.from(byPost.values())
      .map((r) => ({ ...r, channels: Array.from(r.channels), engagementRate: engagementRate(r.totals) }))
      .sort((a, b) => (b.totals.reach + b.totals.webViews) - (a.totals.reach + a.totals.webViews)),
    campaigns: Array.from(byCampaign.values()).map((c) => ({ ...c, posts: c.posts.size, engagementRate: engagementRate(c.totals) })),
    series: days.map((day) => ({ day, webViews: viewsByDay.get(day) ?? 0, published: publishedByDay.get(day) ?? 0 })),
  }
}

export async function workspaceStats(opts: { workspaceIds: string[] | null; from: Date; to: Date; campaignId?: string | null; channel?: string | null }) {
  const pubs = await prisma.marketingPublication.findMany({
    where: {
      status: 'published',
      publishedAt: { gte: opts.from, lte: opts.to },
      ...(opts.channel ? { channel: opts.channel as never } : {}),
      post: { ...(opts.workspaceIds ? { workspaceId: { in: opts.workspaceIds } } : {}), ...(opts.campaignId ? { campaignId: opts.campaignId } : {}) },
    },
    select: pubSelect,
    take: 2000,
  })
  return aggregate(pubs, { from: opts.from.toISOString().slice(0, 10), to: opts.to.toISOString().slice(0, 10) })
}

export async function campaignStats(campaignId: string) {
  const pubs = await prisma.marketingPublication.findMany({ where: { status: 'published', post: { campaignId } }, select: pubSelect, take: 2000 })
  return aggregate(pubs)
}
