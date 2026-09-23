export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { canManage, getWorkspaceAccess } from '@/lib/workspaces'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params
  const access = await getWorkspaceAccess(admin)
  if (!canManage(access, id)) return NextResponse.json({ error: 'Solo el propietario puede editar el workspace' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const data: { name?: string; description?: string | null } = {}
  if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 80)
  if (body.description !== undefined) data.description = typeof body.description === 'string' && body.description.trim() ? body.description.trim().slice(0, 300) : null
  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })

  const workspace = await prisma.workspace.update({ where: { id }, data }).catch(() => null)
  if (!workspace) return NextResponse.json({ error: 'Workspace no encontrado' }, { status: 404 })

  await auditAdminAction({ actorId: admin.id, actorEmail: admin.email, action: 'workspace.update', entityType: 'Workspace', entityId: id, route: `/api/admin/workspaces/${id}`, details: JSON.stringify(data), request })
  return NextResponse.json({ ok: true, workspace: { id: workspace.id, name: workspace.name, description: workspace.description } })
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params
  const access = await getWorkspaceAccess(admin)
  if (!canManage(access, id)) return NextResponse.json({ error: 'Solo el propietario puede eliminar el workspace' }, { status: 403 })

  const workspace = await prisma.workspace.findUnique({ where: { id }, include: { _count: { select: { connections: true, conversations: true } } } })
  if (!workspace) return NextResponse.json({ error: 'Workspace no encontrado' }, { status: 404 })
  if (workspace.isDefault) return NextResponse.json({ error: 'El workspace por defecto no se puede eliminar' }, { status: 400 })
  if (workspace._count.connections > 0 || workspace._count.conversations > 0) {
    return NextResponse.json({ error: 'Desconecta sus cuentas y vacía sus conversaciones antes de eliminarlo' }, { status: 409 })
  }

  await prisma.workspace.delete({ where: { id } })
  await auditAdminAction({ actorId: admin.id, actorEmail: admin.email, action: 'workspace.delete', entityType: 'Workspace', entityId: id, route: `/api/admin/workspaces/${id}`, details: workspace.name, request })
  return NextResponse.json({ ok: true })
}
