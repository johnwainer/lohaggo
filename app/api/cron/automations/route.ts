import { NextRequest, NextResponse } from 'next/server'
import { processDueAutomations } from '@/lib/messaging/automation-service'
import { createLogger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const logger = createLogger('cron-automations')

export async function POST(request: NextRequest) {
  // Verify Vercel cron secret
  const secret = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && secret !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processDueAutomations(200)
    logger.info('Cron automations completed', result)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    logger.error('Cron automations error', { err })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Also allow GET for Vercel cron (it sends GET by default for crons)
export async function GET(request: NextRequest) {
  return POST(request)
}
