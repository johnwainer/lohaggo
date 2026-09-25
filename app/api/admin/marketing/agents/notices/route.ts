import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { marketingAuth, mkWorkspacesWith } from '@/lib/marketing/permissions'

export const dynamic = 'force-dynamic'

/** The module's bell: the agents' latest notices in the workspaces the person sees. */
export async function GET(request: NextRequest) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const scope = mkWorkspacesWith(auth.access, 'marketing.view')
  const workspaceId = request.nextUrl.searchParams.get('workspaceId')
  const where = { ...(scope ? { workspaceId: { in: workspaceId ? scope.filter((w) => w === workspaceId) : scope } } : workspaceId ? { workspaceId } : {}) }
  const [notices, unread] = await Promise.all([
    prisma.marketingAgentNotice.findMany({ where, orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, type: true, title: true, body: true, url: true, readAt: true, createdAt: true, agentId: true } }),
    prisma.marketingAgentNotice.count({ where: { ...where, readAt: null } }),
  ])
  return NextResponse.json({ notices, unread })
}

/** Mark as read: some ids, or all. */
export async function PATCH(request: NextRequest) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const scope = mkWorkspacesWith(auth.access, 'marketing.view')
  const body = await request.json().catch(() => ({}))
  const ids = Array.isArray(body.ids) ? body.ids.filter((x: unknown): x is string => typeof x === 'string').slice(0, 100) : null
  await prisma.marketingAgentNotice.updateMany({
    where: { readAt: null, ...(scope ? { workspaceId: { in: scope } } : {}), ...(ids ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  })
  return NextResponse.json({ ok: true })
}
