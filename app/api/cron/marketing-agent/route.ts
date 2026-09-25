export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { cronRoute } from '@/lib/system/cron'
import { createLogger } from '@/lib/logger'
import { runMarketingAgents } from '@/lib/marketing/agent'

const logger = createLogger('cron-marketing-agent')

/** Every 30 min: each active marketing agent plans, writes, schedules and learns within its limits. */
async function handle(request: NextRequest) {
  // Fails closed: the agent spends on the model and can queue posts for the networks
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    logger.error('CRON_SECRET is not set: job refused')
    return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 503 })
  }
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await runMarketingAgents()
    logger.info('Run', { agents: result.agents, ran: result.ran })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    logger.error('Run error', { message: err instanceof Error ? err.message : 'error' })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const GET = cronRoute('marketing-agent', handle)
export const POST = GET
