export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { runTokenHealth } from '@/lib/marketing/token-health'

const logger = createLogger('cron-channel-health')

/** Daily: token validity of every Meta account, renewal of user tokens before they expire. */
export async function POST(request: NextRequest) {
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
    const result = await runTokenHealth()
    logger.info('Run', result)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    logger.error('Run error', { message: err instanceof Error ? err.message : 'error' })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
