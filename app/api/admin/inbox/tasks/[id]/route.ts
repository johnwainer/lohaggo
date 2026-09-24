import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import { canView, getWorkspaceAccess } from '@/lib/workspaces'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const task = await prisma.conversationTask.findUnique({ where: { id: (await context.params).id } })
  if (!task) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  const access = await getWorkspaceAccess(admin)
  if (!canView(access, task.workspaceId)) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  const body = await request.json().catch(() => ({}))
  const updated = await prisma.conversationTask.update({ where: { id: task.id }, data: { doneAt: body.done ? new Date() : null } })
  return NextResponse.json({ task: updated })
}
