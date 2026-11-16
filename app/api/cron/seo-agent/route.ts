import { NextResponse } from 'next/server'
import { cronRoute } from '@/lib/system/cron'
import { runSeoCycle } from '@/lib/seo/agent/agent'
import { sendMonthlySummary } from '@/lib/seo/agent/monthly'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Daily: the free rules (technical read of the public pages, Search Console, opportunities) and, on the
 * configured weekday, the model's briefs and weekly report.
 */
export const GET = cronRoute('seo-agent', async () => {
  const r = await runSeoCycle({ trigger: 'cron' })
  // Days 1 to 5 of the month: the owner's summary of the month that just ended (once; never throws)
  const monthly = await sendMonthlySummary().catch(() => ({ sent: false, skipped: 'error' }))
  return NextResponse.json({ ...r, monthly })
}, { maxDuration: 300 })
