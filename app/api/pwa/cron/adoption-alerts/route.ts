import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { runPwaAdoptionAlerts } from '@/lib/pwa/adoption-alerts'

function isAuthorized(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || ''
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim()
  const cronSecret = (env.CRON_SECRET || '').trim()
  if (cronSecret && bearerToken && bearerToken === cronSecret) return true

  const headerToken = request.headers.get('x-internal-token')
  const queryToken = request.nextUrl.searchParams.get('token')
  if (env.SECURITY_INTERNAL_TOKEN && (headerToken === env.SECURITY_INTERNAL_TOKEN || queryToken === env.SECURITY_INTERNAL_TOKEN)) {
    return true
  }

  return false
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runPwaAdoptionAlerts()
  return NextResponse.json({ ok: true, ...result })
}
