export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import { getWorkspaceAccess, workspaceScope } from '@/lib/workspaces'

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '50', 10) || 50, 200)
  const access = await getWorkspaceAccess(admin)

  // Non-superadmins only see events for accounts connected in their workspaces
  let externalFilter: { externalId: { in: string[] } } | Record<string, never> = {}
  if (!access.isSuperAdmin) {
    const conns = await prisma.channelConnection.findMany({ where: workspaceScope(access), select: { externalId: true } }).catch(() => [])
    externalFilter = { externalId: { in: conns.map((c) => c.externalId) } }
  }

  const events = await prisma.webhookEvent.findMany({
    where: { channel: { in: ['MESSENGER', 'INSTAGRAM'] }, ...externalFilter },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, channel: true, externalId: true, status: true, detail: true, createdAt: true },
  }).catch(() => [])

  return NextResponse.json({ events })
}
