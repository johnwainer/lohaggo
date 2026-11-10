import type { Prisma } from '@prisma/client'
import { channelLines } from '@/lib/marketing/format-display'
import { prisma } from '@/lib/prisma'
import { emptyTotals, engagementRate, latestSnapshots, type MetricTotals } from '@/lib/marketing/metrics'
import { postChats, postResults, type PostResult } from '@/lib/marketing/post-results'

type PubRow = Prisma.MarketingPublicationGetPayload<{ select: typeof pubSelect }>
const pubSelect = {
  id: true, postId: true, channel: true, externalId: true, permalink: true, publishedAt: true, variantId: true,
  connection: { select: { name: true } },
  post: { select: { title: true, campaignId: true, campaign: { select: { name: true, color: true } } } },
} satisfies Prisma.MarketingPublicationSelect

const add = (t: MetricTotals, s: Partial<MetricTotals>) => {
  for (const k of Object.keys(t) as Array<keyof MetricTotals>) t[k] += Number(s[k] ?? 0)
}

/** What a send brought: chats (comments in the inbox + WhatsApp chats from the post's link), requests and bookings. */
export type Outcomes = { conversations: number; requests: number; bookings: number }
const emptyOutcomes = (): Outcomes => ({ conversations: 0, requests: 0, bookings: 0 })
const addOutcomes = (t: Outcomes, o: Outcomes) => { t.conversations += o.conversations; t.requests += o.requests; t.bookings += o.bookings }

/**
 * A post's results split by send (pure): requests and bookings go to the channel they came through, the
 * ones without channel and the post's WhatsApp chats to its first send; comments to the send they are on.
 */
export function outcomesBySend(pubs: Array<{ id: string; postId: string; channel: string; publishedAt: Date | null }>, results: Map<string, PostResult>, chats: Map<string, number>, comments: Map<string, number>) {
  const first = new Map<string, { id: string; at: number }>()
  for (const p of pubs) {
    const at = p.publishedAt?.getTime() ?? Infinity
    const cur = first.get(p.postId)
    if (!cur || at < cur.at) first.set(p.postId, { id: p.id, at })
  }
  const out = new Map<string, Outcomes>()
  for (const p of pubs) {
    const r = results.get(p.postId)
    const isFirst = first.get(p.postId)?.id === p.id
    const ch = r?.byChannel[p.channel as keyof PostResult['byChannel']] ?? { requests: 0, bookings: 0 }
    const credited = r ? Object.values(r.byChannel).reduce((a, c) => ({ requests: a.requests + (c?.requests ?? 0), bookings: a.bookings + (c?.bookings ?? 0) }), { requests: 0, bookings: 0 }) : { requests: 0, bookings: 0 }
    const rest = isFirst && r ? { requests: r.requests - credited.requests, bookings: r.bookings - credited.bookings } : { requests: 0, bookings: 0 }
    out.set(p.id, {
      conversations: (comments.get(p.id) ?? 0) + (isFirst ? chats.get(p.postId) ?? 0 : 0),
      requests: ch.requests + rest.requests,
      bookings: ch.bookings + rest.bookings,
    })
  }
  return out
}

