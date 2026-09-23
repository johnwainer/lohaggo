export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { getAppBaseUrl, startOAuthSession } from '@/lib/messaging/meta-channels'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const channelParam = (request.nextUrl.searchParams.get('channel') || '').toUpperCase()
  if (channelParam !== 'MESSENGER' && channelParam !== 'INSTAGRAM') {
    return NextResponse.json({ error: 'channel debe ser messenger o instagram' }, { status: 400 })
  }

  try {
    const { url } = await startOAuthSession({ channel: channelParam, adminId: admin.id })
    await auditAdminAction({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'channels.oauth.start',
      entityType: 'ChannelConnection',
      route: '/api/admin/channels/oauth/start',
      details: channelParam,
      request,
    })
    return NextResponse.redirect(url, { status: 302 })
  } catch (err) {
    const target = new URL('/admin/channels', getAppBaseUrl() || request.nextUrl.origin)
    target.searchParams.set('oauthError', err instanceof Error ? err.message : 'No se pudo iniciar la autorización')
    return NextResponse.redirect(target.toString(), { status: 302 })
  }
}
