export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'
import { canManage, getWorkspaceAccess } from '@/lib/workspaces'

type RouteContext = { params: Promise<{ id: string }> }

function parseRole(value: unknown): 'OWNER' | 'MEMBER' | null {
  return value === 'OWNER' || value === 'MEMBER' ? value : null
}

async function guard(id: string) {
  const admin = await requireAdmin()
  if (!admin) return { admin: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const access = await getWorkspaceAccess(admin)
  if (!canManage(access, id)) return { admin, error: NextResponse.json({ error: 'Solo el propietario puede gestionar miembros' }, { status: 403 }) }
  return { admin, error: null }
}

async function ownersCount(workspaceId: string) {
  return prisma.workspaceMember.count({ where: { workspaceId, role: 'OWNER' } })
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const { admin, error } = await guard(id)
  if (error || !admin) return error
  const body = await request.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' ? body.userId : ''
  const role = parseRole(body.role) ?? 'MEMBER'
  if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, isActive: true, name: true } })
  if (!user || user.role !== 'ADMIN' || !user.isActive) return NextResponse.json({ error: 'Solo usuarios ADMIN activos pueden ser miembros' }, { status: 400 })

  const member = await prisma.workspaceMember.upsert({
    where: { workspaceId_userId: { workspaceId: id, userId } },
    create: { workspaceId: id, userId, role, invitedByEmail: admin.email },
    update: { role },
    include: { user: { select: { id: true, name: true, email: true, image: true, isActive: true } } },
  })

  await auditAdminAction({ actorId: admin.id, actorEmail: admin.email, action: 'workspace.member.add', entityType: 'Workspace', entityId: id, route: `/api/admin/workspaces/${id}/members`, details: `${user.name} → ${role}`, request })
  return NextResponse.json({ ok: true, member: { id: member.id, role: member.role, createdAt: member.createdAt, user: member.user } })
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const { admin, error } = await guard(id)
  if (error || !admin) return error
  const body = await request.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' ? body.userId : ''
  const role = parseRole(body.role)
  if (!userId || !role) return NextResponse.json({ error: 'userId y role requeridos' }, { status: 400 })

  const current = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: id, userId } } })
  if (!current) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  if (current.role === 'OWNER' && role === 'MEMBER' && (await ownersCount(id)) <= 1) {
    return NextResponse.json({ error: 'El workspace debe conservar al menos un propietario' }, { status: 400 })
  }

  const member = await prisma.workspaceMember.update({ where: { id: current.id }, data: { role } })
  await auditAdminAction({ actorId: admin.id, actorEmail: admin.email, action: 'workspace.member.role', entityType: 'Workspace', entityId: id, route: `/api/admin/workspaces/${id}/members`, details: `${userId} → ${role}`, request })
  return NextResponse.json({ ok: true, member: { id: member.id, role: member.role } })
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const { admin, error } = await guard(id)
  if (error || !admin) return error
  const userId = request.nextUrl.searchParams.get('userId') || ''
  if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })

  const current = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: id, userId } } })
  if (!current) return NextResponse.json({ error: 'Miembro no encontrado' }, { status: 404 })
  if (current.role === 'OWNER' && (await ownersCount(id)) <= 1) {
    return NextResponse.json({ error: 'No puedes quitar al único propietario' }, { status: 400 })
  }

  await prisma.workspaceMember.delete({ where: { id: current.id } })
  await prisma.conversation.updateMany({ where: { workspaceId: id, assignedToId: userId }, data: { assignedToId: null } })
  await auditAdminAction({ actorId: admin.id, actorEmail: admin.email, action: 'workspace.member.remove', entityType: 'Workspace', entityId: id, route: `/api/admin/workspaces/${id}/members`, details: userId, request })
  return NextResponse.json({ ok: true })
}
