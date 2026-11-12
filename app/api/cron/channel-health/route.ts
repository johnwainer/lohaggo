export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { cronRoute } from '@/lib/system/cron'
import { createLogger } from '@/lib/logger'
import { runTokenHealth } from '@/lib/marketing/token-health'

const logger = createLogger('cron-channel-health')

/** Daily: token validity of every Meta account, renewal of user tokens before they expire. */
async function handle(request: NextRequest) {
  try {
    const result = await runTokenHealth()
    logger.info('Run', result)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    logger.error('Run error', { message: err instanceof Error ? err.message : 'error' })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const GET = cronRoute('channel-health', handle)
export const POST = GET
