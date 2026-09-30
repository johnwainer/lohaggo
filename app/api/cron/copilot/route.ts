export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { cronRoute } from '@/lib/system/cron'
import { createLogger } from '@/lib/logger'
import { answerAfterHours, drainAgentTasks } from '@/lib/ai/autopilot'
import { runCopilotTakeovers } from '@/lib/ai/copilot'

const logger = createLogger('cron-copilot')

/** Copilot: take over (or flag) conversations whose client has waited longer than the agent's limit. */
async function handle(request: NextRequest) {
  const secret = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && secret !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await runCopilotTakeovers()
    const afterHours = await answerAfterHours(5).catch(() => ({ answered: 0 }))
    await drainAgentTasks()
    if (result.tookOver || result.alerted || afterHours.answered) logger.info('Copilot run', { ...result, afterHours })
    return NextResponse.json({ ok: true, ...result, afterHours })
  } catch (err) {
    logger.error('Copilot run error', { message: err instanceof Error ? err.message : 'error' })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const GET = cronRoute('copilot', handle)
export const POST = GET
