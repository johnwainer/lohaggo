import { NextRequest, NextResponse } from 'next/server'
import type { ConversationStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-utils'
import { canView, getWorkspaceAccess } from '@/lib/workspaces'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params

  const before = request.nextUrl.searchParams.get('before') // cursor: sentAt ISO string
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') || 60), 100)

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, role: true, image: true, phone: true, excludedFromMarketing: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      workspace: { select: { id: true, name: true } },
      connection: { select: { id: true, name: true, channel: true } },
      events: { orderBy: { createdAt: 'asc' }, take: 200 },
      tasks: { orderBy: [{ doneAt: 'asc' }, { createdAt: 'desc' }], take: 50 },
      messages: {
        orderBy: { sentAt: 'desc' },
        take: limit,
        ...(before ? { where: { sentAt: { lt: new Date(before) } } } : {}),
        include: { sentBy: { select: { id: true, name: true } } },
      },
    },
  })

  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const access = await getWorkspaceAccess(admin)
  if (!canView(access, conversation.workspaceId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Reverse to chronological order
  const messages = [...conversation.messages].reverse()
  const hasMore = conversation.messages.length === limit

  // Mark as read only on initial load (no before cursor)
  if (!before) {
    await prisma.conversation.update({ where: { id }, data: { unreadCount: 0 } })
  }

  return NextResponse.json({ conversation: { ...conversation, messages }, hasMore })
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await context.params
  const body = await request.json()

  const existing = await prisma.conversation.findUnique({ where: { id }, select: { workspaceId: true, status: true, assignedToId: true } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const access = await getWorkspaceAccess(admin)
  if (!canView(access, existing.workspaceId)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const data: Record<string, unknown> = {}
  if (body.status !== undefined) {
    data.status = body.status as ConversationStatus
    // Case closed by a person: a future message may be taken by the AI again
    if (body.status === 'RESOLVED' || body.status === 'CLOSED') Object.assign(data, { aiHandoffAt: null, priority: 'normal' })
  }
  if (body.assignedToId !== undefined) {
    const assignee = body.assignedToId ? String(body.assignedToId) : null
    if (assignee && !access.isSuperAdmin) {
      const member = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: existing.workspaceId, userId: assignee } } })
      if (!member) return NextResponse.json({ error: 'El agente no pertenece a este workspace' }, { status: 400 })
    }
    data.assignedToId = assignee
    // Choosing a person (or nobody) in the selector takes the conversation away from the AI
    data.aiHandled = false
  }
  if (body.contactName !== undefined) data.contactName = body.contactName
  if (body.tags !== undefined) data.tags = Array.isArray(body.tags) ? body.tags : []

  const conversation = await prisma.conversation.update({
    where: { id },
    data,
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  })

  // Immutable facts for the thread
  const actor = { conversationId: id, actorType: 'user', actorId: admin.id, actorName: admin.name }
  if (data.status !== undefined && data.status !== existing.status) {
    await prisma.conversationEvent.create({ data: { ...actor, type: 'status', detail: String(data.status) } })
  }
  if (data.assignedToId !== undefined && data.assignedToId !== existing.assignedToId) {
    await prisma.conversationEvent.create({ data: { ...actor, type: 'assigned', detail: conversation.assignedTo?.name || 'Sin asignar' } })
  }

  return NextResponse.json({ conversation })
}
