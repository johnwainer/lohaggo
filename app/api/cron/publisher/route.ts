export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { cronRoute } from '@/lib/system/cron'
import { createLogger } from '@/lib/logger'
import { runDuePublications } from '@/lib/marketing/publisher'
import { retryFailedConversions } from '@/lib/analytics/conversions'

const logger = createLogger('cron-publisher')

/** Scheduled posts that are due (and Instagram videos Meta finished processing), and failed conversions. */
async function handle(request: NextRequest) {
  // Fails closed: these jobs publish to the networks and rewrite account tokens
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    logger.error('CRON_SECRET is not set: job refused')
    return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 503 })
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await runDuePublications()
    // Server conversions (Meta CAPI / GA4) that failed: retried here, every minute is cheap when there are none
    const conversions = await retryFailedConversions()
    logger.info('Run', { ...result, conversions })
    return NextResponse.json({ ok: true, ...result, conversions })
  } catch (err) {
    logger.error('Run error', { message: err instanceof Error ? err.message : 'error' })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const GET = cronRoute('publisher', handle)
export const POST = GET
