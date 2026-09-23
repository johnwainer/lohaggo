export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { getAppBaseUrl, startOAuthSession } from '@/lib/messaging/meta-channels'
import { canManage, getWorkspaceAccess } from '@/lib/workspaces'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const channelParam = (request.nextUrl.searchParams.get('channel') || '').toUpperCase()
  const workspaceId = request.nextUrl.searchParams.get('workspaceId') || ''
  const fail = (message: string) => {
    const target = new URL('/admin/channels', getAppBaseUrl() || request.nextUrl.origin)
    target.searchParams.set('oauthError', message)
    return NextResponse.redirect(target.toString(), { status: 302 })
  }

  if (channelParam !== 'MESSENGER' && channelParam !== 'INSTAGRAM') return fail('Canal inválido')
  if (!workspaceId) return fail('Elige un workspace antes de conectar')

  const access = await getWorkspaceAccess(admin)
  if (!canManage(access, workspaceId)) return fail('Solo el propietario del workspace puede conectar cuentas')

  try {
    const { url } = await startOAuthSession({ channel: channelParam, adminId: admin.id, workspaceId })
    await auditAdminAction({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'channels.oauth.start',
      entityType: 'ChannelConnection',
      route: '/api/admin/channels/oauth/start',
      details: `${channelParam} ws=${workspaceId}`,
      request,
    })
    return NextResponse.redirect(url, { status: 302 })
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'No se pudo iniciar la autorización')
  }
}
