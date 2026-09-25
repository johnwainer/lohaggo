export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { cronRoute } from '@/lib/system/cron'
import { tick } from '@/lib/haggo/runner'

/** Every 5 minutes, only a clock: Haggo's own schedule (Ajustes) decides whether a cycle or a report is due. */
export const GET = cronRoute('haggo', async () => NextResponse.json({ ok: true, ...(await tick()) }))
