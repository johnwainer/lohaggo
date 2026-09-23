export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { canManage, getDefaultWorkspace, getWorkspaceAccess } from '@/lib/workspaces'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await getDefaultWorkspace()
  const access = await getWorkspaceAccess(admin)

  const [workspaces, admins] = await Promise.all([
    prisma.workspace.findMany({
      where: access.workspaceIds === null ? {} : { id: { in: access.workspaceIds } },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        members: {
          orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
          include: { user: { select: { id: true, name: true, email: true, image: true, isActive: true } } },
        },
        _count: { select: { connections: true, conversations: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { id: true, name: true, email: true, isSuperAdmin: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return NextResponse.json({
    me: { id: admin.id, isSuperAdmin: access.isSuperAdmin },
    admins,
    workspaces: workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      isDefault: w.isDefault,
      createdAt: w.createdAt,
      createdBy: w.createdBy,
      myRole: access.roles.get(w.id) ?? null,
      canManage: canManage(access, w.id),
      counts: w._count,
      members: w.members.map((m) => ({ id: m.id, role: m.role, createdAt: m.createdAt, user: m.user })),
    })),
  })
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : ''
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 300) : null
  if (!name) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

  const workspace = await prisma.workspace.create({
    data: {
      name,
      description: description || null,
      createdById: admin.id,
      members: { create: { userId: admin.id, role: 'OWNER', invitedByEmail: admin.email } },
    },
  })

  await auditAdminAction({
    actorId: admin.id,
    actorEmail: admin.email,
    action: 'workspace.create',
    entityType: 'Workspace',
    entityId: workspace.id,
    route: '/api/admin/workspaces',
    details: name,
    request,
  })
  return NextResponse.json({ ok: true, workspace: { id: workspace.id, name: workspace.name } })
}
