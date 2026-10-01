import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { MetaGraphError } from '@/lib/messaging/meta-graph'
import { getConnectionCredentials, requireMetaApp } from '@/lib/messaging/meta-channels'
import { facebookMetrics, facebookReelMetrics, instagramMetrics } from '@/lib/marketing/meta-publish'
import { metricsDue } from '@/lib/marketing/publisher-core'
import { bogotaDay } from '@/lib/analytics/core'

const logger = createLogger('marketing-metrics')

const H = 3600_000
/** The refresh bands of metricsDue: age range and how often (5 min of slack, like metricsDue). */
const METRIC_BANDS = [
  { minAge: 0, maxAge: 48 * H, every: H },
  { minAge: 48 * H, maxAge: 7 * 24 * H, every: 6 * H },
  { minAge: 7 * 24 * H, maxAge: 30 * 24 * H, every: 24 * H },
]

/**
 * Cron: a snapshot of each social publication whose refresh is due (see metricsDue). Each age band is
 * queried with its own due condition, so a crowd of fresh posts never hides the older ones.
 */
export async function collectMetrics(limit = 60) {
  const now = new Date()
  const bands = await Promise.all(METRIC_BANDS.map((b) => prisma.marketingPublication.findMany({
    where: {
      status: 'published', channel: { in: ['FACEBOOK', 'INSTAGRAM'] }, externalId: { not: null },
      publishedAt: { gte: new Date(now.getTime() - b.maxAge), lte: new Date(now.getTime() - b.minAge) },
      OR: [{ metricsAt: null }, { metricsAt: { lte: new Date(now.getTime() - b.every + 5 * 60_000) } }],
      // An expired story has no statistics left (Meta keeps them 24 h): its last capture is final
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
    },
    include: { connection: true, post: { select: { media: { select: { kind: true } } } } },
    orderBy: [{ metricsAt: { sort: 'asc', nulls: 'first' } }],
    take: limit,
  })))
  const seen = new Set<string>()
  const due = bands.flat()
    .filter((p) => p.publishedAt && metricsDue(p.publishedAt, p.metricsAt, now) && !seen.has(p.id) && seen.add(p.id))
    .sort((a, b) => (a.metricsAt?.getTime() ?? 0) - (b.metricsAt?.getTime() ?? 0))
    .slice(0, limit)
  const app = due.length ? await requireMetaApp() : null
  const formats = new Map((await prisma.marketingPostVariant.findMany({ where: { id: { in: due.map((p) => p.variantId) } }, select: { id: true, format: true } })).map((v) => [v.id, v.format]))
  let captured = 0
  for (const pub of due) {
    try {
      const token = pub.connection ? getConnectionCredentials(pub.connection)?.pageAccessToken : null
      if (!token || !app || !pub.externalId) continue
      const ctx = { app, token }
      const isVideo = pub.post.media.some((m) => m.kind === 'video')
      const format = formats.get(pub.variantId) ?? null
      // Facebook does not give statistics of a Page story by API: nothing to ask
      if (pub.channel === 'FACEBOOK' && format === 'story') continue
      const m = pub.channel === 'FACEBOOK'
        ? format === 'reel' ? await facebookReelMetrics(ctx, pub.externalId) : await facebookMetrics(ctx, pub.externalId, isVideo && !pub.externalId.includes('_'))
        : await instagramMetrics(ctx, pub.externalId, format === 'story' ? 'story' : format === 'reel' || format === 'trial_reel' ? 'reel' : 'post')
      await prisma.marketingMetricSnapshot.create({
        data: {
          publicationId: pub.id, reach: m.reach, impressions: m.impressions, likes: m.likes, comments: m.comments, shares: m.shares,
          saves: m.saves, clicks: m.clicks, videoViews: m.videoViews, raw: m.raw as Prisma.InputJsonValue,
        },
      })
      captured++
    } catch (err) {
      // Deleted on the network (code 100 / 803): stop asking
      const gone = err instanceof MetaGraphError && (err.code === 100 || err.code === 803)
      logger.warn('Metrics failed', { publicationId: pub.id, gone, err: err instanceof Error ? err.message : err })
      if (gone) await prisma.marketingPublication.update({ where: { id: pub.id }, data: { lastError: 'La publicación ya no existe en la red' } }).catch(() => null)
    }
    await prisma.marketingPublication.update({ where: { id: pub.id }, data: { metricsAt: now } }).catch(() => null)
  }
  return { captured, due: due.length }
}

/** Blog: one row per article and day (no cookies, no personal data). */
export async function recordPageView(variantId: string, day = bogotaDay(new Date())) {
  await prisma.webPageView.upsert({
    where: { variantId_day: { variantId, day } },
    create: { variantId, day, views: 1 },
    update: { views: { increment: 1 } },
  })
}

export type MetricTotals = { reach: number; impressions: number; likes: number; comments: number; shares: number; saves: number; clicks: number; videoViews: number; webViews: number }

export const emptyTotals = (): MetricTotals => ({ reach: 0, impressions: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, videoViews: 0, webViews: 0 })

/** Latest snapshot of each publication (metrics are cumulative on the networks, so the last one wins). */
export async function latestSnapshots(publicationIds: string[]) {
  if (!publicationIds.length) return new Map<string, Awaited<ReturnType<typeof prisma.marketingMetricSnapshot.findFirst>>>()
  const rows = await prisma.marketingMetricSnapshot.findMany({ where: { publicationId: { in: publicationIds } }, orderBy: { capturedAt: 'desc' } })
  const map = new Map<string, (typeof rows)[number]>()
  for (const r of rows) if (!map.has(r.publicationId)) map.set(r.publicationId, r)
  return map
}

export function engagementRate(t: Pick<MetricTotals, 'likes' | 'comments' | 'shares' | 'saves' | 'clicks' | 'reach'>) {
  if (!t.reach) return null
  return Math.round(((t.likes + t.comments + t.shares + t.saves + t.clicks) / t.reach) * 1000) / 10
}
