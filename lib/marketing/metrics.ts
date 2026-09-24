import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { MetaGraphError } from '@/lib/messaging/meta-graph'
import { getConnectionCredentials, requireMetaApp } from '@/lib/messaging/meta-channels'
import { facebookMetrics, instagramMetrics } from '@/lib/marketing/meta-publish'
import { metricsDue } from '@/lib/marketing/publisher-core'

const logger = createLogger('marketing-metrics')

/** Cron: a snapshot of each social publication whose refresh is due (see metricsDue). */
export async function collectMetrics(limit = 60) {
  const now = new Date()
  const candidates = await prisma.marketingPublication.findMany({
    where: { status: 'published', channel: { in: ['FACEBOOK', 'INSTAGRAM'] }, externalId: { not: null }, publishedAt: { gte: new Date(now.getTime() - 31 * 24 * 3600_000) } },
    include: { connection: true, post: { select: { media: { select: { kind: true } } } } },
    orderBy: [{ metricsAt: { sort: 'asc', nulls: 'first' } }],
    take: limit * 3,
  })
  const due = candidates.filter((p) => p.publishedAt && metricsDue(p.publishedAt, p.metricsAt, now)).slice(0, limit)
  const app = due.length ? await requireMetaApp() : null
  let captured = 0
  for (const pub of due) {
    try {
      const token = pub.connection ? getConnectionCredentials(pub.connection)?.pageAccessToken : null
      if (!token || !app || !pub.externalId) continue
      const ctx = { app, token }
      const isVideo = pub.post.media.some((m) => m.kind === 'video')
      const m = pub.channel === 'FACEBOOK' ? await facebookMetrics(ctx, pub.externalId, isVideo && !pub.externalId.includes('_')) : await instagramMetrics(ctx, pub.externalId)
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
export async function recordPageView(variantId: string, day = new Date().toISOString().slice(0, 10)) {
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
