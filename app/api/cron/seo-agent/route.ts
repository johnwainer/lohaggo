import { NextResponse } from 'next/server'
import { cronRoute } from '@/lib/system/cron'
import { runSeoCycle } from '@/lib/seo/agent/agent'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Daily: the free rules (technical read of the public pages, Search Console, opportunities) and, on the
 * configured weekday, the model's briefs and weekly report.
 */
export const GET = cronRoute('seo-agent', async () => {
  const r = await runSeoCycle({ trigger: 'cron' })
  return NextResponse.json(r)
}, { maxDuration: 300 })
