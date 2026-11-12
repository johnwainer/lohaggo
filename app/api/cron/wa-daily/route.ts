import { NextResponse } from 'next/server'
import { cronRoute } from '@/lib/system/cron'
import { createDeadline } from '@/lib/system/deadline'
import { createLogger } from '@/lib/logger'
import { runWaDaily } from '@/lib/messaging/wa-scheduled'
import { runClientWelcome } from '@/lib/accounts/welcome'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const logger = createLogger('cron-wa-daily')

/**
 * Hourly (half past): the WhatsApp templates sent by time (partner onboarding C3/C8/C9, win-back B23/C30, demand C29,
 * unfinished chat requests B24) and the client welcome. Apart from «automations» so a slow step cannot starve the others.
 * Unfinished work is picked up by the next run (sends are deduplicated).
 */
async function handle() {
  const deadline = createDeadline()
  const whatsapp = await runWaDaily(new Date(), deadline).catch((err) => { logger.error('WhatsApp daily templates failed', { err }); return { error: 1 } })
  const welcome = await runClientWelcome(new Date(), 100, deadline).catch((err) => { logger.error('Client welcome failed', { err }); return { error: 1 } })
  return NextResponse.json({ ok: true, whatsapp, welcome, deadlineHit: deadline.expired() })
}

export const GET = cronRoute('wa-daily', handle, { maxDuration })
export const POST = GET
