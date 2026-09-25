import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { runPwaAdoptionAlerts } from '@/lib/pwa/adoption-alerts'
import { cronRoute } from '@/lib/system/cron'

function isAuthorized(request: NextRequest) {
  const headerToken = request.headers.get('x-internal-token')
  return Boolean(env.SECURITY_INTERNAL_TOKEN && headerToken === env.SECURITY_INTERNAL_TOKEN)
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runPwaAdoptionAlerts()
  return NextResponse.json({ ok: true, ...result })
}

/** Vercel cron (GET with CRON_SECRET): the POST above only accepts the internal token, so the schedule never ran. */
export const GET = cronRoute('pwa-adoption-alerts', async () => NextResponse.json({ ok: true, ...(await runPwaAdoptionAlerts()) }))
