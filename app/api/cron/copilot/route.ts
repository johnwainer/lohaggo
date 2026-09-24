export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { drainAgentTasks } from '@/lib/ai/autopilot'
import { runCopilotTakeovers } from '@/lib/ai/copilot'

const logger = createLogger('cron-copilot')

/** Copilot: take over (or flag) conversations whose client has waited longer than the agent's limit. */
export async function POST(request: NextRequest) {
  const secret = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && secret !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await runCopilotTakeovers()
    await drainAgentTasks()
    if (result.tookOver || result.alerted) logger.info('Copilot run', result)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    logger.error('Copilot run error', { message: err instanceof Error ? err.message : 'error' })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
