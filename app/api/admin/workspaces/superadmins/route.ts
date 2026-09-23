export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditAdminAction, requireAdmin } from '@/lib/admin-utils'

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!admin.isSuperAdmin) return NextResponse.json({ error: 'Solo un superadmin puede cambiar esto' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const userId = typeof body.userId === 'string' ? body.userId : ''
  const value = Boolean(body.isSuperAdmin)
  if (!userId) return NextResponse.json({ error: 'userId requerido' }, { status: 400 })

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, isActive: true, name: true } })
  if (!target || target.role !== 'ADMIN' || !target.isActive) return NextResponse.json({ error: 'Solo usuarios ADMIN activos' }, { status: 400 })

  if (!value) {
    const remaining = await prisma.user.count({ where: { isSuperAdmin: true, isActive: true, id: { not: userId } } })
    if (remaining === 0) return NextResponse.json({ error: 'Debe quedar al menos un superadmin' }, { status: 400 })
  }

  await prisma.user.update({ where: { id: userId }, data: { isSuperAdmin: value } })
  await auditAdminAction({ actorId: admin.id, actorEmail: admin.email, action: 'workspace.superadmin', entityType: 'User', entityId: userId, route: '/api/admin/workspaces/superadmins', details: `${target.name} → ${value}`, request })
  return NextResponse.json({ ok: true })
}
