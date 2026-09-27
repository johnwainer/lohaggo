import { prisma } from '@/lib/prisma'
import { bogotaDay, type Period } from '@/lib/analytics/core'
import { spendWithoutRequests, summarizeOrigins, type AttributionModel } from '@/lib/analytics/origins-core'
import { spendByDraft, spendDays } from '@/lib/marketing/ad-spend'

/**
 * Analítica → Origen: the conversations, requests and bookings of the period grouped by where they came
 * from. Requests and bookings are those created in the period (a booking counts where its request came from).
 */
export async function originsTab(period: Period, model: AttributionModel = 'last') {
  const range = { gte: period.from, lte: period.to }
  const [conversations, requests, bookings, drafts, spend] = await Promise.all([
    prisma.conversation.findMany({ where: { createdAt: range }, select: { id: true, channel: true, customFields: true }, take: 20000 }),
    prisma.serviceRequest.findMany({ where: { createdAt: range }, select: { id: true, acquisition: true, lastTouch: true }, take: 20000 }),
    prisma.booking.findMany({
      where: { createdAt: range },
      select: { id: true, status: true, totalPrice: true, acquisition: true, lastTouch: true, proposal: { select: { serviceRequestId: true } } },
      take: 20000,
    }),
    prisma.marketingAdDraft.findMany({ where: { status: { in: ['ready', 'used', 'archived'] } }, select: { id: true, title: true }, orderBy: { createdAt: 'desc' }, take: 500 }),
    spendByDraft(new Date(`${bogotaDay(period.from)}T00:00:00Z`), new Date(`${bogotaDay(period.to)}T00:00:00Z`)),
  ])
  const postIds = new Set<string>()
  for (const r of requests) {
    for (const t of [r.acquisition, r.lastTouch]) {
      const c = t && typeof t === 'object' ? (t as { content?: unknown }).content : null
      if (typeof c === 'string' && c.length >= 20) postIds.add(c)
    }
  }
  for (const c of conversations) {
    const ref = c.customFields && typeof c.customFields === 'object' ? (c.customFields as { webRef?: unknown }).webRef : null
    if (typeof ref === 'string' && ref.startsWith('post-')) postIds.add(ref.slice(5))
  }
  const posts = postIds.size
    ? await prisma.marketingPost.findMany({ where: { id: { in: Array.from(postIds) } }, select: { id: true, title: true } })
    : []
  const summary = summarizeOrigins({
    conversations,
    requests,
    bookings: bookings.map((b) => ({ id: b.id, status: b.status, totalPrice: b.totalPrice, requestId: b.proposal?.serviceRequestId ?? null, acquisition: b.acquisition, lastTouch: b.lastTouch })),
    spendByDraft: spend,
    labels: {
      adDrafts: new Map(drafts.map((d) => [`ad-${d.id.slice(-8).toLowerCase()}`, { id: d.id, title: d.title }])),
      posts: new Map(posts.map((p) => [p.id, p.title])),
    },
    model,
  })
  const withoutData = requests.filter((r) => !r.acquisition && !r.lastTouch).length
  return { ...summary, requestsWithoutData: withoutData }
}

/**
 * For Haggo's snapshot: requests of 7 days and how many have an origin, the week's ad spend, packages with
 * spend on 3+ days and no request credited, and server conversions that failed.
 */
export async function attributionSnapshot(now = new Date()) {
  const week = new Date(now.getTime() - 7 * 24 * 3600_000)
  const [requests, days, failed] = await Promise.all([
    prisma.serviceRequest.findMany({ where: { createdAt: { gte: week } }, select: { acquisition: true, lastTouch: true }, take: 5000 }),
    spendDays(new Date(`${bogotaDay(week)}T00:00:00Z`)),
    prisma.conversionEvent.count({ where: { status: 'failed', createdAt: { gte: week } } }).catch(() => 0),
  ])
  const byCampaign = new Map<string, number>()
  for (const r of requests) {
    const camps = new Set([r.acquisition, r.lastTouch].map((t) => (t && typeof t === 'object' ? (t as { campaign?: unknown }).campaign : null)).filter((c): c is string => typeof c === 'string'))
    for (const c of Array.from(camps)) byCampaign.set(c, (byCampaign.get(c) ?? 0) + 1)
  }
  const idle = spendWithoutRequests({ spendDays: days, requestsByCampaign: byCampaign, minDays: 3 })
  const titles = idle.length ? await prisma.marketingAdDraft.findMany({ where: { id: { in: idle.map((i) => i.adDraftId) } }, select: { id: true, title: true } }) : []
  return {
    requests7d: requests.length,
    withOrigin7d: requests.filter((r) => r.acquisition || r.lastTouch).length,
    spend7d: days.reduce((a, d) => a + d.amountCop, 0),
    spendWithoutRequests: idle.map((i) => ({ ...i, title: titles.find((t) => t.id === i.adDraftId)?.title ?? 'Pauta' })),
    conversionsFailed7d: failed,
  }
}
