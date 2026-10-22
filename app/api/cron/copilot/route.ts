export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { cronRoute } from '@/lib/system/cron'
import { createLogger } from '@/lib/logger'
import { answerAfterHours, drainAgentTasks } from '@/lib/ai/autopilot'
import { runCopilotTakeovers } from '@/lib/ai/copilot'
import { closeInactiveConversations } from '@/lib/ai/closing'

const logger = createLogger('cron-copilot')

/**
 * Copilot: take over (or flag) conversations whose client has waited longer than the agent's limit.
 * Every 10 minutes it also closes the AI conversations whose contact has not answered in 24 h.
 */
async function handle(request: NextRequest) {
  const secret = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && secret !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await runCopilotTakeovers()
    const afterHours = await answerAfterHours(5).catch(() => ({ answered: 0 }))
    const inactive = new Date().getUTCMinutes() % 10 === 0
      ? await closeInactiveConversations(20).catch((err) => { logger.warn('Inactivity close failed', { message: err instanceof Error ? err.message : 'error' }); return { closed: 0, checked: 0 } })
      : null
    await drainAgentTasks()
    if (result.tookOver || result.alerted || afterHours.answered || inactive?.closed) logger.info('Copilot run', { ...result, afterHours, inactive })
    return NextResponse.json({ ok: true, ...result, afterHours, inactive })
  } catch (err) {
    logger.error('Copilot run error', { message: err instanceof Error ? err.message : 'error' })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const GET = cronRoute('copilot', handle)
export const POST = GET
