export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import { getMetaAppConfig, META_GRAPH_DEFAULT_VERSION } from '@/lib/messaging/provider-config'
import { getOAuthRedirectUri, getWebhookUrls } from '@/lib/messaging/meta-channels'
import { canManage, getWorkspaceAccess, listAccessibleWorkspaces, workspaceScope } from '@/lib/workspaces'

function maskSecret(value: string | undefined) {
  if (!value) return ''
  if (value.length <= 8) return '********'
  return `${value.slice(0, 4)}********${value.slice(-4)}`
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getWorkspaceAccess(admin)

  const [app, connections, workspaces] = await Promise.all([
    getMetaAppConfig(),
    prisma.channelConnection.findMany({
      where: { channel: { in: ['MESSENGER', 'INSTAGRAM'] }, ...workspaceScope(access) },
      orderBy: [{ workspaceId: 'asc' }, { channel: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        workspaceId: true,
        workspace: { select: { id: true, name: true } },
        channel: true,
        externalId: true,
        name: true,
        status: true,
        enabled: true,
        meta: true,
        capabilities: true,
        commentSettings: true,
        lastError: true,
        lastEventAt: true,
        connectedByEmail: true,
        createdAt: true,
        _count: { select: { conversations: true } },
      },
    }).catch(() => []),
    listAccessibleWorkspaces(access).catch(() => []),
  ])

  return NextResponse.json({
    metaApp: {
      configured: Boolean(app?.appId && app?.appSecret && app?.verifyToken),
      appId: app?.appId || '',
      appSecret: maskSecret(app?.appSecret),
      hasAppSecret: Boolean(app?.appSecret),
      verifyToken: app?.verifyToken || '',
      graphVersion: app?.graphVersion || META_GRAPH_DEFAULT_VERSION,
      configId: app?.configId || '',
      canEdit: access.isSuperAdmin,
    },
    urls: { redirect: getOAuthRedirectUri(), ...getWebhookUrls() },
    connections: connections.map((c) => ({ ...c, canManage: canManage(access, c.workspaceId) })),
    workspaces: workspaces.map((w) => ({ ...w, canManage: canManage(access, w.id) })),
    isSuperAdmin: access.isSuperAdmin,
  })
}
