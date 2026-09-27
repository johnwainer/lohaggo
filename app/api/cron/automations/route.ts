import { NextRequest, NextResponse } from 'next/server'
import { cronRoute } from '@/lib/system/cron'
import { ensureDefaultAutomationRules, processDueAutomations } from '@/lib/messaging/automation-service'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const logger = createLogger('cron-automations')

async function handle(request: NextRequest) {
  // Verify Vercel cron secret
  const secret = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && secret !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const defaults = await ensureDefaultAutomationRules().catch((err) => {
      logger.error('ensureDefaultAutomationRules failed', { err })
      return null
    })
    const result = await processDueAutomations(200)
    logger.info('Cron automations completed', result)
    return NextResponse.json({ ok: true, ...result, rulesCreated: defaults?.created ?? 0, rulesLinksFixed: defaults?.fixedLinks ?? 0 })
  } catch (err) {
    logger.error('Cron automations error', { err })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Also allow GET for Vercel cron (it sends GET by default for crons)
export const GET = cronRoute('automations', handle)
export const POST = GET
