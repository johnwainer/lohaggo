import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { runPwaAdoptionAlerts } from '@/lib/pwa/adoption-alerts'

function isAuthorized(request: NextRequest) {
  const headerToken = request.headers.get('x-internal-token')
  const queryToken = request.nextUrl.searchParams.get('token')
  if (!env.SECURITY_INTERNAL_TOKEN) return false
  return headerToken === env.SECURITY_INTERNAL_TOKEN || queryToken === env.SECURITY_INTERNAL_TOKEN
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await runPwaAdoptionAlerts()
  return NextResponse.json({ ok: true, ...result })
}
