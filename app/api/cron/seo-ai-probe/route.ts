import { NextResponse } from 'next/server'
import { cronRoute } from '@/lib/system/cron'
import { runAiProbeCycle } from '@/lib/seo/agent/agent'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Weekly: asks AI assistants with web search the questions a client asks and records whether LoHaggo is named or cited. */
export const GET = cronRoute('seo-ai-probe', async () => {
  const r = await runAiProbeCycle({ trigger: 'cron' })
  return NextResponse.json(r)
}, { maxDuration: 300 })
