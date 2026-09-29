import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { runScheduledCampaigns } from '@/lib/messaging/campaign-service'

export const maxDuration = 300

function isAuthorized(request: NextRequest) {
  const headerToken = request.headers.get('x-internal-token')
  if (!env.SECURITY_INTERNAL_TOKEN) return false
  return headerToken === env.SECURITY_INTERNAL_TOKEN
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = await runScheduledCampaigns()

  return NextResponse.json({ ok: true, processed: results.length, results })
}
