export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { cronRoute } from '@/lib/system/cron'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { indexPending } from '@/lib/ai/knowledge'
import { runReengagement } from '@/lib/ai/autopilot'
import { runFunnelNudges } from '@/lib/ai/funnel'
import { bogotaDateKey, isSweepHour } from '@/lib/inbox/escalation-core'

const logger = createLogger('cron-ai-maintenance')

/** Knowledge indexing left pending + one reminder for half-way requests + one-time re-engagement follow-ups + once a day the sweep of leads nobody answered. */
async function handle(request: NextRequest) {
  const secret = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && secret !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // A crashed invocation can leave a document "indexing" forever
    await prisma.aiKnowledgeDoc.updateMany({ where: { status: 'indexing', updatedAt: { lt: new Date(Date.now() - 15 * 60_000) } }, data: { status: 'pending' } })
    const indexed = await indexPending(10)
    // Half-way requests first: their reminder says what is missing, and it stamps reengagedAt so the generic one skips them
    const funnel = await runFunnelNudges().catch((err) => {
      logger.warn('Funnel nudges failed', { message: err instanceof Error ? err.message : 'error' })
      return { nudged: 0 }
    })
    const reengagement = await runReengagement()
    const staleLeads = await dailyStaleLeads()
    if (indexed || reengagement.sent || funnel.nudged || staleLeads) logger.info('AI maintenance', { indexed, ...reengagement, funnelNudged: funnel.nudged, staleLeads })
    return NextResponse.json({ ok: true, indexed, ...reengagement, funnelNudged: funnel.nudged, staleLeads })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error'
    logger.error('AI maintenance error', { message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/** At the sweep hour (Bogotá), the first run of the day claims it; the others skip. */
async function dailyStaleLeads(now = new Date()) {
  if (!isSweepHour(now)) return null
  const { hit } = await import('@/lib/rate-limit-store')
  if ((await hit(`cron:stale-leads:${bogotaDateKey(now)}`, 24 * 3600_000, now.getTime())).count > 1) return null
  try {
    const { sweepStaleLeads } = await import('@/lib/inbox/stale-leads')
    const r = await sweepStaleLeads({ dryRun: false, notify: true, now })
    return { candidates: r.candidates, aiReplied: r.aiReplied, reopened: r.reopened, alreadyFlagged: r.alreadyFlagged, skipped: r.skipped }
  } catch (err) {
    logger.warn('Stale leads sweep failed', { message: err instanceof Error ? err.message : 'error' })
    return null
  }
}

export const GET = cronRoute('ai-maintenance', handle)
export const POST = GET
