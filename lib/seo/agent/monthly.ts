/** Monthly owner summary (server): gathers the data, records a SeoRun 'monthly' and emails the owners. */
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { sendMessageViaProvider } from '@/lib/messaging/providers'
import { getMessagingProviderRuntimeConfig } from '@/lib/messaging/provider-config'
import { getHaggoConfig } from '@/lib/haggo/store'
import { bogotaDay, buildMonthly, monthKey, monthLabelOf, monthRange, previousMonthKey, renderMonthlyEmail, type MonthlyInput } from '@/lib/seo/agent/monthly-core'

const logger = createLogger('seo-monthly')

type CycleOut = {
  gsc?: { clicks?: number; impressions?: number; top?: Array<{ query: string; clicks: number; impressions: number; position: number }>; topPages?: Array<{ path: string; clicks: number; impressions: number }>; indexing?: { inspected?: number; indexed?: number } | null; state?: string } | null
  keywords?: Array<{ keyword: string; position: number | null; impressions: number }>
  health?: { score?: number } | null
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Last cycle that started inside the month. */
async function lastCycle(key: string) {
  const { start, end } = monthRange(key)
  const run = await prisma.seoRun.findFirst({ where: { type: 'cycle', status: 'ok', startedAt: { gte: start, lt: end } }, orderBy: { startedAt: 'desc' }, select: { output: true } })
  return (run?.output ?? null) as CycleOut | null
}

/**
 * Sent on days 1-5 of the month (Bogotá), once per month. It reports the month that just ended and
 * compares it with the one before. The SeoRun summary «Resumen YYYY-MM» (the reported month) is the marker.
 */
export async function sendMonthlySummary(opts: { now?: Date; force?: boolean } = {}): Promise<{ sent: boolean; skipped?: string; to?: number }> {
  try {
    const now = opts.now ?? new Date()
    if (!opts.force && bogotaDay(now) > 5) return { sent: false, skipped: 'No es de los primeros 5 días del mes' }
    const key = previousMonthKey(monthKey(now))
    const summaryKey = `Resumen ${key}`
    if (!opts.force && (await prisma.seoRun.findFirst({ where: { type: 'monthly', summary: summaryKey }, select: { id: true } }))) return { sent: false, skipped: 'Ya se envió este mes' }

    const { start, end } = monthRange(key)
    const [cur, prev] = await Promise.all([lastCycle(key), lastCycle(previousMonthKey(key))])
    const cycle = cur ?? ((await prisma.seoRun.findFirst({ where: { type: 'cycle', status: 'ok' }, orderBy: { startedAt: 'desc' }, select: { output: true } }))?.output as CycleOut | null)

    const firstDay = start.toISOString().slice(0, 10)
    const [variants, open, highOpen, done, spend, total] = await Promise.all([
      prisma.marketingPostVariant.findMany({
        where: { channel: 'WEB', webPublishedAt: { gte: start, lt: end }, slug: { not: null } },
        orderBy: { webPublishedAt: 'asc' }, take: 30, select: { id: true, slug: true, post: { select: { title: true } } },
      }),
      prisma.seoOpportunity.count({ where: { status: { in: ['open', 'briefed'] } } }),
      prisma.seoOpportunity.count({ where: { status: { in: ['open', 'briefed'] }, impact: 'high' } }),
      prisma.seoOpportunity.count({ where: { resolvedAt: { gte: start, lt: end } } }),
      prisma.seoRun.aggregate({ where: { startedAt: { gte: start, lt: end } }, _sum: { costUsd: true } }),
      prisma.marketingPostVariant.count({ where: { channel: 'WEB', webPublishedAt: { not: null, lt: end }, slug: { not: null }, noindex: false } }),
    ])
    const lastDay = new Date(end.getTime() - 86_400_000).toISOString().slice(0, 10)
    const viewRows = variants.length
      ? await prisma.webPageView.groupBy({ by: ['variantId'], where: { variantId: { in: variants.map((v) => v.id) }, day: { gte: firstDay, lte: lastDay } }, _sum: { views: true } })
      : []
    const viewsBy = new Map(viewRows.map((r) => [r.variantId, r._sum.views ?? 0]))

    const g = cycle?.gsc && num(cycle.gsc.clicks) != null ? cycle.gsc : null
    const prevKw = new Map((prev?.keywords ?? []).map((k) => [k.keyword, k.position]))
    const input: MonthlyInput = {
      monthLabel: monthLabelOf(key),
      gsc: g ? {
        clicks: g.clicks ?? 0, impressions: g.impressions ?? 0,
        prevClicks: num(prev?.gsc?.clicks), prevImpressions: num(prev?.gsc?.impressions),
        topQueries: g.top ?? [], topPages: g.topPages ?? [],
      } : null,
      keywords: (cycle?.keywords ?? []).map((k) => ({ keyword: k.keyword, position: k.position ?? null, prevPosition: prevKw.get(k.keyword) ?? null, impressions: k.impressions ?? 0 })),
      articles: {
        publishedThisMonth: variants.map((v) => ({ title: v.post.title, slug: v.slug!, views: viewsBy.get(v.id) ?? 0 })),
        totalPublished: total, indexed: num(g?.indexing?.indexed), inspected: num(g?.indexing?.inspected),
      },
      health: { score: num(cycle?.health?.score) ?? 0, prevScore: num(prev?.health?.score) },
      opportunities: { open, highOpen, doneThisMonth: done },
      spendUsd: spend._sum.costUsd ?? 0,
    }
    const summary = buildMonthly(input)
    const email = renderMonthlyEmail(summary)

    await prisma.seoRun.create({ data: { type: 'monthly', status: 'ok', trigger: opts.force ? 'manual' : 'cron', summary: summaryKey, output: JSON.parse(JSON.stringify({ month: key, summary, subject: email.subject })), finishedAt: new Date() } })

    const runtime = await getMessagingProviderRuntimeConfig()
    if (!runtime.sendgrid?.active) return { sent: false, skipped: 'Correo (SendGrid) no está activo; el resumen quedó en el panel' }
    const cfg = await getHaggoConfig()
    const to = cfg.notifyTo.length ? cfg.notifyTo : Array.from(new Set((await prisma.user.findMany({ where: { isSuperAdmin: true, isActive: true }, select: { email: true }, take: 5 })).map((a) => a.email).filter(Boolean)))
    if (!to.length) return { sent: false, skipped: 'No hay destinatarios', to: 0 }
    const results = await Promise.all(to.slice(0, 5).map((address) => sendMessageViaProvider({ channel: 'EMAIL', to: address, subject: email.subject, body: email.html }, runtime).catch(() => ({ ok: false }))))
    return { sent: results.some((r) => r.ok), to: results.filter((r) => r.ok).length }
  } catch (err) {
    logger.warn('Monthly summary failed', { err: err instanceof Error ? err.message : err })
    return { sent: false, skipped: 'Error al preparar el resumen' }
  }
}
