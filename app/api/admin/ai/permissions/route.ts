import { NextRequest, NextResponse } from 'next/server'
import { auditAdminAction } from '@/lib/admin-utils'
import { prisma } from '@/lib/prisma'
import { aiAuth, forbidden } from '@/lib/ai/route-auth'
import { AI_PERMISSION_LABELS, canManageAiPermissions, resolveGrants } from '@/lib/ai/permissions'

/** Members of a workspace and their AI permissions. Owners and the platform administrator manage them. */
export async function GET(request: NextRequest) {
  const auth = await aiAuth()
  if (!auth.ok) return auth.response
  const workspaceId = request.nextUrl.searchParams.get('workspaceId') || ''
  if (!workspaceId || !canManageAiPermissions(auth.access, workspaceId)) return forbidden()
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    select: { id: true, role: true, permissions: true, user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({
    labels: AI_PERMISSION_LABELS,
    members: members.map((m) => ({ ...m, effective: resolveGrants(m.role, m.permissions) })),
  })
}

export async function PUT(request: NextRequest) {
  const auth = await aiAuth()
  if (!auth.ok) return auth.response
  const body = await request.json().catch(() => ({}))
  const member = typeof body.memberId === 'string' ? await prisma.workspaceMember.findUnique({ where: { id: body.memberId } }) : null
  if (!member || !canManageAiPermissions(auth.access, member.workspaceId)) return forbidden()
  const allowed = Object.keys(AI_PERMISSION_LABELS)
  const keepOther = member.permissions.filter((p) => !p.startsWith('ai.'))
  const ai = Array.isArray(body.permissions) ? body.permissions.filter((p: unknown) => typeof p === 'string' && allowed.includes(p)) : []
  await prisma.workspaceMember.update({ where: { id: member.id }, data: { permissions: [...keepOther, ...ai] } })
  await auditAdminAction({ actorId: auth.admin.id, actorEmail: auth.admin.email, action: 'AI_PERMISSIONS_UPDATE', entityType: 'WorkspaceMember', entityId: member.id, details: ai.join(','), request })
  return NextResponse.json({ ok: true })
}
