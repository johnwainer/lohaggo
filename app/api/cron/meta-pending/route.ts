export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { pollPendingFolders, purgeOldWebhookEvents } from '@/lib/messaging/meta-inbound'

const logger = createLogger('cron-meta-pending')

export async function POST(request: NextRequest) {
  const secret = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && secret !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const report = await pollPendingFolders()
    const purged = await purgeOldWebhookEvents(7).catch(() => 0)
    const recorded = report.reduce((acc, r) => acc + r.recorded, 0)
    if (recorded > 0 || report.some((r) => r.error)) logger.info('Meta pending poll', { report, purged })
    return NextResponse.json({ ok: true, recorded, purged, report })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error'
    // Not configured yet is a normal state, not an error
    if (/no está configurada/i.test(message)) return NextResponse.json({ ok: true, skipped: message })
    logger.error('Meta pending poll error', { message })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
