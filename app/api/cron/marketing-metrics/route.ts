export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { cronRoute } from '@/lib/system/cron'
import { createLogger } from '@/lib/logger'
import { collectMetrics } from '@/lib/marketing/metrics'

const logger = createLogger('cron-marketing-metrics')

/** Insights snapshots of published social posts whose refresh is due. */
async function handle(request: NextRequest) {
  try {
    const result = await collectMetrics()
    logger.info('Run', result)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    logger.error('Run error', { message: err instanceof Error ? err.message : 'error' })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const GET = cronRoute('marketing-metrics', handle)
export const POST = GET
