import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction } from '@/lib/admin-utils'
import { MARKETING_PERMISSION_LABELS, canManageMarketingPermissions, forbidden, marketingAuth, resolveMarketingGrants } from '@/lib/marketing/permissions'

/** Members of a workspace and their marketing permissions (owners and the superadmin manage them). */
export async function GET(request: NextRequest) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const workspaceId = request.nextUrl.searchParams.get('workspaceId') || ''
  if (!workspaceId || !canManageMarketingPermissions(auth.access, workspaceId)) return forbidden()
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    select: { id: true, role: true, permissions: true, user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ labels: MARKETING_PERMISSION_LABELS, members: members.map((m) => ({ ...m, effective: resolveMarketingGrants(m.role, m.permissions) })) })
}

export async function PUT(request: NextRequest) {
  const auth = await marketingAuth()
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => ({}))
  const member = typeof body.memberId === 'string' ? await prisma.workspaceMember.findUnique({ where: { id: body.memberId } }) : null
  if (!member || !canManageMarketingPermissions(auth.access, member.workspaceId)) return forbidden()
  const allowed = Object.keys(MARKETING_PERMISSION_LABELS)
  const keep = member.permissions.filter((p) => !p.startsWith('marketing.'))
  const granted = Array.isArray(body.permissions) ? body.permissions.filter((p: unknown) => typeof p === 'string' && allowed.includes(p)) : []
  await prisma.workspaceMember.update({ where: { id: member.id }, data: { permissions: [...keep, ...granted] } })
  await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'MARKETING_PERMISSIONS_UPDATE', entityType: 'WorkspaceMember', entityId: member.id, details: granted.join(','), request })
  return NextResponse.json({ ok: true })
}
