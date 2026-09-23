export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import { getMetaAppConfig, META_GRAPH_DEFAULT_VERSION } from '@/lib/messaging/provider-config'
import { getOAuthRedirectUri, getWebhookUrls } from '@/lib/messaging/meta-channels'

function maskSecret(value: string | undefined) {
  if (!value) return ''
  if (value.length <= 8) return '********'
  return `${value.slice(0, 4)}********${value.slice(-4)}`
}

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [app, connections] = await Promise.all([
    getMetaAppConfig(),
    prisma.channelConnection.findMany({
      where: { channel: { in: ['MESSENGER', 'INSTAGRAM'] } },
      orderBy: [{ channel: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        channel: true,
        externalId: true,
        name: true,
        status: true,
        enabled: true,
        meta: true,
        capabilities: true,
        lastError: true,
        lastEventAt: true,
        connectedByEmail: true,
        createdAt: true,
        _count: { select: { conversations: true } },
      },
    }).catch(() => []),
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
    },
    urls: { redirect: getOAuthRedirectUri(), ...getWebhookUrls() },
    connections,
  })
}
