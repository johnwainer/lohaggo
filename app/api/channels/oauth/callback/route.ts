export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { completeOAuthCallback, getAppBaseUrl } from '@/lib/messaging/meta-channels'

// Public endpoint (no session guard): the OAuth `state` is the only credential and it is single-use.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  // Meta reports user denials as error_message (not error_description)
  const errorMessage = params.get('error_message') || params.get('error_description') || params.get('error_reason') || params.get('error')

  const result = await completeOAuthCallback({
    code: params.get('code'),
    state: params.get('state'),
    errorMessage,
  })

  const target = new URL('/admin/channels', getAppBaseUrl() || request.nextUrl.origin)
  if (result.ok) {
    target.searchParams.set('session', result.sessionId)
  } else {
    target.searchParams.set('oauthError', result.error.slice(0, 300))
  }
  return NextResponse.redirect(target.toString(), { status: 302 })
}