/** Totals by channel, format, post and campaign from the latest snapshot of each publication + blog views + inbox chats + requests. */
async function aggregate(pubs: PubRow[], range: { from?: string; to?: string; since: Date }) {
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
  const commentsByPub = new Map(pubs.map((p) => [p.id, p.externalId ? convByPost.get(p.externalId) ?? 0 : 0]))

  // Format of each network's version (Reel, Historia, Carrusel…), and what each post brought
  const postIds = Array.from(new Set(pubs.map((p) => p.postId)))
  const [fmtVariants, fmtMedia, results, chats] = postIds.length
    ? await Promise.all([
      prisma.marketingPostVariant.findMany({ where: { postId: { in: postIds } }, select: { postId: true, channel: true, format: true, mediaIds: true, linkUrl: true, publishOptions: true } }),
      prisma.marketingMedia.findMany({ where: { postId: { in: postIds } }, select: { id: true, postId: true, kind: true }, orderBy: { position: 'asc' } }),
      postResults(postIds, range.since),
      postChats(postIds, range.since),
    ])
    : [[], [], new Map<string, PostResult>(), new Map<string, number>()]
  const formatsOf = (postId: string): Record<string, string> => Object.fromEntries(channelLines(fmtVariants.filter((v) => v.postId === postId), fmtMedia.filter((m) => m.postId === postId), []).map((l) => [l.channel, l.format]))
  const formatCache = new Map<string, Record<string, string>>()
  const formatOf = (postId: string, channel: string) => {
    if (!formatCache.has(postId)) formatCache.set(postId, formatsOf(postId))
    return formatCache.get(postId)![channel] ?? null
  }
  const outcomes = outcomesBySend(pubs, results, chats, commentsByPub)

  const totals = emptyTotals()
  const totalOutcomes = emptyOutcomes()
  const byChannel: Record<string, MetricTotals & Outcomes & { publications: number }> = {}
  const byFormat = new Map<string, { channel: string; format: string; publications: number; totals: MetricTotals; outcomes: Outcomes }>()
  const byPost = new Map<string, { postId: string; title: string; campaign: string | null; channels: Set<string>; totals: MetricTotals; inboxConversations: number; outcomes: Outcomes; publishedAt: Date | null; links: Array<{ channel: string; account: string | null; permalink: string | null }> }>()
  const byCampaign = new Map<string, { campaignId: string; name: string; color: string; posts: Set<string>; totals: MetricTotals; outcomes: Outcomes }>()

  for (const p of pubs) {
    const s = snaps.get(p.id)
    const t: Partial<MetricTotals> = p.channel === 'WEB'
      ? { webViews: viewsByVariant.get(p.variantId) ?? 0 }
      : s ? { reach: s.reach, impressions: s.impressions, likes: s.likes, comments: s.comments, shares: s.shares, saves: s.saves, clicks: s.clicks, videoViews: s.videoViews } : {}
    const o = outcomes.get(p.id) ?? emptyOutcomes()
    add(totals, t)
    addOutcomes(totalOutcomes, o)
    const ch = (byChannel[p.channel] ??= { ...emptyTotals(), ...emptyOutcomes(), publications: 0 })
    ch.publications++
    add(ch, t)
    addOutcomes(ch, o)
    const format = formatOf(p.postId, p.channel) ?? (p.channel === 'WEB' ? 'Artículo' : 'Publicación')
    const fk = `${p.channel}:${format}`
    const f = byFormat.get(fk) ?? { channel: p.channel, format, publications: 0, totals: emptyTotals(), outcomes: emptyOutcomes() }
    f.publications++
    add(f.totals, t)
    addOutcomes(f.outcomes, o)
    byFormat.set(fk, f)
    const row = byPost.get(p.postId) ?? { postId: p.postId, title: p.post.title, campaign: p.post.campaign?.name ?? null, channels: new Set<string>(), totals: emptyTotals(), inboxConversations: 0, outcomes: emptyOutcomes(), publishedAt: p.publishedAt, links: [] }
    row.channels.add(p.channel)
    add(row.totals, t)
    addOutcomes(row.outcomes, o)
    row.inboxConversations += commentsByPub.get(p.id) ?? 0
    row.links.push({ channel: p.channel, account: p.connection?.name ?? null, permalink: p.permalink })
    if (p.publishedAt && (!row.publishedAt || p.publishedAt < row.publishedAt)) row.publishedAt = p.publishedAt
    byPost.set(p.postId, row)
    if (p.post.campaignId && p.post.campaign) {
      const c = byCampaign.get(p.post.campaignId) ?? { campaignId: p.post.campaignId, name: p.post.campaign.name, color: p.post.campaign.color, posts: new Set<string>(), totals: emptyTotals(), outcomes: emptyOutcomes() }
      c.posts.add(p.postId)
      add(c.totals, t)
      addOutcomes(c.outcomes, o)
      byCampaign.set(p.post.campaignId, c)
    }
  }

  const publishedByDay = new Map<string, number>()
  for (const p of pubs) if (p.publishedAt) publishedByDay.set(p.publishedAt.toISOString().slice(0, 10), (publishedByDay.get(p.publishedAt.toISOString().slice(0, 10)) ?? 0) + 1)
  const days = Array.from(new Set(Array.from(viewsByDay.keys()).concat(Array.from(publishedByDay.keys())))).sort()
  const score = (o: Outcomes) => o.bookings * 5 + o.requests * 3 + o.conversations

  return {
    totals: { ...totals, ...totalOutcomes, engagementRate: engagementRate(totals), publications: pubs.length, posts: byPost.size },
    byChannel: Object.entries(byChannel).map(([channel, t]) => ({ channel, ...t, engagementRate: engagementRate(t) })),
    byFormat: Array.from(byFormat.values())
      .map((f) => ({ ...f, engagementRate: engagementRate(f.totals) }))
      .sort((a, b) => score(b.outcomes) - score(a.outcomes) || (b.totals.reach + b.totals.webViews) - (a.totals.reach + a.totals.webViews)),
    posts: Array.from(byPost.values())
      .map((r) => ({ ...r, channels: Array.from(r.channels), formats: formatCache.get(r.postId) ?? formatsOf(r.postId), engagementRate: engagementRate(r.totals) }))
      .sort((a, b) => score(b.outcomes) - score(a.outcomes) || (b.totals.reach + b.totals.webViews) - (a.totals.reach + a.totals.webViews)),
    campaigns: Array.from(byCampaign.values()).map((c) => ({ ...c, posts: c.posts.size, engagementRate: engagementRate(c.totals) })),
    series: days.map((day) => ({ day, webViews: viewsByDay.get(day) ?? 0, published: publishedByDay.get(day) ?? 0 })),
  }
}

/**
 * Where the platform's conversations, requests and bookings of the period came from (Analítica → Origen,
 * last touch, the whole platform): Google, ChatGPT, the inbox, social posts, ads. Null when it cannot be read.
 */
async function sourcesFor(from: Date, to: Date) {
  try {
    const { originsTab } = await import('@/lib/analytics/origins')
    const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000))
    const span = to.getTime() - from.getTime()
    const r = await originsTab({ from, to, prevFrom: new Date(from.getTime() - span), prevTo: from, days, label: `${days} días` }, 'last')
    return {
      totals: { conversations: r.totals.conversations, requests: r.totals.requests, bookings: r.totals.bookings },
      channels: r.channels.slice(0, 12).map((c) => ({ key: c.key, label: c.channelLabel, conversations: c.conversations, requests: c.requests, bookings: c.bookings })),
      requestsWithoutData: r.requestsWithoutData,
    }
  } catch {
    return null
  }
}

export async function workspaceStats(opts: { workspaceIds: string[] | null; from: Date; to: Date; campaignId?: string | null; channel?: string | null; withSources?: boolean }) {
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
  const [stats, sources] = await Promise.all([
    aggregate(pubs, { from: opts.from.toISOString().slice(0, 10), to: opts.to.toISOString().slice(0, 10), since: opts.from }),
    opts.withSources ? sourcesFor(opts.from, opts.to) : Promise.resolve(null),
  ])
  return { ...stats, sources }
}

export async function campaignStats(campaignId: string) {
  const pubs = await prisma.marketingPublication.findMany({ where: { status: 'published', post: { campaignId } }, select: pubSelect, take: 2000 })
  const first = pubs.reduce<Date | null>((a, p) => (p.publishedAt && (!a || p.publishedAt < a) ? p.publishedAt : a), null)
  return aggregate(pubs, { since: first ?? new Date(Date.now() - 365 * 86_400_000) })
}
